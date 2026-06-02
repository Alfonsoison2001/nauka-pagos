import Link from "next/link"
import { formatMXN } from "@/lib/format"
import type { EstatusEstimacion, MontoCount } from "@/lib/resumen/compute"
import { cn } from "@/lib/utils"

type Props = {
  projectId: string
  statusBreakdown: Record<EstatusEstimacion, MontoCount>
}

const ITEMS: {
  status: EstatusEstimacion
  label: string
  dot: string
}[] = [
  { status: "pendiente", label: "Pendiente", dot: "bg-muted-foreground" },
  { status: "enviada", label: "Enviada", dot: "bg-sky-500" },
  { status: "pagada", label: "Pagada", dot: "bg-green-600" },
]

/** Chips por estatus (count + monto), cada uno linkea a Flujo filtrado. */
export function StatusBreakdown({ projectId, statusBreakdown }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {ITEMS.map(({ status, label, dot }) => {
        const { count, monto } = statusBreakdown[status]
        return (
          <Link
            key={status}
            href={`/proyectos/${projectId}/flujo-de-pagos?status=${status}`}
            className="flex items-center gap-2 rounded-full border border-nauka-card-border bg-nauka-card px-3 py-1.5 text-sm transition-colors hover:bg-white"
          >
            <span className={cn("size-2 rounded-full", dot)} />
            <span className="font-medium">{label}</span>
            <span className="text-muted-foreground">({count})</span>
            <span className="tabular-nums text-muted-foreground">
              {formatMXN(monto)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
