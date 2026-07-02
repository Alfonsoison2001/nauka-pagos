"use client"

import { Pencil } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ConceptoDialog } from "./concepto-dialog"

type Props = {
  projectId: string
  conceptoId: string
  nombre: string
}

export function EditConceptoButton({ projectId, conceptoId, nombre }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Renombrar ${nombre}`}
      >
        <Pencil className="size-4" />
      </Button>
      <ConceptoDialog
        mode="rename"
        projectId={projectId}
        conceptoId={conceptoId}
        nombre={nombre}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
