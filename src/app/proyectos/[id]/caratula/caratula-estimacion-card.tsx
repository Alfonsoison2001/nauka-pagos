"use client"

import { useTransition } from "react"
import { EstatusBadge } from "@/components/estatus-badge"
import { Button } from "@/components/ui/button"
import type { DocumentApproval } from "@/lib/approvals/fetch"
import { formatDate } from "@/lib/format/fecha"
import { formatMXN } from "@/lib/utils"
import { generarCaratula, getCaratulaSignedUrl } from "./actions"
import { CaratulaBadgeView, caratulaBadge } from "./caratula-badge"
import type { CaratulaEstimacion } from "./page"

type Props = {
  estimacion: CaratulaEstimacion
  approval: DocumentApproval | undefined
  conIva: boolean
  isAdmin: boolean
  projectId: string
  /** Abre el modal de detalle (preview + todas las acciones). */
  onVer: () => void
  /** El padre marca yaGenerada tras generar. */
  onGenerated: () => void
}

export function CaratulaEstimacionCard({
  estimacion: e,
  approval,
  conIva,
  isAdmin,
  projectId,
  onVer,
  onGenerated,
}: Props) {
  const [generating, startGen] = useTransition()
  const [downloading, startDl] = useTransition()
  const badge = caratulaBadge(e, approval)
  const aprobada = approval?.latestStatus === "aprobada"

  function handleGenerar() {
    startGen(async () => {
      const r = await generarCaratula(e.id, projectId)
      if (!("error" in r)) onGenerated()
    })
  }

  function handleDescargar() {
    startDl(async () => {
      const url = await getCaratulaSignedUrl(e.id)
      if (url) window.open(url, "_blank", "noopener,noreferrer")
    })
  }

  return (
    <div className="flex w-[260px] shrink-0 flex-col gap-2 rounded-2xl border border-[#C9E8E6] bg-white p-4 shadow-nauka-card">
      <div>
        <p className="text-sm font-medium text-nauka-dark">{e.numero}</p>
        <p
          className="truncate text-xs text-muted-foreground"
          title={e.partidaNombre}
        >
          {e.partidaNombre}
        </p>
      </div>

      <p className="font-medium tabular-nums text-[#163D4A]">
        {formatMXN(e.monto)}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {conIva ? "c/IVA" : "s/IVA"}
        </span>
      </p>

      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        <span>{formatDate(e.fechaEstimacion)}</span>
        <span className="truncate" title={e.pagadorNombre ?? undefined}>
          {e.pagadorNombre ?? "—"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <EstatusBadge status={e.status} />
        <CaratulaBadgeView badge={badge} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-nauka-subtle pt-2">
        {!e.yaGenerada && isAdmin ? (
          <Button size="sm" onClick={handleGenerar} disabled={generating}>
            {generating ? "Generando..." : "Generar"}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onVer}>
            Ver
          </Button>
        )}
        {aprobada && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDescargar}
            disabled={downloading}
          >
            {downloading ? "..." : "Descargar"}
          </Button>
        )}
      </div>
    </div>
  )
}
