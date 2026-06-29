// Rollup del Buy-Out (lo que en el Excel hacen los SUMIFS): renglón → cotización
// vigente → item → partida → capítulo → total (todo a MXN vía TC). Fuente única
// que comparten las tarjetas de Partida y el tablero Resumen, para que NUNCA
// difieran. Ver docs/SPEC-buyout.md §4 (Rollup) y §6 (Resumen).
//
// Separado en dos capas:
//   • loadVigenteLines() — carga (server) las líneas de la cotización VIGENTE de
//     cada concepto del proyecto. Recibe el cliente Supabase por parámetro (no lo
//     importa en runtime → las funciones puras de abajo son testeables con node).
//   • aggregateLines() / difPct() — PURAS: agregan a nivel partida/capítulo.

import type {
  CurrencyOption,
  LineaRow,
} from "@/app/proyectos/[id]/buyout/partida/actions"
import type { createClient } from "@/lib/supabase/server"
import { calcLinea } from "./calc"

type Sb = Awaited<ReturnType<typeof createClient>>

/** Una línea de la cotización vigente + su TC y a qué partida pertenece. */
export type VigenteLine = LineaRow & {
  tc: number
  partidaNombre: string
  partida_catalog_id: string
}

export type Maturity = "parametrico" | "ppto" | "parcial"
export type Contratacion = "contratado" | "no_contratado" | "parcial"

/** Estado agregado de una partida (sus conceptos vigentes). */
export type PartidaAgg = {
  /** Σ del total MXN de los conceptos vigentes. */
  total: number
  // Dos ejes INDEPENDIENTES que parten el mismo `total` en dos cubetas cada uno
  // (como las cols V/W del Excel). Por construcción:
  //   parametrico + ppto         === total   (eje madurez)
  //   noContratado + contratado  === total   (eje contratación)
  /** Eje madurez — Σ MXN de conceptos con madurez=paramétrico. */
  parametrico: number
  /** Eje madurez — Σ MXN de conceptos con madurez=ppto. */
  ppto: number
  /** Eje contratación — Σ MXN de conceptos NO contratados. */
  noContratado: number
  /** Eje contratación — Σ MXN de conceptos contratados. */
  contratado: number
  /** Cuántos conceptos vigentes tiene. */
  count: number
  /** Madurez agregada: una sola si todas coinciden, "parcial" si mezclan. */
  madurez: Maturity | null
  /** Contratación agregada: igual lógica que la madurez. */
  contratacion: Contratacion | null
  /** Fecha de la cotización vigente más reciente (ISO yyyy-mm-dd) o null. */
  lastUpdate: string | null
  /** Proveedores distintos (no nulos) entre sus conceptos. */
  proveedores: string[]
}

/** El total MXN de una línea (col T del formato verde). */
export function lineTotalMxn(l: {
  cantidad: number
  unitario: number
  sobrecosto_pct: number
  iva_pct: number
  tc: number
}): number {
  return calcLinea({
    cantidad: l.cantidad,
    unitario: l.unitario,
    sobrecostoPct: l.sobrecosto_pct,
    ivaPct: l.iva_pct,
    tc: l.tc,
  }).totalMxn
}

type AggInput = {
  cantidad: number
  unitario: number
  sobrecosto_pct: number
  iva_pct: number
  tc: number
  kind: "parametrico" | "ppto"
  contratado: boolean
  quote_date: string | null
  proveedor: string | null
}

/** Agrega un conjunto de líneas vigentes (de una misma partida) a su PartidaAgg. */
export function aggregateLines(lines: AggInput[]): PartidaAgg {
  if (lines.length === 0) {
    return {
      total: 0,
      parametrico: 0,
      ppto: 0,
      noContratado: 0,
      contratado: 0,
      count: 0,
      madurez: null,
      contratacion: null,
      lastUpdate: null,
      proveedores: [],
    }
  }
  let total = 0
  // Cubetas por estado (los 2 ejes). Se acumulan en la MISMA pasada que `total`,
  // reusando el mismo `t = lineTotalMxn(l)` → cada par suma exactamente el total.
  let paramSum = 0
  let pptoSum = 0
  let noContratadoSum = 0
  let contratadoSum = 0
  let allPpto = true
  let allParam = true
  let allContratado = true
  let allNoContratado = true
  let lastUpdate: string | null = null
  const proveedores = new Set<string>()
  for (const l of lines) {
    const t = lineTotalMxn(l)
    total += t
    if (l.kind === "ppto") {
      pptoSum += t
      allParam = false
    } else {
      paramSum += t
      allPpto = false
    }
    if (l.contratado) {
      contratadoSum += t
      allNoContratado = false
    } else {
      noContratadoSum += t
      allContratado = false
    }
    if (l.quote_date && (!lastUpdate || l.quote_date > lastUpdate)) {
      lastUpdate = l.quote_date
    }
    const prov = l.proveedor?.trim()
    if (prov) proveedores.add(prov)
  }
  const madurez: Maturity = allPpto
    ? "ppto"
    : allParam
      ? "parametrico"
      : "parcial"
  const contratacion: Contratacion = allContratado
    ? "contratado"
    : allNoContratado
      ? "no_contratado"
      : "parcial"
  return {
    total,
    parametrico: paramSum,
    ppto: pptoSum,
    noContratado: noContratadoSum,
    contratado: contratadoSum,
    count: lines.length,
    madurez,
    contratacion,
    lastUpdate,
    proveedores: [...proveedores],
  }
}

/**
 * DIF = (Σ vigente ÷ base) − 1, como fracción (0.12 = +12%). Devuelve null si la
 * base es 0/negativa (la UI muestra "—") para no dividir entre cero.
 */
export function difPct(total: number, base: number): number | null {
  if (!(base > 0)) return null
  return total / base - 1
}

/**
 * Carga las líneas de la cotización VIGENTE de cada concepto del proyecto, en una
 * sola pasada (item → cotización is_selected → renglón), con su TC y partida.
 * Devuelve [] si no hay items/cotizaciones.
 */
export async function loadVigenteLines(
  sb: Sb,
  projectId: string,
  fxList: CurrencyOption[],
  partidaNombreById: Map<string, string>,
): Promise<VigenteLine[]> {
  const { data: itemRows } = await sb
    .from("buyout_item")
    .select("id, partida_catalog_id")
    .eq("project_id", projectId)
    .is("deleted_at", null)
  const items = itemRows ?? []
  const itemPartida = new Map(
    items.map((i) => [i.id as string, i.partida_catalog_id as string]),
  )
  const itemIds = items.map((i) => i.id as string)
  if (itemIds.length === 0) return []

  const { data: quoteRows } = await sb
    .from("buyout_quote")
    .select("id, item_id, supplier_id, quote_date, kind, contratado, pdf_url")
    .in("item_id", itemIds)
    .eq("is_selected", true)
    .is("deleted_at", null)
  const quotes = quoteRows ?? []
  const quoteById = new Map(quotes.map((q) => [q.id as string, q]))
  const quoteIds = quotes.map((q) => q.id as string)
  if (quoteIds.length === 0) return []

  const { data: lineRows } = await sb
    .from("buyout_line")
    .select(
      "id, quote_id, concepto, detalle, villa_casita, piso, depto, proveedor, unidad, cantidad, moneda, unitario, sobrecosto_pct, iva_pct, notas",
    )
    .in("quote_id", quoteIds)
    .is("deleted_at", null)
    .order("created_at")

  // BO-01: el factor 1 solo es legítimo para MXN. Para una divisa (USD/EUR) sin TC
  // configurado NO caemos a 1 (mostraría un monto ~17-20× subestimado): devolvemos
  // NaN para no fingir un valor en el display. (La escritura a Pagos aborta aparte,
  // en el puente; el rollup es solo lectura.)
  const rateOf = (cur: string) =>
    cur === "MXN"
      ? 1
      : (fxList.find((c) => c.currency === cur)?.rate ?? Number.NaN)

  return (lineRows ?? []).map((l) => {
    const q = quoteById.get(l.quote_id as string)
    const itemId = (q?.item_id as string) ?? ""
    const partidaId = itemPartida.get(itemId) ?? ""
    const moneda = (l.moneda as string) ?? "MXN"
    return {
      id: l.id as string,
      quote_id: l.quote_id as string,
      item_id: itemId,
      concepto: (l.concepto as string) ?? "",
      detalle: (l.detalle as string | null) ?? null,
      villa_casita: (l.villa_casita as string | null) ?? null,
      piso: (l.piso as string | null) ?? null,
      depto: (l.depto as string | null) ?? null,
      proveedor: (l.proveedor as string | null) ?? null,
      unidad: (l.unidad as string | null) ?? null,
      cantidad: Number(l.cantidad ?? 0),
      moneda,
      unitario: Number(l.unitario ?? 0),
      sobrecosto_pct: Number(l.sobrecosto_pct ?? 0),
      iva_pct: Number(l.iva_pct ?? 0),
      notas: (l.notas as string | null) ?? null,
      kind: (q?.kind as "parametrico" | "ppto") ?? "ppto",
      contratado: Boolean(q?.contratado),
      quote_date: (q?.quote_date as string) ?? "",
      pdf_url: (q?.pdf_url as string | null) ?? null,
      supplier_id: (q?.supplier_id as string | null) ?? null,
      tc: rateOf(moneda),
      partidaNombre: partidaNombreById.get(partidaId) ?? "",
      partida_catalog_id: partidaId,
    }
  })
}

/**
 * Agregado VIGENTE por partida del proyecto: `partida_catalog_id → PartidaAgg`.
 * Carga las líneas vigentes una sola vez y las agrupa/agrega por partida. Fuente
 * ÚNICA del total MXN vigente por partida — la usan el Resumen (columna Ppto / mes
 * en curso) y el cierre de mes (la "foto") para que NUNCA difieran. Solo incluye
 * partidas que tienen al menos una línea vigente; el llamador rellena 0 para el
 * resto (ver SPEC-buyout.md §6, conceptos nuevos en 0).
 */
export async function loadPartidaAggs(
  sb: Sb,
  projectId: string,
  fxList: CurrencyOption[],
  partidaNombreById: Map<string, string>,
): Promise<Map<string, PartidaAgg>> {
  const lines = await loadVigenteLines(sb, projectId, fxList, partidaNombreById)
  const byPartida = new Map<string, VigenteLine[]>()
  for (const l of lines) {
    const list = byPartida.get(l.partida_catalog_id) ?? []
    list.push(l)
    byPartida.set(l.partida_catalog_id, list)
  }
  const aggs = new Map<string, PartidaAgg>()
  for (const [pid, list] of byPartida) aggs.set(pid, aggregateLines(list))
  return aggs
}
