import Link from "next/link"
import type { RequestStatus } from "@/lib/approvals/compute"
import { cn } from "@/lib/utils"

export type ApprovalSummary = {
  status: RequestStatus | null
  aprobadas: number
  total: number
  /** id de la ronda abierta (status='en_aprobacion'), o null. Para bloquear/cancelar. */
  openRequestId: string | null
  /** "Edy ✓, José pendiente, Marcos ✓" — para el tooltip. */
  tooltip: string
}

/**
 * Chip compacto de estado de aprobación para la tabla de Flujo de Pagos.
 * Click → /aprobaciones. Tooltip nativo con el detalle por firmante.
 */
export function ApprovalChip({
  summary,
  href,
}: {
  summary: ApprovalSummary
  href: string
}) {
  const { status } = summary
  if (!status) {
    return <span className="text-xs text-slate-300">—</span>
  }

  const cls =
    status === "aprobada"
      ? "bg-green-100 text-green-700"
      : status === "rechazada"
        ? "bg-red-100 text-red-700"
        : status === "cancelada"
          ? "bg-slate-100 text-slate-500"
          : "bg-slate-200 text-slate-500"
  const label =
    status === "aprobada"
      ? "Aprobada"
      : status === "rechazada"
        ? "Rechazada"
        : status === "cancelada"
          ? "Cancelada"
          : `En aprobación ${summary.aprobadas}/${summary.total}`

  return (
    <Link
      href={href}
      title={summary.tooltip}
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-medium transition-opacity hover:opacity-80",
        cls,
      )}
    >
      {label}
    </Link>
  )
}
