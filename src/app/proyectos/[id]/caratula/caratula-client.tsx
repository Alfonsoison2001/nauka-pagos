"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { ApprovalStatusChips } from "@/components/approvals/approval-status-chips"
import { ApprovalTimeline } from "@/components/approvals/approval-timeline"
import { ApproveRejectDialog } from "@/components/approvals/approve-reject-dialog"
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
import {
  enviarAAprobacion,
  generarCaratula,
  regenerarCaratula,
} from "./actions"
import { DeleteCaratulaButton } from "./delete-caratula-button"
import { EnviarDialog } from "./enviar-dialog"
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
  const [estList, setEstList] = useState(estimaciones)
  const [contratistaId, setContratistaId] = useState<string>("")
  const [selectedId, setSelectedId] = useState<string>("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [enviarOpen, setEnviarOpen] = useState(false)
  const [generating, startGen] = useTransition()
  const [sendingAprob, startAprob] = useTransition()
  const [aprobError, setAprobError] = useState<string | null>(null)
  const [regenerating, startRegen] = useTransition()
  const router = useRouter()

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
  const aprobada = approval?.latestStatus === "aprobada"

  function handleEnviarAprob() {
    if (!selected) return
    setAprobError(null)
    startAprob(async () => {
      const r = await enviarAAprobacion(selected.id, projectId)
      if ("error" in r) setAprobError(r.error)
    })
  }

  function selectContratista(id: string) {
    setContratistaId(id)
    setSelectedId("")
    setPreviewUrl(null)
    setGenError(null)
  }

  function selectEstimacion(id: string) {
    setSelectedId(id)
    setPreviewUrl(null)
    setGenError(null)
  }

  function handleGenerar() {
    if (!selected) return
    setGenError(null)
    startGen(async () => {
      const r = await generarCaratula(selected.id, projectId)
      if ("error" in r) {
        setGenError(r.error)
        return
      }
      setPreviewUrl(r.signedUrl)
      setEstList((list) =>
        list.map((e) =>
          e.id === selected.id ? { ...e, yaGenerada: true } : e,
        ),
      )
    })
  }

  function handleRegenerar() {
    if (!selected) return
    setGenError(null)
    startRegen(async () => {
      const r = await regenerarCaratula(selected.id, projectId)
      if ("error" in r) {
        setGenError(r.error)
        return
      }
      setPreviewUrl(r.signedUrl)
      setEstList((list) =>
        list.map((e) =>
          e.id === selected.id ? { ...e, yaGenerada: true } : e,
        ),
      )
    })
  }

  function handleCaratulaDeleted() {
    if (!selected) return
    setEstList((list) =>
      list.map((e) =>
        e.id === selected.id
          ? {
              ...e,
              yaGenerada: false,
              enviadaAt: null,
              destinatariosPrev: null,
            }
          : e,
      ),
    )
    setPreviewUrl(null)
    setGenError(null)
    router.refresh()
  }

  function handleSent(info: { enviadaAt: string; destinatarios: string[] }) {
    if (!selected) return
    setEstList((list) =>
      list.map((e) =>
        e.id === selected.id
          ? {
              ...e,
              enviadaAt: info.enviadaAt,
              destinatariosPrev: info.destinatarios,
            }
          : e,
      ),
    )
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

  // Destinatarios por defecto: emails del proyecto + email del PAGADOR (no del
  // contratista). Si el pagador no tiene email, solo van los del proyecto.
  const prefillEmails = selected
    ? Array.from(
        new Set(
          [...defaultEmails, selected.pagadorEmail].filter((x): x is string =>
            Boolean(x),
          ),
        ),
      )
    : []

  const canEnviar = Boolean(selected && (selected.yaGenerada || previewUrl))

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
          {/* Panel de detalle */}
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
                <span className="text-xs text-muted-foreground">Estatus</span>
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

            {/* Firmantes que aparecerán */}
            <div className="mt-4 border-t border-nauka-subtle pt-3">
              <p className="mb-1 text-xs text-muted-foreground">
                Firmantes en la carátula
              </p>
              {firmantes.length > 0 ? (
                <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {firmantes.map((f) => (
                    <li key={`${f.nombre}-${f.empresa}`}>
                      {f.nombre}{" "}
                      <span className="text-muted-foreground">
                        · {f.cargo}, {f.empresa}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  Sin firmantes asignados.
                </p>
              )}
            </div>

            {/* Acciones de admin (generar / enviar al pagador) */}
            {isAdmin && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-nauka-subtle pt-3">
                <Button onClick={handleGenerar} disabled={generating}>
                  {generating ? "Generando..." : "Generar carátula"}
                </Button>
                {selected.yaGenerada && !approval?.isOpen && (
                  <Button
                    variant="outline"
                    onClick={handleRegenerar}
                    disabled={regenerating}
                    title="Re-renderiza la carátula con los datos actuales"
                  >
                    {regenerating ? "Regenerando..." : "Regenerar"}
                  </Button>
                )}
                {aprobada ? (
                  <Button
                    variant="outline"
                    disabled={!canEnviar}
                    onClick={() => setEnviarOpen(true)}
                  >
                    Enviar al pagador
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      disabled
                      title="Disponible cuando la carátula esté aprobada"
                    >
                      Enviar al pagador
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!canEnviar}
                      onClick={() => setEnviarOpen(true)}
                      title="Enviar al pagador sin esperar la aprobación"
                    >
                      Enviar sin aprobación
                    </Button>
                  </>
                )}
                {(selected.yaGenerada ||
                  selected.enviadaAt ||
                  approval?.hasRequests) && (
                  <DeleteCaratulaButton
                    estimacionId={selected.id}
                    projectId={projectId}
                    onDeleted={handleCaratulaDeleted}
                  />
                )}
              </div>
            )}

            {genError && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {genError}
              </p>
            )}

            {/* Aprobación in-platform */}
            <div className="mt-4 border-t border-nauka-subtle pt-3">
              <p className="mb-2 text-xs text-muted-foreground">Aprobación</p>
              {approval?.hasRequests ? (
                <ApprovalStatusChips
                  status={approval.latestStatus ?? "en_aprobacion"}
                  votes={approval.chips}
                />
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  Esta carátula no se ha enviado a aprobación.
                </p>
              )}

              {approval?.rejectionMotivo && (
                <p className="mt-2 text-sm text-red-700">
                  Motivo del rechazo: {approval.rejectionMotivo}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {isAdmin && !approval?.isOpen && (
                  <Button
                    variant="outline"
                    onClick={handleEnviarAprob}
                    disabled={sendingAprob || firmantes.length === 0}
                  >
                    {sendingAprob
                      ? "Enviando..."
                      : approval?.hasRequests
                        ? "Reenviar a aprobación"
                        : "Enviar a aprobación"}
                  </Button>
                )}

                {approval?.myPendingApprovalId && (
                  <ApproveRejectDialog
                    approvalId={approval.myPendingApprovalId}
                    caratulaTitulo={`Est. ${selected.numero} · ${selected.contratistaNombre}`}
                    previewUrl={previewUrl}
                    triggerLabel="Revisar y firmar"
                  />
                )}

                {isAdmin &&
                  approval?.pendingVotes
                    .filter(
                      (pv) => pv.approvalId !== approval.myPendingApprovalId,
                    )
                    .map((pv) => (
                      <ApproveRejectDialog
                        key={pv.approvalId}
                        approvalId={pv.approvalId}
                        caratulaTitulo={`Est. ${selected.numero} · ${selected.contratistaNombre}`}
                        previewUrl={previewUrl}
                        onBehalfFirmante={pv.firmanteNombre}
                        triggerLabel={`Decidir por ${pv.firmanteNombre}`}
                      />
                    ))}
              </div>

              {aprobError && (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  {aprobError}
                </p>
              )}

              {approval?.hasRequests && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-nauka-dark">
                    Historial
                  </summary>
                  <div className="mt-2">
                    <ApprovalTimeline rounds={approval.rounds} />
                  </div>
                </details>
              )}
            </div>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-nauka-dark">
                Vista previa
              </p>
              <iframe
                src={previewUrl}
                title="Vista previa de la carátula"
                className="h-[640px] w-full rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card"
              />
            </div>
          )}

          <EnviarDialog
            open={enviarOpen}
            onOpenChange={setEnviarOpen}
            estimacionId={selected.id}
            projectId={projectId}
            prefillEmails={prefillEmails}
            enviadaAt={selected.enviadaAt}
            destinatariosPrev={selected.destinatariosPrev}
            onSent={handleSent}
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
