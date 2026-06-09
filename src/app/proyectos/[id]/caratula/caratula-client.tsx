"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { DocumentApproval } from "@/lib/approvals/fetch"
import { CaratulaContratistaGroup } from "./caratula-contratista-group"
import { CaratulaDetailDialog } from "./caratula-detail-dialog"
import type { CaratulaEstimacion, CaratulaFirmanteRow } from "./page"

type Option = { id: string; nombre: string }

type Props = {
  projectId: string
  conIva: boolean
  estimaciones: CaratulaEstimacion[]
  firmantes: CaratulaFirmanteRow[]
  defaultEmails: string[]
  isAdmin: boolean
  approvalByEst: Record<string, DocumentApproval>
  contratistaPresupuesto: Record<string, number>
  partidasByContratista: Record<string, Option[]>
  pagadorOptions: Option[]
}

export function CaratulaClient({
  projectId,
  conIva,
  estimaciones,
  firmantes,
  defaultEmails,
  isAdmin,
  approvalByEst,
  contratistaPresupuesto,
  partidasByContratista,
  pagadorOptions,
}: Props) {
  const router = useRouter()
  const [estList, setEstList] = useState(estimaciones)
  // Re-sincroniza tras router.refresh() (p.ej. al crear una carátula nueva).
  useEffect(() => {
    setEstList(estimaciones)
  }, [estimaciones])
  const [selectedId, setSelectedId] = useState<string>("")
  const [detailOpen, setDetailOpen] = useState(false)

  // Agrupa por contratista; ordena los grupos por Σ presupuesto desc.
  const grupos = useMemo(() => {
    const byC = new Map<
      string,
      { nombre: string; ests: CaratulaEstimacion[] }
    >()
    for (const e of estList) {
      const g = byC.get(e.contratistaId)
      if (g) g.ests.push(e)
      else byC.set(e.contratistaId, { nombre: e.contratistaNombre, ests: [e] })
    }
    return [...byC.entries()]
      .map(([cid, g]) => ({ cid, ...g }))
      .sort(
        (a, b) =>
          (contratistaPresupuesto[b.cid] ?? 0) -
            (contratistaPresupuesto[a.cid] ?? 0) ||
          a.nombre.localeCompare(b.nombre),
      )
  }, [estList, contratistaPresupuesto])

  const selected = estList.find((e) => e.id === selectedId)
  const approval = selected ? approvalByEst[selected.id] : undefined

  function patchEst(estId: string, patch: Partial<CaratulaEstimacion>) {
    setEstList((list) =>
      list.map((e) => (e.id === estId ? { ...e, ...patch } : e)),
    )
  }

  function onVer(est: CaratulaEstimacion) {
    setSelectedId(est.id)
    setDetailOpen(true)
  }

  if (estList.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium">Sin estimaciones</p>
        <p className="mt-2">
          Captura estimaciones en la pestaña Flujo de Pagos para empezar a
          generar carátulas.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {firmantes.length === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Este proyecto no tiene firmantes. La carátula saldrá sin bloque de
          firmas. Agrégalos en Configuración.
        </div>
      )}

      {grupos.map((g) => (
        <CaratulaContratistaGroup
          key={g.cid}
          contratistaNombre={g.nombre}
          projectId={projectId}
          conIva={conIva}
          isAdmin={isAdmin}
          estimaciones={g.ests}
          approvalByEst={approvalByEst}
          partidas={partidasByContratista[g.cid] ?? []}
          pagadores={pagadorOptions}
          onVer={onVer}
          onGenerated={(estId) => patchEst(estId, { yaGenerada: true })}
          onCreated={() => router.refresh()}
        />
      ))}

      {selected && (
        <CaratulaDetailDialog
          key={selected.id}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          estimacion={selected}
          projectId={projectId}
          conIva={conIva}
          firmantes={firmantes}
          defaultEmails={defaultEmails}
          isAdmin={isAdmin}
          approval={approval}
          onGenerated={() => patchEst(selected.id, { yaGenerada: true })}
          onSent={(info) =>
            patchEst(selected.id, {
              enviadaAt: info.enviadaAt,
              destinatariosPrev: info.destinatarios,
            })
          }
          onDeleted={() => {
            patchEst(selected.id, {
              yaGenerada: false,
              enviadaAt: null,
              destinatariosPrev: null,
            })
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
