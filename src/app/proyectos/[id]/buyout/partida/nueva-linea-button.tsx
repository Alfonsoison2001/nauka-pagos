"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { Catalogs } from "./linea-dialog"
import { LineaDialog } from "./linea-dialog"

type Props = {
  projectId: string
  partidaCatalogId: string
  catalogs: Catalogs
}

export function NuevaLineaButton({
  projectId,
  partidaCatalogId,
  catalogs,
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Agregar línea
      </Button>
      <LineaDialog
        mode="new"
        projectId={projectId}
        partidaCatalogId={partidaCatalogId}
        catalogs={catalogs}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
