"use client"

import { RefreshCw } from "lucide-react"
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

/** "Actualizar presupuesto" — nueva versión fechada del mismo concepto. */
export function UpdateBudgetButton({ projectId, linea, catalogs }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Actualizar presupuesto de ${linea.concepto}`}
        title="Actualizar presupuesto (nueva versión)"
      >
        <RefreshCw className="size-4 text-nauka-dark" />
      </Button>
      <LineaDialog
        mode="version"
        projectId={projectId}
        linea={linea}
        catalogs={catalogs}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
