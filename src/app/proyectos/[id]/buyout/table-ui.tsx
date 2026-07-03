import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Sistema visual COMPARTIDO de las 3 tablas del Resumen (Vigente · Evolución ·
 * Contratación) — design-prompt.md § "Extensión Buy-Out: tablero financiero
 * denso". Solo estilo: no toca datos ni cálculos. Las constantes garantizan que
 * las 3 tablas hablen el mismo idioma (densidad, jerarquía de tinta, bandas).
 *
 * - `TABLE` — cuerpo 14px + números tabulares.
 * - `HEAD_ROW` — encabezado blanco sólido (sticky-safe), labels 11px uppercase.
 * - `TH_HAIRLINE` — hairline inferior del header como box-shadow inset: con
 *   `border-collapse` un border-b en fila sticky se queda atrás al hacer
 *   scroll; la sombra viaja con la celda.
 * - `TD` — celda densa `px-3 py-2`; 1ª/última columna respiran hacia el borde.
 * - `ROW` — fila de partida h-11 con hover plano.
 * - `CHAPTER_TD` — banda de capítulo con espina accent de 2px.
 * - `SUBTOTAL_ROW` — lavado `nauka-bg` (más claro que la banda de capítulo).
 * - `TOTAL_FOOT` — tfoot sticky bottom: el TOTAL siempre visible al scrollear.
 */

/** Tabla base del tablero: densa (14px), números tabulares. */
export const TABLE = "w-full text-sm tabular-nums"

/** Fila de encabezado: blanco sólido, texto 11px uppercase atenuado. */
export const HEAD_ROW =
  "bg-white text-[11px] uppercase tracking-wider text-muted-foreground"

/** Hairline inferior de celdas de header sticky (sobrevive al scroll). */
export const TH_HAIRLINE = "shadow-[inset_0_-1px_0_0_var(--color-nauka-subtle)]"

/** Celda estándar: densa, con respiro extra en la primera/última columna. */
export const TD = "px-3 py-2 first:pl-4 last:pr-4"

/** Fila de partida: 44px, divisor hairline, hover plano. */
export const ROW =
  "h-11 border-b border-nauka-subtle transition-colors hover:bg-nauka-bg"

/** Banda de capítulo: espina accent + nombre 11px uppercase dark. */
export const CHAPTER_TD =
  "border-l-2 border-nauka-accent bg-nauka-subtle/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-nauka-dark"

/** Fila de subtotal del capítulo (los valores caen bajo su columna). */
export const SUBTOTAL_ROW = "border-b border-nauka-subtle bg-nauka-bg"

/** Label "Subtotal X" de la fila de subtotal. */
export const SUBTOTAL_LABEL =
  "px-3 py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

/** tfoot del TOTAL: pegado abajo del contenedor de scroll, banda oscura. */
export const TOTAL_FOOT = "sticky bottom-0 z-10"

/** Celda de encabezado. `align` posiciona el label (numéricas a la derecha). */
export function Th({
  children,
  align = "left",
  className,
}: {
  children: ReactNode
  align?: "left" | "right"
  className?: string
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 font-medium first:pl-4 last:pr-4",
        TH_HAIRLINE,
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  )
}
