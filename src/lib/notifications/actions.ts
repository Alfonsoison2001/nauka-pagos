"use server"

import { createClient } from "@/lib/supabase/server"

export type NotificationItem = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

type RawNotif = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

/** Feed reciente del usuario actual (RLS lo acota a las propias). */
export async function getMyNotifications(): Promise<NotificationItem[]> {
  const sb = await createClient()
  const { data } = await sb
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20)
  return ((data ?? []) as RawNotif[]).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.read_at,
    createdAt: n.created_at,
  }))
}

/** Marca una notificación como leída (RLS garantiza que sea propia). */
export async function markNotificationRead(id: string): Promise<void> {
  const sb = await createClient()
  await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null)
}

/** Marca todas las no leídas del usuario como leídas. */
export async function markAllNotificationsRead(): Promise<void> {
  const sb = await createClient()
  await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
}
