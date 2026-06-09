"use client"

import { useState } from "react"
import type { DocumentApproval } from "@/lib/approvals/fetch"
import { CaratulaEstimacionCard } from "./caratula-estimacion-card"
import { NuevaCaratulaDialog } from "./nueva-caratula-dialog"
import type { CaratulaEstimacion } from "./page"

type Option = { id: string; nombre: string }

type Props = {
  contratistaNombre: string
  projectId: string
  conIva: boolean
  isAdmin: boolean
  estimaciones: CaratulaEstimacion[]
  approvalByEst: Record<string, DocumentApproval>
  /** Partidas del contratista (para el mini-modal). */
  partidas: Option[]
  pagadores: Option[]
  onVer: (est: CaratulaEstimacion) => void
  onGenerated: (estId: string) => void
  onCreated: () => void
}

export function CaratulaContratistaGroup({
  contratistaNombre,
  projectId,
  conIva,
  isAdmin,
  estimaciones,
  approvalByEst,
  partidas,
  pagadores,
  onVer,
  onGenerated,
  onCreated,
}: Props) {
  const [nuevaOpen, setNuevaOpen] = useState(false)

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-nauka-dark">
        {contratistaNombre}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {estimaciones.map((e) => (
          <CaratulaEstimacionCard
            key={e.id}
            estimacion={e}
            approval={approvalByEst[e.id]}
            conIva={conIva}
            isAdmin={isAdmin}
            projectId={projectId}
            onVer={() => onVer(e)}
            onGenerated={() => onGenerated(e.id)}
          />
        ))}
        {isAdmin && (
          <NuevaCaratulaCard
            contratistaNombre={contratistaNombre}
            onClick={() => setNuevaOpen(true)}
          />
        )}
      </div>

      {isAdmin && (
        <NuevaCaratulaDialog
          open={nuevaOpen}
          onOpenChange={setNuevaOpen}
          projectId={projectId}
          contratistaNombre={contratistaNombre}
          partidas={partidas}
          pagadores={pagadores}
          onCreated={onCreated}
        />
      )}
    </section>
  )
}

function NuevaCaratulaCard({
  contratistaNombre,
  onClick,
}: {
  contratistaNombre: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-[260px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#C9E8E6] bg-nauka-bg p-4 text-muted-foreground transition-colors hover:border-primary hover:text-nauka-dark"
    >
      <span className="text-2xl leading-none">+</span>
      <span className="text-center text-xs">
        Nueva carátula para {contratistaNombre}
      </span>
    </button>
  )
}
