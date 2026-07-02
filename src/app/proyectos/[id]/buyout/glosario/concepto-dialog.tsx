"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type ActionResult, createConcepto, renameConcepto } from "./actions"

const formSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido"),
  orden: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

type Props = {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
} & (
  | { mode: "new"; partidaId: string; nextOrden: number }
  | { mode: "rename"; conceptoId: string; nombre: string }
)

export function ConceptoDialog(props: Props) {
  const { projectId, open, onOpenChange, mode } = props
  const [pending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const defaults: FormValues =
    mode === "rename"
      ? { nombre: props.nombre, orden: "" }
      : { nombre: "", orden: String(props.nextOrden) }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  })
  const errors = form.formState.errors

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset(defaults)
      setSubmitError(null)
    }
    onOpenChange(next)
  }

  const onSubmit = form.handleSubmit((v) => {
    setSubmitError(null)
    startTransition(async () => {
      let result: ActionResult
      if (mode === "rename") {
        result = await renameConcepto(
          projectId,
          props.conceptoId,
          v.nombre.trim(),
        )
      } else {
        const ordenNum = v.orden?.trim() ? Number(v.orden) : undefined
        result = await createConcepto(projectId, props.partidaId, {
          nombre: v.nombre.trim(),
          orden: Number.isFinite(ordenNum) ? ordenNum : undefined,
        })
      }
      if ("error" in result) {
        setSubmitError(result.error)
        return
      }
      onOpenChange(false)
      form.reset(defaults)
    })
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "rename" ? "Renombrar concepto" : "Nuevo concepto"}
          </DialogTitle>
          <DialogDescription>
            {mode === "rename"
              ? "Se actualiza en el catálogo y en los datos capturados con ese nombre."
              : "Agrega un concepto (subcategoría) al catálogo de esta partida."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cc-nombre">Nombre del concepto</Label>
            <Controller
              name="nombre"
              control={form.control}
              render={({ field }) => (
                <Input
                  id="cc-nombre"
                  placeholder="Ej. Iluminación"
                  {...field}
                />
              )}
            />
            {errors.nombre ? (
              <p className="text-xs text-destructive">
                {errors.nombre.message}
              </p>
            ) : null}
          </div>

          {mode === "new" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cc-orden">Orden</Label>
              <Controller
                name="orden"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="cc-orden"
                    type="number"
                    min="0"
                    step="1"
                    {...field}
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">
                Posición dentro de la partida (menor = más arriba). También
                puedes reordenar luego con las flechas.
              </p>
            </div>
          ) : null}

          {submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" type="button" disabled={pending} />
              }
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Guardando..."
                : mode === "rename"
                  ? "Guardar"
                  : "Crear concepto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
