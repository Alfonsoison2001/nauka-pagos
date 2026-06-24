import Link from "next/link"
import { cn, formatMXN } from "@/lib/utils"

export type PartidaCard = {
  id: string
  nombre: string
  total: number
  count: number
}
export type ChapterGroup = { nombre: string; partidas: PartidaCard[] }

/** Vista de tarjetas de todas las partidas, agrupadas por capítulo. Cada tarjeta
 *  muestra nombre · total (Σ total MXN de sus conceptos vigentes) · si tiene datos.
 *  Clic en una tarjeta → entra a esa partida. */
export function PartidaCards({
  projectId,
  groups,
}: {
  projectId: string
  groups: ChapterGroup[]
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.nombre} className="flex flex-col gap-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-nauka-dark">
            {g.nombre}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {g.partidas.map((p) => (
              <Link
                key={p.id}
                href={`/proyectos/${projectId}/buyout/partida?partida=${p.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-nauka-card-border bg-white p-4 shadow-nauka-card transition-colors hover:border-nauka-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-nauka-dark">
                    {p.nombre}
                  </span>
                  <span
                    aria-hidden
                    title={p.count > 0 ? "Con datos" : "Sin datos"}
                    className={cn(
                      "mt-1 inline-block size-2 shrink-0 rounded-full",
                      p.count > 0 ? "bg-nauka-success" : "bg-nauka-neutral/40",
                    )}
                  />
                </div>
                <span className="text-lg font-semibold tabular-nums text-nauka-dark">
                  {formatMXN(p.total)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.count > 0
                    ? `${p.count} concepto${p.count === 1 ? "" : "s"}`
                    : "Sin datos"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
