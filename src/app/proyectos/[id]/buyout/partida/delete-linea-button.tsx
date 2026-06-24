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
import { deleteLinea } from "./actions"

type Props = {
  lineId: string
  quoteId: string
  itemId: string
  projectId: string
  concepto: string
}

export function DeleteLineaButton({
  lineId,
  quoteId,
  itemId,
  projectId,
  concepto,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deleteLinea(lineId, quoteId, itemId, projectId)
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
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        aria-label={`Eliminar ${concepto}`}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar línea?</DialogTitle>
            <DialogDescription>
              {error ??
                `Se eliminará "${concepto}" (borrado suave, recuperable). La cotización queda dada de baja.`}
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
