"use client"

import { Undo2 } from "lucide-react"
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
import { reabrirMes } from "./actions"

type Props = {
  projectId: string
  periodo: string
  /** Mes legible para el texto, p. ej. "Junio 2026". */
  periodoShort: string
}

/**
 * Botón (admin) para reabrir un mes cerrado: quita su columna del comparativo
 * (baja su foto, recuperable). No toca otros meses. Vive en la cabecera de cada
 * columna de mes cerrado en el modo Evolución.
 */
export function ReabrirMesButton({ projectId, periodo, periodoShort }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await reabrirMes(projectId, periodo)
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
        variant="ghost"
        size="icon-xs"
        className="text-white/50 hover:text-white"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        aria-label={`Reabrir ${periodoShort}`}
        title={`Reabrir ${periodoShort}`}
      >
        <Undo2 />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Reabrir {periodoShort}?</DialogTitle>
            <DialogDescription>
              {error ??
                `Se quitará la columna de ${periodoShort} del comparativo (la foto queda dada de baja, recuperable). No afecta los demás meses.`}
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
                <Button
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={pending}
                >
                  {pending ? "Reabriendo…" : "Sí, reabrir"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
