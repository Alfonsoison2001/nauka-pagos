"use client"

import { usePathname } from "next/navigation"
import { ProjectSelector } from "@/components/project-selector"

const TITLES: Record<string, string> = {
  resumen: "Resumen",
  presupuesto: "Presupuesto",
  "flujo-de-pagos": "Flujo de Pagos",
  caratula: "Carátula",
  "resumen-mensual": "Resumen Mensual",
  configuracion: "Configuración",
}

type Props = {
  projects: { id: string; nombre: string }[]
  currentProjectId: string
}

/** Header del área principal: título de la página activa + selector de proyecto. */
export function ProjectTopbar({ projects, currentProjectId }: Props) {
  const pathname = usePathname()
  const seg = pathname.match(/^\/proyectos\/[^/]+\/([^/]+)/)?.[1] ?? "resumen"
  const title = TITLES[seg] ?? "Resumen"

  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-3xl font-medium text-nauka-dark">{title}</h1>
      <ProjectSelector
        projects={projects}
        currentProjectId={currentProjectId}
      />
    </div>
  )
}
