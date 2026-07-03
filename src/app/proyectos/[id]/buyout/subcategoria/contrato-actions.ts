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
  /** Base sin IVA en MXN: Σ de TODAS las líneas vivas de la vigente (C1). */
  baseMxn: number
  ivaPct: number
  /** Fecha de la cotización vigente (quote_date, yyyy-mm-dd). Va a la fecha de la
   * partida de Pagos (`fecha_firma`). */
  quoteDate: string | null
}

/**
 * Carga, validando que el item pertenezca al proyecto, su cotización VIGENTE con
 * lo necesario para el puente: estado contratado, enlace actual, PDF, proveedor y
 * el monto (base sin IVA en MXN + iva_pct) sumando TODAS sus líneas vivas (C1).
 * Devuelve un error legible si el concepto o su cotización/renglones no existen.
 */
async function loadVigenteContrato(
  sb: Sb,
  projectId: string,
  itemId: string,
): Promise<{ error: string } | { data: VigenteContrato }> {
  // BO-08: cada select que alimenta el cálculo del dinero revisa su `.error`. Un
  // error de Supabase (red/timeout/RLS) NO es "no encontrado": confundirlo con null
  // nos haría seguir al cálculo/escritura con datos faltantes. Ante error de lectura
  // abortamos con un mensaje DISTINTO del "no existe".
  const { data: item, error: itemErr } = await sb
    .from("buyout_item")
    .select("id, concepto")
    .eq("id", itemId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle()
  if (itemErr) return { error: `Error al leer el concepto: ${itemErr.message}` }
  if (!item) return { error: "Concepto no encontrado." }

  const { data: quote, error: quoteErr } = await sb
    .from("buyout_quote")
    .select("id, contratado, pagos_partida_id, pdf_url, quote_date")
    .eq("item_id", itemId)
    .eq("is_selected", true)
    .is("deleted_at", null)
    .maybeSingle()
  if (quoteErr) {
    return { error: `Error al leer la cotización vigente: ${quoteErr.message}` }
  }
  if (!quote) return { error: "Este concepto no tiene una cotización vigente." }

  // C1 (audit 2026-07-03): la cotización vigente puede tener VARIAS líneas
  // vivas (BF: una por torre). El monto del contrato es la SUMA de TODAS —
  // misma base por línea que el rollup del Resumen (contratoBaseMxn = calcLinea
  // + TC por la moneda de la línea) → el total con IVA de Pagos cuadra con lo
  // que muestran Resumen/Partida. Antes se tomaba solo la 1ª línea y un
  // concepto de 2 torres escribía ~la mitad a Pagos.
  const { data: lineRows, error: lineErr } = await sb
    .from("buyout_line")
    .select("cantidad, unitario, sobrecosto_pct, iva_pct, moneda, proveedor")
    .eq("quote_id", quote.id as string)
    .is("deleted_at", null)
    .order("created_at")
  if (lineErr) {
    return { error: `Error al leer los renglones: ${lineErr.message}` }
  }
  const lines = lineRows ?? []
  if (lines.length === 0) {
    return { error: "La cotización vigente no tiene renglón." }
  }

  const { data: fxRows, error: fxErr } = await sb
    .from("buyout_fx")
    .select("currency, rate")
    .eq("project_id", projectId)
    .is("deleted_at", null)
  if (fxErr)
    return { error: `Error al leer el tipo de cambio: ${fxErr.message}` }

  // El contrato de Pagos es UNO (un contratista + un solo iva_pct en
  // `partidas`): si las líneas difieren en proveedor o IVA no hay mapeo fiel →
  // se aborta con un mensaje claro en vez de escribir una aproximación (esto
  // escribe dinero en Pagos). Con líneas homogéneas (el caso real: mismas
  // condiciones por torre) se comporta idéntico a antes.
  const provs = [
    ...new Set(
      lines
        .map((l) => ((l.proveedor as string | null) ?? "").trim())
        .filter(Boolean),
    ),
  ]
  if (provs.length > 1) {
    return {
      error: `Las líneas de la cotización vigente tienen proveedores distintos (${provs.join(" / ")}). El contrato de Pagos lleva un solo contratista: unifica el proveedor antes de ligar.`,
    }
  }
  const ivas = [...new Set(lines.map((l) => Number(l.iva_pct ?? 0)))]
  if (ivas.length > 1) {
    return {
      error:
        "Las líneas de la cotización vigente tienen IVAs distintos. El contrato de Pagos lleva un solo IVA: unifícalos antes de ligar.",
    }
  }
  const ivaPct = ivas[0]

  // BO-01, ahora POR LÍNEA: el factor 1 solo es legítimo para MXN. Divisa sin
  // TC configurado → se aborta (escribiría a Pagos un monto ~17-20× subestimado,
  // en silencio). Mismo mensaje que antes.
  let baseMxn = 0
  for (const line of lines) {
    const moneda = (line.moneda as string) ?? "MXN"
    let tc: number
    if (moneda === "MXN") {
      tc = 1
    } else {
      const rate = (fxRows ?? []).find((r) => r.currency === moneda)?.rate
      const rateNum = Number(rate)
      if (rate == null || !Number.isFinite(rateNum) || rateNum <= 0) {
        return {
          error: `Falta (o es inválido) el tipo de cambio de ${moneda} en este proyecto. Configúralo en Buy-Out antes de crear o re-sincronizar el contrato en Pagos.`,
        }
      }
      tc = rateNum
    }
    baseMxn += contratoBaseMxn({
      cantidad: Number(line.cantidad ?? 0),
      unitario: Number(line.unitario ?? 0),
      sobrecosto_pct: Number(line.sobrecosto_pct ?? 0),
      iva_pct: ivaPct,
      tc,
    })
  }
  // Σ de montos ya redondeados a 2 dec por línea; re-redondeo para limpiar el
  // polvo binario de la suma antes de escribir a numeric(14,2).
  baseMxn = Math.round(baseMxn * 100) / 100

  return {
    data: {
      quoteId: quote.id as string,
      contratado: Boolean(quote.contratado),
      pagosPartidaId: (quote.pagos_partida_id as string | null) ?? null,
      pdfPath: (quote.pdf_url as string | null) ?? null,
      conceptoNombre: (item.concepto as string) ?? "",
      proveedor: provs[0] ?? null,
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

/**
 * BO-02: ¿alguna cotización del puente (no borrada) está ligada a esta partida de
 * Pagos (`buyout_quote.pagos_partida_id = partidaId`)? Sirve para NO adoptar ni
 * pisar una partida capturada MANUALMENTE en Pagos que solo coincide en nombre: el
 * puente reutiliza una partida únicamente si él la creó/ligó. Solo LEE una tabla
 * propia del Buy-Out; no toca el esquema/lógica de Pagos.
 */
async function partidaLigadaAlPuente(
  sb: Sb,
  partidaId: string,
): Promise<{ linked: boolean } | { error: string }> {
  const { data, error } = await sb
    .from("buyout_quote")
    .select("id")
    .eq("pagos_partida_id", partidaId)
    .is("deleted_at", null)
    .limit(1)
  if (error) {
    return {
      error: `No se pudo verificar el origen de la partida en Pagos: ${error.message}`,
    }
  }
  return { linked: (data ?? []).length > 0 }
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

  // Una partida por concepto: si ya existe una VIVA con ese nombre bajo el
  // contratista (índice único (contratista_id, nombre)), puede ser la del puente o
  // una capturada MANUALMENTE en Pagos. Solo reutilizamos la del puente; si no, la
  // creamos.
  const { data: prior } = await sb
    .from("partidas")
    .select("id")
    .eq("contratista_id", contratista.id)
    .eq("nombre", v.conceptoNombre)
    .is("deleted_at", null)
    .maybeSingle()

  let partidaId: string
  if (prior) {
    // BO-02: NO adoptar/pisar una partida manual de Pagos por coincidencia de
    // nombre. Solo reutilizamos `prior` si ya está ligada a una cotización del
    // puente; si es manual, el índice único (contratista_id, nombre) impide crear
    // otra con el mismo nombre → avisamos para que el admin la renombre o la ligue
    // a mano (nunca la sobrescribimos).
    const owned = await partidaLigadaAlPuente(sb, prior.id as string)
    if ("error" in owned) return owned
    if (!owned.linked) {
      return {
        error: `Ya existe una partida «${v.conceptoNombre}» capturada manualmente en Pagos bajo el contratista «${v.proveedor}». El puente no la sobrescribe: renómbrala o lígala manualmente antes de crear el contrato desde Buy-Out.`,
      }
    }
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

  // BO-02: re-sincronizar solo escribe sobre una partida que el puente creó/ligó,
  // nunca sobre una partida MANUAL de Pagos. Tras el fix de creación, el enlace solo
  // apunta a partidas del puente; esta verificación lo refuerza antes de sobrescribir
  // monto/IVA/fecha.
  const owned = await partidaLigadaAlPuente(sb, partida.id as string)
  if ("error" in owned) return owned
  if (!owned.linked) {
    return {
      error:
        "La partida ligada no fue creada por el puente; no se re-sincroniza para no sobrescribir datos capturados manualmente en Pagos.",
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
