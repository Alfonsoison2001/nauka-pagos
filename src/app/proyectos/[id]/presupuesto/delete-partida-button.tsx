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
  partidaId: string
  projectId: string
  partidaNombre: string
}

export function DeletePartidaButton({
  partidaId,
  projectId,
  partidaNombre,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleOpen() {
    setError(null)
    setOpen(true)
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deletePartida(partidaId, projectId)
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
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={handleOpen}
        aria-label={`Eliminar ${partidaNombre}`}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar partida?</DialogTitle>
            <DialogDescription>
              {error ??
                `Se eliminará "${partidaNombre}". Esta acción no se puede deshacer fácilmente.`}
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
