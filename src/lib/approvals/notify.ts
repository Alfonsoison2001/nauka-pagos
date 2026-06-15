import { buildCaratulaData } from "@/app/proyectos/[id]/caratula/build-caratula-props"
import type { CaratulaProps } from "@/components/caratula/caratula-document"
import { renderCaratulaPdf } from "@/components/caratula/render-caratula"
import {
  completaSubject,
  nuevaAprobacionSubject,
  rechazadaSubject,
  renderCompletaHtml,
  renderNuevaAprobacionHtml,
  renderRechazadaHtml,
} from "@/lib/email/aprobacion-emails"
import { getResend } from "@/lib/email/resend"
import type { createClient } from "@/lib/supabase/server"

// Sub-fase 8d — efectos de notificación (in-app + email) del flujo de
// aprobación. TODO es best-effort: un fallo aquí NUNCA debe romper la acción
// principal (el voto/solicitud ya se persistió), por eso cada función traga sus
// errores. Resend en modo prueba solo entrega al dueño de la cuenta.

type ServerClient = Awaited<ReturnType<typeof createClient>>

type Meta = {
  lote: string
  numero: string
  contratista: string
  partida: string
  montoFormatted: string
}

function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  )
}

/** Deep-link directo a la solicitud en la bandeja (ancla por estimación). */
function deepLink(projectId: string, estimacionId: string): string {
  return `${appOrigin()}/aprobaciones?proyecto=${projectId}#est-${estimacionId}`
}

async function loadMeta(
  estimacionId: string,
  projectId: string,
): Promise<{ meta: Meta; props: CaratulaProps } | null> {
  const built = await buildCaratulaData(estimacionId, projectId)
  if ("error" in built) return null
  const m = built.data.meta
  return {
    meta: {
      lote: m.lote,
      numero: m.numero,
      contratista: m.contratistaNombre,
      partida: m.partidaNombre,
      montoFormatted: m.montoFormatted,
    },
    props: built.data.props,
  }
}

function safeFileName(s: string): string {
  return s
    .replace(/[^\w-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60)
}

type ProfileRow = { auth_user_id: string; email: string; nombre: string }
type AdminRow = { email: string; nombre: string }

// ── (A) Enviada a aprobación → aprobadores ───────────────────────────────────

export async function notifyNuevaAprobacion(
  sb: ServerClient,
  args: {
    estimacionId: string
    projectId: string
    requestId: string
    firmanteIds: string[]
  },
): Promise<void> {
  try {
    if (args.firmanteIds.length === 0) return
    // El que envía es admin → RLS de profiles le deja leer a los aprobadores.
    const { data: profs } = await sb
      .from("profiles")
      .select("auth_user_id, email, nombre")
      .in("firmante_id", args.firmanteIds)
      .is("deleted_at", null)
    const recipients = (profs ?? []) as ProfileRow[]
    if (recipients.length === 0) return

    const loaded = await loadMeta(args.estimacionId, args.projectId)
    if (!loaded) return
    const { meta } = loaded
    const link = deepLink(args.projectId, args.estimacionId)

    for (const r of recipients) {
      await sb.rpc("fn_create_notification", {
        p_user_id: r.auth_user_id,
        p_type: "nueva_aprobacion",
        p_title: `Carátula por aprobar · Est. ${meta.numero}`,
        p_body: `${meta.contratista} · ${meta.partida} · ${meta.montoFormatted}`,
        p_link: link,
        p_request_id: args.requestId,
      })
    }

    const bundle = getResend()
    if (!bundle) return
    const subject = nuevaAprobacionSubject(meta)
    for (const r of recipients) {
      const html = await renderNuevaAprobacionHtml({
        ...meta,
        firmanteNombre: r.nombre,
        link,
      })
      await bundle.resend.emails.send({
        from: bundle.from,
        to: [r.email],
        subject,
        html,
      })
    }
  } catch (e) {
    console.error("notifyNuevaAprobacion", e)
  }
}

// ── (B) Progreso (voto parcial, sigue abierta) → admins (solo in-app) ─────────

export async function notifyProgreso(
  sb: ServerClient,
  args: {
    estimacionId: string
    projectId: string
    requestId: string
    firmanteNombre: string
  },
): Promise<void> {
  try {
    await sb.rpc("fn_notify_admins", {
      p_type: "progreso",
      p_title: "Avance de aprobación",
      p_body: `${args.firmanteNombre} aprobó · faltan firmas`,
      p_link: deepLink(args.projectId, args.estimacionId),
      p_request_id: args.requestId,
    })
  } catch (e) {
    console.error("notifyProgreso", e)
  }
}

// ── (C) Rechazo → admins (in-app + email) ────────────────────────────────────

export async function notifyRechazo(
  sb: ServerClient,
  args: {
    estimacionId: string
    projectId: string
    requestId: string
    motivo: string
    firmanteNombre: string
  },
): Promise<void> {
  try {
    const loaded = await loadMeta(args.estimacionId, args.projectId)
    const meta = loaded?.meta
    const link = deepLink(args.projectId, args.estimacionId)
    const { data } = await sb.rpc("fn_notify_admins", {
      p_type: "rechazada",
      p_title: `Carátula rechazada${meta ? ` · Est. ${meta.numero}` : ""}`,
      p_body: `${args.firmanteNombre}: ${args.motivo}`,
      p_link: link,
      p_request_id: args.requestId,
    })
    const admins = (data ?? []) as AdminRow[]
    const bundle = getResend()
    if (!bundle || !meta || admins.length === 0) return
    const html = await renderRechazadaHtml({
      lote: meta.lote,
      numero: meta.numero,
      contratista: meta.contratista,
      firmanteNombre: args.firmanteNombre,
      motivo: args.motivo,
      link,
    })
    await bundle.resend.emails.send({
      from: bundle.from,
      to: admins.map((a) => a.email),
      subject: rechazadaSubject(meta),
      html,
    })
  } catch (e) {
    console.error("notifyRechazo", e)
  }
}

// ── (D) Aprobación completa → admins (in-app + email con PDF) ─────────────────

export async function notifyAprobacionCompleta(
  sb: ServerClient,
  args: { estimacionId: string; projectId: string; requestId: string },
): Promise<void> {
  try {
    const loaded = await loadMeta(args.estimacionId, args.projectId)
    const link = deepLink(args.projectId, args.estimacionId)
    const { data } = await sb.rpc("fn_notify_admins", {
      p_type: "aprobada",
      p_title: `Carátula aprobada${loaded ? ` · Est. ${loaded.meta.numero}` : ""}`,
      p_body: loaded
        ? `${loaded.meta.contratista} · lista para enviar al pagador`
        : "Lista para enviar al pagador",
      p_link: link,
      p_request_id: args.requestId,
    })
    const admins = (data ?? []) as AdminRow[]
    const bundle = getResend()
    if (!bundle || !loaded || admins.length === 0) return
    const { meta, props } = loaded
    const buffer = await renderCaratulaPdf(props)
    const filename = `Caratula_${safeFileName(meta.numero)}_${safeFileName(meta.contratista)}.pdf`
    const html = await renderCompletaHtml({
      lote: meta.lote,
      numero: meta.numero,
      contratista: meta.contratista,
      link,
    })
    await bundle.resend.emails.send({
      from: bundle.from,
      to: admins.map((a) => a.email),
      subject: completaSubject(meta),
      html,
      attachments: [{ filename, content: buffer }],
    })
  } catch (e) {
    console.error("notifyAprobacionCompleta", e)
  }
}
