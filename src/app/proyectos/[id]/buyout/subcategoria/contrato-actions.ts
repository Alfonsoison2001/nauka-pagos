"use server"

import { revalidatePath } from "next/cache"
import { getMyProfile } from "@/lib/auth/roles"
import { contratoBaseMxn } from "@/lib/buyout/pagos-link"
import { createClient } from "@/lib/supabase/server"

// Puente Buy-Out → Pagos (SPEC-buyout.md §8). Al marcar un concepto CONTRATADO,
// el admin crea/liga su contrato en la sección Presupuesto de Pagos y, después,
// puede re-sincronizar el monto. ALCANCE: estas actions SÍ insertan/actualizan en
// las tablas propias de Pagos (`contratistas`, `partidas`) reusando su estructura
// existente (mismas columnas, FKs, numeric(14,2), generated cols, soft-delete y
// triggers de audit) — NO modifican su esquema, RLS ni lógica. Admin-only.

export type ContratoResult =
  | { error: string }
  | { ok: true; partidaId: string; alreadyLinked?: boolean }

type Sb = Awaited<ReturnType<typeof createClient>>

/** La cotización vigente de un concepto + el renglón y TC para calcular el monto. */
type VigenteContrato = {
  quoteId: string
  contratado: boolean
  pagosPartidaId: string | null
  pdfPath: string | null
  conceptoNombre: string
  proveedor: string | null
  baseMxn: number
  ivaPct: number
  /** Fecha de la cotización vigente (quote_date, yyyy-mm-dd). Va a la fecha de la
   * partida de Pagos (`fecha_firma`). */
  quoteDate: string | null
}

/**
 * Carga, validando que el item pertenezca al proyecto, su cotización VIGENTE con
 * lo necesario para el puente: estado contratado, enlace actual, PDF, proveedor y
 * el monto (base sin IVA en MXN + iva_pct) de su renglón. Devuelve un error legible
 * si el concepto o su cotización/renglón no existen.
 */
async function loadVigenteContrato(
  sb: Sb,
  projectId: string,
  itemId: string,
): Promise<{ error: string } | { data: VigenteContrato }> {
  const { data: item } = await sb
    .from("buyout_item")
    .select("id, concepto")
    .eq("id", itemId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!item) return { error: "Concepto no encontrado." }

  const { data: quote } = await sb
    .from("buyout_quote")
    .select("id, contratado, pagos_partida_id, pdf_url, quote_date")
    .eq("item_id", itemId)
    .eq("is_selected", true)
    .is("deleted_at", null)
    .maybeSingle()
  if (!quote) return { error: "Este concepto no tiene una cotización vigente." }

  const { data: line } = await sb
    .from("buyout_line")
    .select("cantidad, unitario, sobrecosto_pct, iva_pct, moneda, proveedor")
    .eq("quote_id", quote.id as string)
    .is("deleted_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle()
  if (!line) return { error: "La cotización vigente no tiene renglón." }

  const { data: fxRows } = await sb
    .from("buyout_fx")
    .select("currency, rate")
    .eq("project_id", projectId)
    .is("deleted_at", null)
  const moneda = (line.moneda as string) ?? "MXN"
  const rate = (fxRows ?? []).find((r) => r.currency === moneda)?.rate
  const ivaPct = Number(line.iva_pct ?? 0)
  const baseMxn = contratoBaseMxn({
    cantidad: Number(line.cantidad ?? 0),
    unitario: Number(line.unitario ?? 0),
    sobrecosto_pct: Number(line.sobrecosto_pct ?? 0),
    iva_pct: ivaPct,
    tc: Number(rate ?? 1),
  })

  return {
    data: {
      quoteId: quote.id as string,
      contratado: Boolean(quote.contratado),
      pagosPartidaId: (quote.pagos_partida_id as string | null) ?? null,
      pdfPath: (quote.pdf_url as string | null) ?? null,
      conceptoNombre: (item.concepto as string) ?? "",
      proveedor: ((line.proveedor as string | null) ?? "").trim() || null,
      baseMxn,
      ivaPct,
      quoteDate: (quote.quote_date as string | null) ?? null,
    },
  }
}

/** Contratista de Pagos por (proyecto, nombre): lo busca o lo crea (mismo criterio
 * que la captura de Presupuesto de Pagos). */
async function resolveContratista(
  sb: Sb,
  projectId: string,
  nombre: string,
): Promise<{ id: string } | { error: string }> {
  const { data: existing } = await sb
    .from("contratistas")
    .select("id")
    .eq("project_id", projectId)
    .eq("nombre", nombre)
    .is("deleted_at", null)
    .maybeSingle()
  if (existing) return { id: existing.id as string }
  const { data: created, error } = await sb
    .from("contratistas")
    .insert({ project_id: projectId, nombre })
    .select("id")
    .single()
  if (error || !created) {
    return {
      error: error?.message ?? "Error al crear el contratista en Pagos.",
    }
  }
  return { id: created.id as string }
}

/** Copia el PDF de la cotización del Buy-Out a la ruta de PDF de la partida de
 * Pagos. NO fatal: si falla, el contrato queda igual (PDF es opcional). */
async function inheritPdf(
  sb: Sb,
  projectId: string,
  fromPath: string,
  partidaId: string,
): Promise<void> {
  const { data: blob } = await sb.storage.from("proyectos").download(fromPath)
  if (!blob) return
  const toPath = `${projectId}/presupuestos/${partidaId}.pdf`
  const { error } = await sb.storage
    .from("proyectos")
    .upload(toPath, blob, { upsert: true, contentType: "application/pdf" })
  if (error) return
  await sb
    .from("partidas")
    .update({ presupuesto_pdf_url: toPath })
    .eq("id", partidaId)
}

function revalidate(projectId: string): void {
  revalidatePath(`/proyectos/${projectId}/buyout`)
  revalidatePath(`/proyectos/${projectId}/buyout/partida`)
  revalidatePath(`/proyectos/${projectId}/buyout/subcategoria`)
  revalidatePath(`/proyectos/${projectId}/presupuesto`)
}

/**
 * Crea/liga el contrato de Pagos de un concepto CONTRATADO. Idempotente: si la
 * cotización vigente ya está ligada a una partida viva, no duplica. Resuelve el
 * contratista por el proveedor (lo crea si no existe), crea la partida (nombre =
 * concepto, presupuesto = base sin IVA en MXN, iva_pct del concepto, fecha =
 * quote_date de la vigente, hereda el PDF) y guarda el enlace en
 * `buyout_quote.pagos_partida_id`. Admin-only.
 */
export async function crearContratoPagos(
  projectId: string,
  itemId: string,
): Promise<ContratoResult> {
  const sb = await createClient()
  const profile = await getMyProfile()
  if (profile?.role !== "admin") {
    return { error: "Solo un administrador puede crear el contrato en Pagos." }
  }

  const loaded = await loadVigenteContrato(sb, projectId, itemId)
  if ("error" in loaded) return loaded
  const v = loaded.data

  if (!v.contratado) {
    return {
      error:
        "Marca la versión vigente como Contratada antes de ligarla a Pagos.",
    }
  }

  // Idempotencia: ¿la cotización vigente ya apunta a una partida VIVA de Pagos?
  if (v.pagosPartidaId) {
    const { data: existing } = await sb
      .from("partidas")
      .select("id")
      .eq("id", v.pagosPartidaId)
      .is("deleted_at", null)
      .maybeSingle()
    if (existing) {
      return { ok: true, partidaId: existing.id as string, alreadyLinked: true }
    }
    // Apunta a una partida borrada (p. ej. una prueba): se vuelve a crear abajo.
  }

  if (!v.proveedor) {
    return {
      error:
        "El concepto no tiene proveedor. Captúralo en la Partida antes de crear el contrato.",
    }
  }

  const contratista = await resolveContratista(sb, projectId, v.proveedor)
  if ("error" in contratista) return contratista

  // Una partida por concepto: si ya existe una con ese nombre bajo el contratista
  // (índice único (contratista_id, nombre)), la reutiliza sin pisar su monto; si
  // no, la crea con el monto/IVA/PDF del concepto.
  const { data: prior } = await sb
    .from("partidas")
    .select("id")
    .eq("contratista_id", contratista.id)
    .eq("nombre", v.conceptoNombre)
    .is("deleted_at", null)
    .maybeSingle()

  let partidaId: string
  if (prior) {
    partidaId = prior.id as string
  } else {
    const { data: created, error: insErr } = await sb
      .from("partidas")
      .insert({
        contratista_id: contratista.id,
        nombre: v.conceptoNombre,
        presupuesto_sin_iva: v.baseMxn,
        iva_pct: v.ivaPct,
        fecha_firma: v.quoteDate ?? null,
      })
      .select("id")
      .single()
    if (insErr || !created) {
      return { error: insErr?.message ?? "Error al crear la partida en Pagos." }
    }
    partidaId = created.id as string
    if (v.pdfPath) await inheritPdf(sb, projectId, v.pdfPath, partidaId)
  }

  const { error: linkErr } = await sb
    .from("buyout_quote")
    .update({ pagos_partida_id: partidaId })
    .eq("id", v.quoteId)
  if (linkErr) return { error: linkErr.message }

  revalidate(projectId)
  return { ok: true, partidaId }
}

/**
 * Re-sincroniza la partida de Pagos ligada con los datos ACTUALES del concepto:
 * presupuesto (base sin IVA en MXN), iva_pct y **fecha** (quote_date de la
 * cotización vigente). Completa la fecha si la partida estaba sin ella. No toca
 * nombre/contratista/PDF. Admin-only.
 */
export async function resincronizarContratoPagos(
  projectId: string,
  itemId: string,
): Promise<ContratoResult> {
  const sb = await createClient()
  const profile = await getMyProfile()
  if (profile?.role !== "admin") {
    return { error: "Solo un administrador puede re-sincronizar el contrato." }
  }

  const loaded = await loadVigenteContrato(sb, projectId, itemId)
  if ("error" in loaded) return loaded
  const v = loaded.data

  if (!v.pagosPartidaId) {
    return { error: "Este concepto aún no está ligado a Pagos." }
  }
  const { data: partida } = await sb
    .from("partidas")
    .select("id")
    .eq("id", v.pagosPartidaId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!partida) {
    return {
      error:
        "La partida ligada ya no existe en Pagos (se eliminó). Vuelve a crear el contrato.",
    }
  }

  const { error: updErr } = await sb
    .from("partidas")
    .update({
      presupuesto_sin_iva: v.baseMxn,
      iva_pct: v.ivaPct,
      fecha_firma: v.quoteDate ?? null,
    })
    .eq("id", partida.id)
    .is("deleted_at", null)
  if (updErr) return { error: updErr.message }

  revalidate(projectId)
  return { ok: true, partidaId: partida.id as string }
}
