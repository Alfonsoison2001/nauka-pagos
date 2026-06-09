"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export type LoginState = { error: string | null }

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: "Email o contraseña inválidos" }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: "Email o contraseña incorrectos" }
  }

  redirect("/")
}

// ---------------------------------------------------------------------------
// Magic link (passwordless) — solo para usuarios ya invitados.
// ---------------------------------------------------------------------------

export type MagicLinkState = { error: string | null; sent: boolean }

const magicSchema = z.object({ email: z.string().email() })

/**
 * Base URL fija de la app desde NEXT_PUBLIC_APP_URL — NO del Host del request
 * (fix A3: el Host es controlable por el cliente y podía envenenar el enlace
 * del magic-link). Fallback a localhost solo para dev local.
 */
function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  )
}

export async function sendMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = magicSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) {
    return { error: "Email inválido", sent: false }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // Solo usuarios ya invitados (creados en /usuarios) pueden entrar.
      shouldCreateUser: false,
      emailRedirectTo: `${appOrigin()}/auth/callback?next=/`,
    },
  })

  if (error) {
    return {
      error: "No se pudo enviar el enlace. Intenta de nuevo.",
      sent: false,
    }
  }

  // Éxito ambiguo a propósito (no revelamos si el correo existe).
  return { error: null, sent: true }
}
