import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { env } from "@/lib/env"
import { LAST_PROJECT_COOKIE } from "@/lib/last-project"

// /auth/* incluye el callback del magic link / invitación, accesible sin sesión.
const PUBLIC_PATHS = ["/login", "/auth"]

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

  // Recordar el último proyecto visitado (cookie SSR-legible). El sidebar fuera
  // de un proyecto (/aprobaciones) la usa para apuntar los tabs ahí, no al
  // primer proyecto alfabético. Server-side → no depende de timing del cliente.
  const projMatch = pathname.match(/^\/proyectos\/([^/]+)/)
  if (projMatch?.[1]) {
    response.cookies.set(LAST_PROJECT_COOKIE, projMatch[1], {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    })
  }

  return response
}
