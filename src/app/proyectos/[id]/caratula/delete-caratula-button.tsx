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
import { deleteCaratula } from "./actions"

type Props = {
  estimacionId: string
  projectId: string
  /** Se llama tras un borrado exitoso (el padre resetea estado + refresca). */
  onDeleted: () => void
}

export function DeleteCaratulaButton({
  estimacionId,
  projectId,
  onDeleted,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deleteCaratula(estimacionId, projectId)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setOpen(false)
      onDeleted()
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" />
        Borrar carátula
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar carátula?</DialogTitle>
            <DialogDescription>
              {error ??
                "Se borrará el PDF y el historial de aprobación. Esta acción no se puede deshacer."}
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
