"use client"

import { Trash2 } from "lucide-react"
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
import { deletePartida } from "./actions"

type Props = {
  projectId: string
  partidaId: string
  nombre: string
  /** Cuántos conceptos capturados (buyout_item) cuelgan de la partida. */
  itemCount: number
}

export function DeletePartidaButton({
  projectId,
  partidaId,
  nombre,
  itemCount,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deletePartida(projectId, partidaId)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  const conDatos = itemCount > 0

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        aria-label={`Eliminar ${nombre}`}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar la partida “{nombre}”?</DialogTitle>
            <DialogDescription>
              {error ??
                (conDatos
                  ? `Esta partida tiene ${itemCount} concepto${itemCount === 1 ? "" : "s"} con datos capturados. Se ocultará del tablero (borrado suave, recuperable); los datos NO se borran.`
                  : "Se quitará del catálogo (borrado suave, recuperable).")}
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
