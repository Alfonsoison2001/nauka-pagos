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
  /** ¿El mes en curso ya está cerrado? (entonces es "actualizar la foto"). */
  yaCerrado: boolean
}

/**
 * Botón (admin) "Cerrar mes" del Resumen: congela el total vigente por partida del
 * mes en curso en una foto comparable. Si ya estaba cerrado, recierra = sobrescribe
 * la foto. Confirma en un diálogo (acción con efecto sobre datos).
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
          ? `Actualizar foto · ${periodoShort}`
          : `Cerrar mes · ${periodoShort}`}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {yaCerrado
                ? `¿Actualizar la foto de ${periodoShort}?`
                : `¿Cerrar ${periodoShort}?`}
            </DialogTitle>
            <DialogDescription>
              {error ??
                `Se guardará el total vigente actual de cada partida como la foto de ${periodoShort}.${
                  yaCerrado
                    ? " Sobrescribe la foto anterior de este mes (no toca otros meses)."
                    : " Podrás verla como una columna en el modo Evolución."
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
