"use client"

import { Check, Pencil, X } from "lucide-react"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMXN0 } from "@/lib/buyout/format"
import { setPartidaBase } from "./actions"

type Props = {
  projectId: string
  partidaCatalogId: string
  monto: number
  admin: boolean
}

/**
 * Celda "Ppto Base" del Resumen. Muestra el presupuesto base de la partida y, si
 * el usuario es admin, permite editarlo en sitio (input → guarda con la Server
 * Action setPartidaBase). Para no-admin es solo lectura.
 */
export function BaseCell({ projectId, partidaCatalogId, monto, admin }: Props) {
  const [value, setValue] = useState(monto)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(monto))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!admin) {
    return <span className="tabular-nums">{formatMXN0(value)}</span>
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
        title="Editar presupuesto base"
        className="group inline-flex items-center gap-1.5 tabular-nums transition-colors hover:text-nauka-accent"
      >
        {formatMXN0(value)}
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
      const result = await setPartidaBase(projectId, partidaCatalogId, parsed)
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
        aria-label="Presupuesto base"
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
