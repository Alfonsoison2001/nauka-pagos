"use client"

import { Pencil } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { LineaRow } from "./actions"
import type { Catalogs } from "./linea-dialog"
import { LineaDialog } from "./linea-dialog"

type Props = {
  projectId: string
  linea: LineaRow
  catalogs: Catalogs
}

export function EditLineaButton({ projectId, linea, catalogs }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Editar ${linea.concepto}`}
      >
        <Pencil className="size-4" />
      </Button>
      <LineaDialog
        mode="edit"
        projectId={projectId}
        linea={linea}
        catalogs={catalogs}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
