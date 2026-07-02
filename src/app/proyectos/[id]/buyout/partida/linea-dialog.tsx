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
import { createClient } from "@/lib/supabase/client"
import type {
  ActionResult,
  ConceptoOption,
  CurrencyOption,
  KVOption,
  LineaRow,
  SupplierOption,
  UnitMode,
  UnitOption,
  UomOption,
} from "./actions"
import { addBudgetVersion, createLinea, updateLinea } from "./actions"
import type { FormValues } from "./linea-form"
import { CREAR, formSchema, LineaFormFields, NONE, OTRO } from "./linea-form"

// El PDF sube DIRECTO del navegador a Supabase Storage (bucket `proyectos`,
// prefijo `buyout/`, RLS admin-only). Así el archivo NO viaja por el Server
// Action → se saltan el límite de 1 MB de Server Actions y el ~4.5 MB de Vercel.
const PDF_MAX_BYTES = 50 * 1024 * 1024 // 50 MB

export type Catalogs = {
  conceptos: ConceptoOption[]
  suppliers: SupplierOption[]
  units: UnitOption[]
  // BF: "torre" → captura Torre 1/Torre 2 (villa_casita) + Depto de dropdown.
  // L3/L44: "villa" → comportamiento actual (villa/casita por unit_id, depto libre).
  unitMode: UnitMode
  torres: KVOption[]
  deptos: KVOption[]
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

// "version" = Actualizar presupuesto: nueva versión sobre el mismo concepto.
type VersionProps = {
  mode: "version"
  projectId: string
  linea: LineaRow
  catalogs: Catalogs
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Props = NewProps | EditProps | VersionProps

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Mapea el concepto guardado a la opción del dropdown, o a "Otro…" si es libre. */
function conceptoDefaults(
  concepto: string,
  conceptos: ConceptoOption[],
): { concepto: string; concepto_otro: string } {
  return conceptos.some((c) => c.nombre === concepto)
    ? { concepto, concepto_otro: "" }
    : { concepto: OTRO, concepto_otro: concepto }
}

function getDefaults(props: Props): FormValues {
  if (props.mode === "new") {
    return {
      concepto: "",
      concepto_otro: "",
      detalle: "",
      unit_id: NONE,
      torre: NONE,
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
  const torreMode = props.catalogs.unitMode === "torre"
  const unitId =
    props.catalogs.units.find((u) => u.nombre === l.villa_casita)?.id ?? NONE
  // BF: la torre vive en villa_casita como texto ("Torre 1"); el form la resuelve
  // contra sus opciones (o la conserva tal cual si es un valor legacy p. ej. "Compartido").
  const torre = torreMode ? (l.villa_casita ?? NONE) : NONE
  const cc = conceptoDefaults(l.concepto, props.catalogs.conceptos)
  return {
    concepto: cc.concepto,
    concepto_otro: cc.concepto_otro,
    detalle: l.detalle ?? "",
    unit_id: unitId,
    torre,
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
    // Una versión nueva se fecha HOY; un edit conserva la fecha.
    quote_date: props.mode === "version" ? todayISO() : l.quote_date,
  }
}

const COPY: Record<
  Props["mode"],
  { title: string; desc: string; cta: string }
> = {
  new: {
    title: "Agregar línea",
    desc: "Crea un concepto NUEVO en esta partida (un renglón nuevo).",
    cta: "Guardar línea",
  },
  edit: {
    title: "Editar línea",
    desc: "Corrige la línea vigente en sitio (no crea versión).",
    cta: "Actualizar",
  },
  version: {
    title: "Actualizar presupuesto",
    desc: "Nueva versión fechada del MISMO concepto; la anterior se conserva en el historial.",
    cta: "Guardar versión",
  },
}

export function LineaDialog(props: Props) {
  const { mode, open, onOpenChange, projectId, catalogs } = props
  const pdfRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Aviso no-fatal: la línea SÍ se guardó pero el PDF no subió (BO-10).
  const [submitWarning, setSubmitWarning] = useState<string | null>(null)
  // Error de validación del archivo (tipo/tamaño) — se muestra junto al input.
  const [pdfError, setPdfError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaults(props),
  })
  const errors = form.formState.errors

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset(getDefaults(props))
      setSubmitError(null)
      setSubmitWarning(null)
      setPdfError(null)
    }
    onOpenChange(next)
  }

  const onSubmit = form.handleSubmit((v) => {
    // Concepto: en "Otro…" exige el nombre escrito (salvo version, que lo fija el server).
    let concepto = v.concepto
    if (props.mode !== "version" && v.concepto === OTRO) {
      const otro = v.concepto_otro?.trim()
      if (!otro) {
        form.setError("concepto_otro", { message: "Escribe el concepto" })
        return
      }
      concepto = otro
    }
    if (v.supplier_id === CREAR && !v.supplier_nombre?.trim()) {
      form.setError("supplier_nombre", {
        message: "Nombre del proveedor requerido",
      })
      return
    }
    // Validación del archivo ANTES de subir: tipo PDF + tamaño ≤ 50 MB.
    const pdfFile = pdfRef.current?.files?.[0] ?? null
    if (pdfFile) {
      const isPdf =
        pdfFile.type === "application/pdf" ||
        pdfFile.name.toLowerCase().endsWith(".pdf")
      if (!isPdf) {
        setPdfError("Solo se aceptan archivos PDF")
        return
      }
      if (pdfFile.size > PDF_MAX_BYTES) {
        setPdfError("El PDF debe pesar máximo 50 MB")
        return
      }
    }

    setSubmitError(null)
    setSubmitWarning(null)
    setPdfError(null)
    startTransition(async () => {
      // 1) El PDF sube DIRECTO del navegador a Storage (si hay). Best-effort: si
      //    falla, NO bloquea guardar la línea → se guarda sin PDF y se avisa para
      //    reintentar desde “Editar”. La sesión autenticada aplica la RLS admin.
      let pdfPath: string | null = null
      let pdfWarn: string | null = null
      if (pdfFile) {
        const supabase = createClient()
        const path = `${projectId}/buyout/${crypto.randomUUID()}.pdf`
        const { error: upErr } = await supabase.storage
          .from("proyectos")
          .upload(path, pdfFile, {
            contentType: "application/pdf",
            upsert: false,
          })
        if (upErr) pdfWarn = upErr.message
        else pdfPath = path
      }

      // 2) El Server Action recibe solo la RUTA (string), no el archivo.
      const fd = new FormData()
      const put = (k: string, val?: string) => {
        if (val !== undefined && val !== "") fd.append(k, val)
      }
      put(
        "concepto",
        props.mode === "version" ? props.linea.concepto : concepto,
      )
      put("detalle", v.detalle)
      if (v.unit_id && v.unit_id !== NONE) put("unit_id", v.unit_id)
      // BF: la torre (Torre 1/Torre 2) va directo a villa_casita en el server.
      if (v.torre && v.torre !== NONE) put("torre", v.torre)
      put("piso", v.piso)
      if (v.depto && v.depto !== NONE) put("depto", v.depto)
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
      if (pdfPath) fd.append("pdf_path", pdfPath)

      let result: ActionResult
      if (props.mode === "new") {
        fd.append("partida_catalog_id", props.partidaCatalogId)
        result = await createLinea(projectId, fd)
      } else if (props.mode === "version") {
        result = await addBudgetVersion(props.linea.item_id, projectId, fd)
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
      // La línea SÍ se guardó. Si el PDF (opcional) no subió, avisamos y NO
      // cerramos ni permitimos reenviar (evita duplicar la línea ya creada).
      if (pdfWarn) {
        setSubmitWarning(
          `La línea se guardó, pero el PDF no se subió (${pdfWarn}). Ábrela con “Editar” para reintentar la subida.`,
        )
        return
      }
      if (result.warning) {
        setSubmitWarning(result.warning)
        return
      }
      onOpenChange(false)
    })
  })

  const copy = COPY[mode]
  const hasPdf = props.mode === "new" ? false : !!props.linea.pdf_url
  const conceptoName =
    props.mode === "version" ? props.linea.concepto : undefined

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.desc}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <LineaFormFields
            control={form.control}
            errors={errors}
            conceptos={catalogs.conceptos}
            suppliers={catalogs.suppliers}
            units={catalogs.units}
            unitMode={catalogs.unitMode}
            torres={catalogs.torres}
            deptos={catalogs.deptos}
            uoms={catalogs.uoms}
            currencies={catalogs.currencies}
            pdfInputRef={pdfRef}
            hasPdf={hasPdf}
            pdfError={pdfError}
            conceptoLocked={mode === "version"}
            conceptoName={conceptoName}
          />
          {submitError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          {submitWarning ? (
            <p className="mt-3 text-sm text-amber-600" role="status">
              {submitWarning}
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
            <Button type="submit" disabled={pending || !!submitWarning}>
              {pending ? "Guardando..." : copy.cta}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
