import Link from "next/link"
import { ProjectSelector } from "@/components/project-selector"
import { createClient } from "@/lib/supabase/server"
import { UserMenu } from "./user-menu"

type Props = {
  currentProjectId?: string | null
}

/**
 * Top navigation bar.
 *
 * Layout: NAUKA logo · project selector · Consolidado link · avatar.
 * Pass `currentProjectId` from inside the project shell so the selector
 * highlights the active project; omit it on the home page.
 */
export async function TopNav({ currentProjectId = null }: Props) {
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

  const { data: projects } = await supabase
    .from("projects")
    .select("id, nombre")
    .is("deleted_at", null)
    .eq("status", "activo")
    .order("nombre")

  return (
    <header className="border-b">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold">
            NAUKA Pagos
          </Link>
          <ProjectSelector
            projects={projects ?? []}
            currentProjectId={currentProjectId}
          />
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
