"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { ContratistaOption } from "./actions"
import { PartidaDialog } from "./partida-dialog"

type Props = {
  projectId: string
  contratistas: ContratistaOption[]
}

export function NewPartidaButton({ projectId, contratistas }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Subir presupuesto firmado
      </Button>
      <PartidaDialog
        mode="new"
        projectId={projectId}
        contratistas={contratistas}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
