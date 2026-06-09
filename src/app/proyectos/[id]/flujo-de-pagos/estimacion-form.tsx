"use client"

import type { Control, FieldErrors, UseFormSetValue } from "react-hook-form"
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
import { cn, formatMXN } from "@/lib/utils"
import type { ContratistaOption, PagadorOption, PartidaOption } from "./actions"

// ── Schema ────────────────────────────────────────────────────────────────────

export const formSchema = z.object({
  // client-only: drives partida dropdown, not sent to server
  contratista_id: z.string(),
  partida_id: z.string().uuid("Partida inválida"),
  pagador_id: z.string().uuid("Pagador requerido"),
  numero: z.string().trim().min(1, "# Estimación requerido"),
  concepto: z.string().trim().optional(),
  fecha_estimacion: z.string().min(1, "Fecha requerida"),
  monto_sin_iva: z
    .string()
    .min(1, "Monto requerido")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "Debe ser ≥ 0"),
  agregar_iva: z.boolean(),
  // Status manual: las 3 opciones se eligen directamente.
  status: z.enum(["pendiente", "enviada", "pagada"]),
  notas: z.string().trim().optional(),
})

export type FormValues = z.infer<typeof formSchema>

// ── MontoRegistrado (live label) ──────────────────────────────────────────────

function MontoRegistrado({ control }: { control: Control<FormValues> }) {
  const monto = useWatch({ control, name: "monto_sin_iva" })
  const agregarIva = useWatch({ control, name: "agregar_iva" })
  const factor = agregarIva ? 1.16 : 1
  const total = Number(monto || 0) * factor
  return (
    <p className="text-xs text-muted-foreground">
      Monto registrado:{" "}
      <span className="font-medium tabular-nums">{formatMXN(total)}</span>
    </p>
  )
}

// ── DerivedInfo ───────────────────────────────────────────────────────────────

type DerivedInfoProps = {
  control: Control<FormValues>
  partidas: PartidaOption[]
  pagadoAcumByPartida: Record<string, number>
}

export function DerivedInfo({
  control,
  partidas,
  pagadoAcumByPartida,
}: DerivedInfoProps) {
  const partidaId = useWatch({ control, name: "partida_id" })

  const partida = partidas.find((p) => p.id === partidaId)
  if (!partida) return null

  const pagadoAcum = pagadoAcumByPartida[partidaId] ?? 0
  const disponible = partida.presupuesto_con_iva - pagadoAcum

  return (
    <div className="rounded-md bg-muted p-3 text-sm">
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Presupuesto contrato</span>
        <span className="tabular-nums">
          {formatMXN(partida.presupuesto_con_iva)}
        </span>
      </div>
      <div className="mt-1 flex justify-between gap-4">
        <span className="text-muted-foreground">Pagado acum.</span>
        <span className="tabular-nums">{formatMXN(pagadoAcum)}</span>
      </div>
      <div className="mt-1 flex justify-between gap-4 font-medium">
        <span>Disponible</span>
        <span
          className={cn(
            "tabular-nums",
            disponible < 0 ? "text-destructive" : "",
          )}
        >
          {formatMXN(disponible)}
        </span>
      </div>
    </div>
  )
}

// ── EstimacionFormFields ──────────────────────────────────────────────────────

type Props = {
  control: Control<FormValues>
  errors: FieldErrors<FormValues>
  setValue: UseFormSetValue<FormValues>
  contratistas: ContratistaOption[]
  partidas: PartidaOption[]
  pagadores: PagadorOption[]
  pagadoAcumByPartida: Record<string, number>
  mode: "new" | "edit"
  /** Edit mode only: display-only name instead of a disabled Select */
  contratistaName?: string
  partidaName?: string
}

export function EstimacionFormFields({
  control,
  errors,
  setValue,
  contratistas,
  partidas,
  pagadores,
  pagadoAcumByPartida,
  mode,
  contratistaName,
  partidaName,
}: Props) {
  const contratistaId = useWatch({ control, name: "contratista_id" })
  const filteredPartidas = contratistaId
    ? partidas.filter((p) => p.contratista_id === contratistaId)
    : partidas

  return (
    <div className="flex flex-col gap-4">
      {/* Contratista */}
      {mode === "edit" ? (
        <div className="flex flex-col gap-2">
          <Label>Contratista</Label>
          <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
            {contratistaName ?? "—"}
          </p>
        </div>
      ) : (
        <Controller
          name="contratista_id"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ef-contratista">Contratista</Label>
              <Select
                value={field.value ?? ""}
                onValueChange={(v) => {
                  field.onChange(v)
                  setValue("partida_id", "")
                }}
                items={contratistas.map((c) => ({
                  value: c.id,
                  label: c.nombre,
                }))}
              >
                <SelectTrigger id="ef-contratista" className="w-full">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {contratistas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contratista_id && (
                <p className="text-xs text-destructive">
                  {errors.contratista_id.message}
                </p>
              )}
            </div>
          )}
        />
      )}

      {/* Partida */}
      {mode === "edit" ? (
        <div className="flex flex-col gap-2">
          <Label>Partida</Label>
          <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
            {partidaName ?? "—"}
          </p>
        </div>
      ) : (
        <Controller
          name="partida_id"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ef-partida">Partida</Label>
              <Select
                value={field.value ?? ""}
                onValueChange={field.onChange}
                items={filteredPartidas.map((p) => ({
                  value: p.id,
                  label: p.nombre,
                }))}
              >
                <SelectTrigger id="ef-partida" className="w-full">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPartidas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.partida_id && (
                <p className="text-xs text-destructive">
                  {errors.partida_id.message}
                </p>
              )}
            </div>
          )}
        />
      )}

      {/* Pagador */}
      <Controller
        name="pagador_id"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="ef-pagador">Pagó</Label>
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              items={pagadores.map((p) => ({ value: p.id, label: p.nombre }))}
            >
              <SelectTrigger id="ef-pagador" className="w-full">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {pagadores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.pagador_id && (
              <p className="text-xs text-destructive">
                {errors.pagador_id.message}
              </p>
            )}
          </div>
        )}
      />

      {/* # Estimación + Status */}
      <div className="grid grid-cols-2 gap-4">
        <Controller
          name="numero"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ef-numero"># Estimación</Label>
              <Input id="ef-numero" {...field} />
              {errors.numero && (
                <p className="text-xs text-destructive">
                  {errors.numero.message}
                </p>
              )}
            </div>
          )}
        />
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ef-status">Estatus</Label>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={[
                  { value: "pendiente", label: "Pendiente" },
                  { value: "enviada", label: "Enviada" },
                  { value: "pagada", label: "Pagada" },
                ]}
              >
                <SelectTrigger id="ef-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="enviada">Enviada</SelectItem>
                  <SelectItem value="pagada">Pagada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        />
      </div>

      {/* Concepto */}
      <Controller
        name="concepto"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="ef-concepto">Concepto (opcional)</Label>
            <Input id="ef-concepto" {...field} />
          </div>
        )}
      />

      {/* Fecha estimación + Monto */}
      <div className="grid grid-cols-2 gap-4">
        <Controller
          name="fecha_estimacion"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ef-fecha">Fecha estimación</Label>
              <Input id="ef-fecha" type="date" {...field} />
              {errors.fecha_estimacion && (
                <p className="text-xs text-destructive">
                  {errors.fecha_estimacion.message}
                </p>
              )}
            </div>
          )}
        />

        {/* Monto + checkbox IVA + live label */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="ef-monto">Monto</Label>
          <Controller
            name="monto_sin_iva"
            control={control}
            render={({ field }) => (
              <Input
                id="ef-monto"
                type="number"
                min="0"
                step="0.01"
                {...field}
              />
            )}
          />
          {errors.monto_sin_iva && (
            <p className="text-xs text-destructive">
              {errors.monto_sin_iva.message}
            </p>
          )}
          <Controller
            name="agregar_iva"
            control={control}
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                Agregar IVA 16%
              </label>
            )}
          />
          <MontoRegistrado control={control} />
        </div>
      </div>

      {/* Notas */}
      <Controller
        name="notas"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="ef-notas">Notas (opcional)</Label>
            <Textarea id="ef-notas" rows={2} {...field} />
          </div>
        )}
      />

      {/* Info derivada */}
      <DerivedInfo
        control={control}
        partidas={partidas}
        pagadoAcumByPartida={pagadoAcumByPartida}
      />
    </div>
  )
}
