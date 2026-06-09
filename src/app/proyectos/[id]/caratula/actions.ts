"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { renderCaratulaPdf } from "@/components/caratula/render-caratula"
import { requireAdmin } from "@/lib/auth/roles"
import {
  caratulaSubject,
  renderCaratulaEmailHtml,
} from "@/lib/email/caratula-email"
import { getResend } from "@/lib/email/resend"
import { createClient } from "@/lib/supabase/server"
import { buildCaratulaData } from "./build-caratula-props"

export type GenerarResult = { error: string } | { ok: true; signedUrl: string }
export type EnviarResult =
  | { error: string }
  | { ok: true; enviadaAt: string; destinatarios: string[] }

const PREVIEW_TTL = 60 * 10 // 10 min

function safeFileName(s: string): string {
  return s
    .replace(/[^\w-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60)
}

// ── Generar (preview) ──────────────────────────────────────────────────────────

export async function generarCaratula(
  estimacionId: string,
  projectId: string,
): Promise<GenerarResult> {
  await requireAdmin()
  const built = await buildCaratulaData(estimacionId, projectId)
  if ("error" in built) return { error: built.error }

  const buffer = await renderCaratulaPdf(built.data.props)

  const sb = await createClient()
  const path = `${projectId}/caratulas/${estimacionId}_generada.pdf`
  const { error: upErr } = await sb.storage
    .from("proyectos")
    .upload(path, buffer, { upsert: true, contentType: "application/pdf" })
  if (upErr) return { error: `Error subiendo PDF: ${upErr.message}` }

  const { error: updErr } = await sb
    .from("estimaciones")
    .update({ caratula_generada_url: path })
    .eq("id", estimacionId)
    .is("deleted_at", null)
  if (updErr) return { error: updErr.message }

  const { data: signed } = await sb.storage
    .from("proyectos")
    .createSignedUrl(path, PREVIEW_TTL)
  if (!signed?.signedUrl) return { error: "No se pudo generar el preview" }

  revalidatePath(`/proyectos/${projectId}/caratula`)
  return { ok: true, signedUrl: signed.signedUrl }
}

// ── Descargar (signed URL del PDF generado) ──────────────────────────────────

export async function getCaratulaSignedUrl(
  estimacionId: string,
): Promise<string | null> {
  const sb = await createClient()
  const { data: est } = await sb
    .from("estimaciones")
    .select("caratula_generada_url")
    .eq("id", estimacionId)
    .maybeSingle()
  const path = (est?.caratula_generada_url as string | null) ?? null
  if (!path) return null
  const { data } = await sb.storage
    .from("proyectos")
    .createSignedUrl(path, PREVIEW_TTL)
  return data?.signedUrl ?? null
}

// ── Enviar ──────────────────────────────────────────────────────────────────

const emailsSchema = z
  .array(z.string().trim().email("Correo inválido"))
  .min(1, "Agrega al menos un destinatario")

export async function enviarCaratula(
  estimacionId: string,
  projectId: string,
  formData: FormData,
): Promise<EnviarResult> {
  await requireAdmin()
  const raw = (formData.get("emails") as string) || ""
  const emails = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const parsed = emailsSchema.safeParse(emails)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Destinatarios inválidos",
    }
  }
  const destinatarios = parsed.data

  const resendBundle = getResend()
  if (!resendBundle) {
    return {
      error:
        "Falta RESEND_API_KEY en el entorno. Agrégala a .env.local para enviar.",
    }
  }

  const built = await buildCaratulaData(estimacionId, projectId)
  if ("error" in built) return { error: built.error }
  const { props, meta } = built.data

  const buffer = await renderCaratulaPdf(props)
  const html = await renderCaratulaEmailHtml({
    lote: meta.lote,
    numero: meta.numero,
    contratista: meta.contratistaNombre,
    partida: meta.partidaNombre,
    montoFormatted: meta.montoFormatted,
    montoLetra: meta.montoLetra,
  })

  const { resend, from } = resendBundle
  const filename = `Caratula_${safeFileName(meta.numero)}_${safeFileName(meta.contratistaNombre)}.pdf`

  const { error: sendErr } = await resend.emails.send({
    from,
    to: destinatarios,
    subject: caratulaSubject({
      lote: meta.lote,
      numero: meta.numero,
      contratista: meta.contratistaNombre,
    }),
    html,
    attachments: [{ filename, content: buffer }],
  })
  if (sendErr) return { error: `Error al enviar: ${sendErr.message}` }

  // Persistir solo tras envío exitoso: copia timestamped + marcas en DB.
  const sb = await createClient()
  const enviadaAt = new Date().toISOString()
  const sentPath = `${projectId}/caratulas/${estimacionId}_${Date.now()}.pdf`
  const { error: upErr } = await sb.storage
    .from("proyectos")
    .upload(sentPath, buffer, { upsert: true, contentType: "application/pdf" })
  if (upErr)
    return { error: `Enviado, pero error guardando copia: ${upErr.message}` }

  const { error: updErr } = await sb
    .from("estimaciones")
    .update({
      caratula_pdf_path: sentPath,
      caratula_enviada_at: enviadaAt,
      destinatarios_email: destinatarios,
    })
    .eq("id", estimacionId)
    .is("deleted_at", null)
  if (updErr)
    return {
      error: `Enviado, pero error actualizando registro: ${updErr.message}`,
    }

  revalidatePath(`/proyectos/${projectId}/caratula`)
  return { ok: true, enviadaAt, destinatarios }
}

// ── Enviar a aprobación (interno) ────────────────────────────────────────────
// Distinto de "Enviar al contratista": crea una ronda de aprobación con un voto
// pendiente por cada firmante activo del proyecto. Solo admin.

export type EnviarAprobacionResult = { error: string } | { ok: true }

export async function enviarAAprobacion(
  estimacionId: string,
  projectId: string,
): Promise<EnviarAprobacionResult> {
  const me = await requireAdmin()
  const sb = await createClient()

  // Firmantes activos del proyecto (orden 1-3).
  const { data: pfRaw } = await sb
    .from("project_firmantes")
    .select("firmante_id, orden, firmantes(id, deleted_at)")
    .eq("project_id", projectId)
    .order("orden")
  type Fj = { id: string; deleted_at: string | null }
  type PF = { firmante_id: string; firmantes: Fj | Fj[] | null }
  const firmanteIds = ((pfRaw ?? []) as PF[])
    .filter((r) => {
      const f = Array.isArray(r.firmantes) ? r.firmantes[0] : r.firmantes
      return f && !f.deleted_at
    })
    .map((r) => r.firmante_id)

  if (firmanteIds.length === 0) {
    return {
      error:
        "Este proyecto no tiene firmantes configurados. Agrégalos en Configuración.",
    }
  }

  // Estado de rondas previas: bloquear si ya hay una abierta; si no, +1 ronda.
  const { data: prev } = await sb
    .from("approval_requests")
    .select("round, status")
    .eq("document_type", "caratula")
    .eq("document_id", estimacionId)
    .order("round", { ascending: false })
  const rows = (prev ?? []) as { round: number; status: string }[]
  if (rows.some((r) => r.status === "en_aprobacion")) {
    return { error: "Esta carátula ya está en aprobación." }
  }
  const nextRound = (rows[0]?.round ?? 0) + 1

  const { data: request, error: reqErr } = await sb
    .from("approval_requests")
    .insert({
      document_type: "caratula",
      document_id: estimacionId,
      project_id: projectId,
      round: nextRound,
      status: "en_aprobacion",
      requested_by: me.authUserId,
    })
    .select("id")
    .single()
  if (reqErr || !request) {
    return { error: reqErr?.message ?? "No se pudo crear la solicitud" }
  }

  const { error: votesErr } = await sb.from("approvals").insert(
    firmanteIds.map((firmante_id) => ({
      request_id: request.id,
      firmante_id,
      status: "pendiente",
    })),
  )
  if (votesErr) return { error: votesErr.message }

  revalidatePath(`/proyectos/${projectId}/caratula`)
  revalidatePath("/aprobaciones")
  return { ok: true }
}

// ── Borrar carátula (admin) ──────────────────────────────────────────────────
// Hard-delete: PDFs de Storage (prefijo {estId}_ en caratulas/ + constancias) +
// approval_requests (cascade borra approvals, vía policy DELETE admin de la
// migración 20260608210244) + reset de los campos de carátula en la estimación.
// MANTIENE comprobante_pago_url y status (manual). El audit_log registra vía triggers.

export type DeleteCaratulaResult = { error: string } | { ok: true }

export async function deleteCaratula(
  estimacionId: string,
  projectId: string,
): Promise<DeleteCaratulaResult> {
  await requireAdmin()
  const sb = await createClient()

  // Recolecta paths de Storage: todo en caratulas/ con prefijo {estId}_ + constancias.
  const { data: files } = await sb.storage
    .from("proyectos")
    .list(`${projectId}/caratulas`, { limit: 1000 })
  const toRemove = (files ?? [])
    .filter((f) => f.name.startsWith(`${estimacionId}_`))
    .map((f) => `${projectId}/caratulas/${f.name}`)
  const { data: reqRows } = await sb
    .from("approval_requests")
    .select("constancia_pdf_path")
    .eq("document_type", "caratula")
    .eq("document_id", estimacionId)
  for (const r of reqRows ?? []) {
    const p = r.constancia_pdf_path as string | null
    if (p) toRemove.push(p)
  }

  // DB primero: borra solicitudes (cascade borra votos). Si falla, aborta antes de Storage.
  const { error: delReqErr } = await sb
    .from("approval_requests")
    .delete()
    .eq("document_type", "caratula")
    .eq("document_id", estimacionId)
  if (delReqErr)
    return { error: `Error borrando aprobaciones: ${delReqErr.message}` }

  const { error: updErr } = await sb
    .from("estimaciones")
    .update({
      caratula_generada_url: null,
      caratula_pdf_path: null,
      caratula_enviada_at: null,
      destinatarios_email: null,
      caratula_firmada_url: null,
    })
    .eq("id", estimacionId)
    .is("deleted_at", null)
  if (updErr) return { error: updErr.message }

  // Storage al final (huérfanos en caso de fallo son benignos).
  if (toRemove.length > 0) {
    const { error: rmErr } = await sb.storage.from("proyectos").remove(toRemove)
    if (rmErr)
      return {
        error: `Registro borrado, pero error en Storage: ${rmErr.message}`,
      }
  }

  revalidatePath(`/proyectos/${projectId}/caratula`)
  revalidatePath("/aprobaciones")
  return { ok: true }
}

// ── Regenerar carátula (admin) ───────────────────────────────────────────────
// Re-renderiza con los datos actuales. Bloqueada si hay una ronda de aprobación
// abierta (la UI también oculta el botón en ese caso).

export async function regenerarCaratula(
  estimacionId: string,
  projectId: string,
): Promise<GenerarResult> {
  await requireAdmin()
  const sb = await createClient()
  const { data: openReq } = await sb
    .from("approval_requests")
    .select("id")
    .eq("document_type", "caratula")
    .eq("document_id", estimacionId)
    .eq("status", "en_aprobacion")
    .limit(1)
  if (openReq && openReq.length > 0) {
    return {
      error: "No puedes regenerar mientras la carátula está en aprobación.",
    }
  }
  return generarCaratula(estimacionId, projectId)
}
