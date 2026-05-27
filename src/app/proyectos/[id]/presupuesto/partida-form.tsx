"use client"

import type { RefObject } from "react"
import type { Control, FieldErrors } from "react-hook-form"
import { Controller } from "react-hook-form"
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
import type { ContratistaOption } from "./actions"

// ---------------------------------------------------------------------------
// Schema + types (exported so PartidaDialog can import them)
// ---------------------------------------------------------------------------

export const formSchema = z.object({
  contratista_id: z.string().optional(),
  contratista_nombre: z.string().trim().optional(),
  nombre: z.string().trim().min(1, "Nombre de partida requerido"),
  presupuesto_sin_iva: z
    .string()
    .min(1, "Monto requerido")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "Debe ser ≥ 0"),
  iva_pct: z
    .string()
    .min(1, "IVA requerido")
    .refine(
      (v) => !Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100,
      "IVA entre 0 y 100",
    ),
  notas: z.string().optional(),
  fecha_firma: z.string().optional(),
})

export type FormValues = z.infer<typeof formSchema>

// ---------------------------------------------------------------------------
// PartidaFormFields component
// ---------------------------------------------------------------------------

type Props = {
  control: Control<FormValues>
  errors: FieldErrors<FormValues>
  mode: "new" | "edit"
  /** Only required for mode=new */
  contratistas?: ContratistaOption[]
  contratistaId?: string
  /** Displayed as read-only in edit mode */
  contratistaName?: string
  pdfInputRef: RefObject<HTMLInputElement | null>
  hasPdf?: boolean
}

export function PartidaFormFields({
  control,
  errors,
  mode,
  contratistas = [],
  contratistaId,
  contratistaName,
  pdfInputRef,
  hasPdf,
}: Props) {
  const isCreatingNew = contratistaId === "crear_nuevo"

  return (
    <div className="flex flex-col gap-4">
      {mode === "new" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="pf-contratista">Contratista</Label>
          <Controller
            name="contratista_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger id="pf-contratista" className="w-full">
                  <SelectValue placeholder="Selecciona un contratista" />
                </SelectTrigger>
                <SelectContent>
                  {contratistas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                  <SelectItem value="crear_nuevo">+ Crear nuevo</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.contratista_id ? (
            <p className="text-xs text-destructive">
              {errors.contratista_id.message}
            </p>
          ) : null}
          {isCreatingNew && (
            <Controller
              name="contratista_nombre"
              control={control}
              render={({ field }) => (
                <>
                  <Input placeholder="Nombre del contratista" {...field} />
                  {errors.contratista_nombre ? (
                    <p className="text-xs text-destructive">
                      {errors.contratista_nombre.message}
                    </p>
                  ) : null}
                </>
              )}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Contratista</p>
          <p className="text-sm font-medium">{contratistaName}</p>
        </div>
      )}

      <Controller
        name="nombre"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="pf-nombre">Nombre de partida</Label>
            <Input id="pf-nombre" {...field} />
            {errors.nombre ? (
              <p className="text-xs text-destructive">
                {errors.nombre.message}
              </p>
            ) : null}
          </div>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <Controller
          name="presupuesto_sin_iva"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pf-monto">Presupuesto sin IVA</Label>
              <Input
                id="pf-monto"
                type="number"
                min="0"
                step="0.01"
                {...field}
              />
              {errors.presupuesto_sin_iva ? (
                <p className="text-xs text-destructive">
                  {errors.presupuesto_sin_iva.message}
                </p>
              ) : null}
            </div>
          )}
        />
        <Controller
          name="iva_pct"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pf-iva">IVA %</Label>
              <Input
                id="pf-iva"
                type="number"
                min="0"
                max="100"
                step="1"
                {...field}
              />
              {errors.iva_pct ? (
                <p className="text-xs text-destructive">
                  {errors.iva_pct.message}
                </p>
              ) : null}
            </div>
          )}
        />
      </div>

      <Controller
        name="fecha_firma"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="pf-fecha">Fecha de firma (opcional)</Label>
            <Input id="pf-fecha" type="date" {...field} />
          </div>
        )}
      />

      <Controller
        name="notas"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="pf-notas">Notas (opcional)</Label>
            <Textarea id="pf-notas" rows={2} {...field} />
          </div>
        )}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="pf-pdf">PDF del presupuesto firmado (opcional)</Label>
        <input
          id="pf-pdf"
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          className="block text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-accent"
        />
        {hasPdf ? (
          <p className="text-xs text-muted-foreground">
            Ya tiene PDF. Adjunta uno nuevo para reemplazarlo.
          </p>
        ) : null}
      </div>
    </div>
  )
}
