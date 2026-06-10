"use client"

import { useRouter } from "next/navigation"
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
import { marcarEstimacionEnviada } from "../flujo-de-pagos/actions"
import { enviarCaratula } from "./actions"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  estimacionId: string
  projectId: string
  prefillEmails: string[]
  enviadaAt: string | null
  destinatariosPrev: string[] | null
  /** Status de pago actual — para sugerir marcar "Enviada" tras el envío. */
  estimacionStatus: "pendiente" | "enviada" | "pagada"
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
  estimacionStatus,
  onSent,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [value, setValue] = useState("")
  // Tras enviar con éxito: muestra confirmación + sugerencia de marcar Enviada.
  const [sent, setSent] = useState<{ enviadaAt: string; n: number } | null>(
    null,
  )
  const [marking, startMarking] = useTransition()
  const [markError, setMarkError] = useState<string | null>(null)

  const prefillStr = prefillEmails.join("\n")
  useEffect(() => {
    if (open) {
      setValue(prefillStr)
      setError(null)
      setSent(null)
      setMarkError(null)
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
      setSent({ enviadaAt: result.enviadaAt, n: result.destinatarios.length })
    })
  }

  function handleMarcarEnviada() {
    setMarkError(null)
    startMarking(async () => {
      const r = await marcarEstimacionEnviada(estimacionId, projectId)
      if ("error" in r) {
        setMarkError(r.error)
        return
      }
      router.refresh()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {sent
              ? "Carátula enviada"
              : yaEnviada
                ? "Reenviar carátula al pagador"
                : "Enviar carátula al pagador"}
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
              ✓ Carátula enviada a {sent.n} destinatario
              {sent.n === 1 ? "" : "s"} el {formatDate(sent.enviadaAt)}.
            </div>

            {estimacionStatus === "pendiente" ? (
              <div className="rounded-md border border-nauka-card-border bg-nauka-bg p-3 text-sm">
                <p className="font-medium text-nauka-dark">
                  ¿Marcar la estimación como Enviada?
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  El status de pago es manual. Puedes actualizarlo ahora con un
                  clic.
                </p>
                {markError && (
                  <p className="mt-1 text-xs text-destructive">{markError}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    type="button"
                    onClick={handleMarcarEnviada}
                    disabled={marking}
                  >
                    {marking ? "Marcando..." : "Sí, marcar Enviada"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => onOpenChange(false)}
                    disabled={marking}
                  >
                    Ahora no
                  </Button>
                </div>
              </div>
            ) : (
              <DialogFooter>
                <Button type="button" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            )}
          </div>
        ) : (
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
                Uno por línea (o separados por coma). Modo prueba de Resend:
                solo entrega al correo dueño de la cuenta hasta verificar el
                dominio.
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
        )}
      </DialogContent>
    </Dialog>
  )
}
