import type { EmailOtpType } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Confirma enlaces de email de Supabase (magic link de login + invitaciones).
 *
 * Las plantillas de email apuntan aquí con `token_hash` + `type`. Se verifica el
 * OTP (que establece la sesión vía cookies SSR) y se redirige a `next`. Funciona
 * en cualquier dispositivo (no depende de PKCE/code_verifier), por eso sirve
 * tanto para login como para invitaciones abiertas en otro navegador.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  // Evita open-redirect: solo rutas internas (no "//host" ni URLs absolutas).
  const nextParam = searchParams.get("next") ?? "/"
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/"

  if (tokenHash && type) {
    const sb = await createClient()
    const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      redirect(next)
    }
  }

  redirect("/login?error=auth")
}
