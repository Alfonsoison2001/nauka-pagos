import type { createClient } from "@/lib/supabase/server"

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Conteo de notificaciones no leídas del usuario actual (para el badge). RLS
 * acota a las propias, así que no hace falta filtrar por user_id. No realtime:
 * se recalcula al navegar/refrescar.
 */
export async function getUnreadNotificationsCount(
  sb: ServerClient,
): Promise<number> {
  const { count } = await sb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
  return count ?? 0
}
