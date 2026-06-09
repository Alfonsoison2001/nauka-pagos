"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ── Shared types ──────────────────────────────────────────────────────────────

export type ActionResult = { error: string } | { ok: true }
export type CreateEstimacionResult =
  | { error: string }
  | { ok: true; estimacionId: string }

export type EstimacionRow = {
  id: string
  partida_id: string
  contratista_id: string
  contratista_nombre: string
  partida_nombre: string
  partida_presupuesto_con_iva: number
  partida_iva_pct: number
  pagador_id: string | null
  pagador_nombre: string | null
  numero: string
  concepto: string | null
  monto_sin_iva: number
  iva_pct: number
  iva_monto: number
  monto_con_iva: number
  fecha_estimacion: string
  status: "pendiente" | "enviada" | "pagada"
  notas: string | null
  caratula_generada_url: string | null
  caratula_firmada_url: string | null
  comprobante_pago_url: string | null
  pagado_acum: number
  resto_por_pagar: number
}

export type ContratistaOption = { id: string; nombre: string }
export type PartidaOption = {
  id: string
  contratista_id: string
  nombre: string
  presupuesto_con_iva: number
  iva_pct: number
}
export type PagadorOption = { id: string; nombre: string }

// ── Schema ────────────────────────────────────────────────────────────────────

const estimacionSchema = z.object({
  partida_id: z.string().uuid("Partida inválida"),
  pagador_id: z.string().uuid("Pagador inválido"),
  numero: z.string().trim().min(1, "# Estimación requerido"),
  concepto: z.string().trim().optional(),
  fecha_estimacion: z.string().min(1, "Fecha requerida"),
  monto_sin_iva: z.coerce.number().min(0, "Debe ser ≥ 0"),
  // iva_pct sent by client: 0.16 (checkbox on) or 0 (checkbox off)
  iva_pct: z.coerce.number().min(0).max(1),
  // Status manual: pendiente | enviada | pagada
  status: z.enum(["pendiente", "enviada", "pagada"]),
  notas: z.string().trim().optional(),
})

function parseFormData(fd: FormData) {
  return estimacionSchema.safeParse({
    partida_id: fd.get("partida_id"),
    pagador_id: fd.get("pagador_id"),
    numero: fd.get("numero"),
    concepto: (fd.get("concepto") as string) || undefined,
    fecha_estimacion: fd.get("fecha_estimacion"),
    monto_sin_iva: fd.get("monto_sin_iva"),
    iva_pct: fd.get("iva_pct"),
    status: fd.get("status"),
    notas: (fd.get("notas") as string) || undefined,
  })
}

// ── createEstimacion ──────────────────────────────────────────────────────────

export async function createEstimacion(
  projectId: string,
  formData: FormData,
): Promise<CreateEstimacionResult> {
  const parsed = parseFormData(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const d = parsed.data

  const sb = await createClient()
  // Validate partida exists (FK would catch it, but gives a clear message)
  const { data: partida } = await sb
    .from("partidas")
    .select("id")
    .eq("id", d.partida_id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!partida) return { error: "Partida no encontrada" }

  const { data: created, error } = await sb
    .from("estimaciones")
    .insert({
      partida_id: d.partida_id,
      pagador_id: d.pagador_id,
      numero: d.numero,
      concepto: d.concepto ?? null,
      fecha_estimacion: d.fecha_estimacion,
      monto_sin_iva: d.monto_sin_iva,
      iva_pct: d.iva_pct,
      status: d.status,
      notas: d.notas ?? null,
    })
    .select("id")
    .single()
  if (error || !created) {
    return { error: error?.message ?? "Error al crear estimación" }
  }

  revalidatePath(`/proyectos/${projectId}/flujo-de-pagos`)
  return { ok: true, estimacionId: created.id as string }
}

// ── updateEstimacion ──────────────────────────────────────────────────────────

export async function updateEstimacion(
  estimacionId: string,
  projectId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseFormData(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const d = parsed.data

  const sb = await createClient()
  const { error } = await sb
    .from("estimaciones")
    .update({
      partida_id: d.partida_id,
      pagador_id: d.pagador_id,
      numero: d.numero,
      concepto: d.concepto ?? null,
      fecha_estimacion: d.fecha_estimacion,
      monto_sin_iva: d.monto_sin_iva,
      iva_pct: d.iva_pct,
      status: d.status,
      notas: d.notas ?? null,
    })
    .eq("id", estimacionId)
    .is("deleted_at", null)
  if (error) return { error: error.message }

  revalidatePath(`/proyectos/${projectId}/flujo-de-pagos`)
  return { ok: true }
}

// ── deleteEstimacion ──────────────────────────────────────────────────────────

export async function deleteEstimacion(
  estimacionId: string,
  projectId: string,
): Promise<ActionResult> {
  const sb = await createClient()
  const { error } = await sb
    .from("estimaciones")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", estimacionId)
    .is("deleted_at", null)
  if (error) return { error: error.message }
  revalidatePath(`/proyectos/${projectId}/flujo-de-pagos`)
  return { ok: true }
}

// ── uploadComprobante ─────────────────────────────────────────────────────────

const ALLOWED_COMPROBANTE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]
const COMPROBANTE_MAX_BYTES = 10 * 1024 * 1024

export async function uploadComprobante(
  estimacionId: string,
  projectId: string,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("file") as File | null
  if (!file || file.size === 0) return { error: "No se seleccionó archivo" }
  if (!ALLOWED_COMPROBANTE_TYPES.includes(file.type)) {
    return { error: "Solo se aceptan PDF, PNG, JPG o WEBP" }
  }
  if (file.size > COMPROBANTE_MAX_BYTES) {
    return { error: "El archivo debe pesar máximo 10 MB" }
  }

  // Path without extension — upsert replaces regardless of previous type
  const path = `${projectId}/comprobantes/${estimacionId}`
  const sb = await createClient()
  const { error: uploadErr } = await sb.storage
    .from("proyectos")
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadErr) {
    return { error: `Error subiendo archivo: ${uploadErr.message}` }
  }

  const { error: updateErr } = await sb
    .from("estimaciones")
    .update({ comprobante_pago_url: path })
    .eq("id", estimacionId)
    .is("deleted_at", null)
  if (updateErr) return { error: updateErr.message }

  revalidatePath(`/proyectos/${projectId}/flujo-de-pagos`)
  return { ok: true }
}

// ── getComprobanteSignedUrl ───────────────────────────────────────────────────

export async function getComprobanteSignedUrl(
  path: string,
): Promise<string | null> {
  const sb = await createClient()
  const { data } = await sb.storage
    .from("proyectos")
    .createSignedUrl(path, 60 * 5)
  return data?.signedUrl ?? null
}
