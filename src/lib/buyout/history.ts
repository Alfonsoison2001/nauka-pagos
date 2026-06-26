// Historial de pptos de un concepto (subcategoría) — SPEC-buyout.md §6.3. TODAS las
// versiones (buyout_quote) de un buyout_item por fecha desc, cada una con su renglón
// para el monto/total a MXN (misma fórmula que el rollup → cuadra con Partida y
// Resumen) y su estado de 2 ejes. También el índice de conceptos (cuando no se
// eligió uno todavía).

import type { CurrencyOption } from "@/app/proyectos/[id]/buyout/partida/actions"
import type { createClient } from "@/lib/supabase/server"
import { calcLinea } from "./calc"
import { lineTotalMxn, loadVigenteLines } from "./rollup"

type Sb = Awaited<ReturnType<typeof createClient>>

/** Una versión (cotización fechada) en el historial de un concepto. */
export type QuoteVersion = {
  quoteId: string
  quoteDate: string | null
  proveedor: string | null
  moneda: string
  /** Importe sin IVA (col M = cantidad × unitario). */
  montoSinIva: number
  /** Total MXN (col T, vía calcLinea + TC) — comparable entre versiones. */
  totalMxn: number
  kind: "parametrico" | "ppto"
  contratado: boolean
  pdfPath: string | null
  isSelected: boolean
  /** FK a la partida de Pagos si esta cotización ya se ligó (§8). */
  pagosPartidaId: string | null
}

/** Meta del concepto + sus versiones (desc por fecha). */
export type ItemHistory = {
  itemId: string
  concepto: string
  partidaCatalogId: string
  partidaNombre: string
  versions: QuoteVersion[]
}

/** Una fila del índice de conceptos (cuando no se eligió uno). */
export type ConceptoIndexRow = {
  itemId: string
  concepto: string
  partidaCatalogId: string
  partidaNombre: string
  proveedor: string | null
  totalMxn: number
  versions: number
  kind: "parametrico" | "ppto"
  contratado: boolean
}

/**
 * Carga el historial de un concepto: el item (validado contra el proyecto) y TODAS
 * sus cotizaciones no borradas, ordenadas por fecha desc (created_at como
 * desempate), cada una con el renglón de su cotización para calcular monto/total
 * MXN. Devuelve null si el concepto no existe en el proyecto.
 */
export async function loadItemHistory(
  sb: Sb,
  projectId: string,
  itemId: string,
  fxList: CurrencyOption[],
): Promise<ItemHistory | null> {
  const { data: item } = await sb
    .from("buyout_item")
    .select("id, concepto, partida_catalog_id")
    .eq("id", itemId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!item) return null

  const partidaCatalogId = item.partida_catalog_id as string
  const { data: cat } = await sb
    .from("buyout_partida_catalog")
    .select("nombre")
    .eq("id", partidaCatalogId)
    .maybeSingle()

  const { data: quoteRows } = await sb
    .from("buyout_quote")
    .select(
      "id, quote_date, currency, kind, contratado, pdf_url, is_selected, pagos_partida_id, monto_sin_iva, iva_pct, created_at",
    )
    .eq("item_id", itemId)
    .is("deleted_at", null)
    .order("quote_date", { ascending: false })
    .order("created_at", { ascending: false })
  const quotes = quoteRows ?? []
  const quoteIds = quotes.map((q) => q.id as string)
  const lineByQuote = await loadLinesByQuote(sb, quoteIds)

  const rateOf = (cur: string) =>
    fxList.find((c) => c.currency === cur)?.rate ?? 1

  const versions: QuoteVersion[] = quotes.map((q) => {
    const line = lineByQuote.get(q.id as string)
    const moneda =
      (line?.moneda as string | undefined) ?? (q.currency as string) ?? "MXN"
    const tc = rateOf(moneda)
    const base = {
      quoteId: q.id as string,
      quoteDate: (q.quote_date as string | null) ?? null,
      moneda,
      kind: (q.kind as "parametrico" | "ppto") ?? "ppto",
      contratado: Boolean(q.contratado),
      pdfPath: (q.pdf_url as string | null) ?? null,
      isSelected: Boolean(q.is_selected),
      pagosPartidaId: (q.pagos_partida_id as string | null) ?? null,
    }
    if (line) {
      const c = calcLinea({
        cantidad: Number(line.cantidad ?? 0),
        unitario: Number(line.unitario ?? 0),
        sobrecostoPct: Number(line.sobrecosto_pct ?? 0),
        ivaPct: Number(line.iva_pct ?? 0),
        tc,
      })
      return {
        ...base,
        proveedor: (line.proveedor as string | null) ?? null,
        montoSinIva: c.importeSinIva,
        totalMxn: c.totalMxn,
      }
    }
    // Fallback sin renglón (raro en V1): usa los campos guardados en la cotización.
    const montoSinIva = Number(q.monto_sin_iva ?? 0)
    const ivaPct = Number(q.iva_pct ?? 0)
    return {
      ...base,
      proveedor: null,
      montoSinIva,
      totalMxn: montoSinIva * (1 + ivaPct) * tc,
    }
  })

  return {
    itemId,
    concepto: (item.concepto as string) ?? "",
    partidaCatalogId,
    partidaNombre: (cat?.nombre as string) ?? "",
    versions,
  }
}

/** Renglón de cada cotización (1 por quote en V1), indexado por quote_id. */
async function loadLinesByQuote(
  sb: Sb,
  quoteIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>()
  if (quoteIds.length === 0) return out
  const { data } = await sb
    .from("buyout_line")
    .select(
      "quote_id, proveedor, moneda, cantidad, unitario, sobrecosto_pct, iva_pct",
    )
    .in("quote_id", quoteIds)
    .is("deleted_at", null)
    .order("created_at")
  for (const l of data ?? []) {
    const k = l.quote_id as string
    if (!out.has(k)) out.set(k, l) // si hubiera varias por quote, la primera
  }
  return out
}

/**
 * Índice de conceptos del proyecto (uno por buyout_item con cotización vigente),
 * con su proveedor/total/estado vigente y cuántas versiones tiene. Reusa el rollup
 * (loadVigenteLines) → cuadra con Partida y Resumen. Lo usa la pantalla
 * Subcategoría cuando aún no se eligió un concepto.
 */
export async function loadConceptoIndex(
  sb: Sb,
  projectId: string,
  fxList: CurrencyOption[],
  partidaNombreById: Map<string, string>,
): Promise<ConceptoIndexRow[]> {
  const lines = await loadVigenteLines(sb, projectId, fxList, partidaNombreById)
  if (lines.length === 0) return []

  const itemIds = [...new Set(lines.map((l) => l.item_id))]
  const versionsByItem = new Map<string, number>()
  const { data: qRows } = await sb
    .from("buyout_quote")
    .select("item_id")
    .in("item_id", itemIds)
    .is("deleted_at", null)
  for (const q of qRows ?? []) {
    const k = q.item_id as string
    versionsByItem.set(k, (versionsByItem.get(k) ?? 0) + 1)
  }

  return lines.map((l) => ({
    itemId: l.item_id,
    concepto: l.concepto,
    partidaCatalogId: l.partida_catalog_id,
    partidaNombre: l.partidaNombre,
    proveedor: l.proveedor,
    totalMxn: lineTotalMxn({
      cantidad: l.cantidad,
      unitario: l.unitario,
      sobrecosto_pct: l.sobrecosto_pct,
      iva_pct: l.iva_pct,
      tc: l.tc,
    }),
    versions: versionsByItem.get(l.item_id) ?? 1,
    kind: l.kind,
    contratado: l.contratado,
  }))
}
