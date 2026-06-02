import type { EstatusEstimacion } from "@/lib/resumen/compute"
import { cn } from "@/lib/utils"

// Badge de estatus de estimación — colores FUNCIONALES (no la regla azul):
// Pendiente gris · Enviada amber · Pagada verde. Estilo pill suave (design-prompt.md).
const STYLE: Record<EstatusEstimacion, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "bg-slate-100 text-slate-600" },
  enviada: { label: "Enviada", cls: "bg-amber-100 text-amber-700" },
  pagada: { label: "Pagada", cls: "bg-green-100 text-green-700" },
}

export function EstatusBadge({
  status,
  className,
}: {
  status: EstatusEstimacion
  className?: string
}) {
  const s = STYLE[status]
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-3 text-xs font-medium",
        s.cls,
        className,
      )}
    >
      {s.label}
    </span>
  )
}
