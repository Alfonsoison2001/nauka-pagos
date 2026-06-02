"use client"

import { useState, useTransition } from "react"
import { aprobar, rechazar } from "@/app/aprobaciones/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  approvalId: string
  caratulaTitulo: string
  previewUrl?: string | null
  /** Si el admin decide por otro firmante, su nombre (muestra aviso). */
  onBehalfFirmante?: string | null
  triggerLabel?: string
}

export function ApproveRejectDialog({
  approvalId,
  caratulaTitulo,
  previewUrl,
  onBehalfFirmante,
  triggerLabel = "Revisar",
}: Props) {
  const [open, setOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setRejecting(false)
    setMotivo("")
    setError(null)
  }

  function doApprove() {
    setError(null)
    startTransition(async () => {
      const r = await aprobar(approvalId)
      if ("error" in r) {
        setError(r.error)
        return
      }
      setOpen(false)
      reset()
    })
  }

  function doReject() {
    setError(null)
    startTransition(async () => {
      const r = await rechazar(approvalId, motivo)
      if ("error" in r) {
        setError(r.error)
        return
      }
      setOpen(false)
      reset()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Revisar carátula</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{caratulaTitulo}</p>

        {onBehalfFirmante ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
            Vas a decidir{" "}
            <strong>en representación de {onBehalfFirmante}</strong>. Quedará
            registrado así en la constancia.
          </div>
        ) : null}

        {previewUrl ? (
          <iframe
            title="Carátula"
            src={previewUrl}
            className="h-72 w-full rounded-md border border-nauka-card-border"
          />
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Aún no se ha generado el PDF de esta carátula. Puedes decidir de
            todas formas.
          </p>
        )}

        {rejecting ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`motivo-${approvalId}`}>Motivo del rechazo</Label>
            <Textarea
              id={`motivo-${approvalId}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Explica por qué se rechaza…"
            />
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {rejecting ? (
            <>
              <Button
                variant="outline"
                type="button"
                disabled={pending}
                onClick={() => setRejecting(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                type="button"
                disabled={pending || !motivo.trim()}
                onClick={doReject}
              >
                {pending ? "Rechazando…" : "Confirmar rechazo"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                type="button"
                disabled={pending}
                onClick={() => setRejecting(true)}
              >
                Rechazar
              </Button>
              <Button type="button" disabled={pending} onClick={doApprove}>
                {pending ? "Aprobando…" : "Aprobar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
