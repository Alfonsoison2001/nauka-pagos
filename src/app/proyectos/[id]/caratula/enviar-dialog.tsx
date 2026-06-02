"use client"

import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/format/fecha"
import { enviarCaratula } from "./actions"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  estimacionId: string
  projectId: string
  prefillEmails: string[]
  enviadaAt: string | null
  destinatariosPrev: string[] | null
  onSent: (info: { enviadaAt: string; destinatarios: string[] }) => void
}

export function EnviarDialog({
  open,
  onOpenChange,
  estimacionId,
  projectId,
  prefillEmails,
  enviadaAt,
  destinatariosPrev,
  onSent,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [value, setValue] = useState("")

  const prefillStr = prefillEmails.join("\n")
  useEffect(() => {
    if (open) {
      setValue(prefillStr)
      setError(null)
    }
  }, [open, prefillStr])

  const yaEnviada = Boolean(enviadaAt)
  const nPrev = destinatariosPrev?.length ?? 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append("emails", value)
      const result = await enviarCaratula(estimacionId, projectId, fd)
      if ("error" in result) {
        setError(result.error)
        return
      }
      onSent({
        enviadaAt: result.enviadaAt,
        destinatarios: result.destinatarios,
      })
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {yaEnviada
              ? "Reenviar carátula al pagador"
              : "Enviar carátula al pagador"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          {yaEnviada && (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Ya enviada el <strong>{formatDate(enviadaAt)}</strong> a {nPrev}{" "}
              destinatario{nPrev === 1 ? "" : "s"}. ¿Reenviar? Se generará un
              PDF nuevo.
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="caratula-emails">Destinatarios</Label>
            <Textarea
              id="caratula-emails"
              name="emails"
              rows={4}
              value={value}
              onChange={(ev) => setValue(ev.target.value)}
              placeholder="correo@ejemplo.com (uno por línea)"
            />
            <p className="text-xs text-muted-foreground">
              Uno por línea (o separados por coma). Modo prueba de Resend: solo
              entrega al correo dueño de la cuenta hasta verificar el dominio.
            </p>
          </div>

          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="mt-4">
            <DialogClose
              render={
                <Button variant="outline" type="button" disabled={pending} />
              }
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando..." : yaEnviada ? "Reenviar" : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
