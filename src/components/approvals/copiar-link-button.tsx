"use client"

import { Check, Link2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

type Props = {
  /** Proyecto al que apunta el link de la bandeja de aprobaciones. */
  projectId: string
}

/**
 * Copia al portapapeles el link directo a la bandeja de aprobaciones filtrada
 * por proyecto, para pegarlo en WhatsApp. Muestra confirmación transitoria.
 */
export function CopiarLinkButton({ projectId }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}/aprobaciones?proyecto=${projectId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard bloqueado (contexto no seguro): no hacemos nada.
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={handleCopy}
        title="Copiar link para compartir por WhatsApp"
      >
        {copied ? (
          <Check className="size-4 text-green-600" />
        ) : (
          <Link2 className="size-4" />
        )}
        {copied ? "Copiado" : "Copiar link"}
      </Button>
      {copied && (
        <span className="text-xs text-green-700">
          Link copiado — pégalo en WhatsApp
        </span>
      )}
    </span>
  )
}
