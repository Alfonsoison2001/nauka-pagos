import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Callback PKCE (flujo por `code`). Lo usa el magic link de login cuando la
 * plantilla por defecto de Supabase manda a `emailRedirectTo` con `?code=...`
 * (mismo navegador que pidió el enlace). Las invitaciones, en cambio, usan
 * /auth/confirm (token_hash), que funciona también en otro dispositivo.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")

  const nextParam = searchParams.get("next") ?? "/"
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/"

  if (code) {
    const sb = await createClient()
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (!error) {
      redirect(next)
    }
  }

  redirect("/login?error=auth")
}
