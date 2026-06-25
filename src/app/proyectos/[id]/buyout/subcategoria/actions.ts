"use server"

import { revalidatePath } from "next/cache"
import { getMyProfile } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { error: string } | { ok: true }

/**
 * Marca una cotización (versión) como la VIGENTE de su concepto. Baja la vigente
 * anterior (índice único: 1 vigente por item) ANTES de subir la elegida, y
 * actualiza `selected_quote_id`. El rollup (Partida + Resumen) usa la vigente → el
 * cambio se refleja al instante. Admin-only (lo refuerza la RLS `is_admin()` de
 * buyout_quote/buyout_item).
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

  // Baja la vigente anterior antes de subir la elegida (1-vigente por item).
  const { error: downErr } = await sb
    .from("buyout_quote")
    .update({ is_selected: false })
    .eq("item_id", itemId)
    .eq("is_selected", true)
    .is("deleted_at", null)
  if (downErr) return { error: downErr.message }

  const { error: upErr } = await sb
    .from("buyout_quote")
    .update({ is_selected: true })
    .eq("id", quoteId)
  if (upErr) return { error: upErr.message }

  const { error: itemErr } = await sb
    .from("buyout_item")
    .update({ selected_quote_id: quoteId })
    .eq("id", itemId)
  if (itemErr) return { error: itemErr.message }

  // Refleja al instante en Resumen, Partida y este historial.
  revalidatePath(`/proyectos/${projectId}/buyout`)
  revalidatePath(`/proyectos/${projectId}/buyout/partida`)
  revalidatePath(`/proyectos/${projectId}/buyout/subcategoria`)
  return { ok: true }
}
