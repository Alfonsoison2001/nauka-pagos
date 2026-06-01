"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { renderCaratulaPdf } from "@/components/caratula/render-caratula"
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

// ── Enviar ──────────────────────────────────────────────────────────────────

const emailsSchema = z
  .array(z.string().trim().email("Correo inválido"))
  .min(1, "Agrega al menos un destinatario")

export async function enviarCaratula(
  estimacionId: string,
  projectId: string,
  formData: FormData,
): Promise<EnviarResult> {
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
