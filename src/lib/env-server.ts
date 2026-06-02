/**
 * Server-only environment variables.
 *
 * Estas variables NUNCA deben importarse desde código de cliente. Este módulo
 * solo se importa desde server actions / componentes server (p. ej. la capa de
 * email). A diferencia de src/lib/env.ts, el acceso es perezoso (funciones) para
 * que la ausencia de RESEND_API_KEY NO rompa toda la app — solo el envío.
 */

const DEFAULT_RESEND_FROM = "onboarding@resend.dev"

/**
 * Config de Resend, o null si no hay API key configurada.
 * `from` cae a onboarding@resend.dev (modo prueba) si RESEND_FROM no está set;
 * cambiar RESEND_FROM a caratulas@izarquitectos.mx al verificar el dominio.
 */
export function getResendConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  const from = process.env.RESEND_FROM?.trim() || DEFAULT_RESEND_FROM
  return { apiKey, from }
}

/**
 * Service-role key de Supabase, o null si no está configurada.
 *
 * SECRETO server-only: nunca exponer al cliente. Se usa EXCLUSIVAMENTE para la
 * Admin API de Auth (invitar usuarios en /usuarios) — no para leer/escribir
 * tablas (el service_role de este proyecto no tiene grants de tabla; tampoco
 * los necesita para la Admin API). El acceso es perezoso para que su ausencia
 * NO rompa toda la app — solo la invitación de usuarios.
 */
export function getServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null
}
