"use client"

import { Pencil } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { PartidaRow } from "./actions"
import { PartidaDialog } from "./partida-dialog"

type Props = {
  partida: PartidaRow
  projectId: string
}

export function EditPartidaButton({ partida, projectId }: Props) {
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
        key={partida.id}
        mode="edit"
        partida={partida}
        projectId={projectId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
