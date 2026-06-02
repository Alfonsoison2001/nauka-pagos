"use server"

import { headers } from "next/headers"
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

/** Origen de la request (sirve para localhost y prod sin hardcodear el host). */
async function requestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"
  return `${proto}://${host}`
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
      emailRedirectTo: `${await requestOrigin()}/auth/callback?next=/`,
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
