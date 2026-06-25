import { Check, TriangleAlert } from "lucide-react"
import { Fragment } from "react"
import { formatMXN } from "@/lib/utils"
import { DifText } from "./dif-text"
import { ReabrirMesButton } from "./reabrir-mes-button"

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

/**
 * Columna del MES EN CURSO (siempre una sola, total vivo). Si `closed`, el mes en
 * curso ya tiene su foto: no se duplica la columna, se marca "cerrado ✓" (y puede
 * reabrirse). Si además `drift`, el vivo difiere de la foto → "desactualizado".
 */
export type EnCurso = {
  /** "Ppto Junio 2026" (cerrado) o "Ppto Junio 2026 (en curso)" (abierto). */
  label: string
  closed: boolean
  drift: boolean
  /** "2026-06" (para reabrir el mes en curso ya cerrado). */
  periodo: string
  /** "Junio 2026" (para el botón Reabrir). */
  short: string
}

type Props = {
  projectId: string
  chapters: EvoChapter[]
  months: EvoMonth[]
  /** Map<month_close_id, Map<partida_catalog_id, total_mxn>>. */
  snapshotByMonth: Map<string, Map<string, number>>
  /** Columna del mes en curso (colapsa la foto si ya está cerrado). */
  enCurso: EnCurso
  totalBase: number
  total: number
  totalDif: number | null
  admin: boolean
}

/**
 * Modo Evolución del Resumen (SPEC-buyout.md §6): columnas = Ppto Base + cada mes
 * cerrado ANTERIOR (foto congelada) + el mes en curso en vivo (UNA columna) + Dif
 * (Base vs el mes más reciente = el en curso). Si el mes en curso ya está cerrado,
 * su columna lleva "cerrado ✓" en lugar de duplicarse con su foto. Por partida,
 * con subtotal por capítulo y TOTAL. La rejilla alinea todas las partidas en todos
 * los meses; donde un mes no tiene la partida (no existía / sin datos al cerrar) se
 * rellena 0 — sin huecos.
 */
export function EvolucionTable({
  projectId,
  chapters,
  months,
  snapshotByMonth,
  enCurso,
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
          <tr className="bg-nauka-dark text-xs uppercase tracking-wider text-white/70">
            <th className="px-3 py-2.5 text-left">Concepto</th>
            <th className="px-3 py-2.5 text-right">Ppto Base</th>
            {months.map((m) => (
              <th
                key={m.id}
                className="px-3 py-2.5 text-right whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-1">
                  {m.label}
                  {admin ? (
                    <ReabrirMesButton
                      projectId={projectId}
                      periodo={m.periodo}
                      periodoShort={m.short}
                    />
                  ) : null}
                </span>
              </th>
            ))}
            <th className="px-3 py-2.5 text-right whitespace-nowrap text-white">
              <span className="inline-flex items-center gap-1.5">
                {enCurso.label}
                {enCurso.closed ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-200"
                    title="El mes en curso ya está cerrado: esta columna reemplaza a su foto congelada (no se duplica)."
                  >
                    <Check className="size-3" />
                    cerrado
                  </span>
                ) : null}
                {enCurso.closed && enCurso.drift ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-200"
                    title="El total vivo difiere de la foto guardada (se editó tras cerrar). Usa “Actualizar foto” para re-tomarla."
                  >
                    <TriangleAlert className="size-3" />
                    desactualizado
                  </span>
                ) : null}
                {enCurso.closed && admin ? (
                  <ReabrirMesButton
                    projectId={projectId}
                    periodo={enCurso.periodo}
                    periodoShort={enCurso.short}
                  />
                ) : null}
              </span>
            </th>
            <th className="px-3 py-2.5 text-right">Dif</th>
          </tr>
        </thead>
        <tbody>
          {chapters.map((ch) => (
            <Fragment key={ch.nombre}>
              <tr className="bg-nauka-subtle">
                <td
                  colSpan={colCount}
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-nauka-dark"
                >
                  {ch.nombre}
                </td>
              </tr>
              {ch.partidas.length === 0 ? (
                <tr className="border-b border-nauka-subtle">
                  <td
                    colSpan={colCount}
                    className="px-3 py-2 italic text-muted-foreground"
                  >
                    Sin partidas en este capítulo
                  </td>
                </tr>
              ) : (
                ch.partidas.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-nauka-subtle hover:bg-nauka-bg"
                  >
                    <td className="px-3 py-2">{p.nombre}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {formatMXN(p.base)}
                    </td>
                    {months.map((m) => (
                      <td key={m.id} className="px-3 py-2 text-right">
                        {formatMXN(snap(m.id, p.id))}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-medium text-nauka-dark">
                      {formatMXN(p.total)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <DifText dif={p.dif} />
                    </td>
                  </tr>
                ))
              )}
              <tr className="border-b border-nauka-subtle bg-nauka-bg/60">
                <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subtotal {ch.nombre}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {formatMXN(ch.base)}
                </td>
                {months.map((m) => (
                  <td key={m.id} className="px-3 py-2 text-right font-medium">
                    {formatMXN(
                      ch.partidas.reduce((a, p) => a + snap(m.id, p.id), 0),
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold text-nauka-dark">
                  {formatMXN(ch.total)}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  <DifText dif={ch.dif} />
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-nauka-dark text-white">
            <td className="px-3 py-2.5 font-semibold">TOTAL</td>
            <td className="px-3 py-2.5 text-right font-semibold">
              {formatMXN(totalBase)}
            </td>
            {months.map((m) => (
              <td key={m.id} className="px-3 py-2.5 text-right font-semibold">
                {formatMXN(monthTotal(m))}
              </td>
            ))}
            <td className="px-3 py-2.5 text-right font-semibold">
              {formatMXN(total)}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold">
              <DifText dif={totalDif} onDark />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
