/**
 * Runtime-validated environment variables.
 *
 * Import from here instead of accessing `process.env` directly — this
 * gives you typed `string` (not `string | undefined`) and a clear error
 * at module-load time if a required var is missing.
 *
 * NEXT_PUBLIC_* vars are inlined by Next at build time and available
 * on both the server and the client. Server-only vars (service role
 * key, Resend API key, etc.) belong in a separate module so they
 * never leak into the client bundle.
 */

// El valor DEBE pasarse como referencia literal `process.env.NEXT_PUBLIC_*` en
// el call site: Next/Turbopack solo inlinea (reemplaza en el bundle del cliente)
// los `NEXT_PUBLIC_*` accedidos de forma LITERAL. Un acceso dinámico
// (`process.env[name]`) NO se inlinea → en el navegador queda `undefined` y esto
// tiraba "Missing required environment variable" en cualquier componente cliente
// que use el browser client de Supabase. Server-side ambos accesos son iguales.
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
} as const
