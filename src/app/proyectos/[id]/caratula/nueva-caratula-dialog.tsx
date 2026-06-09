"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { createEstimacion } from "../flujo-de-pagos/actions"
import { generarCaratula } from "./actions"

type Option = { id: string; nombre: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  contratistaNombre: string
  /** Partidas del contratista (ya filtradas). */
  partidas: Option[]
  pagadores: Option[]
  onCreated: () => void
}

/**
 * Mini-modal de alta: crea la estimación (status 'pendiente') y genera la
 * carátula automáticamente. Reusa createEstimacion (que devuelve el id).
 */
export function NuevaCaratulaDialog({
  open,
  onOpenChange,
  projectId,
  contratistaNombre,
  partidas,
  pagadores,
  onCreated,
}: Props) {
  const [partidaId, setPartidaId] = useState("")
  const [numero, setNumero] = useState("")
  const [monto, setMonto] = useState("")
  const [agregarIva, setAgregarIva] = useState(true)
  const [fecha, setFecha] = useState("")
  const [pagadorId, setPagadorId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, startSubmit] = useTransition()

  function reset() {
    setPartidaId("")
    setNumero("")
    setMonto("")
    setAgregarIva(true)
    setFecha("")
    setPagadorId("")
    setError(null)
  }

  function close(o: boolean) {
    if (!o) reset()
    onOpenChange(o)
  }

  function handleSubmit() {
    setError(null)
    if (!partidaId || !pagadorId || !numero.trim() || !monto || !fecha) {
      setError("Completa partida, #, monto, fecha y pagador.")
      return
    }
    startSubmit(async () => {
      const fd = new FormData()
      fd.set("partida_id", partidaId)
      fd.set("pagador_id", pagadorId)
      fd.set("numero", numero.trim())
      fd.set("fecha_estimacion", fecha)
      fd.set("monto_sin_iva", monto)
      fd.set("iva_pct", agregarIva ? "0.16" : "0")
      fd.set("status", "pendiente")
      const created = await createEstimacion(projectId, fd)
      if ("error" in created) {
        setError(created.error)
        return
      }
      // Genera la carátula automáticamente (no bloqueante si falla).
      await generarCaratula(created.estimacionId, projectId)
      reset()
      onOpenChange(false)
      onCreated()
    })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva carátula · {contratistaNombre}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nc-partida">Partida</Label>
            <Select
              value={partidaId}
              onValueChange={(v) => setPartidaId(v ?? "")}
              items={partidas.map((p) => ({ value: p.id, label: p.nombre }))}
            >
              <SelectTrigger id="nc-partida" className="w-full">
                <SelectValue placeholder="Selecciona la partida" />
              </SelectTrigger>
              <SelectContent>
                {partidas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nc-numero"># Estimación</Label>
              <Input
                id="nc-numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Anticipo, Est 1…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nc-fecha">Fecha</Label>
              <Input
                id="nc-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nc-monto">Monto sin IVA</Label>
            <Input
              id="nc-monto"
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={agregarIva}
                onChange={(e) => setAgregarIva(e.target.checked)}
              />
              Agregar IVA 16%
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nc-pagador">Pagador</Label>
            <Select
              value={pagadorId}
              onValueChange={(v) => setPagadorId(v ?? "")}
              items={pagadores.map((p) => ({ value: p.id, label: p.nombre }))}
            >
              <SelectTrigger id="nc-pagador" className="w-full">
                <SelectValue placeholder="Quién paga" />
              </SelectTrigger>
              <SelectContent>
                {pagadores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => close(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creando..." : "Crear y generar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
