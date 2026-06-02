"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"
import { getMyProfile } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"

export type DecisionResult = { error: string } | { ok: true }

type RequestJoin = {
  id: string
  status: string
  project_id: string
} | null

type VoteRow = {
  id: string
  request_id: string
  firmante_id: string
  status: string
  approval_requests: RequestJoin | RequestJoin[]
}

/** IP del cliente para la constancia (mejor esfuerzo). */
async function clientIp(): Promise<string | null> {
  const h = await headers()
  const fwd = h.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]?.trim() || null
  return h.get("x-real-ip")
}

async function decide(
  approvalId: string,
  decision: "aprobada" | "rechazada",
  motivo: string | null,
): Promise<DecisionResult> {
  const profile = await getMyProfile()
  if (!profile) return { error: "Sesión no válida." }

  const sb = await createClient()
  const { data, error } = await sb
    .from("approvals")
    .select(
      "id, request_id, firmante_id, status, approval_requests(id, status, project_id)",
    )
    .eq("id", approvalId)
    .maybeSingle()
  if (error || !data) return { error: "Aprobación no encontrada." }

  const vote = data as VoteRow
  const req = Array.isArray(vote.approval_requests)
    ? vote.approval_requests[0]
    : vote.approval_requests
  if (!req) return { error: "Solicitud no encontrada." }

  if (req.status !== "en_aprobacion") {
    return { error: "Esta solicitud ya no está abierta." }
  }
  if (vote.status !== "pendiente") {
    return { error: "Este voto ya fue resuelto." }
  }

  const isAdmin = profile.role === "admin"
  const isOwn = !!profile.firmanteId && profile.firmanteId === vote.firmante_id
  if (!isAdmin && !isOwn) {
    return { error: "No tienes permiso para decidir esta aprobación." }
  }

  const { error: updErr } = await sb
    .from("approvals")
    .update({
      status: decision,
      motivo: decision === "rechazada" ? motivo : null,
      decided_at: new Date().toISOString(),
      decided_by: profile.authUserId,
      on_behalf: isAdmin && !isOwn,
      ip: await clientIp(),
    })
    .eq("id", approvalId)
  if (updErr) return { error: updErr.message }

  await recomputeRequest(vote.request_id)

  revalidatePath("/aprobaciones")
  revalidatePath(`/proyectos/${req.project_id}/caratula`)
  return { ok: true }
}

/** Recalcula el estado de la solicitud tras un voto. */
async function recomputeRequest(requestId: string): Promise<void> {
  const sb = await createClient()
  const { data: votes } = await sb
    .from("approvals")
    .select("status")
    .eq("request_id", requestId)
  const rows = (votes ?? []) as { status: string }[]

  let status: "en_aprobacion" | "aprobada" | "rechazada" = "en_aprobacion"
  if (rows.some((v) => v.status === "rechazada")) status = "rechazada"
  else if (rows.length > 0 && rows.every((v) => v.status === "aprobada"))
    status = "aprobada"

  if (status !== "en_aprobacion") {
    await sb
      .from("approval_requests")
      .update({ status, resolved_at: new Date().toISOString() })
      .eq("id", requestId)
  }
}

export async function aprobar(approvalId: string): Promise<DecisionResult> {
  return decide(approvalId, "aprobada", null)
}

const motivoSchema = z.string().trim().min(1, "El motivo es requerido").max(500)

export async function rechazar(
  approvalId: string,
  motivo: string,
): Promise<DecisionResult> {
  const parsed = motivoSchema.safeParse(motivo)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Motivo inválido" }
  }
  return decide(approvalId, "rechazada", parsed.data)
}
