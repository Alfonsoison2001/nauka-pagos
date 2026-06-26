import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Piezas de presentación COMPARTIDAS por las 3 tablas del Resumen (Vigente ·
 * Evolución · Contratación) para que el lenguaje visual sea idéntico. Solo estilo:
 * no tocan datos ni cálculos.
 *
 * - `HEAD_ROW` — fila de encabezado en gris muy claro (NAUKA), texto chico
 *   uppercase atenuado. Reemplaza el header oscuro anterior; el pie TOTAL sigue
 *   oscuro para anclar la lectura.
 * - `Th` — celda de encabezado con UN icono por columna + etiqueta.
 */

/** Header gris muy claro, texto pequeño uppercase atenuado, sticky-friendly. */
export const HEAD_ROW =
  "bg-nauka-bg text-[11px] uppercase tracking-wider text-muted-foreground"

/** Celda de encabezado: icono (atenuado) + etiqueta. `align` posiciona el bloque
 *  (numéricas a la derecha). El icono va siempre antes de la etiqueta. */
export function Th({
  icon: Icon,
  children,
  align = "left",
  className,
}: {
  icon: LucideIcon
  children: ReactNode
  align?: "left" | "right"
  className?: string
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 font-medium",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 align-middle">
        <Icon className="size-3.5 shrink-0 text-nauka-neutral" />
        {children}
      </span>
    </th>
  )
}
