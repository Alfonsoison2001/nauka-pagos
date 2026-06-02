/**
 * Lógica pura de aprobaciones (sin DB). Única fuente de verdad para derivar el
 * estado de una solicitud a partir de sus votos. Server + client safe.
 */

export type VoteStatus = "pendiente" | "aprobada" | "rechazada"
export type RequestStatus =
  | "en_aprobacion"
  | "aprobada"
  | "rechazada"
  | "cancelada"

export type VoteLike = { status: VoteStatus }

/**
 * Deriva el estado de la solicitud:
 * - algún voto rechazado → 'rechazada'
 * - todos aprobados (y al menos uno) → 'aprobada'
 * - en otro caso → 'en_aprobacion'
 *
 * No produce 'cancelada' (eso es una acción explícita del admin).
 */
export function deriveRequestStatus(votes: VoteLike[]): RequestStatus {
  if (votes.length === 0) return "en_aprobacion"
  if (votes.some((v) => v.status === "rechazada")) return "rechazada"
  if (votes.every((v) => v.status === "aprobada")) return "aprobada"
  return "en_aprobacion"
}

/** Progreso "X de N" aprobadas. */
export function approvalProgress(votes: VoteLike[]): {
  aprobadas: number
  total: number
} {
  return {
    aprobadas: votes.filter((v) => v.status === "aprobada").length,
    total: votes.length,
  }
}

/** ¿La solicitud sigue abierta (acepta votos)? */
export function isOpen(status: RequestStatus): boolean {
  return status === "en_aprobacion"
}

const REQUEST_LABELS: Record<RequestStatus, string> = {
  en_aprobacion: "En aprobación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
}
const VOTE_LABELS: Record<VoteStatus, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
}

export function requestStatusLabel(status: RequestStatus): string {
  return REQUEST_LABELS[status] ?? status
}
export function voteStatusLabel(status: VoteStatus): string {
  return VOTE_LABELS[status] ?? status
}

// ── Tipos de presentación compartidos (chips + timeline + fetch) ─────────────

/** Un voto para los chips de estado ("X de N" + chip por firmante). */
export type VoteDisplay = {
  firmanteNombre: string
  status: VoteStatus
  onBehalf: boolean
}

/** Un voto dentro de una ronda, para la línea de tiempo legible. */
export type TimelineVote = {
  firmanteNombre: string
  status: VoteStatus
  onBehalf: boolean
  decidedByNombre?: string | null
  decidedAt?: string | null
  motivo?: string | null
}

/** Una ronda de aprobación, para la línea de tiempo. */
export type TimelineRound = {
  round: number
  status: RequestStatus
  requestedAt: string
  votes: TimelineVote[]
}
