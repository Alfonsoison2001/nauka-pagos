"use client"

import type { RefObject } from "react"
import type { Control, FieldErrors, Path } from "react-hook-form"
import { Controller, useWatch } from "react-hook-form"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { calcLinea } from "@/lib/buyout/calc"
import { formatMXN } from "@/lib/utils"
import type {
  ConceptoOption,
  CurrencyOption,
  KVOption,
  SupplierOption,
  UnitMode,
  UnitOption,
  UomOption,
} from "./actions"

// Sentinela para "sin valor" en selects (base-ui no admite value="").
export const NONE = "ninguno"
export const CREAR = "crear_nuevo"
export const OTRO = "otro_escribir"

// Opciones de Piso (dropdown). El Excel usa una lista fija; incluye "NA".
const PISO_OPTIONS: Option[] = [
  { value: "NA", label: "NA" },
  { value: "Sótano", label: "Sótano" },
  { value: "PB", label: "PB" },
  { value: "N1", label: "N1" },
  { value: "N2", label: "N2" },
  { value: "Azotea", label: "Azotea" },
]

const isNum = (v: string) => v.trim() !== "" && !Number.isNaN(Number(v))

export const formSchema = z.object({
  concepto: z.string().trim().min(1, "Concepto requerido"),
  concepto_otro: z.string().optional(),
  detalle: z.string().optional(),
  unit_id: z.string().optional(),
  torre: z.string().optional(),
  piso: z.string().optional(),
  depto: z.string().optional(),
  supplier_id: z.string().optional(),
  supplier_nombre: z.string().optional(),
  unidad: z.string().optional(),
  cantidad: z
    .string()
    .refine((v) => isNum(v) && Number(v) >= 0, "Cantidad ≥ 0"),
  moneda: z.string().min(1),
  unitario: z
    .string()
    .refine((v) => isNum(v) && Number(v) >= 0, "Unitario ≥ 0"),
  sobrecosto_pct: z
    .string()
    .refine(
      (v) => v === "" || (isNum(v) && Number(v) >= 0 && Number(v) <= 100),
      "0–100",
    ),
  iva_pct: z
    .string()
    .refine((v) => isNum(v) && Number(v) >= 0 && Number(v) <= 100, "0–100"),
  notas: z.string().optional(),
  madurez: z.string().min(1),
  contratado: z.string().min(1),
  quote_date: z.string().optional(),
})

export type FormValues = z.infer<typeof formSchema>

const numberFmt = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type Option = { value: string; label: string }

// --- helpers de campo (reducen repetición) --------------------------------

function ControlledInput({
  control,
  name,
  label,
  errors,
  type = "text",
  step,
  min,
  placeholder,
}: {
  control: Control<FormValues>
  name: Path<FormValues>
  label: string
  errors: FieldErrors<FormValues>
  type?: string
  step?: string
  min?: string
  placeholder?: string
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`lf-${name}`}>{label}</Label>
          <Input
            id={`lf-${name}`}
            type={type}
            step={step}
            min={min}
            placeholder={placeholder}
            {...field}
          />
          {errors[name] ? (
            <p className="text-xs text-destructive">
              {String(errors[name]?.message)}
            </p>
          ) : null}
        </div>
      )}
    />
  )
}

function ControlledSelect({
  control,
  name,
  label,
  placeholder,
  options,
}: {
  control: Control<FormValues>
  name: Path<FormValues>
  label: string
  placeholder: string
  options: Option[]
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`lf-${name}`}>{label}</Label>
          <Select
            value={field.value ?? ""}
            onValueChange={field.onChange}
            items={options}
          >
            <SelectTrigger id={`lf-${name}`} className="w-full">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    />
  )
}

// --- formulario -----------------------------------------------------------

type Props = {
  control: Control<FormValues>
  errors: FieldErrors<FormValues>
  conceptos: ConceptoOption[]
  suppliers: SupplierOption[]
  units: UnitOption[]
  /** "torre" (BF) → Torre 1/Torre 2 + Depto de dropdown; "villa" (L3/L44) → actual. */
  unitMode: UnitMode
  torres: KVOption[]
  deptos: KVOption[]
  uoms: UomOption[]
  currencies: CurrencyOption[]
  pdfInputRef: RefObject<HTMLInputElement | null>
  hasPdf?: boolean
  /** Error de validación del archivo (tipo/tamaño), mostrado bajo el input. */
  pdfError?: string | null
  /** En modo "version" el concepto es fijo (misma subcategoría) → solo lectura. */
  conceptoLocked?: boolean
  conceptoName?: string
}

export function LineaFormFields({
  control,
  errors,
  conceptos,
  suppliers,
  units,
  unitMode,
  torres,
  deptos,
  uoms,
  currencies,
  pdfInputRef,
  hasPdf,
  pdfError,
  conceptoLocked,
  conceptoName,
}: Props) {
  const supplierId = useWatch({ control, name: "supplier_id" })
  const conceptoSel = useWatch({ control, name: "concepto" })
  const torreSel = useWatch({ control, name: "torre" })
  const deptoSel = useWatch({ control, name: "depto" })
  const [cantidad, unitario, sobre, iva, moneda] = useWatch({
    control,
    name: ["cantidad", "unitario", "sobrecosto_pct", "iva_pct", "moneda"],
  })

  const tc = currencies.find((c) => c.currency === moneda)?.rate ?? 1
  const calc = calcLinea({
    cantidad: Number(cantidad) || 0,
    unitario: Number(unitario) || 0,
    sobrecostoPct: (Number(sobre) || 0) / 100,
    ivaPct: (Number(iva) || 0) / 100,
    tc,
  })

  const supplierOptions: Option[] = [
    { value: NONE, label: "Sin proveedor (paramétrico)" },
    ...suppliers.map((s) => ({ value: s.id, label: s.nombre })),
    { value: CREAR, label: "+ Crear nuevo" },
  ]
  const unitOptions: Option[] = [
    { value: NONE, label: "—" },
    ...units.map((u) => ({ value: u.id, label: u.nombre })),
  ]
  const uomOptions: Option[] = uoms.map((u) => ({
    value: u.codigo,
    label: `${u.codigo} — ${u.nombre}`,
  }))
  const currencyOptions: Option[] = currencies.map((c) => ({
    value: c.currency,
    label: c.currency,
  }))
  const conceptoOptions: Option[] = [
    ...conceptos.map((c) => ({ value: c.nombre, label: c.nombre })),
    { value: OTRO, label: "Otro… (escribir)" },
  ]

  // BF (modo torre): dropdowns de Torre y Depto. Conservan un valor legacy que no
  // esté en el catálogo (p. ej. "Compartido") para no perderlo al editar.
  const withCurrent = (base: Option[], current?: string): Option[] => {
    const opts: Option[] = [{ value: NONE, label: "—" }, ...base]
    if (current && current !== NONE && !opts.some((o) => o.value === current)) {
      opts.push({ value: current, label: current })
    }
    return opts
  }
  const torreOptions = withCurrent(torres, torreSel)
  const deptoOptions = withCurrent(deptos, deptoSel)

  return (
    <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
      {conceptoLocked ? (
        <div className="flex flex-col gap-1.5">
          <Label>Concepto (subcategoría)</Label>
          <p className="rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm">
            {conceptoName}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <ControlledSelect
            control={control}
            name="concepto"
            label="Concepto (subcategoría)"
            placeholder="Selecciona un concepto del catálogo"
            options={conceptoOptions}
          />
          {conceptoSel === OTRO ? (
            <Controller
              name="concepto_otro"
              control={control}
              render={({ field }) => (
                <Input placeholder="Escribe el concepto nuevo" {...field} />
              )}
            />
          ) : null}
          {errors.concepto ? (
            <p className="text-xs text-destructive">
              {String(errors.concepto.message)}
            </p>
          ) : null}
        </div>
      )}
      <ControlledInput
        control={control}
        name="detalle"
        label="Detalle (opcional)"
        errors={errors}
      />

      <div className="grid grid-cols-2 gap-3">
        {unitMode === "torre" ? (
          <ControlledSelect
            control={control}
            name="torre"
            label="Torre"
            placeholder="—"
            options={torreOptions}
          />
        ) : (
          <ControlledSelect
            control={control}
            name="unit_id"
            label="Villa/Casita"
            placeholder="—"
            options={unitOptions}
          />
        )}
        <ControlledSelect
          control={control}
          name="piso"
          label="Piso"
          placeholder="—"
          options={PISO_OPTIONS}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {unitMode === "torre" ? (
          <ControlledSelect
            control={control}
            name="depto"
            label="Depto"
            placeholder="—"
            options={deptoOptions}
          />
        ) : (
          <ControlledInput
            control={control}
            name="depto"
            label="Depto"
            errors={errors}
          />
        )}
        <ControlledSelect
          control={control}
          name="unidad"
          label="Unidad"
          placeholder="Unidad de medida"
          options={uomOptions}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <ControlledSelect
          control={control}
          name="supplier_id"
          label="Proveedor"
          placeholder="Selecciona proveedor"
          options={supplierOptions}
        />
        {supplierId === CREAR ? (
          <Controller
            name="supplier_nombre"
            control={control}
            render={({ field }) => (
              <Input placeholder="Nombre del proveedor nuevo" {...field} />
            )}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ControlledInput
          control={control}
          name="cantidad"
          label="Cantidad"
          errors={errors}
          type="number"
          min="0"
          step="0.001"
        />
        <ControlledSelect
          control={control}
          name="moneda"
          label="Moneda"
          placeholder="MXN"
          options={currencyOptions}
        />
        <ControlledInput
          control={control}
          name="unitario"
          label="$ Unitario"
          errors={errors}
          type="number"
          min="0"
          step="0.01"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ControlledInput
          control={control}
          name="sobrecosto_pct"
          label="Sobrecosto %"
          errors={errors}
          type="number"
          min="0"
          step="0.01"
        />
        <ControlledInput
          control={control}
          name="iva_pct"
          label="IVA %"
          errors={errors}
          type="number"
          min="0"
          step="1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ControlledSelect
          control={control}
          name="madurez"
          label="Madurez"
          placeholder="Ppto"
          options={[
            { value: "ppto", label: "Ppto" },
            { value: "parametrico", label: "Paramétrico" },
          ]}
        />
        <ControlledSelect
          control={control}
          name="contratado"
          label="Contratación"
          placeholder="No contratado"
          options={[
            { value: "no_contratado", label: "No contratado" },
            { value: "contratado", label: "Contratado" },
          ]}
        />
      </div>

      <ControlledInput
        control={control}
        name="quote_date"
        label="Fecha de la cotización"
        errors={errors}
        type="date"
      />

      <Controller
        name="notas"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lf-notas">
              Notas (proveedor, folio, referencia)
            </Label>
            <Textarea id="lf-notas" rows={2} {...field} />
          </div>
        )}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lf-pdf">PDF de la cotización (opcional)</Label>
        <input
          id="lf-pdf"
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          className="block text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-accent"
        />
        {pdfError ? (
          <p className="text-xs text-destructive">{pdfError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {hasPdf
              ? "Ya tiene PDF. Adjunta uno nuevo para reemplazarlo. Máx. 50 MB."
              : "PDF, máx. 50 MB. Se sube directo a Storage."}
          </p>
        )}
      </div>

      {/* Cálculos en vivo (no se teclean — espejan las fórmulas del Excel). */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-nauka-card-border bg-nauka-bg p-3 text-sm tabular-nums">
        <Calc
          label={`Importe sin IVA (${moneda})`}
          value={numberFmt.format(calc.importeSinIva)}
        />
        <Calc label={`$ IVA (${moneda})`} value={numberFmt.format(calc.iva)} />
        <Calc
          label={`Importe total (${moneda})`}
          value={numberFmt.format(calc.importeTotal)}
        />
        <Calc
          label={`Total MXN (TC ${tc})`}
          value={formatMXN(calc.totalMxn)}
          strong
        />
      </div>
    </div>
  )
}

function Calc({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={strong ? "font-semibold text-nauka-dark" : "text-nauka-dark"}
      >
        {value}
      </span>
    </div>
  )
}
