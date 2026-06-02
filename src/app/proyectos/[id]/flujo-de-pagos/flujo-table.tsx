"use client"

import { format, parseISO } from "date-fns"
import {
  ApprovalChip,
  type ApprovalSummary,
} from "@/components/approvals/approval-chip"
import { EstatusBadge } from "@/components/estatus-badge"
import { formatMXN } from "@/lib/utils"
import type {
  ContratistaOption,
  EstimacionRow,
  PagadorOption,
  PartidaOption,
} from "./actions"
import { ComprobanteCell } from "./comprobante-cell"
import { DeleteEstimacionButton } from "./delete-estimacion-button"
import { EditEstimacionButton } from "./edit-estimacion-button"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "dd/MM/yyyy")
  } catch {
    return iso
  }
}

// ── Table ─────────────────────────────────────────────────────────────────────

type Props = {
  rows: EstimacionRow[]
  projectId: string
  contratistas: ContratistaOption[]
  partidas: PartidaOption[]
  pagadores: PagadorOption[]
  pagadoAcumByPartida: Record<string, number>
  aprobacionByEst: Record<string, ApprovalSummary>
}

export function FlujoTable({
  rows,
  projectId,
  contratistas,
  partidas,
  pagadores,
  pagadoAcumByPartida,
  aprobacionByEst,
}: Props) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      <table className="min-w-full text-sm tabular-nums">
        <thead className="sticky top-0 z-20">
          <tr className="bg-nauka-dark text-xs uppercase tracking-wider text-white/70">
            <th className="px-3 py-2.5 text-right">#</th>
            <th className="px-3 py-2.5 text-right">Fecha estimación</th>
            <th className="px-3 py-2.5 text-left">Pagó</th>
            <th className="px-3 py-2.5 text-left">Contratista</th>
            <th className="px-3 py-2.5 text-left">Partida</th>
            <th className="px-3 py-2.5 text-left"># Estimación</th>
            <th className="px-3 py-2.5 text-right">Monto</th>
            <th className="px-3 py-2.5 text-right">Presupuesto</th>
            <th className="px-3 py-2.5 text-right">Pagado Acum.</th>
            <th className="px-3 py-2.5 text-right">Resto por Pagar</th>
            <th className="px-3 py-2.5 text-center">Estatus</th>
            <th className="min-w-[150px] px-3 py-2.5 text-center">
              Aprobación
            </th>
            <th className="px-3 py-2.5 text-left">Comprobante</th>
            <th className="px-3 py-2.5 text-left">Notas</th>
            <th className="sticky right-0 z-30 bg-nauka-dark px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <FlujoRow
              key={row.id}
              row={row}
              index={i + 1}
              projectId={projectId}
              contratistas={contratistas}
              partidas={partidas}
              pagadores={pagadores}
              pagadoAcumByPartida={pagadoAcumByPartida}
              aprobacion={aprobacionByEst[row.id]}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

type RowProps = {
  row: EstimacionRow
  index: number
  projectId: string
  contratistas: ContratistaOption[]
  partidas: PartidaOption[]
  pagadores: PagadorOption[]
  pagadoAcumByPartida: Record<string, number>
  aprobacion: ApprovalSummary | undefined
}

function FlujoRow({
  row,
  index,
  projectId,
  contratistas,
  partidas,
  pagadores,
  pagadoAcumByPartida,
  aprobacion,
}: RowProps) {
  const aprobSummary: ApprovalSummary = aprobacion ?? {
    status: null,
    aprobadas: 0,
    total: 0,
    tooltip: "",
  }
  return (
    <tr className="group border-b border-nauka-subtle last:border-0 hover:bg-nauka-bg">
      <td className="px-3 py-2 text-right text-muted-foreground">{index}</td>
      <td className="px-3 py-2 text-right">
        {formatDate(row.fecha_estimacion)}
      </td>
      <td className="px-3 py-2">{row.pagador_nombre ?? "—"}</td>
      <td className="px-3 py-2 font-medium">{row.contratista_nombre}</td>
      <td className="px-3 py-2">{row.partida_nombre}</td>
      <td className="px-3 py-2">{row.numero}</td>
      <td className="px-3 py-2 text-right font-medium">
        {formatMXN(row.monto_con_iva)}
      </td>
      <td className="px-3 py-2 text-right">
        {formatMXN(row.partida_presupuesto_con_iva)}
      </td>
      <td className="px-3 py-2 text-right">{formatMXN(row.pagado_acum)}</td>
      <td className="px-3 py-2 text-right">{formatMXN(row.resto_por_pagar)}</td>
      <td className="px-3 py-2 text-center">
        <EstatusBadge status={row.status} />
      </td>
      <td className="min-w-[150px] px-3 py-2 text-center">
        <ApprovalChip summary={aprobSummary} href="/aprobaciones" />
      </td>
      <td className="px-3 py-2">
        <ComprobanteCell estimacion={row} projectId={projectId} />
      </td>
      <td className="max-w-[160px] truncate px-3 py-2 text-muted-foreground">
        {row.notas ?? "—"}
      </td>
      <td className="sticky right-0 z-10 bg-white px-3 py-2 group-hover:bg-nauka-bg">
        <div className="flex items-center gap-0.5">
          <EditEstimacionButton
            estimacion={row}
            projectId={projectId}
            contratistas={contratistas}
            partidas={partidas}
            pagadores={pagadores}
            pagadoAcumByPartida={pagadoAcumByPartida}
          />
          <DeleteEstimacionButton estimacion={row} projectId={projectId} />
        </div>
      </td>
    </tr>
  )
}
