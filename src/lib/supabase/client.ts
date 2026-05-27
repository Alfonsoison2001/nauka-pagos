import { createBrowserClient } from "@supabase/ssr"
import { env } from "@/lib/env"

/**
 * Supabase browser client.
 * Use only in client components ("use client").
 * Never import this from server code.
 */
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
