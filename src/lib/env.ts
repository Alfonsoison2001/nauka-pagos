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

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
} as const
