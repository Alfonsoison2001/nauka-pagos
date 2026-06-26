"use client"

import {
  ArrowRightLeft,
  CalendarDays,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentType } from "react"
import { signOut } from "@/app/logout/actions"
import { NotificationsBell } from "@/components/notifications/notifications-bell"
import { cn } from "@/lib/utils"

type IconType = ComponentType<{ className?: string }>

// Tabs de PAGOS (rutas por-proyecto). `hidden` = oculto del menú pero la ruta
// sigue viva (accesible por URL); para reactivarlo, quita `hidden`.
const PAGOS_TABS: {
  slug: string
  label: string
  icon: IconType
  hidden?: boolean
}[] = [
  { slug: "resumen", label: "Resumen", icon: LayoutDashboard },
  { slug: "presupuesto", label: "Presupuesto", icon: Wallet },
  { slug: "flujo-de-pagos", label: "Flujo de Pagos", icon: ArrowRightLeft },
  { slug: "caratula", label: "Carátula", icon: FileText },
  // Resumen Mensual: oculto del menú por ahora. La ruta /resumen-mensual sigue
  // viva (accesible por URL). Para reactivarlo, quita `hidden: true`.
  {
    slug: "resumen-mensual",
    label: "Resumen Mensual",
    icon: CalendarDays,
    hidden: true,
  },
]

type Props = {
  projectId: string
  greetingName: string
  isAdmin?: boolean
  /** Notificaciones no leídas → badge de la campana (8d). */
  unreadCount?: number
  /** Override del href de Aprobaciones (lo usa /aprobaciones para conservar el
   * filtro actual). Por defecto apunta al proyecto del sidebar. */
  aprobacionesHref?: string
  /** Oculta el sidebar en móvil (flujo de aprobación responsive). Default: no. */
  hideOnMobile?: boolean
}

export function Sidebar({
  projectId,
  greetingName,
  isAdmin = false,
  unreadCount = 0,
  aprobacionesHref,
  hideOnMobile = false,
}: Props) {
  const pathname = usePathname()
  const base = `/proyectos/${projectId}`
  // El link de Aprobaciones lleva el proyecto actual como contexto → la bandeja
  // pre-filtra a ese proyecto. (Desde Home el link va sin query = "Todos".)
  const aprobHref =
    aprobacionesHref ??
    (projectId ? `/aprobaciones?proyecto=${projectId}` : "/aprobaciones")

  return (
    <aside
      className={cn(
        "sticky top-0 h-svh w-[260px] shrink-0 flex-col bg-gradient-to-b from-nauka-dark to-nauka-dark-2 text-white",
        hideOnMobile ? "hidden md:flex" : "flex",
      )}
    >
      {/* Logo NAUKA (PNG blanco transparente) → Home */}
      <div className="px-6 pt-10">
        <Link href="/" className="block transition-opacity hover:opacity-80">
          {/* biome-ignore lint/performance/noImgElement: logo estático del sidebar */}
          <img src="/logo-nauka-white.png" alt="NAUKA" className="w-[70%]" />
        </Link>
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-sm text-white/70">¡Hola, {greetingName}!</p>
          <NotificationsBell unreadCount={unreadCount} />
        </div>
      </div>

      <div className="mx-6 my-5 border-t border-white/10" />

      <nav aria-label="Navegación" className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          {/* Home: link suelto, arriba de todo. */}
          <li>
            <SidebarLink
              href="/"
              label="Home"
              Icon={Home}
              active={pathname === "/"}
            />
          </li>

          {/* PAGOS */}
          <SectionHeader label="Pagos" />
          {PAGOS_TABS.filter((item) => !item.hidden).map((item) => {
            const href = `${base}/${item.slug}`
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={item.slug}>
                <SidebarLink
                  href={href}
                  label={item.label}
                  Icon={item.icon}
                  active={active}
                />
              </li>
            )
          })}
          <li>
            <SidebarLink
              href={aprobHref}
              label="Aprobaciones"
              Icon={ClipboardCheck}
              active={pathname === "/aprobaciones"}
            />
          </li>

          {/* BUY-OUT: "libro distinto", solo dentro de un proyecto. */}
          {projectId ? (
            <>
              <SectionHeader label="Buy-Out" />
              <li>
                <SidebarLink
                  href={`${base}/buyout`}
                  label="Buy-Out"
                  Icon={ShoppingCart}
                  active={pathname.startsWith(`${base}/buyout`)}
                />
              </li>
            </>
          ) : null}

          {/* GENERAL */}
          <SectionHeader label="General" />
          <li>
            <SidebarLink
              href={`${base}/configuracion`}
              label="Configuración"
              Icon={Settings}
              active={
                pathname === `${base}/configuracion` ||
                pathname.startsWith(`${base}/configuracion/`)
              }
            />
          </li>
          {isAdmin ? (
            <li>
              <SidebarLink
                href="/usuarios"
                label="Usuarios"
                Icon={Users}
                active={pathname === "/usuarios"}
              />
            </li>
          ) : null}
          <li>
            <SidebarLink
              href="/guia"
              label="¿Cómo funciona?"
              Icon={HelpCircle}
              active={pathname === "/guia"}
            />
          </li>
        </ul>
      </nav>

      <div className="px-3 pb-6">
        <button
          type="button"
          onClick={() => signOut()}
          className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-[18px]" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

/** Encabezado de sección del sidebar: estilo sutil (texto chico, gris, mayúsculas)
 *  precedido por el divisor sutil que separa los grupos (tokens NAUKA). */
function SectionHeader({ label }: { label: string }) {
  return (
    <li className="mt-3 border-t border-white/10 px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
      {label}
    </li>
  )
}

function SidebarLink({
  href,
  label,
  Icon,
  active,
  badge = 0,
}: {
  href: string
  label: string
  Icon: IconType
  active: boolean
  badge?: number
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
        active
          ? "bg-nauka-accent font-medium text-nauka-dark"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="size-[18px]" />
      {label}
      {badge > 0 ? (
        <span
          className={cn(
            "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium",
            active ? "bg-nauka-dark text-white" : "bg-red-500 text-white",
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  )
}
