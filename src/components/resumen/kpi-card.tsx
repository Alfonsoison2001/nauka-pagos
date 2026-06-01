import { cn } from "@/lib/utils"

type Tone = "default" | "positive" | "warning" | "muted"

const toneValue: Record<Tone, string> = {
  default: "text-foreground",
  positive: "text-green-600",
  warning: "text-amber-600",
  muted: "text-muted-foreground",
}

type Props = {
  label: string
  value: string
  hint?: string
  tone?: Tone
}

/** Tarjeta KPI: etiqueta + valor grande (tabular) + hint opcional. */
export function KpiCard({ label, value, hint, tone = "default" }: Props) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span
        className={cn("text-2xl font-semibold tabular-nums", toneValue[tone])}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
