import { notFound } from "next/navigation"
import { PersistLastProject } from "@/components/persist-last-project"
import { ProjectTopbar } from "@/components/project-topbar"
import { Sidebar } from "@/components/sidebar"
import { createClient } from "@/lib/supabase/server"

function firstNameOf(value: string): string {
  const first = value.trim().split(/\s+/)[0] ?? "Usuario"
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: project } = await supabase
    .from("projects")
    .select("id, nombre")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!project) {
    notFound()
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Usuario"
  const greetingName = firstNameOf(fullName)

  let isAdmin = false
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle()
    isAdmin = prof?.role === "admin"
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, nombre")
    .is("deleted_at", null)
    .eq("status", "activo")
    .order("nombre")

  return (
    <div className="flex min-h-svh">
      <Sidebar
        projectId={project.id}
        greetingName={greetingName}
        isAdmin={isAdmin}
      />
      <div className="flex min-w-0 flex-1 flex-col bg-nauka-bg">
        <div className="px-12 pt-10">
          <ProjectTopbar
            projects={projects ?? []}
            currentProjectId={project.id}
          />
        </div>
        <main className="px-12 pb-12 pt-8">{children}</main>
      </div>
      <PersistLastProject projectId={project.id} />
    </div>
  )
}
