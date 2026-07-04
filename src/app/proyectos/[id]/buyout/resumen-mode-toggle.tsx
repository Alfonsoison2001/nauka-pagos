"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type ResumenMode = "vigente" | "evolucion" | "contratacion"

/**
 * Toggle Vigente / Evolución / Contratación del Resumen (SPEC-buyout.md §6). El modo
 * vive en el searchParam `?modo=…` (lo lee el Server Component); aquí solo navegamos.
 * Vigente y Evolución quedan idénticos; Contratación desglosa el total por estado.
 */
export function ResumenModeToggle({ modo }: { modo: ResumenMode }) {
  const pathname = usePathname()
  const items: { key: ResumenMode; label: string; href: string }[] = [
    { key: "vigente", label: "Vigente", href: pathname },
    {
      key: "evolucion",
      label: "Evolución",
      href: `${pathname}?modo=evolucion`,
    },
    {
      key: "contratacion",
      label: "Contratación",
      href: `${pathname}?modo=contratacion`,
    },
  ]
  return (
    <div className="inline-flex items-center rounded-full border border-nauka-card-border bg-white p-1">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          aria-current={modo === it.key ? "page" : undefined}
          className={cn(
            "rounded-full px-3.5 py-1 text-sm font-medium transition-colors",
            modo === it.key
              ? "bg-nauka-dark text-white"
              : "text-muted-foreground hover:text-nauka-dark",
          )}
        >
          {it.label}
        </Link>
      ))}
    </div>
  )
}
