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
import type {
  CurrencyOption,
  LineaRow,
  SupplierOption,
  UnitOption,
  UomOption,
} from "./actions"
import { createLinea, updateLinea } from "./actions"
import type { FormValues } from "./linea-form"
import { CREAR, formSchema, LineaFormFields, NONE } from "./linea-form"

export type Catalogs = {
  suppliers: SupplierOption[]
  units: UnitOption[]
  uoms: UomOption[]
  currencies: CurrencyOption[]
}

type NewProps = {
  mode: "new"
  projectId: string
  partidaCatalogId: string
  catalogs: Catalogs
  open: boolean
  onOpenChange: (open: boolean) => void
}

type EditProps = {
  mode: "edit"
  projectId: string
  linea: LineaRow
  catalogs: Catalogs
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Props = NewProps | EditProps

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function getDefaults(props: Props): FormValues {
  if (props.mode === "new") {
    return {
      concepto: "",
      detalle: "",
      unit_id: NONE,
      piso: "",
      depto: "",
      supplier_id: NONE,
      supplier_nombre: "",
      unidad: "",
      cantidad: "",
      moneda: "MXN",
      unitario: "",
      sobrecosto_pct: "0",
      iva_pct: "16",
      notas: "",
      madurez: "ppto",
      contratado: "no_contratado",
      quote_date: todayISO(),
    }
  }
  const l = props.linea
  const unitId =
    props.catalogs.units.find((u) => u.nombre === l.villa_casita)?.id ?? NONE
  return {
    concepto: l.concepto,
    detalle: l.detalle ?? "",
    unit_id: unitId,
    piso: l.piso ?? "",
    depto: l.depto ?? "",
    supplier_id: l.supplier_id ?? NONE,
    supplier_nombre: "",
    unidad: l.unidad ?? "",
    cantidad: String(l.cantidad),
    moneda: l.moneda,
    unitario: String(l.unitario),
    sobrecosto_pct: String(Math.round(l.sobrecosto_pct * 10000) / 100),
    iva_pct: String(Math.round(l.iva_pct * 10000) / 100),
    notas: l.notas ?? "",
    madurez: l.kind,
    contratado: l.contratado ? "contratado" : "no_contratado",
    quote_date: l.quote_date,
  }
}

export function LineaDialog(props: Props) {
  const { mode, open, onOpenChange, projectId, catalogs } = props
  const pdfRef = useRef<HTMLInputElement>(null)
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
    if (v.supplier_id === CREAR && !v.supplier_nombre?.trim()) {
      form.setError("supplier_nombre", {
        message: "Nombre del proveedor requerido",
      })
      return
    }
    setSubmitError(null)
    startTransition(async () => {
      const fd = new FormData()
      const put = (k: string, val?: string) => {
        if (val !== undefined && val !== "") fd.append(k, val)
      }
      put("concepto", v.concepto)
      put("detalle", v.detalle)
      if (v.unit_id && v.unit_id !== NONE) put("unit_id", v.unit_id)
      put("piso", v.piso)
      put("depto", v.depto)
      put("supplier_id", v.supplier_id)
      put("supplier_nombre", v.supplier_nombre)
      put("unidad", v.unidad)
      put("cantidad", v.cantidad)
      put("moneda", v.moneda)
      put("unitario", v.unitario)
      put("sobrecosto_pct", v.sobrecosto_pct || "0")
      put("iva_pct", v.iva_pct)
      put("notas", v.notas)
      put("madurez", v.madurez)
      put("contratado", v.contratado)
      put("quote_date", v.quote_date)
      const pdfFile = pdfRef.current?.files?.[0]
      if (pdfFile) fd.append("pdf", pdfFile)

      let result: { error: string } | { ok: true }
      if (mode === "new") {
        fd.append("partida_catalog_id", props.partidaCatalogId)
        result = await createLinea(projectId, fd)
      } else {
        result = await updateLinea(
          props.linea.id,
          props.linea.quote_id,
          projectId,
          fd,
        )
      }
      if ("error" in result) {
        setSubmitError(result.error)
        return
      }
      onOpenChange(false)
    })
  })

  const isNew = mode === "new"
  const hasPdf = mode === "edit" ? !!props.linea.pdf_url : false

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Agregar línea" : "Editar línea"}</DialogTitle>
          <DialogDescription>
            Una línea por concepto (formato verde de 22 columnas). El sistema
            calcula importe, IVA y total MXN.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <LineaFormFields
            control={form.control}
            errors={errors}
            suppliers={catalogs.suppliers}
            units={catalogs.units}
            uoms={catalogs.uoms}
            currencies={catalogs.currencies}
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
                  ? "Guardar línea"
                  : "Actualizar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
