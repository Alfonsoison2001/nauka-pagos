"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * Botón "▸ Meses" del Resumen en modo Vigente: des/colapsa el GRUPO de columnas de
 * meses cerrados (foto congelada) que se intercala entre Ppto Base y PPTO Vigente,
 * para ver la evolución sin salir del Vigente. Colapsado por default.
 *
 * El estado vive en el searchParam `?meses=open` (lo lee el Server Component, igual
 * que el toggle Vigente/Evolución) → la tabla siempre se rinde bien formada en el
 * servidor (sin columnas ocultas ni colSpans a medias). `count` = nº de meses
 * cerrados que se revelan. Solo aparece cuando hay al menos uno.
 */
export function MesesToggle({ open, count }: { open: boolean; count: number }) {
  const pathname = usePathname()
  const href = open ? pathname : `${pathname}?meses=open`
  return (
    <Link
      href={href}
      scroll={false}
      aria-expanded={open}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        open
          ? "border-nauka-dark bg-nauka-dark text-white"
          : "border-nauka-card-border bg-white text-nauka-dark hover:bg-nauka-bg",
      )}
    >
      <ChevronRight
        className={cn("size-4 transition-transform", open && "rotate-90")}
      />
      Meses
      <span
        className={cn(
          "text-xs font-normal tabular-nums",
          open ? "text-white/60" : "text-muted-foreground",
        )}
      >
        ({count})
      </span>
    </Link>
  )
}
