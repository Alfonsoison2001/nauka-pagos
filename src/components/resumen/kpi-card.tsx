import { cn } from "@/lib/utils"

type Tone = "default" | "positive" | "warning" | "muted"
type Variant = "light" | "dark"

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
  /** "dark" = card hero azul oscuro con valor en turquesa (alto contraste). */
  variant?: Variant
}

/** Tarjeta KPI: etiqueta uppercase + valor grande (tabular) + hint opcional. */
export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  variant = "light",
}: Props) {
  const dark = variant === "dark"
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-2xl border p-6 shadow-nauka-card",
        dark
          ? "border-transparent bg-nauka-dark"
          : "border-nauka-card-border bg-nauka-card",
      )}
    >
      <span
        className={cn(
          "text-xs font-medium uppercase tracking-wider",
          dark ? "text-nauka-accent/70" : "text-slate-500",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-3xl font-medium tabular-nums",
          dark ? "text-nauka-accent" : toneValue[tone],
        )}
      >
        {value}
      </span>
      {hint && (
        <span
          className={cn("text-xs", dark ? "text-white/50" : "text-slate-400")}
        >
          {hint}
        </span>
      )}
    </div>
  )
}
