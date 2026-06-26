import { Calendar, Coins, Tag, Target, TrendingUp } from "lucide-react"
import { Fragment } from "react"
import { formatMXN0 } from "@/lib/buyout/format"
import { cn } from "@/lib/utils"
import { BaseCell } from "./base-cell"
import { DifBadge } from "./dif-text"
import { MonthCell } from "./month-cell"
import { ReabrirMesButton } from "./reabrir-mes-button"
import { HEAD_ROW, Th } from "./table-ui"

/** Partida en la rejilla de Evolución (total = vigente del mes en curso, vivo). */
export type EvoPartida = {
  id: string
  nombre: string
  base: number
  total: number
  dif: number | null
}
/** Capítulo con sus partidas + subtotales (base/total/dif del mes en curso). */
export type EvoChapter = {
  nombre: string
  partidas: EvoPartida[]
  base: number
  total: number
  dif: number | null
}
/** Un mes cerrado = una columna congelada. */
export type EvoMonth = {
  id: string
  periodo: string
  /** "Ppto Junio 2026" (cabecera de la columna). */
  label: string
  /** "Junio 2026" (para el botón Reabrir). */
  short: string
}

type Props = {
  projectId: string
  chapters: EvoChapter[]
  months: EvoMonth[]
  /** Map<month_close_id, Map<partida_catalog_id, total_mxn>>. */
  snapshotByMonth: Map<string, Map<string, number>>
  /** Etiqueta de la columna viva (total de hoy), p. ej. "PPTO Vigente". */
  enCursoLabel: string
  totalBase: number
  total: number
  totalDif: number | null
  admin: boolean
}

/**
 * Modo Evolución del Resumen (SPEC-buyout.md §6): columnas = Ppto Base + cada mes
 * cerrado (foto congelada, incluido el mes actual si ya cerró) + PPTO Vigente (el
 * total vivo de hoy) + Dif (Base vs PPTO Vigente = lo más reciente). Un mes cerrado
 * es solo una columna congelada: NO se compara con lo vivo ni avisa nada. Evolución es
 * el ÚNICO lugar de edición (admin): el **Ppto Base** por partida (lápiz →
 * `setPartidaBase`) y cada celda de **mes** (lápiz → `setMonthSnapshot`, cualquier mes
 * cerrado incluido uno pasado). En el grupo "▸ Meses" del Vigente esas MISMAS columnas
 * (Base + meses) son solo-lectura. Por partida, con subtotal por capítulo y TOTAL. La
 * rejilla alinea todas las partidas en todos los meses; donde un mes no tiene la partida
 * (no existía / sin datos al cerrar) se rellena 0.
 */
export function EvolucionTable({
  projectId,
  chapters,
  months,
  snapshotByMonth,
  enCursoLabel,
  totalBase,
  total,
  totalDif,
  admin,
}: Props) {
  const snap = (monthId: string, partidaId: string) =>
    snapshotByMonth.get(monthId)?.get(partidaId) ?? 0
  const colCount = months.length + 4 // Concepto + Base + meses + en curso + Dif
  const monthTotal = (m: EvoMonth) =>
    chapters.reduce(
      (acc, ch) => acc + ch.partidas.reduce((a, p) => a + snap(m.id, p.id), 0),
      0,
    )

  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      <table className="w-full text-sm tabular-nums">
        <thead className="sticky top-0 z-10">
          <tr className={cn(HEAD_ROW, "border-b border-nauka-subtle")}>
            <Th icon={Tag}>Concepto</Th>
            <Th icon={Target} align="right">
              Ppto Base
            </Th>
            {months.map((m) => (
              <Th
                key={m.id}
                icon={Calendar}
                align="right"
                className="whitespace-nowrap"
              >
                {m.label}
                {admin ? (
                  <ReabrirMesButton
                    projectId={projectId}
                    periodo={m.periodo}
                    periodoShort={m.short}
                  />
                ) : null}
              </Th>
            ))}
            <Th icon={Coins} align="right" className="whitespace-nowrap">
              {enCursoLabel}
            </Th>
            <Th icon={TrendingUp} align="right">
              Dif
            </Th>
          </tr>
        </thead>
        <tbody>
          {chapters.map((ch) => (
            <Fragment key={ch.nombre}>
              <tr className="bg-nauka-subtle">
                <td
                  colSpan={colCount}
                  className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-nauka-dark"
                >
                  {ch.nombre}
                </td>
              </tr>
              {ch.partidas.length === 0 ? (
                <tr className="border-b border-nauka-subtle">
                  <td
                    colSpan={colCount}
                    className="px-4 py-3 italic text-muted-foreground"
                  >
                    Sin partidas en este capítulo
                  </td>
                </tr>
              ) : (
                ch.partidas.map((p) => (
                  <tr
                    key={p.id}
                    className="h-12 border-b border-nauka-subtle transition-colors hover:bg-nauka-bg"
                  >
                    <td className="px-4 py-3">{p.nombre}</td>
                    <td className="px-4 py-3 text-right">
                      <BaseCell
                        projectId={projectId}
                        partidaCatalogId={p.id}
                        monto={p.base}
                        admin={admin}
                      />
                    </td>
                    {months.map((m) => (
                      <td key={m.id} className="px-4 py-3 text-right">
                        <MonthCell
                          projectId={projectId}
                          monthCloseId={m.id}
                          partidaCatalogId={p.id}
                          monto={snap(m.id, p.id)}
                          mesLabel={m.short}
                          admin={admin}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-medium text-nauka-dark">
                      {formatMXN0(p.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DifBadge dif={p.dif} />
                    </td>
                  </tr>
                ))
              )}
              <tr className="border-b border-nauka-subtle bg-nauka-bg/60">
                <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subtotal {ch.nombre}
                </td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {formatMXN0(ch.base)}
                </td>
                {months.map((m) => (
                  <td key={m.id} className="px-4 py-2.5 text-right font-medium">
                    {formatMXN0(
                      ch.partidas.reduce((a, p) => a + snap(m.id, p.id), 0),
                    )}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-semibold text-nauka-dark">
                  {formatMXN0(ch.total)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium">
                  <DifBadge dif={ch.dif} />
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-nauka-dark text-white">
            <td className="px-4 py-3 font-semibold">TOTAL</td>
            <td className="px-4 py-3 text-right font-semibold">
              {formatMXN0(totalBase)}
            </td>
            {months.map((m) => (
              <td key={m.id} className="px-4 py-3 text-right font-semibold">
                {formatMXN0(monthTotal(m))}
              </td>
            ))}
            <td className="px-4 py-3 text-right font-semibold">
              {formatMXN0(total)}
            </td>
            <td className="px-4 py-3 text-right font-semibold">
              <DifBadge dif={totalDif} onDark />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
