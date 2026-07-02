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
import { deleteConcepto } from "./actions"

type Props = {
  projectId: string
  conceptoId: string
  nombre: string
  /** Datos capturados (buyout_item) que usan este concepto por nombre. */
  itemCount: number
}

/**
 * Borra un concepto del catálogo (soft-delete, recuperable). Si tiene datos
 * capturados, pide confirmación (los datos NO se borran, solo sale del catálogo);
 * si está vacío, es directo (un clic).
 */
export function DeleteConceptoButton({
  projectId,
  conceptoId,
  nombre,
  itemCount,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const conDatos = itemCount > 0

  function doDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteConcepto(projectId, conceptoId)
      if ("error" in result) {
        setError(result.error)
        if (!conDatos) setOpen(true) // muestra el error aunque fuera directo
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
        disabled={pending}
        onClick={() => {
          setError(null)
          if (conDatos) setOpen(true)
          else doDelete()
        }}
        aria-label={`Eliminar ${nombre}`}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar el concepto “{nombre}”?</DialogTitle>
            <DialogDescription>
              {error ??
                (conDatos
                  ? `Este concepto tiene ${itemCount} dato${itemCount === 1 ? "" : "s"} capturado${itemCount === 1 ? "" : "s"}. Se quitará del catálogo (borrado suave, recuperable); los datos capturados NO se borran y siguen en el tablero.`
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
                  onClick={doDelete}
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
