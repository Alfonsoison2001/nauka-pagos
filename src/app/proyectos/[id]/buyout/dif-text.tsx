/**
 * DIF formateado como % con signo (sobre/bajo el presupuesto base). base=0 o sin
 * datos → "—". Sobre base = rojo, bajo base = verde. Compartido por el Resumen en
 * modo Vigente y en modo Evolución (misma presentación). `onDark` para usarlo
 * sobre la fila oscura del TOTAL.
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
