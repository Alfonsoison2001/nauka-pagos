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
import { deleteChapter } from "./actions"

type Props = {
  projectId: string
  chapterId: string
  nombre: string
  partidaCount: number
}

export function DeleteCapituloButton({
  projectId,
  chapterId,
  nombre,
  partidaCount,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Con partidas no se puede borrar: lo bloqueamos en el propio botón (y en el server).
  const bloqueado = partidaCount > 0

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deleteChapter(projectId, chapterId)
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
        disabled={bloqueado}
        title={
          bloqueado
            ? "Tiene partidas: muévelas o elimínalas primero"
            : `Eliminar ${nombre}`
        }
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
            <DialogTitle>¿Eliminar el capítulo “{nombre}”?</DialogTitle>
            <DialogDescription>
              {error ?? "Se quitará del tablero (borrado suave, recuperable)."}
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
