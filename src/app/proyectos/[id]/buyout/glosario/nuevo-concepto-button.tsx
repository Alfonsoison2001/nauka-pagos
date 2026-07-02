"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ConceptoDialog } from "./concepto-dialog"

type Props = {
  projectId: string
  partidaId: string
  nextOrden: number
}

export function NuevoConceptoButton({
  projectId,
  partidaId,
  nextOrden,
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Concepto
      </Button>
      <ConceptoDialog
        mode="new"
        projectId={projectId}
        partidaId={partidaId}
        nextOrden={nextOrden}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
