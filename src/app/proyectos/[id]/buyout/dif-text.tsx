import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * DIF con flecha de tendencia (tablas del Resumen: Vigente · Evolución). Texto
 * con signo, SIN pill de fondo (design-prompt § Buy-Out: el color es la señal,
 * el fondo sobra a nivel fila). Semántica intacta: sobre-presupuesto (positivo)
 * = rojo con flecha ascendente; debajo (negativo) = verde con flecha
 * descendente; ~0 o sin dato = gris. `onDark` para la banda oscura del TOTAL
 * (tintas claras). El % conserva 1 decimal (es un %, no un monto). Usa los
 * tokens semánticos de NAUKA (danger/success).
 */
const DIF_TEXT =
  "inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium tabular-nums"

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
          DIF_TEXT,
          onDark ? "text-white/55" : "text-nauka-neutral",
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
          DIF_TEXT,
          onDark ? "text-white/70" : "text-nauka-neutral",
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
      ? "text-red-300"
      : "text-nauka-danger"
    : onDark
      ? "text-emerald-300"
      : "text-nauka-success"
  return (
    <span className={cn(DIF_TEXT, cls)}>
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
