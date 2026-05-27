"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRef, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
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
import type { ContratistaOption, PartidaRow } from "./actions"
import { createPartida, updatePartida } from "./actions"
import type { FormValues } from "./partida-form"
import { formSchema, PartidaFormFields } from "./partida-form"

type NewProps = {
  mode: "new"
  projectId: string
  contratistas: ContratistaOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

type EditProps = {
  mode: "edit"
  partida: PartidaRow
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Props = NewProps | EditProps

function getDefaults(props: Props): FormValues {
  if (props.mode === "new") {
    return {
      contratista_id: "",
      contratista_nombre: "",
      nombre: "",
      presupuesto_sin_iva: "",
      iva_pct: "16",
      notas: "",
      fecha_firma: "",
    }
  }
  const p = props.partida
  return {
    nombre: p.nombre,
    presupuesto_sin_iva: String(p.presupuesto_sin_iva),
    iva_pct: String(Math.round(p.iva_pct * 100)),
    notas: p.notas ?? "",
    fecha_firma: p.fecha_firma ?? "",
  }
}

export function PartidaDialog(props: Props) {
  const { mode, open, onOpenChange, projectId } = props
  const pdfRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaults(props),
  })
  const errors = form.formState.errors
  const contratistaId = form.watch("contratista_id")

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset(getDefaults(props))
      setSubmitError(null)
    }
    onOpenChange(next)
  }

  const onSubmit = form.handleSubmit((values) => {
    if (mode === "new") {
      if (!values.contratista_id) {
        form.setError("contratista_id", {
          message: "Selecciona un contratista",
        })
        return
      }
      if (
        values.contratista_id === "crear_nuevo" &&
        !values.contratista_nombre?.trim()
      ) {
        form.setError("contratista_nombre", {
          message: "Nombre del contratista requerido",
        })
        return
      }
    }
    setSubmitError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append("nombre", values.nombre)
      fd.append("presupuesto_sin_iva", values.presupuesto_sin_iva)
      fd.append("iva_pct", values.iva_pct)
      if (values.notas) fd.append("notas", values.notas)
      if (values.fecha_firma) fd.append("fecha_firma", values.fecha_firma)
      const pdfFile = pdfRef.current?.files?.[0]
      if (pdfFile) fd.append("pdf", pdfFile)

      let result: { error: string } | { ok: true }
      if (mode === "new") {
        fd.append("contratista_id", values.contratista_id ?? "")
        if (values.contratista_nombre) {
          fd.append("contratista_nombre", values.contratista_nombre)
        }
        result = await createPartida(projectId, fd)
      } else {
        result = await updatePartida(props.partida.id, projectId, fd)
      }

      if ("error" in result) {
        setSubmitError(result.error)
        return
      }
      form.reset(values)
      onOpenChange(false)
    })
  })

  const isNew = mode === "new"
  const contratistaName =
    mode === "edit" ? props.partida.contratista_nombre : undefined
  const hasPdf = mode === "edit" ? !!props.partida.presupuesto_pdf_url : false

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Subir presupuesto firmado" : "Editar partida"}
          </DialogTitle>
          {isNew && (
            <DialogDescription>
              Registra un contrato firmado con su presupuesto.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <PartidaFormFields
            control={form.control}
            errors={errors}
            mode={mode}
            contratistas={isNew ? (props as NewProps).contratistas : []}
            contratistaId={contratistaId}
            contratistaName={contratistaName}
            pdfInputRef={pdfRef}
            hasPdf={hasPdf}
          />
          {submitError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          <DialogFooter className="mt-4">
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
                : isNew
                  ? "Guardar partida"
                  : "Actualizar partida"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
