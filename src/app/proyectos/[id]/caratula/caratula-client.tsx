"use client"

import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate } from "@/lib/format/fecha"
import { formatMXN } from "@/lib/utils"
import { generarCaratula } from "./actions"
import { EnviarDialog } from "./enviar-dialog"
import type { CaratulaEstimacion, CaratulaFirmanteRow } from "./page"

type Props = {
  projectId: string
  conIva: boolean
  estimaciones: CaratulaEstimacion[]
  firmantes: CaratulaFirmanteRow[]
  defaultEmails: string[]
}

export function CaratulaClient({
  projectId,
  conIva,
  estimaciones,
  firmantes,
  defaultEmails,
}: Props) {
  const [estList, setEstList] = useState(estimaciones)
  const [selectedId, setSelectedId] = useState<string>("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [enviarOpen, setEnviarOpen] = useState(false)
  const [generating, startGen] = useTransition()

  const selected = estList.find((e) => e.id === selectedId)

  function selectEstimacion(id: string) {
    setSelectedId(id)
    setPreviewUrl(null)
    setGenError(null)
  }

  function handleGenerar() {
    if (!selected) return
    setGenError(null)
    startGen(async () => {
      const r = await generarCaratula(selected.id, projectId)
      if ("error" in r) {
        setGenError(r.error)
        return
      }
      setPreviewUrl(r.signedUrl)
      setEstList((list) =>
        list.map((e) =>
          e.id === selected.id ? { ...e, yaGenerada: true } : e,
        ),
      )
    })
  }

  function handleSent(info: { enviadaAt: string; destinatarios: string[] }) {
    if (!selected) return
    setEstList((list) =>
      list.map((e) =>
        e.id === selected.id
          ? {
              ...e,
              enviadaAt: info.enviadaAt,
              destinatariosPrev: info.destinatarios,
            }
          : e,
      ),
    )
  }

  if (estList.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium">Sin estimaciones</p>
        <p className="mt-2">
          Captura estimaciones en la pestaña Flujo de Pagos para generar
          carátulas.
        </p>
      </div>
    )
  }

  const prefillEmails = selected
    ? Array.from(
        new Set(
          [...defaultEmails, selected.contratistaEmail].filter(
            (x): x is string => Boolean(x),
          ),
        ),
      )
    : []

  const canEnviar = Boolean(selected && (selected.yaGenerada || previewUrl))

  return (
    <div className="flex flex-col gap-6">
      {firmantes.length === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Este proyecto no tiene firmantes. La carátula saldrá sin bloque de
          firmas. Agrégalos en Configuración.
        </div>
      )}

      {/* Selector */}
      <div className="flex flex-col gap-2">
        <label htmlFor="caratula-select" className="text-sm font-medium">
          Estimación
        </label>
        <Select
          value={selectedId}
          onValueChange={(v) => selectEstimacion(v ?? "")}
          items={estList.map((e) => ({ value: e.id, label: estLabel(e) }))}
        >
          <SelectTrigger id="caratula-select" className="w-full sm:max-w-md">
            <SelectValue placeholder="Selecciona una estimación" />
          </SelectTrigger>
          <SelectContent>
            {estList.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {estLabel(e)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && (
        <>
          {/* Panel de detalle */}
          <div className="rounded-md border p-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Detail label="Contratista" value={selected.contratistaNombre} />
              <Detail label="Partida" value={selected.partidaNombre} />
              <Detail label="# Estimación" value={selected.numero} />
              <Detail
                label={`Monto (${conIva ? "con IVA" : "sin IVA"})`}
                value={formatMXN(selected.monto)}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Estatus</span>
                <span>
                  <Badge
                    variant={
                      selected.status === "pagada" ? "default" : "outline"
                    }
                  >
                    {selected.status === "pagada" ? "Pagada" : "Pendiente"}
                  </Badge>
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Carátula</span>
                <span>
                  {selected.enviadaAt
                    ? `Enviada ${formatDate(selected.enviadaAt)}`
                    : selected.yaGenerada
                      ? "Generada"
                      : "—"}
                </span>
              </div>
            </div>

            {/* Firmantes que aparecerán */}
            <div className="mt-4 border-t pt-3">
              <p className="mb-1 text-xs text-muted-foreground">
                Firmantes en la carátula
              </p>
              {firmantes.length > 0 ? (
                <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {firmantes.map((f) => (
                    <li key={`${f.nombre}-${f.empresa}`}>
                      {f.nombre}{" "}
                      <span className="text-muted-foreground">
                        · {f.cargo}, {f.empresa}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  Sin firmantes asignados.
                </p>
              )}
            </div>

            {/* Acciones */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
              <Button onClick={handleGenerar} disabled={generating}>
                {generating ? "Generando..." : "Generar carátula"}
              </Button>
              <Button
                variant="outline"
                disabled={!canEnviar}
                onClick={() => setEnviarOpen(true)}
              >
                Enviar por correo
              </Button>
            </div>

            {genError && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {genError}
              </p>
            )}
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Vista previa</p>
              <iframe
                src={previewUrl}
                title="Vista previa de la carátula"
                className="h-[640px] w-full rounded-md border"
              />
            </div>
          )}

          <EnviarDialog
            open={enviarOpen}
            onOpenChange={setEnviarOpen}
            estimacionId={selected.id}
            projectId={projectId}
            prefillEmails={prefillEmails}
            enviadaAt={selected.enviadaAt}
            destinatariosPrev={selected.destinatariosPrev}
            onSent={handleSent}
          />
        </>
      )}
    </div>
  )
}

/** Etiqueta legible para el dropdown: "{numero} — {contratista} — {partida}". */
function estLabel(e: CaratulaEstimacion): string {
  return `${e.numero} — ${e.contratistaNombre} — ${e.partidaNombre}`
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  )
}
