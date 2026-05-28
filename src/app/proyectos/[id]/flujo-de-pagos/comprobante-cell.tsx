"use client"

import { Loader2, Paperclip, RefreshCw } from "lucide-react"
import { useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import type { EstimacionRow } from "./actions"
import { getComprobanteSignedUrl, uploadComprobante } from "./actions"

const ACCEPTED = "application/pdf,image/png,image/jpeg,image/webp"
const MAX_BYTES = 10 * 1024 * 1024

type Props = {
  estimacion: EstimacionRow
  projectId: string
}

export function ComprobanteCell({ estimacion, projectId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [viewPending, startViewTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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
    </div>
  )
}
