"use server"

import { revalidatePath } from "next/cache"
import { getMyProfile } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { error: string } | { ok: true }

/**
 * Marca una cotización (versión) como la VIGENTE de su concepto. El swap (baja la
 * anterior → sube la elegida → apunta `selected_quote_id`) corre ATÓMICO en la RPC
 * `buyout_mark_vigente` (una sola transacción Postgres): si algo falla, se revierte
 * todo y el concepto conserva su vigente anterior, nunca queda sin vigente (BO-09).
 * El rollup (Partida + Resumen) usa la vigente → el cambio se refleja al instante.
 * Admin-only (guard server + re-check `is_admin()` dentro de la RPC).
 */
export async function marcarVigente(
  projectId: string,
  itemId: string,
  quoteId: string,
): Promise<ActionResult> {
  const sb = await createClient()
  const profile = await getMyProfile()
  if (profile?.role !== "admin") {
    return { error: "Solo un administrador puede cambiar la versión vigente." }
  }

  // El item debe pertenecer al proyecto (defensa) y la cotización al item.
  const { data: item } = await sb
    .from("buyout_item")
    .select("id")
    .eq("id", itemId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!item) return { error: "Concepto no encontrado." }

  const { data: quote } = await sb
    .from("buyout_quote")
    .select("id, is_selected")
    .eq("id", quoteId)
    .eq("item_id", itemId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!quote) return { error: "Esa versión no existe o fue eliminada." }
  if (quote.is_selected) return { ok: true } // ya es la vigente

  // Swap ATÓMICO vía RPC: baja la anterior + sube la elegida + apunta el item en
  // UNA sola transacción Postgres. Si algo falla, se revierte completo y el
  // concepto conserva su vigente anterior → nunca queda sin vigente (BO-09).
  const { error: rpcErr } = await sb.rpc("buyout_mark_vigente", {
    p_project_id: projectId,
    p_item_id: itemId,
    p_quote_id: quoteId,
  })
  if (rpcErr) return { error: rpcErr.message }

  // Refleja al instante en Resumen, Partida y este historial.
  revalidatePath(`/proyectos/${projectId}/buyout`)
  revalidatePath(`/proyectos/${projectId}/buyout/partida`)
  revalidatePath(`/proyectos/${projectId}/buyout/subcategoria`)
  return { ok: true }
}
