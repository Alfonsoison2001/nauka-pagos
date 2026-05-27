"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// Shared types exported for client components
// ---------------------------------------------------------------------------

export type ActionResult = { error: string } | { ok: true }

export type PartidaRow = {
  id: string
  contratista_id: string
  contratista_nombre: string
  nombre: string
  presupuesto_sin_iva: number
  iva_pct: number
  iva_monto: number
  presupuesto_con_iva: number
  notas: string | null
  fecha_firma: string | null
  presupuesto_pdf_url: string | null
}

export type ContratistaOption = { id: string; nombre: string }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const PDF_MAX_BYTES = 10 * 1024 * 1024

type Sb = Awaited<ReturnType<typeof createClient>>

async function resolveContratista(
  sb: Sb,
  projectId: string,
  contratistaId: string | undefined,
  contratistaNombre: string | undefined,
): Promise<{ id: string } | { error: string }> {
  if (contratistaId && contratistaId !== "crear_nuevo") {
    return { id: contratistaId }
  }
  const nombre = contratistaNombre?.trim()
  if (!nombre) return { error: "Nombre del contratista requerido" }
  const { data: existing } = await sb
    .from("contratistas")
    .select("id")
    .eq("project_id", projectId)
    .eq("nombre", nombre)
    .is("deleted_at", null)
    .maybeSingle()
  if (existing) return { id: existing.id as string }
  const { data: created, error } = await sb
    .from("contratistas")
    .insert({ project_id: projectId, nombre })
    .select("id")
    .single()
  if (error || !created) {
    return { error: error?.message ?? "Error al crear contratista" }
  }
  return { id: created.id as string }
}

async function uploadPdf(
  sb: Sb,
  file: File,
  projectId: string,
  partidaId: string,
): Promise<{ path: string } | { error: string }> {
  if (file.size > PDF_MAX_BYTES)
    return { error: "El PDF debe pesar máximo 10 MB" }
  if (file.type !== "application/pdf")
    return { error: "Solo se aceptan archivos PDF" }
  const path = `${projectId}/presupuestos/${partidaId}.pdf`
  const { error } = await sb.storage
    .from("proyectos")
    .upload(path, file, { upsert: true, contentType: "application/pdf" })
  if (error) return { error: `Error subiendo PDF: ${error.message}` }
  return { path }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createSchema = z.object({
  contratista_id: z.string().optional(),
  contratista_nombre: z.string().trim().optional(),
  nombre: z.string().trim().min(1, "Nombre de partida requerido"),
  presupuesto_sin_iva: z.coerce.number().min(0, "Debe ser ≥ 0"),
  iva_pct: z.coerce.number().min(0).max(100).default(16),
  notas: z.string().trim().optional(),
  fecha_firma: z.string().optional(),
})

const updateSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre de partida requerido"),
  presupuesto_sin_iva: z.coerce.number().min(0, "Debe ser ≥ 0"),
  iva_pct: z.coerce.number().min(0).max(100).default(16),
  notas: z.string().trim().optional(),
  fecha_firma: z.string().optional(),
})

// ---------------------------------------------------------------------------
// createPartida
// ---------------------------------------------------------------------------

export async function createPartida(
  projectId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createSchema.safeParse({
    contratista_id: (formData.get("contratista_id") as string) || undefined,
    contratista_nombre:
      (formData.get("contratista_nombre") as string) || undefined,
    nombre: formData.get("nombre"),
    presupuesto_sin_iva: formData.get("presupuesto_sin_iva"),
    iva_pct: formData.get("iva_pct"),
    notas: (formData.get("notas") as string) || undefined,
    fecha_firma: (formData.get("fecha_firma") as string) || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const d = parsed.data
  if (!d.contratista_id && !d.contratista_nombre) {
    return { error: "Selecciona o crea un contratista" }
  }

  const sb = await createClient()
  const cResult = await resolveContratista(
    sb,
    projectId,
    d.contratista_id,
    d.contratista_nombre,
  )
  if ("error" in cResult) return { error: cResult.error }

  const { data: partida, error: insertErr } = await sb
    .from("partidas")
    .insert({
      contratista_id: cResult.id,
      nombre: d.nombre,
      presupuesto_sin_iva: d.presupuesto_sin_iva,
      iva_pct: d.iva_pct / 100,
      notas: d.notas ?? null,
      fecha_firma: d.fecha_firma || null,
    })
    .select("id")
    .single()
  if (insertErr || !partida) {
    return { error: insertErr?.message ?? "Error al crear partida" }
  }

  const pdfFile = formData.get("pdf") as File | null
  if (pdfFile && pdfFile.size > 0) {
    const pResult = await uploadPdf(
      sb,
      pdfFile,
      projectId,
      partida.id as string,
    )
    if ("error" in pResult) return { error: pResult.error }
    await sb
      .from("partidas")
      .update({ presupuesto_pdf_url: pResult.path })
      .eq("id", partida.id)
  }

  revalidatePath(`/proyectos/${projectId}/presupuesto`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// updatePartida
// ---------------------------------------------------------------------------

export async function updatePartida(
  partidaId: string,
  projectId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateSchema.safeParse({
    nombre: formData.get("nombre"),
    presupuesto_sin_iva: formData.get("presupuesto_sin_iva"),
    iva_pct: formData.get("iva_pct"),
    notas: (formData.get("notas") as string) || undefined,
    fecha_firma: (formData.get("fecha_firma") as string) || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const d = parsed.data

  const sb = await createClient()
  const { error: updateErr } = await sb
    .from("partidas")
    .update({
      nombre: d.nombre,
      presupuesto_sin_iva: d.presupuesto_sin_iva,
      iva_pct: d.iva_pct / 100,
      notas: d.notas ?? null,
      fecha_firma: d.fecha_firma || null,
    })
    .eq("id", partidaId)
    .is("deleted_at", null)
  if (updateErr) return { error: updateErr.message }

  const pdfFile = formData.get("pdf") as File | null
  if (pdfFile && pdfFile.size > 0) {
    const pResult = await uploadPdf(sb, pdfFile, projectId, partidaId)
    if ("error" in pResult) return { error: pResult.error }
    await sb
      .from("partidas")
      .update({ presupuesto_pdf_url: pResult.path })
      .eq("id", partidaId)
  }

  revalidatePath(`/proyectos/${projectId}/presupuesto`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// deletePartida
// ---------------------------------------------------------------------------

export async function deletePartida(
  partidaId: string,
  projectId: string,
): Promise<ActionResult> {
  const sb = await createClient()
  const { count } = await sb
    .from("estimaciones")
    .select("id", { count: "exact", head: true })
    .eq("partida_id", partidaId)
    .is("deleted_at", null)
  if (count && count > 0) {
    return {
      error:
        "No puedes eliminar esta partida porque tiene estimaciones registradas.",
    }
  }
  const { error } = await sb
    .from("partidas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", partidaId)
    .is("deleted_at", null)
  if (error) return { error: error.message }
  revalidatePath(`/proyectos/${projectId}/presupuesto`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// getSignedPdfUrl — called from PdfCell on click
// ---------------------------------------------------------------------------

export async function getSignedPdfUrl(pdfPath: string): Promise<string | null> {
  const sb = await createClient()
  const { data } = await sb.storage
    .from("proyectos")
    .createSignedUrl(pdfPath, 60 * 5)
  return data?.signedUrl ?? null
}
