import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * DIF como PILL con flecha de tendencia (tablas del Resumen: Vigente · Evolución).
 * Mantiene la semántica del módulo: sobre-presupuesto (positivo) = rojo con flecha
 * ascendente; debajo (negativo) = verde con flecha descendente; ~0 o sin dato =
 * gris. `onDark` para la fila oscura del TOTAL (pill translúcido legible).
 * El % conserva 1 decimal (es un %, no un monto). Usa la familia de colores
 * semánticos de NAUKA (rojo/verde).
 */
const DIF_PILL =
  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"

export function DifBadge({
  dif,
  onDark,
}: {
  dif: number | null
  onDark?: boolean
}) {
  if (dif === null) {
    return (
      <span
        className={cn(
          DIF_PILL,
          onDark ? "bg-white/10 text-white/60" : "bg-slate-100 text-slate-500",
        )}
      >
        —
      </span>
    )
  }
  const pct = dif * 100
  const text = `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`
  // ~0% → neutro (gris), sin flecha.
  if (Math.abs(pct) < 0.05) {
    return (
      <span
        className={cn(
          DIF_PILL,
          onDark ? "bg-white/10 text-white/70" : "bg-slate-100 text-slate-500",
        )}
      >
        <Minus className="size-3" />
        {text}
      </span>
    )
  }
  const over = pct > 0
  const Arrow = over ? ArrowUpRight : ArrowDownRight
  const cls = over
    ? onDark
      ? "bg-red-400/20 text-red-200"
      : "bg-red-100 text-red-700"
    : onDark
      ? "bg-emerald-400/20 text-emerald-200"
      : "bg-emerald-100 text-emerald-700"
  return (
    <span className={cn(DIF_PILL, cls)}>
      <Arrow className="size-3" />
      {text}
    </span>
  )
}

/**
 * DIF formateado como % con signo (sobre/bajo el presupuesto base). base=0 o sin
 * datos → "—". Sobre base = rojo, bajo base = verde. Lo usa el comparativo de
 * versiones en la pantalla Subcategoría (texto, no pill). `onDark` para fila oscura.
 */
export function DifText({
  dif,
  onDark,
}: {
  dif: number | null
  onDark?: boolean
}) {
  if (dif === null) {
    return (
      <span className={onDark ? "text-white/50" : "text-muted-foreground"}>
        —
      </span>
    )
  }
  const pct = dif * 100
  const text = `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`
  if (onDark) return <span>{text}</span>
  const cls =
    Math.abs(pct) < 0.05
      ? "text-muted-foreground"
      : pct > 0
        ? "text-red-600"
        : "text-emerald-600"
  return <span className={cls}>{text}</span>
}
