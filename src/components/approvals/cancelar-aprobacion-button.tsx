"use client"

import { XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { cancelarAprobacion } from "@/app/aprobaciones/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  requestId: string
  /** Tras cancelar con éxito. Por defecto: router.refresh(). */
  onCanceled?: () => void
  triggerLabel?: string
  size?: "sm" | "default"
}

/**
 * Cancela una ronda de aprobación en curso (admin). Confirm + motivo opcional.
 * Los votos emitidos quedan en el historial; la carátula vuelve a "Generada".
 */
export function CancelarAprobacionButton({
  requestId,
  onCanceled,
  triggerLabel = "Cancelar solicitud",
  size = "sm",
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const r = await cancelarAprobacion(requestId, motivo.trim() || undefined)
      if ("error" in r) {
        setError(r.error)
        return
      }
      setOpen(false)
      setMotivo("")
      if (onCanceled) onCanceled()
      else router.refresh()
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        className="text-amber-700 hover:bg-amber-50 hover:text-amber-800"
      >
        <XCircle className="size-4" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Cancelar esta solicitud?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Los votos emitidos quedan en el historial. Podrás corregir y
            reenviar.
          </p>
          <div className="mt-1 flex flex-col gap-1.5">
            <Label htmlFor={`cancel-motivo-${requestId}`}>
              Motivo (opcional)
            </Label>
            <Textarea
              id={`cancel-motivo-${requestId}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Por qué se cancela (opcional)…"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              No, volver
            </Button>
            <Button type="button" disabled={pending} onClick={handleConfirm}>
              {pending ? "Cancelando..." : "Sí, cancelar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
