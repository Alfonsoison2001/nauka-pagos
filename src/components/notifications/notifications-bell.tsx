"use client"

import { formatDistanceToNow, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Bell } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/notifications/actions"
import { cn } from "@/lib/utils"

/** Convierte el link (puede ser absoluto del email) a ruta relativa para navegar. */
function toRelative(link: string | null): string | null {
  if (!link) return null
  try {
    const u = new URL(link)
    return `${u.pathname}${u.search}${u.hash}`
  } catch {
    return link
  }
}

const DOT: Record<string, string> = {
  nueva_aprobacion: "bg-amber-500",
  aprobada: "bg-green-500",
  rechazada: "bg-red-500",
  progreso: "bg-slate-400",
  recordatorio: "bg-sky-500",
}

export function NotificationsBell({ unreadCount }: { unreadCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && items === null) {
      startTransition(async () => {
        setItems(await getMyNotifications())
      })
    }
  }

  function handleClick(n: NotificationItem) {
    startTransition(async () => {
      if (!n.readAt) await markNotificationRead(n.id)
      setOpen(false)
      router.refresh()
      const href = toRelative(n.link)
      if (href) router.push(href)
    })
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead()
      setItems(
        (prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? "x" })) ?? prev,
      )
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notificaciones"
        className="relative flex size-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Bell className="size-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar notificaciones"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-2 max-h-[70vh] w-[320px] overflow-y-auto rounded-2xl border border-nauka-card-border bg-white text-nauka-dark shadow-nauka-card">
            <div className="flex items-center justify-between border-b border-nauka-subtle px-4 py-2.5">
              <span className="text-sm font-medium">Notificaciones</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={pending}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  Marcar todas
                </button>
              )}
            </div>
            <NotifList items={items} pending={pending} onItem={handleClick} />
          </div>
        </>
      )}
    </div>
  )
}

function NotifList({
  items,
  pending,
  onItem,
}: {
  items: NotificationItem[] | null
  pending: boolean
  onItem: (n: NotificationItem) => void
}) {
  if (items === null) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        {pending ? "Cargando..." : ""}
      </p>
    )
  }
  if (items.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        No tienes notificaciones.
      </p>
    )
  }
  return (
    <ul className="flex flex-col">
      {items.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => onItem(n)}
            className={cn(
              "flex w-full gap-2.5 px-4 py-3 text-left transition-colors hover:bg-nauka-bg",
              !n.readAt && "bg-nauka-bg/60",
            )}
          >
            <span
              className={cn(
                "mt-1 size-2 shrink-0 rounded-full",
                DOT[n.type] ?? "bg-slate-400",
              )}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{n.title}</span>
              {n.body && (
                <span className="block truncate text-xs text-muted-foreground">
                  {n.body}
                </span>
              )}
              <span className="block text-[11px] text-slate-400">
                {formatDistanceToNow(parseISO(n.createdAt), {
                  locale: es,
                  addSuffix: true,
                })}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
