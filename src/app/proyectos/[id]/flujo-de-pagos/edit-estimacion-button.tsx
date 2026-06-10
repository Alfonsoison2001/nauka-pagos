"use client"

import { Pencil } from "lucide-react"
import { useState } from "react"
import type { ApprovalSummary } from "@/components/approvals/approval-chip"
import { Button } from "@/components/ui/button"
import type {
  ContratistaOption,
  EstimacionRow,
  PagadorOption,
  PartidaOption,
} from "./actions"
import { EstimacionDialog } from "./estimacion-dialog"

type Props = {
  estimacion: EstimacionRow
  projectId: string
  contratistas: ContratistaOption[]
  partidas: PartidaOption[]
  pagadores: PagadorOption[]
  pagadoAcumByPartida: Record<string, number>
  aprobacion: ApprovalSummary | undefined
  isAdmin: boolean
}

export function EditEstimacionButton({
  estimacion,
  projectId,
  contratistas,
  partidas,
  pagadores,
  pagadoAcumByPartida,
  aprobacion,
  isAdmin,
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Editar estimación ${estimacion.numero}`}
      >
        <Pencil className="size-4" />
      </Button>
      <EstimacionDialog
        key={estimacion.id}
        mode="edit"
        estimacion={estimacion}
        projectId={projectId}
        contratistas={contratistas}
        partidas={partidas}
        pagadores={pagadores}
        pagadoAcumByPartida={pagadoAcumByPartida}
        aprobacion={aprobacion}
        isAdmin={isAdmin}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
