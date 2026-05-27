import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { env } from "@/lib/env"

const PUBLIC_PATHS = ["/login"]

/**
 * Refreshes the Supabase auth session (rotates cookies) AND enforces
 * route protection in a single pass.
 *
 * - Unauthenticated users hitting anything other than PUBLIC_PATHS → /login
 * - Authenticated users hitting /login → /
 * - Everyone else: pass through with refreshed cookies
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // CRITICAL: call getUser() (not getSession()) right after creating the
  // client, with no logic between. getUser() validates against Supabase
  // Auth; getSession() only reads cookies and can be tricked by stale JWTs.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return response
}
