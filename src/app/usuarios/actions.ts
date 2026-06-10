"use server"

import { revalidatePath } from "next/cache"
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

/**
 * Base URL fija de la app desde NEXT_PUBLIC_APP_URL — NO del Host del request
 * (fix A3: el Host es controlable por el cliente y podía envenenar el enlace
 * de invitación). Fallback a localhost solo para dev local.
 */
function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  )
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

  const origin = appOrigin()
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

/**
 * Activa/desactiva un usuario. No sobre uno mismo.
 *
 * Fix M3 — al desactivar no basta el soft-delete del perfil: el usuario conserva
 * su JWT y sigue pasando el middleware (lectura abierta) hasta que el token
 * expira. Aquí, además del soft-delete, se REVOCA el acceso de Auth baneando al
 * auth.user vía Admin API (no se puede usar admin.signOut: requiere el JWT del
 * propio usuario, que un admin no tiene). El ban bloquea el refresh del token y
 * nuevos logins de inmediato. Reactivar restaura el perfil y quita el ban.
 */
export async function setUserActive(
  profileId: string,
  active: boolean,
): Promise<UsuarioActionResult> {
  const me = await requireAdmin()
  if (profileId === me.id) {
    return { error: "No puedes desactivar tu propio acceso." }
  }

  const sb = await createClient()
  const { data: target, error: findErr } = await sb
    .from("profiles")
    .select("auth_user_id")
    .eq("id", profileId)
    .maybeSingle()
  if (findErr) return { error: findErr.message }
  if (!target) return { error: "Usuario no encontrado" }

  // Admin API lista ANTES de mutar (evita perfil desactivado sin revocar).
  const admin = createAdminClient()
  if (!admin) {
    return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }
  }

  const { error } = await sb
    .from("profiles")
    .update({ deleted_at: active ? null : new Date().toISOString() })
    .eq("id", profileId)
  if (error) return { error: error.message }

  // Revocar (ban) / restaurar (none) el acceso de Auth. ~100 años ≈ permanente.
  const { error: banErr } = await admin.auth.admin.updateUserById(
    target.auth_user_id as string,
    { ban_duration: active ? "none" : "876000h" },
  )
  if (banErr) {
    const accion = active ? "reactivar" : "revocar"
    return {
      error: `Perfil actualizado pero no se pudo ${accion} el acceso: ${banErr.message}`,
    }
  }

  revalidatePath("/usuarios")
  return { ok: true }
}
