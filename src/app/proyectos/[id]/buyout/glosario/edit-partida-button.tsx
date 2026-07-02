"use client"

import { Pencil } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PartidaDialog, type PartidaForEdit } from "./partida-dialog"

type Props = {
  projectId: string
  chapterNames: string[]
  partida: PartidaForEdit
}

export function EditPartidaButton({ projectId, chapterNames, partida }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Editar ${partida.nombre}`}
      >
        <Pencil className="size-4" />
      </Button>
      <PartidaDialog
        mode="edit"
        projectId={projectId}
        chapterNames={chapterNames}
        partida={partida}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
