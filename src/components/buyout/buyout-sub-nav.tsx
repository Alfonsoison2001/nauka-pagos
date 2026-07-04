"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

// Las 3 pantallas del módulo Buy-Out (SPEC-buyout.md §6). Es un "libro distinto"
// de las 6 tabs de Pagos: su propia sub-navegación, no una 7ª tab.
// La pantalla Subcategoría (historial de versiones) se retiró del sub-nav: su valor
// vive ahora en el botón "Historial" de cada fila de la Partida (panel de solo
// lectura). La RUTA `/subcategoria` sigue viva y accesible por URL (anti-cleanup;
// ahí quedan "Marcar vigente" y el puente a Pagos para admin).
const TABS = [
  { slug: "", label: "Resumen" },
  { slug: "partida", label: "Partida" },
  { slug: "glosario", label: "Glosario" },
] as const

export function BuyoutSubNav({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const base = `/proyectos/${projectId}/buyout`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-nauka-subtle">
      <nav aria-label="Secciones de Buy-Out">
        <ul className="flex items-center gap-1">
          {TABS.map((tab) => {
            const href = tab.slug ? `${base}/${tab.slug}` : base
            const isActive = tab.slug
              ? pathname === href || pathname.startsWith(`${href}/`)
              : pathname === base
            return (
              <li key={tab.slug || "resumen"}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center border-b-2 px-3 text-sm transition-colors",
                    isActive
                      ? "border-nauka-dark font-medium text-nauka-dark"
                      : "border-transparent text-muted-foreground hover:text-nauka-dark",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Regreso explícito al "libro" de Pagos. */}
      <Link
        href={`/proyectos/${projectId}/resumen`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-nauka-dark"
      >
        <ArrowLeft className="size-4" />
        Volver a Pagos
      </Link>
    </div>
  )
}
