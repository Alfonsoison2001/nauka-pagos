import { redirect } from "next/navigation"
import { ProjectCard } from "@/components/project-card"
import { TopNav } from "@/components/top-nav"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, nombre, lote, ubicacion, status")
    .is("deleted_at", null)
    .order("nombre")

  return (
    <div className="min-h-svh">
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Consolidado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige un proyecto para entrar. El dashboard agregado llega en Día 7.
          </p>
        </div>
        {!projects || projects.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aún no hay proyectos. Crea uno desde el selector arriba.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                id={p.id}
                nombre={p.nombre}
                lote={p.lote}
                ubicacion={p.ubicacion}
                status={p.status}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
