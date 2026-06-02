"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/roles"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type UsuarioActionResult = { error: string } | { ok: true }

const inviteSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  nombre: z.string().trim().min(1, "Nombre requerido").max(120),
  role: z.enum(["admin", "aprobador"]),
  firmanteId: z.string().uuid().nullable(),
})

/** Origen de la request (localhost y prod, sin hardcodear el host). */
async function requestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"
  return `${proto}://${host}`
}

/**
 * Invita a un usuario: crea su auth.user vía Admin API (manda magic link) e
 * inserta su perfil con rol. Para aprobadores se vincula su firmante.
 */
export async function inviteUser(
  formData: FormData,
): Promise<UsuarioActionResult> {
  await requireAdmin()

  const firmanteRaw = ((formData.get("firmante_id") as string) || "").trim()
  const roleRaw = formData.get("role")
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    nombre: formData.get("nombre"),
    role: roleRaw,
    // Solo los aprobadores se vinculan a un firmante.
    firmanteId: roleRaw === "aprobador" && firmanteRaw ? firmanteRaw : null,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const d = parsed.data

  const admin = createAdminClient()
  if (!admin) {
    return {
      error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.",
    }
  }

  const origin = await requestOrigin()
  const { data: invited, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(d.email, {
      data: { full_name: d.nombre },
      redirectTo: `${origin}/auth/confirm?next=/`,
    })
  if (inviteErr || !invited?.user) {
    return { error: inviteErr?.message ?? "No se pudo invitar al usuario" }
  }

  // Perfil vía sesión admin autenticada (RLS permite porque is_admin()).
  const sb = await createClient()
  const { error: profErr } = await sb.from("profiles").insert({
    auth_user_id: invited.user.id,
    email: d.email,
    nombre: d.nombre,
    role: d.role,
    firmante_id: d.role === "aprobador" ? d.firmanteId : null,
  })
  if (profErr) {
    return {
      error: `Usuario creado pero falló el perfil: ${profErr.message}`,
    }
  }

  revalidatePath("/usuarios")
  return { ok: true }
}

const roleSchema = z.enum(["admin", "aprobador"])

/** Cambia el rol de un usuario. Un admin no puede cambiar su propio rol aquí. */
export async function updateUserRole(
  profileId: string,
  role: string,
): Promise<UsuarioActionResult> {
  const me = await requireAdmin()
  if (profileId === me.id) {
    return { error: "No puedes cambiar tu propio rol." }
  }
  const parsed = roleSchema.safeParse(role)
  if (!parsed.success) return { error: "Rol inválido" }

  const update: Record<string, unknown> = { role: parsed.data }
  if (parsed.data === "admin") update.firmante_id = null // admin no es firmante

  const sb = await createClient()
  const { error } = await sb.from("profiles").update(update).eq("id", profileId)
  if (error) return { error: error.message }

  revalidatePath("/usuarios")
  return { ok: true }
}

/** Activa/desactiva (soft-delete) un usuario. No sobre uno mismo. */
export async function setUserActive(
  profileId: string,
  active: boolean,
): Promise<UsuarioActionResult> {
  const me = await requireAdmin()
  if (profileId === me.id) {
    return { error: "No puedes desactivar tu propio acceso." }
  }
  const sb = await createClient()
  const { error } = await sb
    .from("profiles")
    .update({ deleted_at: active ? null : new Date().toISOString() })
    .eq("id", profileId)
  if (error) return { error: error.message }

  revalidatePath("/usuarios")
  return { ok: true }
}
