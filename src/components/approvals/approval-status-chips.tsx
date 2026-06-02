import type {
  RequestStatus,
  VoteDisplay,
  VoteStatus,
} from "@/lib/approvals/compute"
import { requestStatusLabel } from "@/lib/approvals/compute"
import { cn } from "@/lib/utils"

export type { VoteDisplay }

// Pill del estado a nivel documento — colores funcionales.
const REQUEST_PILL: Record<RequestStatus, string> = {
  en_aprobacion: "bg-amber-100 text-amber-700",
  aprobada: "bg-green-100 text-green-700",
  rechazada: "bg-red-100 text-red-700",
  cancelada: "bg-slate-100 text-slate-600",
}
const VOTE_DOT: Record<VoteStatus, string> = {
  pendiente: "bg-slate-300",
  aprobada: "bg-green-500",
  rechazada: "bg-red-500",
}
const VOTE_CHIP: Record<VoteStatus, string> = {
  pendiente: "border-slate-200 text-slate-600",
  aprobada: "border-green-200 text-green-700",
  rechazada: "border-red-200 text-red-700",
}

/** Estado de aprobación de un documento: pill global + "X de N" + chip por firmante. */
export function ApprovalStatusChips({
  status,
  votes,
}: {
  status: RequestStatus
  votes: VoteDisplay[]
}) {
  const aprobadas = votes.filter((v) => v.status === "aprobada").length
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex h-6 items-center rounded-full px-3 text-xs font-medium",
          REQUEST_PILL[status],
        )}
      >
        {requestStatusLabel(status)}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {aprobadas} de {votes.length} aprobada{votes.length === 1 ? "" : "s"}
      </span>
      <span className="flex flex-wrap gap-1.5">
        {votes.map((v) => (
          <span
            key={v.firmanteNombre}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
              VOTE_CHIP[v.status],
            )}
          >
            <span className={cn("size-1.5 rounded-full", VOTE_DOT[v.status])} />
            {v.firmanteNombre}
            {v.onBehalf ? " (rep.)" : ""}
          </span>
        ))}
      </span>
    </div>
  )
}
