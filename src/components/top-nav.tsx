import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { UserMenu } from "./user-menu"

/**
 * Top navigation bar.
 *
 * Día 1: NAUKA logo · project selector placeholder · Consolidado link · avatar.
 * Día 2+ replaces the project selector with the real dropdown.
 */
export async function TopNav() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const email = user.email ?? ""
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    email.split("@")[0] ??
    "Usuario"
  const initial = fullName.charAt(0).toUpperCase() || "?"

  return (
    <header className="border-b">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold">
            NAUKA Pagos
          </Link>
          <span className="text-sm text-muted-foreground">Proyecto: —</span>
          <Link
            href="/consolidado"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Consolidado
          </Link>
        </div>
        <UserMenu email={email} displayName={fullName} initial={initial} />
      </nav>
    </header>
  )
}
