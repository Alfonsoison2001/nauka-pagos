"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { EstatusBadge } from "@/components/estatus-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DocumentApproval } from "@/lib/approvals/fetch"
import { formatDate } from "@/lib/format/fecha"
import { formatMXN } from "@/lib/utils"
import { CaratulaDetailDialog } from "./caratula-detail-dialog"
import type { CaratulaEstimacion, CaratulaFirmanteRow } from "./page"

type Props = {
  projectId: string
  conIva: boolean
  estimaciones: CaratulaEstimacion[]
  firmantes: CaratulaFirmanteRow[]
  defaultEmails: string[]
  isAdmin: boolean
  approvalByEst: Record<string, DocumentApproval>
}

export function CaratulaClient({
  projectId,
  conIva,
  estimaciones,
  firmantes,
  defaultEmails,
  isAdmin,
  approvalByEst,
}: Props) {
  const router = useRouter()
  const [estList, setEstList] = useState(estimaciones)
  const [contratistaId, setContratistaId] = useState<string>("")
  const [selectedId, setSelectedId] = useState<string>("")
  const [detailOpen, setDetailOpen] = useState(false)

  // Step 1: contratistas que tienen estimaciones (únicos, ordenados).
  const contratistaOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of estList) {
      if (e.contratistaId && !seen.has(e.contratistaId)) {
        seen.set(e.contratistaId, e.contratistaNombre)
      }
    }
    return [...seen.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [estList])

  // Step 2: estimaciones del contratista elegido.
  const estForContratista = useMemo(
    () => estList.filter((e) => e.contratistaId === contratistaId),
    [estList, contratistaId],
  )

  const selected = estList.find((e) => e.id === selectedId)
  const approval = selected ? approvalByEst[selected.id] : undefined

  function selectContratista(id: string) {
    setContratistaId(id)
    setSelectedId("")
  }

  function selectEstimacion(id: string) {
    setSelectedId(id)
    setDetailOpen(true)
  }

  function patchSelected(patch: Partial<CaratulaEstimacion>) {
    setEstList((list) =>
      list.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)),
    )
  }
  const onGenerated = () => patchSelected({ yaGenerada: true })
  const onSent = (info: { enviadaAt: string; destinatarios: string[] }) =>
    patchSelected({
      enviadaAt: info.enviadaAt,
      destinatariosPrev: info.destinatarios,
    })
  function onDeleted() {
    patchSelected({
      yaGenerada: false,
      enviadaAt: null,
      destinatariosPrev: null,
    })
    router.refresh()
  }

  if (estList.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium">Sin estimaciones</p>
        <p className="mt-2">
          Captura estimaciones en la pestaña Flujo de Pagos para generar
          carátulas.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {firmantes.length === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Este proyecto no tiene firmantes. La carátula saldrá sin bloque de
          firmas. Agrégalos en Configuración.
        </div>
      )}

      {/* Selector en 2 pasos: contratista → estimación */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2 sm:w-72">
          <label htmlFor="contratista-select" className="text-sm font-medium">
            Contratista
          </label>
          <Select
            value={contratistaId}
            onValueChange={(v) => selectContratista(v ?? "")}
            items={contratistaOptions.map((c) => ({
              value: c.id,
              label: c.nombre,
            }))}
          >
            <SelectTrigger id="contratista-select" className="w-full">
              <SelectValue placeholder="Selecciona un contratista" />
            </SelectTrigger>
            <SelectContent>
              {contratistaOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {contratistaId ? (
          <div className="flex flex-col gap-2 sm:w-[26rem]">
            <label htmlFor="estimacion-select" className="text-sm font-medium">
              Estimación
            </label>
            <Select
              value={selectedId}
              onValueChange={(v) => selectEstimacion(v ?? "")}
              items={estForContratista.map((e) => ({
                value: e.id,
                label: estLabel(e),
              }))}
            >
              <SelectTrigger id="estimacion-select" className="w-full">
                <SelectValue placeholder="Selecciona una estimación" />
              </SelectTrigger>
              <SelectContent>
                {estForContratista.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {estLabel(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {selected && (
        <>
          <div className="rounded-2xl border border-nauka-card-border bg-white p-6 shadow-nauka-card">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Detail label="Contratista" value={selected.contratistaNombre} />
              <Detail label="Partida" value={selected.partidaNombre} />
              <Detail label="# Estimación" value={selected.numero} />
              <Detail
                label={`Monto (${conIva ? "con IVA" : "sin IVA"})`}
                value={formatMXN(selected.monto)}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Pago</span>
                <span>
                  <EstatusBadge status={selected.status} />
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Carátula</span>
                <span>
                  {selected.enviadaAt
                    ? `Enviada ${formatDate(selected.enviadaAt)}`
                    : selected.yaGenerada
                      ? "Generada"
                      : "—"}
                </span>
              </div>
            </div>
            <div className="mt-4 border-t border-nauka-subtle pt-3">
              <Button onClick={() => setDetailOpen(true)}>
                Ver carátula y acciones
              </Button>
            </div>
          </div>

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
            onGenerated={onGenerated}
            onSent={onSent}
            onDeleted={onDeleted}
          />
        </>
      )}
    </div>
  )
}

/** Etiqueta del Step 2 (contratista ya elegido): "Est. N — Partida — $monto". */
function estLabel(e: CaratulaEstimacion): string {
  return `Est. ${e.numero} — ${e.partidaNombre} — ${formatMXN(e.monto)}`
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  )
}
