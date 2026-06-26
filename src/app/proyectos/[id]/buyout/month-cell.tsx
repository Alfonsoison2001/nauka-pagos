"use client"

import { Check, Pencil, X } from "lucide-react"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMXN } from "@/lib/utils"
import { setMonthSnapshot } from "./actions"

type Props = {
  projectId: string
  /** id del cierre (buyout_month_close) de la columna. */
  monthCloseId: string
  partidaCatalogId: string
  monto: number
  /** Mes legible para accesibilidad/tooltip, p. ej. "Junio 2026". */
  mesLabel: string
  admin: boolean
}

/**
 * Celda editable de un mes CERRADO (por partida) en el modo Evolución. Igual que
 * `BaseCell`, pero al guardar escribe el snapshot del mes (Server Action
 * `setMonthSnapshot`): sobrescribe el valor congelado de esa partida en ese mes,
 * sin tocar el rollup vivo ni otros meses. Sirve para cualquier mes cerrado
 * (incluido uno pasado, p. ej. corregir Junio estando en Julio). No-admin = solo
 * lectura.
 */
export function MonthCell({
  projectId,
  monthCloseId,
  partidaCatalogId,
  monto,
  mesLabel,
  admin,
}: Props) {
  const [value, setValue] = useState(monto)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(monto))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!admin) {
    return <span className="tabular-nums">{formatMXN(value)}</span>
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value))
          setError(null)
          setEditing(true)
        }}
        title={`Editar ${mesLabel}`}
        className="group inline-flex items-center gap-1.5 tabular-nums transition-colors hover:text-nauka-accent"
      >
        {formatMXN(value)}
        <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
      </button>
    )
  }

  function save() {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Monto inválido")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await setMonthSnapshot(
        projectId,
        monthCloseId,
        partidaCatalogId,
        parsed,
      )
      if ("error" in result) {
        setError(result.error)
        return
      }
      setValue(parsed)
      setEditing(false)
    })
  }

  return (
    <span className="inline-flex items-center justify-end gap-1">
      <Input
        type="number"
        min={0}
        step="0.01"
        value={draft}
        autoFocus
        disabled={pending}
        aria-label={`Valor de ${mesLabel}`}
        aria-invalid={error ? true : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save()
          if (e.key === "Escape") setEditing(false)
        }}
        className="h-7 w-28 px-2 text-right text-sm tabular-nums"
      />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={save}
        disabled={pending}
        aria-label="Guardar"
        title={error ?? "Guardar"}
      >
        <Check className="size-4 text-nauka-success" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={() => setEditing(false)}
        disabled={pending}
        aria-label="Cancelar"
      >
        <X className="size-4" />
      </Button>
    </span>
  )
}
