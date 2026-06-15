import type { createClient } from "@/lib/supabase/server"
import type {
  RequestStatus,
  TimelineRound,
  VoteDisplay,
  VoteStatus,
} from "./compute"

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type ApprovalRequestRow = {
  id: string
  documentId: string
  projectId: string
  round: number
  status: RequestStatus
  requestedAt: string
  resolvedAt: string | null
  /** Solo en rondas canceladas: nombre del admin que canceló + motivo. */
  canceledByNombre: string | null
  cancelMotivo: string | null
}
export type ApprovalVoteRow = {
  id: string
  requestId: string
  firmanteId: string
  firmanteNombre: string
  status: VoteStatus
  onBehalf: boolean
  decidedAt: string | null
  motivo: string | null
}

type RawRequest = {
  id: string
  document_id: string
  project_id: string
  round: number
  status: string
  requested_at: string
  resolved_at: string | null
  canceled_by: string | null
  cancel_motivo: string | null
}
type RawVote = {
  id: string
  request_id: string
  firmante_id: string
  status: string
  on_behalf: boolean
  decided_at: string | null
  motivo: string | null
}

function mapRequest(
  r: RawRequest,
  cancelerNames: Map<string, string>,
): ApprovalRequestRow {
  return {
    id: r.id,
    documentId: r.document_id,
    projectId: r.project_id,
    round: r.round,
    status: r.status as RequestStatus,
    requestedAt: r.requested_at,
    resolvedAt: r.resolved_at,
    canceledByNombre: r.canceled_by
      ? (cancelerNames.get(r.canceled_by) ?? null)
      : null,
    cancelMotivo: r.cancel_motivo,
  }
}

/** Resuelve auth_user_id → nombre vía profiles (para "quién canceló"). */
async function resolveProfileNames(
  sb: ServerClient,
  authUserIds: string[],
): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  if (authUserIds.length === 0) return m
  const { data } = await sb
    .from("profiles")
    .select("auth_user_id, nombre")
    .in("auth_user_id", authUserIds)
  for (const p of (data ?? []) as { auth_user_id: string; nombre: string }[]) {
    m.set(p.auth_user_id, p.nombre)
  }
  return m
}

/** Solicitudes de carátula; opcionalmente acotadas a ciertos document_id. */
export async function fetchCaratulaRequests(
  sb: ServerClient,
  documentIds?: string[],
): Promise<ApprovalRequestRow[]> {
  if (documentIds && documentIds.length === 0) return []
  let q = sb
    .from("approval_requests")
    .select(
      "id, document_id, project_id, round, status, requested_at, resolved_at, canceled_by, cancel_motivo",
    )
    .eq("document_type", "caratula")
  if (documentIds) q = q.in("document_id", documentIds)
  const { data } = await q.order("requested_at", { ascending: false })
  const all = (data ?? []) as RawRequest[]

  // Excluir rondas huérfanas: cuyo document_id apunta a una estimación
  // soft-deleted (deleted_at IS NOT NULL) o inexistente. La bandeja y el badge
  // no deben mostrarlas (no hay carátula viva detrás).
  const raw = await filterLiveCaratulaRequests(sb, all)

  const cancelerNames = await resolveProfileNames(sb, [
    ...new Set(
      raw.map((r) => r.canceled_by).filter((x): x is string => Boolean(x)),
    ),
  ])
  return raw.map((r) => mapRequest(r, cancelerNames))
}

/** Conserva solo las solicitudes cuyo document_id es una estimación viva. */
async function filterLiveCaratulaRequests(
  sb: ServerClient,
  requests: RawRequest[],
): Promise<RawRequest[]> {
  if (requests.length === 0) return requests
  const docIds = [...new Set(requests.map((r) => r.document_id))]
  const { data } = await sb
    .from("estimaciones")
    .select("id")
    .in("id", docIds)
    .is("deleted_at", null)
  const live = new Set((data ?? []).map((e) => e.id as string))
  return requests.filter((r) => live.has(r.document_id))
}

async function resolveFirmanteNames(
  sb: ServerClient,
  ids: string[],
): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  if (ids.length === 0) return m
  const { data } = await sb.from("firmantes").select("id, nombre").in("id", ids)
  for (const f of (data ?? []) as { id: string; nombre: string }[]) {
    m.set(f.id, f.nombre)
  }
  return m
}

/** Votos agrupados por request_id, con el nombre del firmante resuelto. */
export async function fetchVotesByRequest(
  sb: ServerClient,
  requestIds: string[],
): Promise<Map<string, ApprovalVoteRow[]>> {
  const map = new Map<string, ApprovalVoteRow[]>()
  if (requestIds.length === 0) return map

  const { data: vRaw } = await sb
    .from("approvals")
    .select(
      "id, request_id, firmante_id, status, on_behalf, decided_at, motivo",
    )
    .in("request_id", requestIds)
  const votes = (vRaw ?? []) as RawVote[]
  const names = await resolveFirmanteNames(sb, [
    ...new Set(votes.map((v) => v.firmante_id)),
  ])

  for (const v of votes) {
    const arr = map.get(v.request_id) ?? []
    arr.push({
      id: v.id,
      requestId: v.request_id,
      firmanteId: v.firmante_id,
      firmanteNombre: names.get(v.firmante_id) ?? "—",
      status: v.status as VoteStatus,
      onBehalf: v.on_behalf,
      decidedAt: v.decided_at,
      motivo: v.motivo,
    })
    map.set(v.request_id, arr)
  }
  return map
}

export type DocumentApproval = {
  hasRequests: boolean
  latestStatus: RequestStatus | null
  latestRound: number
  isOpen: boolean
  /** id de la solicitud abierta (status='en_aprobacion'), o null. Para cancelar. */
  openRequestId: string | null
  chips: VoteDisplay[]
  rounds: TimelineRound[]
  /** Voto pendiente del usuario actual en la ronda abierta (para firmar). */
  myPendingApprovalId: string | null
  /** Votos pendientes (id + firmante) de la ronda abierta — para override admin. */
  pendingVotes: { approvalId: string; firmanteNombre: string }[]
  rejectionMotivo: string | null
}

/**
 * Ensambla el estado de aprobación de UN documento a partir de sus rondas y
 * votos. Reusado por la bandeja y la pestaña Carátula.
 */
export function buildDocumentApproval(
  requestsForDoc: ApprovalRequestRow[],
  votesByRequest: Map<string, ApprovalVoteRow[]>,
  myFirmanteId: string | null,
): DocumentApproval {
  if (requestsForDoc.length === 0) {
    return {
      hasRequests: false,
      latestStatus: null,
      latestRound: 0,
      isOpen: false,
      openRequestId: null,
      chips: [],
      rounds: [],
      myPendingApprovalId: null,
      pendingVotes: [],
      rejectionMotivo: null,
    }
  }

  const sorted = [...requestsForDoc].sort((a, b) => b.round - a.round)
  const latest = sorted[0]
  const latestVotes = votesByRequest.get(latest.id) ?? []
  const isOpen = latest.status === "en_aprobacion"

  const rounds: TimelineRound[] = sorted.map((r) => ({
    requestId: r.id,
    round: r.round,
    status: r.status,
    requestedAt: r.requestedAt,
    canceledByNombre: r.canceledByNombre,
    cancelMotivo: r.cancelMotivo,
    votes: (votesByRequest.get(r.id) ?? []).map((v) => ({
      firmanteNombre: v.firmanteNombre,
      status: v.status,
      onBehalf: v.onBehalf,
      decidedAt: v.decidedAt,
      motivo: v.motivo,
    })),
  }))

  const pendingVotes = isOpen
    ? latestVotes
        .filter((v) => v.status === "pendiente")
        .map((v) => ({ approvalId: v.id, firmanteNombre: v.firmanteNombre }))
    : []
  const myVote =
    isOpen && myFirmanteId
      ? latestVotes.find(
          (v) => v.firmanteId === myFirmanteId && v.status === "pendiente",
        )
      : undefined

  return {
    hasRequests: true,
    latestStatus: latest.status,
    latestRound: latest.round,
    isOpen,
    openRequestId: isOpen ? latest.id : null,
    chips: latestVotes.map((v) => ({
      firmanteNombre: v.firmanteNombre,
      status: v.status,
      onBehalf: v.onBehalf,
    })),
    rounds,
    myPendingApprovalId: myVote?.id ?? null,
    pendingVotes,
    rejectionMotivo:
      latest.status === "rechazada"
        ? (latestVotes.find((v) => v.status === "rechazada")?.motivo ?? null)
        : null,
  }
}

/**
 * Conteo de aprobaciones pendientes para el badge del sidebar (context-aware).
 * - admin: solicitudes abiertas (status='en_aprobacion').
 * - aprobador: sus votos pendientes en solicitudes abiertas.
 * Si se pasa `projectId`, cuenta solo ese proyecto; si no, global.
 * No realtime: se recalcula al navegar.
 */
export async function getPendingApprovalsCount(
  sb: ServerClient,
  role: "admin" | "aprobador",
  firmanteId: string | null,
  projectId?: string,
): Promise<number> {
  // Solicitudes abiertas de carátula (excluyendo huérfanas de estimaciones
  // soft-deleted), opcionalmente acotadas a un proyecto.
  let openQ = sb
    .from("approval_requests")
    .select("id, document_id")
    .eq("document_type", "caratula")
    .eq("status", "en_aprobacion")
  if (projectId) openQ = openQ.eq("project_id", projectId)
  const { data: openRaw } = await openQ
  const open = (openRaw ?? []) as { id: string; document_id: string }[]
  if (open.length === 0) return 0

  const docIds = [...new Set(open.map((r) => r.document_id))]
  const { data: liveEst } = await sb
    .from("estimaciones")
    .select("id")
    .in("id", docIds)
    .is("deleted_at", null)
  const live = new Set((liveEst ?? []).map((e) => e.id as string))
  const ids = open.filter((r) => live.has(r.document_id)).map((r) => r.id)
  if (ids.length === 0) return 0

  if (role === "admin") return ids.length

  if (!firmanteId) return 0
  const { count } = await sb
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .in("request_id", ids)
    .eq("firmante_id", firmanteId)
    .eq("status", "pendiente")
  return count ?? 0
}
