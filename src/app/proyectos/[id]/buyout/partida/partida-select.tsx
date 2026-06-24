"use client"

import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PartidaOption } from "./actions"

type Props = {
  projectId: string
  partidas: PartidaOption[]
  selected: string | null
}

export function PartidaSelect({ projectId, partidas, selected }: Props) {
  const router = useRouter()
  const items = partidas.map((p) => ({ value: p.id, label: p.nombre }))

  return (
    <Select
      value={selected ?? ""}
      onValueChange={(v) =>
        router.push(`/proyectos/${projectId}/buyout/partida?partida=${v}`)
      }
      items={items}
    >
      <SelectTrigger className="w-full sm:w-80">
        <SelectValue placeholder="Selecciona una partida del catálogo" />
      </SelectTrigger>
      <SelectContent>
        {partidas.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
