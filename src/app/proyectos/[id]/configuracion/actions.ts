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
  const emailRaw = ((formData.get("email") as string) || "").trim()
  const supabase = await createClient()
  await supabase
    .from("pagadores")
    .insert({ nombre, project_id: projectId, email: emailRaw || null })
  revalidatePath(`/proyectos/${projectId}/configuracion`)
}

/**
 * Actualiza el correo de un pagador (destinatario de la carátula). Editar un
 * pagador GLOBAL afecta a todos los proyectos que lo comparten. Vacío → null.
 */
export async function updatePagadorEmail(
  pagadorId: string,
  projectId: string,
  formData: FormData,
) {
  const raw = ((formData.get("email") as string) || "").trim()
  const email = raw === "" ? null : raw
  // Si viene algo, validar que sea un correo; si no, no hacer nada.
  if (email && !z.string().email().safeParse(email).success) return
  const supabase = await createClient()
  await supabase.from("pagadores").update({ email }).eq("id", pagadorId)
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

// ---------------------------------------------------------------------------
// Firmantes: CRUD por proyecto (biblioteca global compartida vía junction)
// ---------------------------------------------------------------------------

export type FirmanteActionResult = { error: string } | { ok: true }

const firmanteSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido").max(120),
  cargo: z.string().trim().min(1, "Cargo requerido").max(120),
  empresa: z.string().trim().min(1, "Empresa requerida").max(120),
  email: z.string().trim().email("Correo inválido"),
})

function parseFirmante(formData: FormData) {
  return firmanteSchema.safeParse({
    nombre: formData.get("nombre"),
    cargo: formData.get("cargo"),
    empresa: formData.get("empresa"),
    email: formData.get("email"),
  })
}

export async function addProjectFirmante(
  projectId: string,
  formData: FormData,
): Promise<FirmanteActionResult> {
  const parsed = parseFirmante(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const d = parsed.data
  const supabase = await createClient()

  // Máx 3 firmantes por proyecto (CHECK orden IN (1,2,3)); busca orden libre.
  const { data: existing } = await supabase
    .from("project_firmantes")
    .select("orden")
    .eq("project_id", projectId)
  const ordenes = new Set((existing ?? []).map((r) => r.orden as number))
  let nextOrden = 1
  while (ordenes.has(nextOrden)) nextOrden++
  if (nextOrden > 3) return { error: "Máximo 3 firmantes por proyecto" }

  // Reusa firmante por email (índice único), o crea uno nuevo.
  const { data: found } = await supabase
    .from("firmantes")
    .select("id")
    .ilike("email", d.email)
    .is("deleted_at", null)
    .maybeSingle()
  let firmanteId = found?.id as string | undefined
  if (!firmanteId) {
    const { data: inserted, error: insErr } = await supabase
      .from("firmantes")
      .insert({
        nombre: d.nombre,
        cargo: d.cargo,
        empresa: d.empresa,
        email: d.email,
      })
      .select("id")
      .single()
    if (insErr) return { error: insErr.message }
    firmanteId = inserted.id as string
  }

  const { data: link } = await supabase
    .from("project_firmantes")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("firmante_id", firmanteId)
    .maybeSingle()
  if (link) return { error: "Ese firmante ya está en este proyecto" }

  const { error: linkErr } = await supabase.from("project_firmantes").insert({
    project_id: projectId,
    firmante_id: firmanteId,
    orden: nextOrden,
    default_signs: true,
  })
  if (linkErr) return { error: linkErr.message }

  revalidatePath(`/proyectos/${projectId}/configuracion`)
  return { ok: true }
}

export async function updateFirmante(
  firmanteId: string,
  projectId: string,
  formData: FormData,
): Promise<FirmanteActionResult> {
  const parsed = parseFirmante(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const d = parsed.data
  const supabase = await createClient()

  // Edita la fila global → aplica a todos los proyectos que la comparten.
  const { error } = await supabase
    .from("firmantes")
    .update({
      nombre: d.nombre,
      cargo: d.cargo,
      empresa: d.empresa,
      email: d.email,
    })
    .eq("id", firmanteId)
    .is("deleted_at", null)
  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un firmante con ese correo" }
    }
    return { error: error.message }
  }

  revalidatePath(`/proyectos/${projectId}/configuracion`)
  return { ok: true }
}

export async function removeProjectFirmante(
  firmanteId: string,
  projectId: string,
): Promise<FirmanteActionResult> {
  const supabase = await createClient()

  // Desvincula de ESTE proyecto (junction sin deleted_at → se quita el link).
  const { error: delErr } = await supabase
    .from("project_firmantes")
    .delete()
    .eq("project_id", projectId)
    .eq("firmante_id", firmanteId)
  if (delErr) return { error: delErr.message }

  // Si ya no firma en ningún proyecto, soft-delete del firmante global.
  const { count } = await supabase
    .from("project_firmantes")
    .select("project_id", { count: "exact", head: true })
    .eq("firmante_id", firmanteId)
  if ((count ?? 0) === 0) {
    await supabase
      .from("firmantes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", firmanteId)
      .is("deleted_at", null)
  }

  revalidatePath(`/proyectos/${projectId}/configuracion`)
  return { ok: true }
}
