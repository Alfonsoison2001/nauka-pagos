"use client"

import { FileText } from "lucide-react"
import { useTransition } from "react"
import { getSignedBuyoutPdfUrl } from "./actions"

export function BuyoutPdfCell({ pdfPath }: { pdfPath: string | null }) {
  const [pending, startTransition] = useTransition()

  if (!pdfPath) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  function handleClick() {
    if (!pdfPath) return
    startTransition(async () => {
      const url = await getSignedBuyoutPdfUrl(pdfPath)
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
      {pending ? "…" : "PDF"}
    </button>
  )
}
