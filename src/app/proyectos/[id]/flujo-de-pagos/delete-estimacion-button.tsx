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
import type { EstimacionRow } from "./actions"
import { deleteEstimacion } from "./actions"

type Props = {
  estimacion: EstimacionRow
  projectId: string
}

function warningText(estimacion: EstimacionRow): string | null {
  if (estimacion.status === "pagada") {
    return "⚠️ Esta estimación está marcada como PAGADA. Eliminarla va a alterar el historial financiero del contratista y el Pagado Acumulado de la partida. Esta acción no se puede deshacer fácilmente."
  }
  const hasFiles =
    !!estimacion.caratula_firmada_url || !!estimacion.comprobante_pago_url
  if (hasFiles) {
    return "⚠️ Esta estimación tiene archivos adjuntos (carátula o comprobante). Al eliminarla perderás el registro de esos documentos."
  }
  return null
}

export function DeleteEstimacionButton({ estimacion, projectId }: Props) {
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
      const result = await deleteEstimacion(estimacion.id, projectId)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  const warning = warningText(estimacion)

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={handleOpen}
        aria-label={`Eliminar estimación ${estimacion.numero}`}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar estimación?</DialogTitle>
            <DialogDescription>
              {error ??
                warning ??
                `Se eliminará la estimación #${estimacion.numero}. Esta acción no se puede deshacer fácilmente.`}
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
                  {pending ? "Eliminando..." : "Sí, eliminar de todas formas"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
