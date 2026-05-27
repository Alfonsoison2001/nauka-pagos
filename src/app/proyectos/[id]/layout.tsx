import { notFound } from "next/navigation"
import { PersistLastProject } from "@/components/persist-last-project"
import { ProjectSubNav } from "@/components/project-sub-nav"
import { TopNav } from "@/components/top-nav"
import { createClient } from "@/lib/supabase/server"

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

  return (
    <div className="min-h-svh">
      <TopNav currentProjectId={project.id} />
      <ProjectSubNav projectId={project.id} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <PersistLastProject projectId={project.id} />
    </div>
  )
}
