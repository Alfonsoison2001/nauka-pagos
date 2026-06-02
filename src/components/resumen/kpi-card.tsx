import { cn } from "@/lib/utils"

type Tone = "default" | "positive" | "warning" | "muted"

const toneValue: Record<Tone, string> = {
  default: "text-nauka-dark",
  positive: "text-nauka-dark",
  warning: "text-nauka-danger",
  muted: "text-slate-500",
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
    <div className="flex flex-col gap-1.5 rounded-2xl border border-nauka-card-border bg-nauka-card p-6 shadow-nauka-card">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span
        className={cn("text-3xl font-medium tabular-nums", toneValue[tone])}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
  )
}
