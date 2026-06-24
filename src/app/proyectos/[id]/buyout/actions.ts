"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
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
