import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { env } from "@/lib/env"

/**
 * Supabase server client.
 * Use in Server Components, Server Actions, and Route Handlers.
 * Never import this from a client component — `cookies()` is server-only.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component — cookies are read-only there.
            // The middleware refreshes session cookies on every request, so
            // ignoring this is safe.
          }
        },
      },
    },
  )
}
