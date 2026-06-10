"use client"

import { Loader2, Paperclip, RefreshCw, X } from "lucide-react"
import { useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { EstimacionRow } from "./actions"
import {
  getComprobanteSignedUrl,
  removeComprobante,
  uploadComprobante,
} from "./actions"

const ACCEPTED = "application/pdf,image/png,image/jpeg,image/webp"
const MAX_BYTES = 10 * 1024 * 1024

type Props = {
  estimacion: EstimacionRow
  projectId: string
  isAdmin: boolean
}

export function ComprobanteCell({ estimacion, projectId, isAdmin }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [viewPending, startViewTransition] = useTransition()
  const [removing, startRemoving] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ACCEPTED.split(",")
    if (!allowed.includes(file.type)) {
      setError("Solo PDF, PNG, JPG o WEBP")
      e.target.value = ""
      return
    }
    if (file.size > MAX_BYTES) {
      setError("Máximo 10 MB")
      e.target.value = ""
      return
    }

    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append("file", file)
      const result = await uploadComprobante(estimacion.id, projectId, fd)
      if ("error" in result) setError(result.error)
    })
    // Reset so the same file can be re-selected if needed
    e.target.value = ""
  }

  function handleView() {
    if (!estimacion.comprobante_pago_url) return
    startViewTransition(async () => {
      const url = await getComprobanteSignedUrl(
        estimacion.comprobante_pago_url as string,
      )
      if (url) window.open(url, "_blank", "noopener,noreferrer")
    })
  }

  function handleRemove() {
    setRemoveError(null)
    startRemoving(async () => {
      const r = await removeComprobante(estimacion.id, projectId)
      if ("error" in r) {
        setRemoveError(r.error)
        return
      }
      setConfirmOpen(false)
    })
  }

  const hasFile = !!estimacion.comprobante_pago_url

  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-1">
        {hasFile && (
          <button
            type="button"
            onClick={handleView}
            disabled={viewPending}
            className="text-xs text-primary underline-offset-3 hover:underline disabled:opacity-50"
          >
            {viewPending ? "..." : "Ver"}
          </button>
        )}

        {/* Upload / Replace button */}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          aria-label={hasFile ? "Reemplazar comprobante" : "Subir comprobante"}
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : hasFile ? (
            <RefreshCw className="size-3 text-muted-foreground" />
          ) : (
            <Paperclip className="size-3 text-muted-foreground" />
          )}
        </Button>

        {/* Quitar (admin only) */}
        {hasFile && isAdmin && (
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={() => {
              setRemoveError(null)
              setConfirmOpen(true)
            }}
            aria-label="Quitar comprobante"
          >
            <X className="size-3 text-destructive" />
          </Button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && (
        <p className="max-w-[120px] text-xs text-destructive">{error}</p>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Quitar el comprobante?</DialogTitle>
            <DialogDescription>
              {removeError ??
                `Se borrará el archivo de la estimación #${estimacion.numero}. Esta acción no se puede deshacer.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {removeError ? (
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  type="button"
                  disabled={removing}
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  type="button"
                  disabled={removing}
                  onClick={handleRemove}
                >
                  {removing ? "Quitando..." : "Sí, quitar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
