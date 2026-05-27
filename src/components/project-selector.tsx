"use client"

import { ChevronsUpDown, Plus } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { NewProjectDialog } from "@/components/new-project-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getLastProjectId, setLastProjectId } from "@/lib/last-project"

type ProjectOption = {
  id: string
  nombre: string
}

type Props = {
  projects: ProjectOption[]
  currentProjectId: string | null
}

const PLACEHOLDER = "Elegir proyecto"

export function ProjectSelector({ projects, currentProjectId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lastId, setLastId] = useState<string | null>(null)

  useEffect(() => {
    setLastId(getLastProjectId())
  }, [])

  // Label: current project if we're in one, else last visited (visual hint
  // only — clicking the trigger opens the dropdown to choose).
  const currentProject = currentProjectId
    ? projects.find((p) => p.id === currentProjectId)
    : null
  const lastProject =
    !currentProject && lastId ? projects.find((p) => p.id === lastId) : null
  const displayed = currentProject ?? lastProject
  const label = displayed?.nombre ?? PLACEHOLDER

  function navigateToProject(id: string) {
    // Eagerly write to localStorage so the preselect works even if the
    // navigation gets cancelled mid-flight.
    setLastProjectId(id)
    // Preserve current tab when switching projects. Default to /resumen
    // when coming from the home page.
    const match = pathname.match(/^\/proyectos\/[^/]+\/([^/]+)/)
    const tab = match?.[1] ?? "resumen"
    router.push(`/proyectos/${id}/${tab}`)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="max-w-[200px] truncate">{label}</span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {projects.length === 0 ? (
            <DropdownMenuItem disabled>Aún no hay proyectos</DropdownMenuItem>
          ) : (
            projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => navigateToProject(p.id)}
              >
                {p.nombre}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Nuevo proyecto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
