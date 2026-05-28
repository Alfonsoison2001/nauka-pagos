"use client"

import { format, parseISO } from "date-fns"
import { Badge } from "@/components/ui/badge"
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

/** Last day of the month for a given YYYY-MM-DD date string. */
function getEOM(fechaPago: string | null): string {
  if (!fechaPago) return "—"
  const [y, m] = fechaPago.split("-").map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return `${String(lastDay).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

// ── Table ─────────────────────────────────────────────────────────────────────

type Props = {
  rows: EstimacionRow[]
  projectId: string
  contratistas: ContratistaOption[]
  partidas: PartidaOption[]
  pagadores: PagadorOption[]
  pagadoAcumByPartida: Record<string, number>
}

export function FlujoTable({
  rows,
  projectId,
  contratistas,
  partidas,
  pagadores,
  pagadoAcumByPartida,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
            <th className="px-3 py-2.5 text-right">#</th>
            <th className="px-3 py-2.5 text-right">EOM</th>
            <th className="px-3 py-2.5 text-right">Fecha de pago</th>
            <th className="px-3 py-2.5 text-left">Pagó</th>
            <th className="px-3 py-2.5 text-left">Contratista</th>
            <th className="px-3 py-2.5 text-left">Partida</th>
            <th className="px-3 py-2.5 text-left"># Estimación</th>
            <th className="px-3 py-2.5 text-right">Monto</th>
            <th className="px-3 py-2.5 text-right">Presupuesto</th>
            <th className="px-3 py-2.5 text-right">Pagado Acum.</th>
            <th className="px-3 py-2.5 text-right">Resto por Pagar</th>
            <th className="px-3 py-2.5 text-center">Estatus</th>
            <th className="px-3 py-2.5 text-left">Comprobante</th>
            <th className="px-3 py-2.5 text-left">Notas</th>
            <th className="sticky right-0 z-10 bg-muted/50 px-3 py-2.5" />
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
}

function FlujoRow({
  row,
  index,
  projectId,
  contratistas,
  partidas,
  pagadores,
  pagadoAcumByPartida,
}: RowProps) {
  return (
    <tr className="group border-b last:border-0 hover:bg-muted/30">
      <td className="px-3 py-2 text-right text-muted-foreground">{index}</td>
      <td className="px-3 py-2 text-right text-muted-foreground">
        {getEOM(row.fecha_pago)}
      </td>
      <td className="px-3 py-2 text-right">{formatDate(row.fecha_pago)}</td>
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
        <Badge variant={row.status === "pagada" ? "default" : "outline"}>
          {row.status === "pagada" ? "Pagada" : "Pendiente"}
        </Badge>
      </td>
      <td className="px-3 py-2">
        <ComprobanteCell estimacion={row} projectId={projectId} />
      </td>
      <td className="max-w-[160px] truncate px-3 py-2 text-muted-foreground">
        {row.notas ?? "—"}
      </td>
      <td className="sticky right-0 z-10 bg-background px-3 py-2 group-hover:bg-muted/30">
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
