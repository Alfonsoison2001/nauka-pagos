import { formatMXN, formatPct } from "@/lib/format"
import { SEGMENT_COLORS, SEGMENT_LABELS } from "./colors"

type Props = {
  pctAvance: number
  ejercido: number
  porPagar: number
  presupuesto: number
}

/** Hero del Resumen: % avance grande + barra de 3 colores (Ejercido / Por
 * pagar / No comprometido) + "Ejercido X de Y contratado". */
export function AvanceHero({
  pctAvance,
  ejercido,
  porPagar,
  presupuesto,
}: Props) {
  const noComprometido = Math.max(0, presupuesto - ejercido - porPagar)
  const pct = (n: number) =>
    presupuesto > 0 ? Math.min(100, Math.max(0, (n / presupuesto) * 100)) : 0
  const segments = [
    { key: "ejercido", value: ejercido, color: SEGMENT_COLORS.ejercido },
    { key: "porPagar", value: porPagar, color: SEGMENT_COLORS.porPagar },
    {
      key: "noComprometido",
      value: noComprometido,
      color: SEGMENT_COLORS.noComprometido,
    },
  ] as const

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
      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.key}
              className="h-full"
              style={{ width: `${pct(s.value)}%`, backgroundColor: s.color }}
            />
          ) : null,
        )}
      </div>
      {/* Leyenda: los 3 segmentos con su color y monto. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-muted-foreground">
              {SEGMENT_LABELS[s.key]}:
            </span>
            <span className="font-medium tabular-nums text-nauka-dark">
              {formatMXN(s.value)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
