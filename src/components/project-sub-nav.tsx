"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { slug: "resumen", label: "Resumen" },
  { slug: "presupuesto", label: "Presupuesto" },
  { slug: "flujo-de-pagos", label: "Flujo de Pagos" },
  { slug: "caratula", label: "Carátula" },
  { slug: "resumen-mensual", label: "Resumen Mensual" },
  { slug: "configuracion", label: "Configuración" },
] as const

type Props = {
  projectId: string
}

export function ProjectSubNav({ projectId }: Props) {
  const pathname = usePathname()
  const base = `/proyectos/${projectId}`

  return (
    <nav aria-label="Tabs del proyecto" className="border-b bg-background">
      <ul className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4">
        {TABS.map((tab) => {
          const href = `${base}/${tab.slug}`
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={tab.slug}>
              <Link
                href={href}
                className={cn(
                  "inline-flex h-11 items-center border-b-2 px-3 text-sm transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
