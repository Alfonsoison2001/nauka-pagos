import Link from "next/link"
import { EstatusBadge } from "@/components/estatus-badge"
import { formatDate, formatMXN } from "@/lib/format"
import type { EstatusEstimacion } from "@/lib/resumen/compute"

export type MiniRow = {
  id: string
  partidaId: string
  numero: string
  contratistaNombre: string
  partidaNombre: string
  status: EstatusEstimacion
  fechaEstimacion: string
  monto: number
}

type Props = {
  projectId: string
  rows: MiniRow[]
  emptyMessage: string
}

/** Lista compacta de estimaciones (por pagar / actividad reciente). */
export function EstimacionMiniList({ projectId, rows, emptyMessage }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul className="divide-y divide-nauka-card-border rounded-2xl border border-nauka-card-border bg-nauka-card shadow-nauka-card">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between gap-3 px-3 py-2.5"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <EstatusBadge status={r.status} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {r.numero}{" "}
                <span className="font-normal text-muted-foreground">
                  · {r.contratistaNombre}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {r.partidaNombre}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="hidden text-xs text-muted-foreground sm:inline tabular-nums">
              {formatDate(r.fechaEstimacion)}
            </span>
            <span className="text-sm font-medium tabular-nums">
              {formatMXN(r.monto)}
            </span>
            <Link
              href={`/proyectos/${projectId}/flujo-de-pagos?partida_id=${r.partidaId}`}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Ver →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}
