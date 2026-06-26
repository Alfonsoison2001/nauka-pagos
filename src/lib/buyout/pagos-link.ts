// Puente Buy-Out → Pagos (SPEC-buyout.md §8 — "el cruce"). Helpers compartidos
// por la pantalla Subcategoría (lectura del estado del enlace) y las Server
// Actions del puente (cálculo del monto a registrar en Pagos). NO escribe; las
// escrituras viven en subcategoria/contrato-actions.ts.
//
// IMPORTANTE: NO toca el esquema ni la lógica de Pagos. Solo LEE `partidas` /
// `contratistas` (estructura existente) para resolver el estado del enlace.

import type { createClient } from "@/lib/supabase/server"
import { calcLinea } from "./calc"

type Sb = Awaited<ReturnType<typeof createClient>>

/** Estado del enlace de un concepto con su partida (contrato) de Pagos. */
export type PagosLinkInfo = {
  partidaId: string
  partidaNombre: string
  contratistaNombre: string
}

/**
 * Resuelve el enlace a Pagos de una cotización: dado el `pagos_partida_id`
 * guardado en `buyout_quote`, devuelve la partida de Pagos **viva** (su nombre y
 * el del contratista) o `null` si no hay enlace o la partida fue **soft-deleted**
 * en Pagos. Devolver `null` ante una partida borrada permite que la UI vuelva a
 * ofrecer "crear contrato" (el caso de borrar una prueba). Solo lectura.
 */
export async function loadPagosLinkInfo(
  sb: Sb,
  pagosPartidaId: string | null,
): Promise<PagosLinkInfo | null> {
  if (!pagosPartidaId) return null
  const { data: partida } = await sb
    .from("partidas")
    .select("id, nombre, contratista_id")
    .eq("id", pagosPartidaId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!partida) return null
  const { data: contratista } = await sb
    .from("contratistas")
    .select("nombre")
    .eq("id", partida.contratista_id as string)
    .is("deleted_at", null)
    .maybeSingle()
  return {
    partidaId: partida.id as string,
    partidaNombre: (partida.nombre as string) ?? "",
    contratistaNombre: (contratista?.nombre as string) ?? "",
  }
}

/**
 * Base imponible (sin IVA) en MXN del renglón vigente, para guardar como
 * `partidas.presupuesto_sin_iva` en Pagos: `(importe sin IVA + sobrecosto) × TC`.
 * El IVA lo aplica Pagos vía `iva_pct` (col generada `presupuesto_con_iva`), de
 * modo que el total con IVA de Pagos **cuadra exactamente** con el Total MXN
 * (col T) que muestra el Buy-Out. Redondeado a 2 decimales (numeric(14,2)).
 */
export function contratoBaseMxn(l: {
  cantidad: number
  unitario: number
  sobrecosto_pct: number
  iva_pct: number
  tc: number
}): number {
  const c = calcLinea({
    cantidad: l.cantidad,
    unitario: l.unitario,
    sobrecostoPct: l.sobrecosto_pct,
    ivaPct: l.iva_pct,
    tc: l.tc,
  })
  return Math.round((c.importeSinIva + c.totalSobrecosto) * l.tc * 100) / 100
}
