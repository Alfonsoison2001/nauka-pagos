"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getMyProfile } from "@/lib/auth/roles"
import { currentPeriodo } from "@/lib/buyout/month-close"
import { loadPartidaAggs } from "@/lib/buyout/rollup"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { error: string } | { ok: true }

const baseSchema = z.object({
  partida_catalog_id: z.string().trim().min(1, "Partida requerida"),
  monto_base: z.coerce.number().min(0, "El presupuesto base debe ser ≥ 0"),
})

/**
 * Fija/edita el presupuesto base (referencia fija) de una partida. Upsert sobre
 * la base vigente del par (proyecto, partida): actualiza si existe, inserta si
 * no. Admin-only (lo refuerza la RLS de buyout_partida_base con is_admin()).
 */
export async function setPartidaBase(
  projectId: string,
  partidaCatalogId: string,
  montoBase: number,
): Promise<ActionResult> {
  const parsed = baseSchema.safeParse({
    partida_catalog_id: partidaCatalogId,
    monto_base: montoBase,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const { partida_catalog_id, monto_base } = parsed.data
  const sb = await createClient()

  const { data: existing } = await sb
    .from("buyout_partida_base")
    .select("id")
    .eq("project_id", projectId)
    .eq("partida_catalog_id", partida_catalog_id)
    .is("deleted_at", null)
    .maybeSingle()

  if (existing) {
    const { error } = await sb
      .from("buyout_partida_base")
      .update({ monto_base })
      .eq("id", existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await sb
      .from("buyout_partida_base")
      .insert({ project_id: projectId, partida_catalog_id, monto_base })
    if (error) return { error: error.message }
  }

  revalidatePath(`/proyectos/${projectId}/buyout`)
  return { ok: true }
}

/**
 * Cierra (o recierra) el MES EN CURSO: toma la FOTO del total MXN vigente por
 * partida en este momento y la guarda en `buyout_month_close` (periodo del mes
 * actual) + `buyout_month_snapshot` (una fila por partida con conceptos vigentes).
 * Recerrar = sobrescribe la foto (baja la anterior, escribe la nueva). NO toca el
 * histórico de otros meses. Admin-only (lo refuerza la RLS `is_admin()`).
 */
export async function cerrarMesActual(
  projectId: string,
): Promise<ActionResult> {
  const sb = await createClient()
  const profile = await getMyProfile()
  if (profile?.role !== "admin") {
    return { error: "Solo un administrador puede cerrar el mes." }
  }
  const periodo = currentPeriodo()

  // Rollup vigente por partida (misma fuente única que el Resumen → no difieren).
  const [partidaRes, fxRes] = await Promise.all([
    sb
      .from("buyout_partida_catalog")
      .select("id, nombre")
      .is("deleted_at", null),
    sb
      .from("buyout_fx")
      .select("currency, rate")
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ])
  const partidaNombreById = new Map(
    (partidaRes.data ?? []).map((p) => [p.id as string, p.nombre as string]),
  )
  const fxList = (fxRes.data ?? []).map((c) => ({
    currency: c.currency as string,
    rate: Number(c.rate),
  }))
  const aggs = await loadPartidaAggs(sb, projectId, fxList, partidaNombreById)

  const now = new Date().toISOString()

  // Find-or-create el cierre del periodo (índice único 1-por-periodo, vigente).
  const { data: existing } = await sb
    .from("buyout_month_close")
    .select("id")
    .eq("project_id", projectId)
    .eq("periodo", periodo)
    .is("deleted_at", null)
    .maybeSingle()

  let closeId: string
  if (existing) {
    closeId = existing.id as string
    const { error: upErr } = await sb
      .from("buyout_month_close")
      .update({
        closed_at: now,
        closed_by: profile.authUserId,
        reopened_at: null,
      })
      .eq("id", closeId)
    if (upErr) return { error: upErr.message }
    // Sobrescribir la foto: baja (soft-delete) la anterior antes de re-tomarla.
    const { error: snapDelErr } = await sb
      .from("buyout_month_snapshot")
      .update({ deleted_at: now })
      .eq("month_close_id", closeId)
      .is("deleted_at", null)
    if (snapDelErr) return { error: snapDelErr.message }
  } else {
    const { data: ins, error: insErr } = await sb
      .from("buyout_month_close")
      .insert({ project_id: projectId, periodo, closed_by: profile.authUserId })
      .select("id")
      .single()
    if (insErr || !ins) {
      return { error: insErr?.message ?? "No se pudo crear el cierre de mes." }
    }
    closeId = ins.id as string
  }

  // Una fila por partida con al menos un concepto vigente (el resto se rellena 0
  // en la vista). total_mxn = Σ del total MXN vigente de la partida.
  const rows = [...aggs.entries()]
    .filter(([, agg]) => agg.count > 0)
    .map(([partidaId, agg]) => ({
      month_close_id: closeId,
      partida_catalog_id: partidaId,
      total_mxn: agg.total,
    }))
  if (rows.length > 0) {
    const { error } = await sb.from("buyout_month_snapshot").insert(rows)
    if (error) return { error: error.message }
  }

  revalidatePath(`/proyectos/${projectId}/buyout`)
  return { ok: true }
}

/**
 * Reabre un mes cerrado: baja (soft-delete) su cierre + su foto, de modo que su
 * columna desaparece del comparativo. NO toca otros meses. Para re-cerrarlo basta
 * volver a `cerrarMesActual` (solo aplica al mes en curso). Admin-only (RLS).
 */
export async function reabrirMes(
  projectId: string,
  periodo: string,
): Promise<ActionResult> {
  const sb = await createClient()
  const profile = await getMyProfile()
  if (profile?.role !== "admin") {
    return { error: "Solo un administrador puede reabrir el mes." }
  }
  const { data: close } = await sb
    .from("buyout_month_close")
    .select("id")
    .eq("project_id", projectId)
    .eq("periodo", periodo)
    .is("deleted_at", null)
    .maybeSingle()
  if (!close) return { error: "Ese mes no está cerrado." }
  const closeId = close.id as string
  const now = new Date().toISOString()

  const { error: snapErr } = await sb
    .from("buyout_month_snapshot")
    .update({ deleted_at: now })
    .eq("month_close_id", closeId)
    .is("deleted_at", null)
  if (snapErr) return { error: snapErr.message }

  const { error } = await sb
    .from("buyout_month_close")
    .update({ deleted_at: now })
    .eq("id", closeId)
  if (error) return { error: error.message }

  revalidatePath(`/proyectos/${projectId}/buyout`)
  return { ok: true }
}
