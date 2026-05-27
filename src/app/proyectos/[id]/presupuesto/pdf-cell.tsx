"use client"

import { AlertCircle, FileText } from "lucide-react"
import { useTransition } from "react"
import { getSignedPdfUrl } from "./actions"

type Props = { pdfPath: string | null }

export function PdfCell({ pdfPath }: Props) {
  const [pending, startTransition] = useTransition()

  if (!pdfPath) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <AlertCircle className="size-3.5" />
        Falta PDF
      </span>
    )
  }

  function handleClick() {
    if (!pdfPath) return
    startTransition(async () => {
      const url = await getSignedPdfUrl(pdfPath)
      if (url) window.open(url, "_blank", "noopener,noreferrer")
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-3 hover:underline disabled:opacity-50"
    >
      <FileText className="size-3.5" />
      {pending ? "Cargando..." : "Ver PDF"}
    </button>
  )
}
