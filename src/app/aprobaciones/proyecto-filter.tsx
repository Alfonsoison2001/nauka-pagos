"use client"

import { ChevronsUpDown } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Proj = { id: string; nombre: string }

/**
 * Filtro de proyecto para la bandeja. El estado vive en la URL
 * (?proyecto=ID o sin query = todos), no en localStorage.
 */
export function ProyectoFilter({
  projects,
  selected,
}: {
  projects: Proj[]
  selected: string
}) {
  const router = useRouter()
  const current = projects.find((p) => p.id === selected)
  const label = current?.nombre ?? "Todos los proyectos"

  function go(id: string) {
    router.push(id ? `/aprobaciones?proyecto=${id}` : "/aprobaciones")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-nauka-card-border bg-white px-4 text-sm text-nauka-dark hover:bg-nauka-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="max-w-[200px] truncate">{label}</span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => go("")}>
          Todos los proyectos
        </DropdownMenuItem>
        {projects.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => go(p.id)}>
            {p.nombre}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
