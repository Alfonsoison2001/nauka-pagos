"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { ContratistaOption, PagadorOption, PartidaOption } from "./actions"
import { EstimacionDialog } from "./estimacion-dialog"

type Props = {
  projectId: string
  contratistas: ContratistaOption[]
  partidas: PartidaOption[]
  pagadores: PagadorOption[]
  pagadoAcumByPartida: Record<string, number>
}

export function NewEstimacionButton({
  projectId,
  contratistas,
  partidas,
  pagadores,
  pagadoAcumByPartida,
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nueva estimación
      </Button>
      <EstimacionDialog
        mode="new"
        projectId={projectId}
        contratistas={contratistas}
        partidas={partidas}
        pagadores={pagadores}
        pagadoAcumByPartida={pagadoAcumByPartida}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
