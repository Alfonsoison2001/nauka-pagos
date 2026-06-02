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
    <div className="rounded-2xl border border-nauka-card-border bg-nauka-card p-8 shadow-nauka-card">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        Avance del proyecto
      </p>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-5xl font-medium tabular-nums text-nauka-dark">
          {formatPct(pctAvance)}
        </span>
        <span className="text-sm text-slate-500">ejercido</span>
      </div>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#C9E8E6]">
        <div
          className="h-full rounded-full bg-nauka-accent transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-slate-500 tabular-nums">
        <span className="font-medium text-nauka-dark">
          {formatMXN(ejercido)}
        </span>{" "}
        de {formatMXN(presupuesto)} contratado
      </p>
    </div>
  )
}
