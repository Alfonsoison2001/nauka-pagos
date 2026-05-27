"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// Soft-delete a project
// ---------------------------------------------------------------------------

export async function deleteProject(
  projectId: string,
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", projectId)
    .is("deleted_at", null)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Update project config (metadata + optional logo upload)
// ---------------------------------------------------------------------------

const configSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido").max(120),
  lote: z.string().trim().optional(),
  cliente: z.string().trim().min(1, "Cliente requerido"),
  ubicacion: z.string().trim().optional(),
  caratula_iva_mode: z.enum(["con_iva", "sin_iva"]),
  default_emails: z.array(z.string().trim().email()).default([]),
})

export type UpdateConfigState = { error: string | null; ok: boolean }

const LOGO_MAX_BYTES = 5 * 1024 * 1024 // 5MB
const LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
])

export async function updateProjectConfig(
  _prev: UpdateConfigState,
  formData: FormData,
): Promise<UpdateConfigState> {
  const projectId = formData.get("project_id") as string
  if (!projectId) {
    return { error: "Falta project_id", ok: false }
  }

  // Parse default_emails from a single textarea (one per line, blanks dropped)
  const emailsRaw = (formData.get("default_emails") as string) || ""
  const emails = emailsRaw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const parsed = configSchema.safeParse({
    nombre: formData.get("nombre"),
    lote: formData.get("lote") || undefined,
    cliente: formData.get("cliente"),
    ubicacion: formData.get("ubicacion") || undefined,
    caratula_iva_mode: formData.get("caratula_iva_mode"),
    default_emails: emails,
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
      ok: false,
    }
  }

  const supabase = await createClient()

  // Optional logo upload
  const logoFile = formData.get("logo") as File | null
  let logoPath: string | null = null

  if (logoFile && logoFile.size > 0) {
    if (logoFile.size > LOGO_MAX_BYTES) {
      return { error: "El logo debe pesar máximo 5MB", ok: false }
    }
    if (!LOGO_TYPES.has(logoFile.type)) {
      return { error: "Formato no permitido (PNG, JPG o SVG)", ok: false }
    }
    const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png"
    const path = `${projectId}/logo.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from("proyectos")
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
    if (uploadErr) {
      return { error: `Error subiendo logo: ${uploadErr.message}`, ok: false }
    }
    logoPath = path
  }

  const update: Record<string, unknown> = {
    nombre: parsed.data.nombre,
    lote: parsed.data.lote || null,
    cliente: parsed.data.cliente,
    ubicacion: parsed.data.ubicacion || null,
    caratula_iva_mode: parsed.data.caratula_iva_mode,
    default_emails: parsed.data.default_emails,
    updated_at: new Date().toISOString(),
  }
  if (logoPath) update.logo_url = logoPath

  const { error: updateErr } = await supabase
    .from("projects")
    .update(update)
    .eq("id", projectId)

  if (updateErr) {
    return { error: updateErr.message, ok: false }
  }

  revalidatePath(`/proyectos/${projectId}`, "layout")
  revalidatePath("/", "layout")
  return { error: null, ok: true }
}

// ---------------------------------------------------------------------------
// Pagadores: add / remove per-project
// ---------------------------------------------------------------------------

export async function addProjectPagador(projectId: string, formData: FormData) {
  const nombre = ((formData.get("nombre") as string) || "").trim()
  if (!nombre) return
  const supabase = await createClient()
  await supabase.from("pagadores").insert({ nombre, project_id: projectId })
  revalidatePath(`/proyectos/${projectId}/configuracion`)
}

export async function removeProjectPagador(
  pagadorId: string,
  projectId: string,
) {
  const supabase = await createClient()
  await supabase
    .from("pagadores")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", pagadorId)
    .eq("project_id", projectId)
  revalidatePath(`/proyectos/${projectId}/configuracion`)
}
