"use client"

import { BellRing, Check } from "lucide-react"
import { useState, useTransition } from "react"
import { recordar } from "@/app/aprobaciones/actions"
import { Button } from "@/components/ui/button"

type Props = {
  requestId: string
}

/**
 * Reenvía el email accionable + notif a los firmantes pendientes de la ronda
 * abierta (admin). Confirmación transitoria inline. Resend en modo prueba solo
 * entrega al dueño de la cuenta hasta verificar el dominio.
 */
export function RecordarButton({ requestId }: Props) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const r = await recordar(requestId)
      if ("error" in r) {
        setError(r.error)
        return
      }
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={handleClick}
        disabled={pending}
        title="Reenviar el aviso a los firmantes pendientes"
      >
        {done ? (
          <Check className="size-4 text-green-600" />
        ) : (
          <BellRing className="size-4" />
        )}
        {done ? "Recordatorio enviado" : pending ? "Enviando..." : "Recordar"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
