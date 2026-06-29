"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// Tipos compartidos con los componentes cliente
// ---------------------------------------------------------------------------

// `warning` (opcional) = la operación guardó el dato crítico pero algo secundario
// y no-fatal falló (p. ej. el PDF opcional). La línea queda guardada; el aviso es
// para reintentar. Quien no lo lea ve `ok: true` y trata todo como éxito (BO-10).
export type ActionResult = { error: string } | { ok: true; warning?: string }

export type SupplierOption = { id: string; nombre: string }
export type UnitOption = { id: string; nombre: string }
export type UomOption = { codigo: string; nombre: string }
export type CurrencyOption = { currency: string; rate: number }
export type PartidaOption = { id: string; nombre: string }
export type ConceptoOption = { id: string; nombre: string }

/** Una línea capturada = renglón (22 col) + los campos de su cotización vigente. */
export type LineaRow = {
  id: string
  quote_id: string
  item_id: string
  concepto: string
  detalle: string | null
  villa_casita: string | null
  piso: string | null
  depto: string | null
  proveedor: string | null
  unidad: string | null
  cantidad: number
  moneda: string
  unitario: number
  sobrecosto_pct: number
  iva_pct: number
  notas: string | null
  kind: "parametrico" | "ppto"
  contratado: boolean
  quote_date: string
  pdf_url: string | null
  supplier_id: string | null
}

type Sb = Awaited<ReturnType<typeof createClient>>

const PDF_MAX_BYTES = 10 * 1024 * 1024

// ---------------------------------------------------------------------------
// Schema (entradas del formato verde; los % llegan como 0-100 y se guardan como fracción)
// ---------------------------------------------------------------------------

const baseSchema = z.object({
  concepto: z.string().trim().min(1, "Concepto requerido"),
  detalle: z.string().trim().optional(),
  unit_id: z.string().trim().optional(),
  piso: z.string().trim().optional(),
  depto: z.string().trim().optional(),
  supplier_id: z.string().trim().optional(),
  supplier_nombre: z.string().trim().optional(),
  unidad: z.string().trim().optional(),
  cantidad: z.coerce.number().min(0, "Cantidad ≥ 0"),
  moneda: z.enum(["MXN", "USD", "EUR"]).default("MXN"),
  unitario: z.coerce.number().min(0, "Unitario ≥ 0"),
  sobrecosto_pct: z.coerce.number().min(0).max(100).default(0),
  iva_pct: z.coerce.number().min(0).max(100).default(16),
  notas: z.string().trim().optional(),
  madurez: z.enum(["parametrico", "ppto"]).default("ppto"),
  contratado: z.enum(["contratado", "no_contratado"]).default("no_contratado"),
  quote_date: z.string().trim().optional(),
})

const createSchema = baseSchema.extend({
  partida_catalog_id: z.string().trim().min(1, "Partida requerida"),
})

function parseForm(fd: FormData): Record<string, unknown> {
  const get = (k: string) => (fd.get(k) as string) || undefined
  return {
    partida_catalog_id: get("partida_catalog_id"),
    concepto: fd.get("concepto"),
    detalle: get("detalle"),
    unit_id: get("unit_id"),
    piso: get("piso"),
    depto: get("depto"),
    supplier_id: get("supplier_id"),
    supplier_nombre: get("supplier_nombre"),
    unidad: get("unidad"),
    cantidad: fd.get("cantidad"),
    moneda: get("moneda") ?? "MXN",
    unitario: fd.get("unitario"),
    sobrecosto_pct: fd.get("sobrecosto_pct"),
    iva_pct: fd.get("iva_pct"),
    notas: get("notas"),
    madurez: get("madurez") ?? "ppto",
    contratado: get("contratado") ?? "no_contratado",
    quote_date: get("quote_date"),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Proveedor global: usa el elegido, crea al vuelo, o null (paramétrico). */
async function resolveSupplier(
  sb: Sb,
  supplierId: string | undefined,
  supplierNombre: string | undefined,
): Promise<{ id: string | null; nombre: string | null } | { error: string }> {
  if (supplierId && supplierId !== "crear_nuevo" && supplierId !== "ninguno") {
    const { data } = await sb
      .from("buyout_supplier")
      .select("nombre")
      .eq("id", supplierId)
      .is("deleted_at", null)
      .maybeSingle()
    return { id: supplierId, nombre: (data?.nombre as string) ?? null }
  }
  const nombre = supplierNombre?.trim()
  if (!nombre) return { id: null, nombre: null }
  const { data: existing } = await sb
    .from("buyout_supplier")
    .select("id, nombre")
    .ilike("nombre", nombre)
    .is("deleted_at", null)
    .maybeSingle()
  if (existing) {
    return { id: existing.id as string, nombre: existing.nombre as string }
  }
  const { data: created, error } = await sb
    .from("buyout_supplier")
    .insert({ nombre })
    .select("id, nombre")
    .single()
  if (error || !created) {
    return { error: error?.message ?? "Error al crear proveedor" }
  }
  return { id: created.id as string, nombre: created.nombre as string }
}

/** Nombre de partida + capítulo del proyecto (por chapter_default → buyout_chapter). */
async function resolvePartidaMeta(
  sb: Sb,
  projectId: string,
  partidaCatalogId: string,
): Promise<{ nombre: string; chapterId: string | null }> {
  const { data: cat } = await sb
    .from("buyout_partida_catalog")
    .select("nombre, chapter_default")
    .eq("id", partidaCatalogId)
    .maybeSingle()
  const nombre = (cat?.nombre as string) ?? ""
  let chapterId: string | null = null
  if (cat?.chapter_default) {
    const { data: ch } = await sb
      .from("buyout_chapter")
      .select("id")
      .eq("project_id", projectId)
      .eq("nombre", cat.chapter_default as string)
      .is("deleted_at", null)
      .maybeSingle()
    chapterId = (ch?.id as string) ?? null
  }
  return { nombre, chapterId }
}

async function resolveUnitName(
  sb: Sb,
  unitId: string | undefined,
): Promise<string | null> {
  if (!unitId) return null
  const { data } = await sb
    .from("buyout_unit")
    .select("nombre")
    .eq("id", unitId)
    .maybeSingle()
  return (data?.nombre as string) ?? null
}

async function uploadBuyoutPdf(
  sb: Sb,
  file: File,
  projectId: string,
  quoteId: string,
): Promise<{ path: string } | { error: string }> {
  if (file.size > PDF_MAX_BYTES)
    return { error: "El PDF debe pesar máximo 10 MB" }
  if (file.type !== "application/pdf")
    return { error: "Solo se aceptan archivos PDF" }
  const path = `${projectId}/buyout/${quoteId}.pdf`
  const { error } = await sb.storage
    .from("proyectos")
    .upload(path, file, { upsert: true, contentType: "application/pdf" })
  if (error) return { error: `Error subiendo PDF: ${error.message}` }
  return { path }
}

// ---------------------------------------------------------------------------
// Helper compartido: cotización VIGENTE (baja la anterior) + su renglón.
// Lo usan createLinea (concepto nuevo) y addBudgetVersion (nueva versión).
// ---------------------------------------------------------------------------

type ParsedLinea = z.infer<typeof baseSchema>

async function insertVigenteQuoteAndLine(
  sb: Sb,
  projectId: string,
  itemId: string,
  conceptoNombre: string,
  partidaNombre: string,
  sup: { id: string | null; nombre: string | null },
  villaCasita: string | null,
  d: ParsedLinea,
  pdfFile: File | null,
): Promise<ActionResult> {
  // Baja la vigente anterior del item (índice único: 1 vigente por item).
  await sb
    .from("buyout_quote")
    .update({ is_selected: false })
    .eq("item_id", itemId)
    .eq("is_selected", true)
    .is("deleted_at", null)

  const { data: quote, error: quoteErr } = await sb
    .from("buyout_quote")
    .insert({
      item_id: itemId,
      supplier_id: sup.id,
      quote_date: d.quote_date || undefined,
      currency: d.moneda,
      kind: d.madurez,
      is_selected: true,
      contratado: d.contratado === "contratado",
      monto_sin_iva: d.cantidad * d.unitario,
      iva_pct: d.iva_pct / 100,
      notas: d.notas ?? null,
    })
    .select("id")
    .single()
  if (quoteErr || !quote) {
    return { error: quoteErr?.message ?? "Error al crear la cotización" }
  }
  const quoteId = quote.id as string
  await sb
    .from("buyout_item")
    .update({ selected_quote_id: quoteId })
    .eq("id", itemId)

  // La LÍNEA va PRIMERO: es el dato crítico (sin renglón, el join por quote_id no
  // devuelve nada y el concepto DESAPARECE del rollup). El PDF es opcional y se
  // sube DESPUÉS, sin poder tumbar la línea ya guardada (BO-10).
  const { error: lineErr } = await sb.from("buyout_line").insert({
    quote_id: quoteId,
    categoria: partidaNombre,
    concepto: conceptoNombre,
    detalle: d.detalle ?? null,
    villa_casita: villaCasita,
    piso: d.piso ?? null,
    depto: d.depto ?? null,
    proveedor: sup.nombre,
    unidad: d.unidad ?? null,
    cantidad: d.cantidad,
    moneda: d.moneda,
    unitario: d.unitario,
    sobrecosto_pct: d.sobrecosto_pct / 100,
    iva_pct: d.iva_pct / 100,
    notas: d.notas ?? null,
  })
  if (lineErr) return { error: lineErr.message }

  // PDF al final: un fallo NO aborta (la línea ya está guardada). Se avisa para
  // reintentar subiéndolo al editar la línea. El PDF es opcional/progresivo.
  if (pdfFile && pdfFile.size > 0) {
    const up = await uploadBuyoutPdf(sb, pdfFile, projectId, quoteId)
    if ("error" in up) {
      return {
        ok: true,
        warning: `La línea se guardó, pero el PDF no se subió (${up.error}). Ábrela con “Editar” para reintentar la subida.`,
      }
    }
    await sb.from("buyout_quote").update({ pdf_url: up.path }).eq("id", quoteId)
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// createLinea — "Agregar": SIEMPRE crea un concepto NUEVO (buyout_item nuevo)
// ---------------------------------------------------------------------------

export async function createLinea(
  projectId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createSchema.safeParse(parseForm(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const d = parsed.data
  const sb = await createClient()

  const sup = await resolveSupplier(sb, d.supplier_id, d.supplier_nombre)
  if ("error" in sup) return { error: sup.error }
  const { nombre: partidaNombre, chapterId } = await resolvePartidaMeta(
    sb,
    projectId,
    d.partida_catalog_id,
  )
  const unitId = d.unit_id || null
  const villaCasita = await resolveUnitName(sb, unitId ?? undefined)

  const { data: item, error: itemErr } = await sb
    .from("buyout_item")
    .insert({
      project_id: projectId,
      partida_catalog_id: d.partida_catalog_id,
      chapter_id: chapterId,
      concepto: d.concepto,
      unit_id: unitId,
    })
    .select("id")
    .single()
  if (itemErr || !item) {
    return { error: itemErr?.message ?? "Error al crear el concepto" }
  }

  const res = await insertVigenteQuoteAndLine(
    sb,
    projectId,
    item.id as string,
    d.concepto,
    partidaNombre,
    sup,
    villaCasita,
    d,
    formData.get("pdf") as File | null,
  )
  if ("error" in res) return res
  revalidatePath(`/proyectos/${projectId}/buyout/partida`)
  return res // propaga el aviso si la línea se guardó pero el PDF no subió (BO-10)
}

// ---------------------------------------------------------------------------
// addBudgetVersion — "Actualizar presupuesto": nueva versión sobre el MISMO
// concepto (item existente). Marca la nueva vigente, conserva la anterior.
// ---------------------------------------------------------------------------

export async function addBudgetVersion(
  itemId: string,
  projectId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = baseSchema.safeParse(parseForm(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const d = parsed.data
  const sb = await createClient()

  // La partida se fija desde el item; el concepto es el de la línea vigente
  // (lo envía el form, bloqueado). Así no diverge si la línea se editó antes.
  const { data: item } = await sb
    .from("buyout_item")
    .select("id, partida_catalog_id")
    .eq("id", itemId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!item) return { error: "Concepto no encontrado" }

  const sup = await resolveSupplier(sb, d.supplier_id, d.supplier_nombre)
  if ("error" in sup) return { error: sup.error }
  const { nombre: partidaNombre } = await resolvePartidaMeta(
    sb,
    projectId,
    item.partida_catalog_id as string,
  )
  const villaCasita = await resolveUnitName(sb, d.unit_id || undefined)

  const res = await insertVigenteQuoteAndLine(
    sb,
    projectId,
    itemId,
    d.concepto,
    partidaNombre,
    sup,
    villaCasita,
    d,
    formData.get("pdf") as File | null,
  )
  if ("error" in res) return res
  revalidatePath(`/proyectos/${projectId}/buyout/partida`)
  return res // propaga el aviso si la línea se guardó pero el PDF no subió (BO-10)
}

// ---------------------------------------------------------------------------
// updateLinea — edita la línea + su cotización vigente en sitio
// ---------------------------------------------------------------------------

export async function updateLinea(
  lineId: string,
  quoteId: string,
  projectId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = baseSchema.safeParse(parseForm(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const d = parsed.data
  const sb = await createClient()

  const sup = await resolveSupplier(sb, d.supplier_id, d.supplier_nombre)
  if ("error" in sup) return { error: sup.error }
  const villaCasita = await resolveUnitName(sb, d.unit_id || undefined)

  const { error: quoteErr } = await sb
    .from("buyout_quote")
    .update({
      supplier_id: sup.id,
      quote_date: d.quote_date || undefined,
      currency: d.moneda,
      kind: d.madurez,
      contratado: d.contratado === "contratado",
      monto_sin_iva: d.cantidad * d.unitario,
      iva_pct: d.iva_pct / 100,
      notas: d.notas ?? null,
    })
    .eq("id", quoteId)
    .is("deleted_at", null)
  if (quoteErr) return { error: quoteErr.message }

  const pdfFile = formData.get("pdf") as File | null
  if (pdfFile && pdfFile.size > 0) {
    const up = await uploadBuyoutPdf(sb, pdfFile, projectId, quoteId)
    if ("error" in up) return { error: up.error }
    await sb.from("buyout_quote").update({ pdf_url: up.path }).eq("id", quoteId)
  }

  const { error: lineErr } = await sb
    .from("buyout_line")
    .update({
      concepto: d.concepto,
      detalle: d.detalle ?? null,
      villa_casita: villaCasita,
      piso: d.piso ?? null,
      depto: d.depto ?? null,
      proveedor: sup.nombre,
      unidad: d.unidad ?? null,
      cantidad: d.cantidad,
      moneda: d.moneda,
      unitario: d.unitario,
      sobrecosto_pct: d.sobrecosto_pct / 100,
      iva_pct: d.iva_pct / 100,
      notas: d.notas ?? null,
    })
    .eq("id", lineId)
    .is("deleted_at", null)
  if (lineErr) return { error: lineErr.message }

  revalidatePath(`/proyectos/${projectId}/buyout/partida`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// deleteLinea — soft-delete línea + cotización; promueve versión previa o baja el item
// ---------------------------------------------------------------------------

export async function deleteLinea(
  lineId: string,
  quoteId: string,
  itemId: string,
  projectId: string,
): Promise<ActionResult> {
  const sb = await createClient()
  const now = new Date().toISOString()

  const { error: lineErr } = await sb
    .from("buyout_line")
    .update({ deleted_at: now })
    .eq("id", lineId)
    .is("deleted_at", null)
  if (lineErr) return { error: lineErr.message }

  await sb
    .from("buyout_quote")
    .update({ deleted_at: now, is_selected: false })
    .eq("id", quoteId)

  // ¿Quedan versiones (cotizaciones) de este concepto? Promueve la más reciente.
  const { data: prev } = await sb
    .from("buyout_quote")
    .select("id")
    .eq("item_id", itemId)
    .is("deleted_at", null)
    .order("quote_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (prev) {
    await sb
      .from("buyout_quote")
      .update({ is_selected: true })
      .eq("id", prev.id)
    await sb
      .from("buyout_item")
      .update({ selected_quote_id: prev.id })
      .eq("id", itemId)
  } else {
    await sb
      .from("buyout_item")
      .update({ deleted_at: now, selected_quote_id: null })
      .eq("id", itemId)
  }

  revalidatePath(`/proyectos/${projectId}/buyout/partida`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// getSignedBuyoutPdfUrl — URL firmada para ver el PDF de la cotización
// ---------------------------------------------------------------------------

export async function getSignedBuyoutPdfUrl(
  pdfPath: string,
): Promise<string | null> {
  const sb = await createClient()
  const { data } = await sb.storage
    .from("proyectos")
    .createSignedUrl(pdfPath, 60 * 5)
  return data?.signedUrl ?? null
}
