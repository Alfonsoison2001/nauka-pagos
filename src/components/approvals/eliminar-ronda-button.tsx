"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { eliminarRonda } from "@/app/aprobaciones/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  requestId: string
  round: number
  /** Tras eliminar con éxito. Por defecto: router.refresh(). */
  onDeleted?: () => void
}

/**
 * Elimina del historial UNA ronda cancelada o rechazada (admin). Hard-delete:
 * borra la solicitud y, en cascada, sus votos. Las rondas aprobadas no exponen
 * este botón (son constancia probatoria).
 */
export function EliminarRondaButton({ requestId, round, onDeleted }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const r = await eliminarRonda(requestId)
      if ("error" in r) {
        setError(r.error)
        return
      }
      setOpen(false)
      if (onDeleted) onDeleted()
      else router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-destructive"
      >
        <Trash2 className="size-3" />
        Eliminar del historial
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar la ronda {round} del historial?</DialogTitle>
            <DialogDescription>
              {error ??
                "Se borrará esta ronda y sus votos de forma permanente. Esta acción no se puede deshacer."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {error ? (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  type="button"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  type="button"
                  disabled={pending}
                  onClick={handleConfirm}
                >
                  {pending ? "Eliminando..." : "Sí, eliminar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
