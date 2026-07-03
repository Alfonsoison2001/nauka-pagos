"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getMyProfile } from "@/lib/auth/roles"
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
// Opción genérica valor/etiqueta (torres y deptos derivados de buyout_unit en BF).
export type KVOption = { value: string; label: string }
export type UnitMode = "villa" | "torre"
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

// ---------------------------------------------------------------------------
// Schema (entradas del formato verde; los % llegan como 0-100 y se guardan como fracción)
// ---------------------------------------------------------------------------

const baseSchema = z.object({
  concepto: z.string().trim().min(1, "Concepto requerido"),
  detalle: z.string().trim().optional(),
  unit_id: z.string().trim().optional(),
  // BF: la torre llega como texto ("Torre 1"/"Torre 2"). En L3/L44 no se usa
  // (la villa/casita va por unit_id). Se guarda directo en `villa_casita`.
  torre: z.string().trim().optional(),
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
  // Ruta del PDF que el NAVEGADOR ya subió directo a Storage (no el archivo).
  // El Server Action recibe solo el string → su body queda chico (se salta el
  // límite de Server Actions y el de Vercel). Se valida su forma en el server.
  pdf_path: z.string().trim().optional(),
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
    torre: get("torre"),
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
    pdf_path: get("pdf_path"),
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

/**
 * El PDF ya NO viaja por el Server Action: el navegador lo sube DIRECTO a
 * Storage (RLS admin-only) y nos manda solo su RUTA. Aquí solo validamos que la
 * ruta tenga la forma esperada —dentro de la carpeta `buyout/` de ESTE
 * proyecto, con sufijo `.pdf` y sin travesía de rutas— antes de guardarla en
 * `buyout_quote.pdf_url`. Devuelve la ruta si es válida, o null (sin PDF).
 */
function safeBuyoutPdfPath(
  projectId: string,
  raw: string | undefined,
): string | null {
  if (!raw) return null
  const prefix = `${projectId}/buyout/`
  if (raw.startsWith(prefix) && raw.endsWith(".pdf") && !raw.includes(".."))
    return raw
  return null
}

/**
 * Revalida las pantallas del Buy-Out que dependen de las líneas de una partida:
 * Resumen (total/rollup/parcial/% Contratación), Partida (tabla), Subcategoría
 * (historial/índice) y Glosario (contadores "con datos" por partida/concepto).
 * Un alta/edición/borrado/toggle/versión de línea debe reflejarse en las cuatro (M1).
 */
function revalidateEstado(projectId: string) {
  revalidatePath(`/proyectos/${projectId}/buyout`)
  revalidatePath(`/proyectos/${projectId}/buyout/partida`)
  revalidatePath(`/proyectos/${projectId}/buyout/subcategoria`)
  revalidatePath(`/proyectos/${projectId}/buyout/glosario`)
}

/**
 * Guard admin server-side (además lo refuerza la RLS `is_admin()` de las tablas
 * `buyout_*`). Devuelve un mensaje si no es admin, o null si puede continuar.
 */
async function requireAdmin(): Promise<string | null> {
  const profile = await getMyProfile()
  if (profile?.role !== "admin") {
    return "Solo un administrador puede editar el estado."
  }
  return null
}

// ---------------------------------------------------------------------------
// Helper compartido: cotización VIGENTE (baja la anterior) + su renglón.
// Lo usan createLinea (concepto nuevo) y addBudgetVersion (nueva versión).
// ---------------------------------------------------------------------------

type ParsedLinea = z.infer<typeof baseSchema>

async function insertVigenteQuoteAndLine(
  sb: Sb,
  itemId: string,
  conceptoNombre: string,
  partidaNombre: string,
  sup: { id: string | null; nombre: string | null },
  villaCasita: string | null,
  d: ParsedLinea,
  pdfPath: string | null,
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
      // El PDF ya está en Storage (subida directa del navegador). Su ruta se
      // conoce ANTES del insert, así que va en la MISMA fila (atómico): no hay
      // paso de subida posterior que pueda fallar y dejar el renglón huérfano.
      pdf_url: pdfPath,
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

  // La LÍNEA es el dato crítico: sin renglón, el join por quote_id no devuelve
  // nada y el concepto DESAPARECE del rollup. Se inserta tras crear la cotización.
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
  // BF: la torre viene como texto y se guarda directo en `villa_casita` (no hay
  // buyout_unit de torre → el item no lleva unit_id). L3/L44: villa/casita por unit_id.
  const torre = d.torre?.trim() || null
  const unitId = torre ? null : d.unit_id || null
  const villaCasita = torre ?? (await resolveUnitName(sb, unitId ?? undefined))

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
    item.id as string,
    d.concepto,
    partidaNombre,
    sup,
    villaCasita,
    d,
    safeBuyoutPdfPath(projectId, d.pdf_path),
  )
  if ("error" in res) return res
  // M1 — revalida Resumen + Partida + Subcategoría + Glosario (un concepto/versión
  // nuevo cambia el total del rollup y los contadores del Glosario, no solo /partida).
  revalidateEstado(projectId)
  return res
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
  const villaCasita =
    d.torre?.trim() || (await resolveUnitName(sb, d.unit_id || undefined))

  const res = await insertVigenteQuoteAndLine(
    sb,
    itemId,
    d.concepto,
    partidaNombre,
    sup,
    villaCasita,
    d,
    safeBuyoutPdfPath(projectId, d.pdf_path),
  )
  if ("error" in res) return res
  // M1 — revalida Resumen + Partida + Subcategoría + Glosario (un concepto/versión
  // nuevo cambia el total del rollup y los contadores del Glosario, no solo /partida).
  revalidateEstado(projectId)
  return res
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
  const villaCasita =
    d.torre?.trim() || (await resolveUnitName(sb, d.unit_id || undefined))

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

  // El navegador ya subió el PDF nuevo directo a Storage; solo guardamos su ruta.
  // Sin ruta nueva → NO se toca pdf_url (se conserva el PDF anterior, si había).
  const pdfPath = safeBuyoutPdfPath(projectId, d.pdf_path)
  if (pdfPath) {
    await sb.from("buyout_quote").update({ pdf_url: pdfPath }).eq("id", quoteId)
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
      // Estado POR LÍNEA (además del de la cotización, arriba): el rollup lee el
      // de la línea con fallback a la cotización, así que sin esto el cambio de
      // estado NO se reflejaba en líneas con estado por-línea (BF por torre).
      kind: d.madurez,
      contratado: d.contratado === "contratado",
    })
    .eq("id", lineId)
    .is("deleted_at", null)
  if (lineErr) return { error: lineErr.message }

  revalidateEstado(projectId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// deleteLinea — soft-delete SOLO esa línea; limpia cotización/item vacíos únicamente
// si era la ÚLTIMA línea viva del concepto (no toca las hermanas de otras torres).
// ---------------------------------------------------------------------------

export async function deleteLinea(
  lineId: string,
  quoteId: string,
  itemId: string,
  projectId: string,
): Promise<ActionResult> {
  const guard = await requireAdmin()
  if (guard) return { error: guard }
  const sb = await createClient()

  // L1 — Scoping: el concepto (item) debe pertenecer a ESTE proyecto antes de
  // tocar sus líneas/cotizaciones. La RLS `buyout_*` gatea por admin GLOBAL, no
  // por proyecto → sin esto, ids de otro proyecto pasarían.
  const { data: item, error: itemErr } = await sb
    .from("buyout_item")
    .select("id")
    .eq("id", itemId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle()
  if (itemErr)
    return { error: `Error al validar el concepto: ${itemErr.message}` }
  if (!item) return { error: "Concepto no encontrado en este proyecto." }

  const now = new Date().toISOString()

  // 1) Soft-delete SOLO esta línea (por su id). Las líneas hermanas del mismo
  //    concepto/cotización (p. ej. la otra torre) NO se tocan.
  const { error: lineErr } = await sb
    .from("buyout_line")
    .update({ deleted_at: now })
    .eq("id", lineId)
    .is("deleted_at", null)
  if (lineErr) return { error: lineErr.message }

  // 2) ¿Quedan líneas vivas bajo la MISMA cotización (otras torres)? Si sí, el
  //    concepto sigue vivo: NO tocamos la cotización ni el item.
  const { data: siblings, error: sibErr } = await sb
    .from("buyout_line")
    .select("id")
    .eq("quote_id", quoteId)
    .is("deleted_at", null)
    .limit(1)
  if (sibErr) return { error: sibErr.message }
  if (siblings && siblings.length > 0) {
    revalidateEstado(projectId)
    return { ok: true }
  }

  // 3) Era la ÚLTIMA línea de la cotización → da de baja la cotización vacía y
  //    promueve la versión previa (o baja el item si no quedan versiones).
  await sb
    .from("buyout_quote")
    .update({ deleted_at: now, is_selected: false })
    .eq("id", quoteId)

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

  revalidateEstado(projectId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// setLineaContratado — toggle RÁPIDO de contratación de UNA línea (admin-only)
// ---------------------------------------------------------------------------

/**
 * Alterna Contratado/No contratado de UNA línea, escribiendo el estado por-línea
 * `buyout_line.contratado` (el que lee el rollup del Resumen). Una cotización con
 * varias líneas (BF por torre) puede quedar "parcial" (una torre contratada y otra
 * no) sin que el toggle de una arrastre a la otra.
 *
 * L2 — Scoping: ata la línea → cotización → item → proyecto antes de escribir
 * (la RLS `buyout_*` gatea por admin GLOBAL, no por proyecto).
 * L3 — Consistencia con el puente a Pagos: el puente lee el estado de la
 * COTIZACIÓN (`buyout_quote.contratado`), no de las líneas. Tras el toggle se
 * recomputa ese agregado desde TODAS las líneas vivas con la MISMA regla que el
 * rollup (`contratado` = true solo si TODAS lo están; una parcial → false) → el
 * bridge y el Resumen coinciden. Solo se recomputa `contratado` (lo único que
 * cambia este toggle); `kind`, montos y cuadre quedan intactos.
 */
export async function setLineaContratado(
  lineId: string,
  projectId: string,
  contratado: boolean,
): Promise<ActionResult> {
  const guard = await requireAdmin()
  if (guard) return { error: guard }
  const sb = await createClient()

  // L2 — línea → cotización → item → proyecto.
  const { data: line, error: lineErr } = await sb
    .from("buyout_line")
    .select("quote_id")
    .eq("id", lineId)
    .is("deleted_at", null)
    .maybeSingle()
  if (lineErr) return { error: `Error al leer la línea: ${lineErr.message}` }
  if (!line) return { error: "Línea no encontrada." }
  const quoteId = line.quote_id as string

  const { data: quote, error: quoteErr } = await sb
    .from("buyout_quote")
    .select("item_id, contratado")
    .eq("id", quoteId)
    .maybeSingle()
  if (quoteErr) {
    return { error: `Error al leer la cotización: ${quoteErr.message}` }
  }
  if (!quote) return { error: "Cotización no encontrada." }

  const { data: item, error: itemErr } = await sb
    .from("buyout_item")
    .select("id")
    .eq("id", quote.item_id as string)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle()
  if (itemErr)
    return { error: `Error al validar el proyecto: ${itemErr.message}` }
  if (!item) return { error: "La línea no pertenece a este proyecto." }

  // Toggle de ESTA línea.
  const { error } = await sb
    .from("buyout_line")
    .update({ contratado })
    .eq("id", lineId)
    .is("deleted_at", null)
  if (error) return { error: error.message }

  // L3 — Recomputa el agregado de la cotización desde sus líneas vivas. Una línea
  // sin estado propio (`contratado` NULL) hereda el valor previo de la cotización
  // (mismo fallback que el rollup), para no voltear el display de una hermana
  // heredada. Solo se escribe si el agregado cambió.
  const prevQuote = Boolean(quote.contratado)
  const { data: quoteLines, error: linesErr } = await sb
    .from("buyout_line")
    .select("contratado")
    .eq("quote_id", quoteId)
    .is("deleted_at", null)
  if (linesErr) {
    return { error: `Error al recomputar el estado: ${linesErr.message}` }
  }
  const live = quoteLines ?? []
  const quoteContratado =
    live.length > 0 &&
    live.every((l) => ((l.contratado as boolean | null) ?? prevQuote) === true)
  if (quoteContratado !== prevQuote) {
    const { error: qErr } = await sb
      .from("buyout_quote")
      .update({ contratado: quoteContratado })
      .eq("id", quoteId)
    if (qErr) {
      return { error: `Error al actualizar la cotización: ${qErr.message}` }
    }
  }

  revalidateEstado(projectId)
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
