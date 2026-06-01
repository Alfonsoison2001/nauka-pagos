import { formatMXN, formatPct } from "@/lib/format"

type Props = {
  pctAvance: number
  ejercido: number
  presupuesto: number
}

/** Hero del Resumen: % avance grande + barra + "Ejercido X de Y contratado". */
export function AvanceHero({ pctAvance, ejercido, presupuesto }: Props) {
  // La barra se topa visualmente en 100% aunque haya sobre-ejercido.
  const width = Math.min(100, Math.max(0, pctAvance * 100))
  return (
    <div className="rounded-xl border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">
        Avance del proyecto
      </p>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-4xl font-bold tabular-nums">
          {formatPct(pctAvance)}
        </span>
        <span className="text-sm text-muted-foreground">ejercido</span>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-green-600 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-muted-foreground tabular-nums">
        <span className="font-medium text-foreground">
          {formatMXN(ejercido)}
        </span>{" "}
        de {formatMXN(presupuesto)} contratado
      </p>
    </div>
  )
}
