import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type UserRole = "admin" | "aprobador"

export type Profile = {
  id: string
  authUserId: string
  email: string
  nombre: string
  role: UserRole
  firmanteId: string | null
}

/**
 * Perfil del usuario autenticado actual, o null si no hay sesión / sin perfil.
 * Lee `profiles` por el cliente SSR (RLS permite leer el propio perfil).
 */
export async function getMyProfile(): Promise<Profile | null> {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null

  const { data } = await sb
    .from("profiles")
    .select("id, auth_user_id, email, nombre, role, firmante_id")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!data) return null

  return {
    id: data.id as string,
    authUserId: data.auth_user_id as string,
    email: data.email as string,
    nombre: data.nombre as string,
    role: data.role as UserRole,
    firmanteId: (data.firmante_id as string | null) ?? null,
  }
}

/** ¿El usuario actual es admin? */
export async function isAdmin(): Promise<boolean> {
  const profile = await getMyProfile()
  return profile?.role === "admin"
}

/**
 * Guard para páginas/acciones admin-only. Si el usuario no es admin, redirige
 * a Home. Devuelve el perfil admin para uso posterior.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getMyProfile()
  if (profile?.role !== "admin") {
    redirect("/")
  }
  return profile
}
