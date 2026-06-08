"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export type UpdatePasswordResult = { error: string } | { ok: true }

// Política: min 12, una mayúscula, una minúscula, un número, un símbolo.
// Se valida aquí (servidor, autoritativo) además de en el cliente.
const passwordSchema = z
  .string()
  .min(12, "Mínimo 12 caracteres")
  .regex(/[A-Z]/, "Incluye una mayúscula")
  .regex(/[a-z]/, "Incluye una minúscula")
  .regex(/[0-9]/, "Incluye un número")
  .regex(/[^A-Za-z0-9]/, "Incluye un símbolo")

/**
 * Actualiza la contraseña del usuario usando la sesión de recovery activa
 * (establecida por verifyOtp en el cliente antes de mostrar el form).
 */
export async function updatePassword(
  password: string,
): Promise<UpdatePasswordResult> {
  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Contraseña inválida" }
  }

  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return { error: "Sesión de recuperación no válida o expirada." }
  }

  const { error } = await sb.auth.updateUser({ password: parsed.data })
  if (error) {
    return { error: "No se pudo actualizar la contraseña. Intenta de nuevo." }
  }

  return { ok: true }
}
