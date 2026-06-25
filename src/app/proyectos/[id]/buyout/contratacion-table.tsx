import Link from "next/link"
import { Fragment } from "react"
import { cn, formatMXN } from "@/lib/utils"

/**
 * Modo Contratación del Resumen (SPEC-buyout.md §6, "Contratado vs No"): por cada
 * partida, el total MXN de la cotización VIGENTE de sus conceptos, partido por
 * estado en DOS ejes INDEPENDIENTES (cols V/W del Excel):
 *   • Madurez:      Paramétrico + Ppto         = Total
 *   • Contratación: No Contratado + Contratado = Total
 * Son dos cortes del MISMO total → cada par suma el Total. El % Contratado es el
 * avance por dinero (Contratado ÷ Total). Misma fuente que el rollup vigente
 * (lib/buyout/rollup) → el Total cuadra con el modo Vigente. Subtotal por capítulo,
 * TOTAL general y % Contratado global al pie.
 */

/** Una partida con su total vigente partido por estado. */
export type ContraPartida = {
  id: string
  nombre: string
  parametrico: number
  ppto: number
  noContratado: number
  contratado: number
  total: number
}
/** Capítulo + sus partidas + subtotales por estado. */
export type ContraChapter = {
  nombre: string
  partidas: ContraPartida[]
  parametrico: number
  ppto: number
  noContratado: number
  contratado: number
  total: number
}

// Divisor vertical que separa los 2 pares de ejes (Madurez ‖ Contratación). Cae
// sobre la columna "No Contratado" y baja por toda la tabla para que se lea claro
// que son dos pares independientes.
const AXIS_DIV = "border-l border-nauka-card-border"
const AXIS_DIV_DARK = "border-l border-white/25"

/** % contratado (Contratado ÷ Total) como barrita de avance + texto. */
function PctBar({ value, onDark }: { value: number | null; onDark?: boolean }) {
  if (value === null) {
    return (
      <span className={onDark ? "text-white/50" : "text-muted-foreground"}>
        —
      </span>
    )
  }
  const pct = value * 100
  return (
    <div className="flex items-center justify-end gap-2">
      <div
        className={cn(
          "h-1.5 w-14 overflow-hidden rounded-full",
          onDark ? "bg-white/20" : "bg-nauka-subtle",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full",
            onDark ? "bg-emerald-400" : "bg-emerald-500",
          )}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span
        className={cn(
          "w-12 text-right tabular-nums",
          onDark ? "text-white" : "text-nauka-dark",
        )}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

/** Contratado ÷ Total; null si Total ≤ 0 (la UI muestra "—"). */
function pctContratado(contratado: number, total: number): number | null {
  return total > 0 ? contratado / total : null
}

export function ContratacionTable({
  projectId,
  chapters,
}: {
  projectId: string
  chapters: ContraChapter[]
}) {
  // Totales generales = Σ de los capítulos (misma fuente → cuadra con Vigente).
  const g = {
    parametrico: chapters.reduce((a, c) => a + c.parametrico, 0),
    ppto: chapters.reduce((a, c) => a + c.ppto, 0),
    noContratado: chapters.reduce((a, c) => a + c.noContratado, 0),
    contratado: chapters.reduce((a, c) => a + c.contratado, 0),
    total: chapters.reduce((a, c) => a + c.total, 0),
  }
  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      <table className="w-full text-sm tabular-nums">
        <thead className="sticky top-0 z-10">
          {/* Fila 1: encabezados AGRUPADOS — deja claro que son 2 pares. */}
          <tr className="bg-nauka-dark text-xs uppercase tracking-wider text-white/70">
            <th className="px-3 py-2 text-left align-bottom" rowSpan={2}>
              Concepto
            </th>
            <th
              className="px-3 pt-2 pb-1 text-center font-semibold text-white/90"
              colSpan={2}
            >
              Madurez
            </th>
            <th
              className={cn(
                "px-3 pt-2 pb-1 text-center font-semibold text-white/90",
                AXIS_DIV_DARK,
              )}
              colSpan={2}
            >
              Contratación
            </th>
            <th className="px-3 py-2 text-right align-bottom" rowSpan={2}>
              Total
            </th>
            <th className="px-3 py-2 text-right align-bottom" rowSpan={2}>
              % Contratado
            </th>
          </tr>
          {/* Fila 2: las 4 columnas de estado (2 por eje). */}
          <tr className="bg-nauka-dark text-[11px] uppercase tracking-wider text-white/55">
            <th className="px-3 pb-2 text-right font-medium">Paramétrico</th>
            <th className="px-3 pb-2 text-right font-medium">Ppto</th>
            <th
              className={cn("px-3 pb-2 text-right font-medium", AXIS_DIV_DARK)}
            >
              No Contratado
            </th>
            <th className="px-3 pb-2 text-right font-medium">Contratado</th>
          </tr>
        </thead>
        <tbody>
          {chapters.map((ch) => (
            <Fragment key={ch.nombre}>
              <tr className="bg-nauka-subtle">
                <td
                  colSpan={7}
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-nauka-dark"
                >
                  {ch.nombre}
                </td>
              </tr>
              {ch.partidas.length === 0 ? (
                <tr className="border-b border-nauka-subtle">
                  <td
                    colSpan={7}
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
                    <td className="px-3 py-2">
                      <Link
                        href={`/proyectos/${projectId}/buyout/partida?partida=${p.id}`}
                        className="transition-colors hover:text-nauka-accent"
                      >
                        {p.nombre}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {formatMXN(p.parametrico)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatMXN(p.ppto)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right text-muted-foreground",
                        AXIS_DIV,
                      )}
                    >
                      {formatMXN(p.noContratado)}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-700">
                      {formatMXN(p.contratado)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-nauka-dark">
                      {formatMXN(p.total)}
                    </td>
                    <td className="px-3 py-2">
                      <PctBar value={pctContratado(p.contratado, p.total)} />
                    </td>
                  </tr>
                ))
              )}
              {/* Subtotal del capítulo. */}
              <tr className="border-b border-nauka-subtle bg-nauka-bg/60">
                <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subtotal {ch.nombre}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {formatMXN(ch.parametrico)}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {formatMXN(ch.ppto)}
                </td>
                <td
                  className={cn("px-3 py-2 text-right font-medium", AXIS_DIV)}
                >
                  {formatMXN(ch.noContratado)}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {formatMXN(ch.contratado)}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-nauka-dark">
                  {formatMXN(ch.total)}
                </td>
                <td className="px-3 py-2">
                  <PctBar value={pctContratado(ch.contratado, ch.total)} />
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-nauka-dark text-white">
            <td className="px-3 py-2.5 font-semibold">TOTAL</td>
            <td className="px-3 py-2.5 text-right font-semibold">
              {formatMXN(g.parametrico)}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold">
              {formatMXN(g.ppto)}
            </td>
            <td
              className={cn(
                "px-3 py-2.5 text-right font-semibold",
                AXIS_DIV_DARK,
              )}
            >
              {formatMXN(g.noContratado)}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold">
              {formatMXN(g.contratado)}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold">
              {formatMXN(g.total)}
            </td>
            <td className="px-3 py-2.5">
              <PctBar value={pctContratado(g.contratado, g.total)} onDark />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
