"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { ApprovalStatusChips } from "@/components/approvals/approval-status-chips"
import { ApprovalTimeline } from "@/components/approvals/approval-timeline"
import { ApproveRejectDialog } from "@/components/approvals/approve-reject-dialog"
import { CancelarAprobacionButton } from "@/components/approvals/cancelar-aprobacion-button"
import { CopiarLinkButton } from "@/components/approvals/copiar-link-button"
import { EstatusBadge } from "@/components/estatus-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DocumentApproval } from "@/lib/approvals/fetch"
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
  open: boolean
  onOpenChange: (open: boolean) => void
  estimacion: CaratulaEstimacion
  projectId: string
  conIva: boolean
  firmantes: CaratulaFirmanteRow[]
  defaultEmails: string[]
  isAdmin: boolean
  approval: DocumentApproval | undefined
  /** El padre actualiza la card/lista tras cada acción. */
  onGenerated: () => void
  onSent: (info: { enviadaAt: string; destinatarios: string[] }) => void
  onDeleted: () => void
}

/**
 * Modal de detalle de una carátula: preview + acciones (generar/regenerar/
 * enviar al pagador/enviar a aprobación/aprobar-rechazar/borrar) + timeline.
 * Extraído del panel inline de caratula-client para reusarlo desde las cards.
 */
export function CaratulaDetailDialog({
  open,
  onOpenChange,
  estimacion: selected,
  projectId,
  conIva,
  firmantes,
  defaultEmails,
  isAdmin,
  approval,
  onGenerated,
  onSent,
  onDeleted,
}: Props) {
  const router = useRouter()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [aprobError, setAprobError] = useState<string | null>(null)
  const [enviarOpen, setEnviarOpen] = useState(false)
  const [generating, startGen] = useTransition()
  const [regenerating, startRegen] = useTransition()
  const [sendingAprob, startAprob] = useTransition()

  const aprobada = approval?.latestStatus === "aprobada"
  const canEnviar = Boolean(selected.yaGenerada || previewUrl)
  const prefillEmails = Array.from(
    new Set(
      [...defaultEmails, selected.pagadorEmail].filter((x): x is string =>
        Boolean(x),
      ),
    ),
  )

  function handleGenerar() {
    setGenError(null)
    startGen(async () => {
      const r = await generarCaratula(selected.id, projectId)
      if ("error" in r) {
        setGenError(r.error)
        return
      }
      setPreviewUrl(r.signedUrl)
      onGenerated()
    })
  }

  function handleRegenerar() {
    setGenError(null)
    startRegen(async () => {
      const r = await regenerarCaratula(selected.id, projectId)
      if ("error" in r) {
        setGenError(r.error)
        return
      }
      setPreviewUrl(r.signedUrl)
      onGenerated()
    })
  }

  function handleEnviarAprob() {
    setAprobError(null)
    startAprob(async () => {
      const r = await enviarAAprobacion(selected.id, projectId)
      if ("error" in r) setAprobError(r.error)
      else router.refresh()
    })
  }

  function handleDeleted() {
    setPreviewUrl(null)
    setGenError(null)
    onDeleted()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(56rem,92vw)] max-w-none overflow-y-auto sm:max-w-none">
        <DialogHeader>
          <DialogTitle>
            Est. {selected.numero} · {selected.contratistaNombre}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Datos */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <Detail label="Partida" value={selected.partidaNombre} />
            <Detail
              label={`Monto (${conIva ? "con IVA" : "sin IVA"})`}
              value={formatMXN(selected.monto)}
            />
            <Detail label="Pagador" value={selected.pagadorNombre ?? "—"} />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Pago</span>
              <span>
                <EstatusBadge status={selected.status} />
              </span>
            </div>
          </div>

          {/* Firmantes */}
          <div className="border-t border-nauka-subtle pt-3">
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

          {/* Acciones admin */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 border-t border-nauka-subtle pt-3">
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
                  onDeleted={handleDeleted}
                />
              )}
            </div>
          )}

          {genError && (
            <p className="text-sm text-destructive" role="alert">
              {genError}
            </p>
          )}

          {/* Aprobación */}
          <div className="border-t border-nauka-subtle pt-3">
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

              {isAdmin && approval?.isOpen && approval.openRequestId && (
                <CancelarAprobacionButton
                  requestId={approval.openRequestId}
                  onCanceled={() => router.refresh()}
                />
              )}

              {approval?.isOpen && <CopiarLinkButton projectId={projectId} />}

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
                  <ApprovalTimeline
                    rounds={approval.rounds}
                    isAdmin={isAdmin}
                  />
                </div>
              </details>
            )}
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="flex flex-col gap-2 border-t border-nauka-subtle pt-3">
              <p className="text-sm font-medium text-nauka-dark">
                Vista previa
              </p>
              <iframe
                src={previewUrl}
                title="Vista previa de la carátula"
                className="h-[560px] w-full rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card"
              />
            </div>
          )}
        </div>

        <EnviarDialog
          open={enviarOpen}
          onOpenChange={setEnviarOpen}
          estimacionId={selected.id}
          projectId={projectId}
          prefillEmails={prefillEmails}
          enviadaAt={selected.enviadaAt}
          destinatariosPrev={selected.destinatariosPrev}
          estimacionStatus={selected.status}
          onSent={onSent}
        />
      </DialogContent>
    </Dialog>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  )
}
