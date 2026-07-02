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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type ActionResult, createPartida, updatePartida } from "./actions"

// Sentinela para "sin capítulo" (base-ui no admite value="").
const SIN_CAP = "__sin_capitulo__"

const formSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido"),
  chapter: z.string().optional(),
  unidad_driver: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

export type PartidaForEdit = {
  id: string
  nombre: string
  chapter_default: string | null
  unidad_driver: string | null
}

type Props = {
  projectId: string
  chapterNames: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
} & (
  | { mode: "new"; defaultChapter?: string }
  | { mode: "edit"; partida: PartidaForEdit }
)

function getDefaults(props: Props): FormValues {
  if (props.mode === "edit") {
    // Si el capítulo guardado ya no existe (referencia obsoleta), cae a "Sin
    // capítulo" en vez de dejar el Select en blanco.
    const ch = props.partida.chapter_default
    return {
      nombre: props.partida.nombre,
      chapter: ch && props.chapterNames.includes(ch) ? ch : SIN_CAP,
      unidad_driver: props.partida.unidad_driver ?? "",
    }
  }
  return {
    nombre: "",
    chapter: props.defaultChapter ?? SIN_CAP,
    unidad_driver: "",
  }
}

export function PartidaDialog(props: Props) {
  const { projectId, chapterNames, open, onOpenChange, mode } = props
  const [pending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaults(props),
  })
  const errors = form.formState.errors

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset(getDefaults(props))
      setSubmitError(null)
    }
    onOpenChange(next)
  }

  const onSubmit = form.handleSubmit((v) => {
    setSubmitError(null)
    startTransition(async () => {
      const payload = {
        nombre: v.nombre.trim(),
        chapter: v.chapter === SIN_CAP ? undefined : v.chapter,
        unidad_driver: v.unidad_driver?.trim() || undefined,
      }
      const result: ActionResult =
        mode === "edit"
          ? await updatePartida(projectId, props.partida.id, payload)
          : await createPartida(projectId, payload)
      if ("error" in result) {
        setSubmitError(result.error)
        return
      }
      onOpenChange(false)
      form.reset(getDefaults(props))
    })
  })

  const chapterOptions = [
    ...chapterNames.map((c) => ({ value: c, label: c })),
    { value: SIN_CAP, label: "Sin capítulo" },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar partida" : "Nueva partida"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Renombra, mueve de capítulo o ajusta el driver de la partida."
              : "Crea una partida en el catálogo de este proyecto."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pd-nombre">Nombre de la partida</Label>
            <Controller
              name="nombre"
              control={form.control}
              render={({ field }) => (
                <Input
                  id="pd-nombre"
                  placeholder="Ej. IMPERMEABILIZACIÓN"
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pd-chapter">Capítulo</Label>
            <Controller
              name="chapter"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value ?? SIN_CAP}
                  onValueChange={field.onChange}
                  items={chapterOptions}
                >
                  <SelectTrigger id="pd-chapter" className="w-full">
                    <SelectValue placeholder="Sin capítulo" />
                  </SelectTrigger>
                  <SelectContent>
                    {chapterOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pd-driver">Unidad / driver (opcional)</Label>
            <Controller
              name="unidad_driver"
              control={form.control}
              render={({ field }) => (
                <Input
                  id="pd-driver"
                  placeholder="Ej. m², PZA, Villa/Casita"
                  {...field}
                />
              )}
            />
          </div>

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
                : mode === "edit"
                  ? "Guardar cambios"
                  : "Crear partida"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
