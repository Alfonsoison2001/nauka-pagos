"use client"

import { Star } from "lucide-react"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { marcarVigente } from "./actions"

type Props = {
  projectId: string
  itemId: string
  quoteId: string
  /** Etiqueta legible de la versión, p. ej. "DIECI · 12/06/2026". */
  etiqueta: string
}

/**
 * Botón (admin) para marcar una versión como la vigente del concepto. Confirma en
 * un diálogo (cambia el monto que usan Resumen y Partida). Vive en cada fila no
 * vigente del historial de la pantalla Subcategoría.
 */
export function MarcarVigenteButton({
  projectId,
  itemId,
  quoteId,
  etiqueta,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await marcarVigente(projectId, itemId, quoteId)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        <Star />
        Marcar vigente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Marcar esta versión como vigente?</DialogTitle>
            <DialogDescription>
              {error ??
                `${etiqueta} pasará a ser la versión vigente del concepto. El Resumen y la Partida usarán su monto. Puedes revertir marcando otra versión.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {error ? (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            ) : (
              <>
                <DialogClose
                  render={<Button variant="outline" disabled={pending} />}
                >
                  Cancelar
                </DialogClose>
                <Button onClick={handleConfirm} disabled={pending}>
                  {pending ? "Aplicando…" : "Sí, marcar vigente"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
