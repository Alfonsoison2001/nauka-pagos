import type { TimelineRound, TimelineVote } from "@/lib/approvals/compute"
import { formatDateTime } from "@/lib/format/fecha"
import { EliminarRondaButton } from "./eliminar-ronda-button"

export type { TimelineRound, TimelineVote }

function voteLine(v: TimelineVote): string {
  if (v.status === "pendiente") return `Pendiente: ${v.firmanteNombre}`
  const verbo = v.status === "aprobada" ? "aprobó" : "rechazó"
  const rep =
    v.onBehalf && v.decidedByNombre
      ? ` (en representación, por ${v.decidedByNombre})`
      : ""
  const cuando = v.decidedAt ? ` el ${formatDateTime(v.decidedAt)}` : ""
  const motivo = v.status === "rechazada" && v.motivo ? ` — “${v.motivo}”` : ""
  return `${v.firmanteNombre} ${verbo}${cuando}${rep}${motivo}`
}

/** Línea de tiempo legible de la aprobación (visible para todos). Más reciente arriba. */
export function ApprovalTimeline({
  rounds,
  isAdmin = false,
}: {
  rounds: TimelineRound[]
  /** Admin: muestra "Eliminar del historial" en rondas canceladas/rechazadas. */
  isAdmin?: boolean
}) {
  if (rounds.length === 0) return null
  const ordered = [...rounds].sort((a, b) => b.round - a.round)

  return (
    <ol className="flex flex-col gap-3">
      {ordered.map((r) => (
        <li key={r.round} className="border-l-2 border-nauka-subtle pl-3">
          <p className="text-xs font-medium text-nauka-dark">
            Ronda {r.round} · enviada {formatDateTime(r.requestedAt)}
          </p>
          {r.status === "cancelada" && (
            <p className="mt-0.5 text-xs text-amber-700">
              Cancelada{r.canceledByNombre ? ` por ${r.canceledByNombre}` : ""}
              {r.cancelMotivo ? ` — “${r.cancelMotivo}”` : ""}
            </p>
          )}
          <ul className="mt-1 flex flex-col gap-0.5">
            {r.votes.map((v) => (
              <li
                key={v.firmanteNombre}
                className="text-xs text-muted-foreground"
              >
                {voteLine(v)}
              </li>
            ))}
          </ul>
          {isAdmin && (r.status === "cancelada" || r.status === "rechazada") ? (
            <div className="mt-1.5">
              <EliminarRondaButton requestId={r.requestId} round={r.round} />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
