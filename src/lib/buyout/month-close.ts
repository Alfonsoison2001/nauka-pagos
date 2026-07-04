// Cierre manual de mes ("toma la foto") y lectura para el modo Evolución del
// Resumen (SPEC-buyout.md §6). Una `buyout_month_close` por (proyecto, periodo)
// con su `buyout_month_snapshot` (total MXN vigente por partida congelado). Aquí
// viven solo helpers de presentación + lectura; la escritura (cerrar/reabrir)
// está en las Server Actions de `buyout/actions.ts`.

import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import type { createClient } from "@/lib/supabase/server"

type Sb = Awaited<ReturnType<typeof createClient>>

export type ClosedMonth = { id: string; periodo: string }

/**
 * Periodo del mes en curso, `yyyy-mm`, en la zona horaria del negocio
 * (America/Mexico_City). A1 (audit 2026-07-03): con la fecha del SERVIDOR
 * (Vercel corre en UTC), cerrar el mes el último día después de las ~18:00
 * hora CDMX registraba el mes SIGUIENTE (30-jun 19:00 CDMX = 1-jul UTC →
 * "2026-07"). Se resuelve el año/mes explícitamente en la TZ de México.
 */
export function currentPeriodo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date())
  const year = parts.find((p) => p.type === "year")?.value ?? ""
  const month = parts.find((p) => p.type === "month")?.value ?? ""
  return `${year}-${month}`
}

/** "Junio 2026" a partir de "2026-06" (primera letra en mayúscula). */
export function periodoShort(periodo: string): string {
  try {
    const s = format(parseISO(`${periodo}-01`), "LLLL yyyy", { locale: es })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch {
    return periodo
  }
}

/** Etiqueta legible de una columna de mes cerrado: "Ppto Junio 2026". */
export function periodoLabel(periodo: string): string {
  return `Ppto ${periodoShort(periodo)}`
}

/** Meses cerrados (vigentes, no reabiertos) del proyecto, ascendentes por periodo. */
export async function loadClosedMonths(
  sb: Sb,
  projectId: string,
): Promise<ClosedMonth[]> {
  const { data } = await sb
    .from("buyout_month_close")
    .select("id, periodo")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("periodo")
  return (data ?? []).map((r) => ({
    id: r.id as string,
    periodo: r.periodo as string,
  }))
}

/**
 * Fotos por mes: `Map<month_close_id, Map<partida_catalog_id, total_mxn>>`.
 * Las partidas ausentes de un mes (no existían / sin datos al cerrar) se quedan
 * fuera; el llamador rellena 0 para alinear la rejilla.
 */
export async function loadSnapshots(
  sb: Sb,
  closeIds: string[],
): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>()
  if (closeIds.length === 0) return out
  const { data } = await sb
    .from("buyout_month_snapshot")
    .select("month_close_id, partida_catalog_id, total_mxn")
    .in("month_close_id", closeIds)
    .is("deleted_at", null)
  for (const r of data ?? []) {
    const cid = r.month_close_id as string
    const m = out.get(cid) ?? new Map<string, number>()
    m.set(r.partida_catalog_id as string, Number(r.total_mxn))
    out.set(cid, m)
  }
  return out
}
