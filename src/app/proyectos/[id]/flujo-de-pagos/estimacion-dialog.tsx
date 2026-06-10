"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import type { ApprovalSummary } from "@/components/approvals/approval-chip"
import { CancelarAprobacionButton } from "@/components/approvals/cancelar-aprobacion-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  ContratistaOption,
  EstimacionRow,
  PagadorOption,
  PartidaOption,
} from "./actions"
import { createEstimacion, updateEstimacion } from "./actions"
import type { FormValues } from "./estimacion-form"
import { EstimacionFormFields, formSchema } from "./estimacion-form"

// ── Shared props ──────────────────────────────────────────────────────────────

type SharedProps = {
  projectId: string
  contratistas: ContratistaOption[]
  partidas: PartidaOption[]
  pagadores: PagadorOption[]
  pagadoAcumByPartida: Record<string, number>
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Estado de aprobación de la carátula (solo relevante en modo edit). */
  aprobacion?: ApprovalSummary
  isAdmin?: boolean
}

type NewProps = SharedProps & { mode: "new" }
type EditProps = SharedProps & { mode: "edit"; estimacion: EstimacionRow }
type Props = NewProps | EditProps

// ── Default values ────────────────────────────────────────────────────────────

function getDefaults(props: Props): FormValues {
  if (props.mode === "new") {
    return {
      contratista_id: "",
      partida_id: "",
      pagador_id: "",
      numero: "",
      concepto: "",
      fecha_estimacion: new Date().toISOString().slice(0, 10),
      monto_sin_iva: "",
      agregar_iva: false,
      status: "pendiente",
      notas: "",
    }
  }
  const e = props.estimacion
  return {
    contratista_id: e.contratista_id,
    partida_id: e.partida_id,
    pagador_id: e.pagador_id ?? "",
    numero: e.numero,
    concepto: e.concepto ?? "",
    fecha_estimacion: e.fecha_estimacion,
    monto_sin_iva: String(e.monto_sin_iva),
    agregar_iva: e.iva_pct > 0,
    status: e.status,
    notas: e.notas ?? "",
  }
}

// ── EstimacionDialog ──────────────────────────────────────────────────────────

export function EstimacionDialog(props: Props) {
  const { open, onOpenChange, projectId } = props
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

  const onSubmit = form.handleSubmit((values) => {
    setSubmitError(null)
    startTransition(async () => {
      // iva_pct: 0.16 if checkbox on, 0 if off
      const ivaPct = values.agregar_iva ? 0.16 : 0

      const fd = new FormData()
      fd.append("partida_id", values.partida_id)
      fd.append("pagador_id", values.pagador_id)
      fd.append("numero", values.numero)
      if (values.concepto) fd.append("concepto", values.concepto)
      fd.append("fecha_estimacion", values.fecha_estimacion)
      fd.append("monto_sin_iva", values.monto_sin_iva)
      fd.append("iva_pct", String(ivaPct))
      fd.append("status", values.status)
      if (values.notas) fd.append("notas", values.notas)

      let result: { error: string } | { ok: true }
      if (props.mode === "new") {
        result = await createEstimacion(projectId, fd)
      } else {
        result = await updateEstimacion(props.estimacion.id, projectId, fd)
      }

      if ("error" in result) {
        setSubmitError(result.error)
        return
      }
      form.reset(values)
      onOpenChange(false)
    })
  })

  const isNew = props.mode === "new"

  // Guard de edición (F3): si la carátula tiene una ronda abierta, bloquear el
  // guardado en la UI (el server action es la validación autoritativa).
  const openReqId =
    props.mode === "edit" && props.aprobacion?.status === "en_aprobacion"
      ? props.aprobacion.openRequestId
      : null
  const blocked = Boolean(openReqId)
  const aprob = props.aprobacion?.aprobadas ?? 0
  const totalFirmas = props.aprobacion?.total ?? 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Nueva estimación" : "Editar estimación"}
          </DialogTitle>
        </DialogHeader>
        {blocked && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">
              Aprobación en curso ({aprob}/{totalFirmas} firmas).
            </p>
            <p className="mt-0.5">
              Cancela la solicitud antes de editar, o los firmantes verán un PDF
              desactualizado.
            </p>
            {props.isAdmin && openReqId && (
              <div className="mt-2">
                <CancelarAprobacionButton requestId={openReqId} />
              </div>
            )}
          </div>
        )}
        <form onSubmit={onSubmit} noValidate>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <EstimacionFormFields
              control={form.control}
              errors={errors}
              setValue={form.setValue}
              contratistas={props.contratistas}
              partidas={props.partidas}
              pagadores={props.pagadores}
              pagadoAcumByPartida={props.pagadoAcumByPartida}
              mode={props.mode}
              contratistaName={
                props.mode === "edit"
                  ? props.estimacion.contratista_nombre
                  : undefined
              }
              partidaName={
                props.mode === "edit"
                  ? props.estimacion.partida_nombre
                  : undefined
              }
            />
          </div>
          {submitError && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {submitError}
            </p>
          )}
          <DialogFooter className="mt-4">
            <DialogClose
              render={
                <Button variant="outline" type="button" disabled={pending} />
              }
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pending || blocked}>
              {pending
                ? "Guardando..."
                : isNew
                  ? "Guardar estimación"
                  : "Actualizar estimación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
