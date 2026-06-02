import { formatMXN, formatPct } from "@/lib/format"
import { SEGMENT_COLORS, SEGMENT_LABELS } from "./colors"

type Props = {
  ejercido: number
  porPagar: number
  noComprometido: number
  total: number
}

/**
 * Barra horizontal de composición global: Ejercido / Por pagar / No comprometido,
 * sobre el total contratado. Div-based (server-friendly), reusable.
 */
export function CompositionBar({
  ejercido,
  porPagar,
  noComprometido,
  total,
}: Props) {
  const pct = (n: number) => (total > 0 ? Math.min(100, (n / total) * 100) : 0)
  const avance = total > 0 ? ejercido / total : 0

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
    <div className="rounded-2xl border border-nauka-card-border bg-nauka-card p-6 shadow-nauka-card">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold text-nauka-dark">
          Composición del proyecto
        </p>
        <p className="text-sm text-slate-500 tabular-nums">
          {formatPct(avance)} ejercido
        </p>
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-white">
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.key}
              style={{ width: `${pct(s.value)}%`, backgroundColor: s.color }}
              className="h-full"
            />
          ) : null,
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs">
            <span
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-muted-foreground">
              {SEGMENT_LABELS[s.key]}:
            </span>
            <span className="font-medium tabular-nums">
              {formatMXN(s.value)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
