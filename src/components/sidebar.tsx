"use client"

import {
  ArrowRightLeft,
  CalendarDays,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentType } from "react"
import { signOut } from "@/app/logout/actions"
import { cn } from "@/lib/utils"

type IconType = ComponentType<{ className?: string }>

const TABS: { slug: string; label: string; icon: IconType }[] = [
  { slug: "resumen", label: "Resumen", icon: LayoutDashboard },
  { slug: "presupuesto", label: "Presupuesto", icon: Wallet },
  { slug: "flujo-de-pagos", label: "Flujo de Pagos", icon: ArrowRightLeft },
  { slug: "caratula", label: "Carátula", icon: FileText },
  { slug: "resumen-mensual", label: "Resumen Mensual", icon: CalendarDays },
  { slug: "configuracion", label: "Configuración", icon: Settings },
]

type Props = {
  projectId: string
  greetingName: string
}

export function Sidebar({ projectId, greetingName }: Props) {
  const pathname = usePathname()
  const base = `/proyectos/${projectId}`

  return (
    <aside className="sticky top-0 flex h-svh w-[260px] shrink-0 flex-col bg-gradient-to-b from-nauka-dark to-nauka-dark-2 text-white">
      {/* Logo NAUKA (PNG blanco transparente) → Home */}
      <div className="px-6 pt-10">
        <Link href="/" className="block transition-opacity hover:opacity-80">
          {/* biome-ignore lint/performance/noImgElement: logo estático del sidebar */}
          <img src="/logo-nauka-white.png" alt="NAUKA" className="w-[70%]" />
        </Link>
        <p className="mt-4 text-sm text-white/70">¡Hola, {greetingName}!</p>
      </div>

      <div className="mx-6 my-5 border-t border-white/10" />

      <nav aria-label="Navegación del proyecto" className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          {TABS.map((item) => {
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
          <li className="mt-1">
            <SidebarLink
              href="/"
              label="Home"
              Icon={Home}
              active={pathname === "/"}
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

function SidebarLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string
  label: string
  Icon: IconType
  active: boolean
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
    </Link>
  )
}
