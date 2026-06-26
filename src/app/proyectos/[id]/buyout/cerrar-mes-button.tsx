"use client"

import { CalendarCheck } from "lucide-react"
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
import { cerrarMesActual } from "./actions"

type Props = {
  projectId: string
  /** Mes en curso legible, p. ej. "Junio 2026". */
  periodoShort: string
  /** ¿El mes en curso ya está cerrado? (entonces el botón es "Actualizar mes"). */
  yaCerrado: boolean
}

/**
 * Botón (admin) del Resumen: "Cerrar mes" congela el total vigente por partida del
 * mes en curso como una columna comparable. Si el mes ya está cerrado, el botón pasa
 * a "Actualizar mes" = re-toma el total de hoy y sobrescribe el valor congelado de
 * ese mes (no toca otros meses). Confirma en un diálogo (acción con efecto en datos).
 */
export function CerrarMesButton({ projectId, periodoShort, yaCerrado }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await cerrarMesActual(projectId)
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
        variant={yaCerrado ? "outline" : "default"}
        size="sm"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        <CalendarCheck />
        {yaCerrado
          ? `Actualizar mes · ${periodoShort}`
          : `Cerrar mes · ${periodoShort}`}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {yaCerrado
                ? `¿Actualizar ${periodoShort}?`
                : `¿Cerrar ${periodoShort}?`}
            </DialogTitle>
            <DialogDescription>
              {error ??
                `${yaCerrado ? "Se re-tomará" : "Se guardará"} el total vigente actual de cada partida como la columna de ${periodoShort}.${
                  yaCerrado
                    ? " Sobrescribe el valor congelado anterior de este mes (no toca otros meses)."
                    : " La verás como una columna en Evolución y en el grupo “▸ Meses” del Vigente."
                }`}
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
                  {pending
                    ? "Guardando…"
                    : yaCerrado
                      ? "Sí, actualizar"
                      : "Sí, cerrar mes"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
