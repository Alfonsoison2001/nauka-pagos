"use client"

import { useTransition } from "react"
import { cn } from "@/lib/utils"
import { setLineaContratado } from "./actions"

// Mismo look que el pill de `EstadoBadge` (page.tsx), pero clicable: alterna
// Contratado/No contratado de ESA línea (admin-only; RLS refuerza en el server).
const PILL =
  "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition"

export function ContratadoToggle({
  lineId,
  projectId,
  contratado,
  concepto,
}: {
  lineId: string
  projectId: string
  contratado: boolean
  concepto: string
}) {
  const [pending, startTransition] = useTransition()
  const next = contratado ? "No contratado" : "Contratado"

  function toggle() {
    startTransition(async () => {
      const result = await setLineaContratado(lineId, projectId, !contratado)
      // Admin-only + RLS → error improbable; si ocurre, no rompemos la fila.
      if ("error" in result) console.error(result.error)
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={`${concepto}: marcar ${next}`}
      title={`Clic para marcar “${next}”`}
      className={cn(
        PILL,
        "cursor-pointer hover:ring-2 hover:ring-offset-1 disabled:opacity-50",
        contratado
          ? "bg-green-100 text-green-700 hover:ring-green-300"
          : "bg-slate-100 text-slate-600 hover:ring-slate-300",
      )}
    >
      {pending ? "…" : contratado ? "Contratado" : "No contratado"}
    </button>
  )
}
