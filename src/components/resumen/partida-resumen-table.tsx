"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { Fragment, useMemo, useState } from "react"
import { formatDate, formatMXN, formatPct } from "@/lib/format"
import type { EstatusEstimacion, PartidaResumen } from "@/lib/resumen/compute"
import { cn } from "@/lib/utils"
import type { MiniRow } from "./estimacion-mini-list"

const STATUS_STYLE: Record<EstatusEstimacion, { label: string; cls: string }> =
  {
    pendiente: {
      label: "Pendiente",
      cls: "border-border text-muted-foreground",
    },
    enviada: {
      label: "Enviada",
      cls: "border-transparent bg-sky-500 text-white",
    },
    pagada: {
      label: "Pagada",
      cls: "border-transparent bg-green-600 text-white",
    },
  }

function StatusChip({ status }: { status: EstatusEstimacion }) {
  const s = STATUS_STYLE[status]
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[11px] font-medium",
        s.cls,
      )}
    >
      {s.label}
    </span>
  )
}

type Props = {
  projectId: string
  porPartida: PartidaResumen[]
  estimaciones: MiniRow[]
  totalPresupuesto: number
  totalEjercido: number
  totalDisponible: number
  pctAvance: number
}

export function PartidaResumenTable({
  projectId,
  porPartida,
  estimaciones,
  totalPresupuesto,
  totalEjercido,
  totalDisponible,
  pctAvance,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const byPartida = useMemo(() => {
    const m = new Map<string, MiniRow[]>()
    for (const e of estimaciones) {
      const arr = m.get(e.partidaId)
      if (arr) arr.push(e)
      else m.set(e.partidaId, [e])
    }
    return m
  }, [estimaciones])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-nauka-card-border bg-nauka-card shadow-nauka-card">
      <table className="min-w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-nauka-card-border text-xs uppercase tracking-wider text-slate-500">
            <th className="px-3 py-3 text-left font-medium">Contratista</th>
            <th className="px-3 py-2.5 text-left">Partida</th>
            <th className="px-3 py-2.5 text-right">Presupuesto</th>
            <th className="px-3 py-2.5 text-right">Ejercido</th>
            <th className="px-3 py-2.5 text-left">% Avance</th>
            <th className="px-3 py-2.5 text-right">Disponible</th>
          </tr>
        </thead>
        <tbody>
          {porPartida.map((p) => {
            const isOpen = expanded.has(p.partidaId)
            const ests = byPartida.get(p.partidaId) ?? []
            return (
              <Fragment key={p.partidaId}>
                <tr
                  onClick={() => toggle(p.partidaId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      toggle(p.partidaId)
                    }
                  }}
                  tabIndex={0}
                  aria-expanded={isOpen}
                  className={cn(
                    "cursor-pointer border-b last:border-0 hover:bg-muted/30",
                    p.sobreEjercido && "bg-red-50 hover:bg-red-100/70",
                  )}
                >
                  <td className="px-3 py-2 font-medium">
                    <span className="flex items-center gap-1.5">
                      <ChevronRight
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-90",
                        )}
                      />
                      {p.contratistaNombre}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {p.partidaNombre}
                    {p.sobreEjercido && (
                      <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Sobre-ejercido
                      </span>
                    )}
                    <Link
                      href={`/proyectos/${projectId}/flujo-de-pagos?partida_id=${p.partidaId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="ml-2 text-xs text-primary underline-offset-2 hover:underline"
                    >
                      Ver todo →
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatMXN(p.presupuesto)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatMXN(p.ejercido)}
                  </td>
                  <td className="px-3 py-2">
                    <AvanceCell pct={p.pctAvance} over={p.sobreEjercido} />
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right",
                      p.disponible < 0 && "font-medium text-red-600",
                    )}
                  >
                    {formatMXN(p.disponible)}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-muted/20">
                    <td colSpan={6} className="px-3 py-2">
                      <SubEstimaciones
                        projectId={projectId}
                        partidaId={p.partidaId}
                        rows={ests}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-muted/30 font-semibold">
            <td className="px-3 py-2.5" colSpan={2}>
              TOTAL
            </td>
            <td className="px-3 py-2.5 text-right">
              {formatMXN(totalPresupuesto)}
            </td>
            <td className="px-3 py-2.5 text-right">
              {formatMXN(totalEjercido)}
            </td>
            <td className="px-3 py-2.5">{formatPct(pctAvance)}</td>
            <td className="px-3 py-2.5 text-right">
              {formatMXN(totalDisponible)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** Sub-tabla compacta de estimaciones de una partida (al expandir la fila). */
function SubEstimaciones({
  projectId,
  partidaId,
  rows,
}: {
  projectId: string
  partidaId: string
  rows: MiniRow[]
}) {
  if (rows.length === 0) {
    return (
      <p className="px-1 py-1 text-xs italic text-muted-foreground">
        Sin estimaciones en esta partida.
      </p>
    )
  }
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      {rows.map((r) => (
        <Link
          key={r.id}
          href={`/proyectos/${projectId}/flujo-de-pagos?partida_id=${partidaId}`}
          className="flex items-center justify-between gap-3 border-b px-3 py-1.5 text-sm last:border-0 hover:bg-muted/40"
        >
          <span className="flex items-center gap-2">
            <StatusChip status={r.status} />
            <span className="font-medium">{r.numero}</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(r.fechaEstimacion)}
            </span>
          </span>
          <span className="tabular-nums">{formatMXN(r.monto)}</span>
        </Link>
      ))}
    </div>
  )
}

/** Barra de avance + porcentaje dentro de una celda de la tabla. */
function AvanceCell({ pct, over }: { pct: number; over: boolean }) {
  const width = Math.min(100, Math.max(0, pct * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            over ? "bg-red-600" : "bg-green-600",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-12 text-xs text-muted-foreground">
        {formatPct(pct)}
      </span>
    </div>
  )
}
