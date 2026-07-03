import Link from "next/link"
import { Fragment } from "react"
import { formatMXN0 } from "@/lib/buyout/format"
import { cn } from "@/lib/utils"
import {
  CHAPTER_TD,
  HEAD_ROW,
  ROW,
  SUBTOTAL_LABEL,
  SUBTOTAL_ROW,
  TABLE,
  TD,
  TH_HAIRLINE,
  TOTAL_FOOT,
} from "./table-ui"

/**
 * Modo Contratación del Resumen (SPEC-buyout.md §6, "Contratado vs No"): por cada
 * partida, el total MXN de la cotización VIGENTE de sus conceptos, partido por
 * estado en DOS ejes INDEPENDIENTES (cols V/W del Excel):
 *   • Madurez:      Paramétrico + Ppto         = Total
 *   • Contratación: No Contratado + Contratado = Total
 * Son dos cortes del MISMO total → cada par suma el Total. Cada cubeta muestra su
 * monto Y su % del total de la fila (ej. "$240,700 (67%)"), con cada par sumando
 * 100%. El % Contratado al pie es el avance por dinero (Contratado ÷ Total). Misma
 * fuente que el rollup vigente (lib/buyout/rollup) → el Total cuadra con el modo
 * Vigente. Subtotal por capítulo, TOTAL general y % Contratado global al pie.
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

/** Los 4 % por estado de una fila (cubeta ÷ total de la fila). Para que cada PAR
 *  sume EXACTO 100% pese al redondeo a entero, se redondean `ppto` y `contratado`
 *  y su complemento (`parametrico` / `noContratado`) se deriva como 100 − ese %.
 *  Cada uno es null si el total ≤ 0 → la celda muestra "—" (sin dividir entre 0). */
function estadoPcts(row: { ppto: number; contratado: number; total: number }): {
  parametrico: number | null
  ppto: number | null
  noContratado: number | null
  contratado: number | null
} {
  if (!(row.total > 0)) {
    return {
      parametrico: null,
      ppto: null,
      noContratado: null,
      contratado: null,
    }
  }
  const ppto = Math.round((row.ppto / row.total) * 100)
  const contratado = Math.round((row.contratado / row.total) * 100)
  return {
    parametrico: 100 - ppto,
    ppto,
    noContratado: 100 - contratado,
    contratado,
  }
}

/** Monto MXN + su % del total de la fila, en línea y atenuado: "$240,700 (67%)".
 *  pct null (total ≤ 0) → "(—)". El monto hereda el color de la celda; el % va
 *  atenuado (secundario) para que se lea limpio. */
function MontoPct({
  amount,
  pct,
  onDark,
}: {
  amount: number
  pct: number | null
  onDark?: boolean
}) {
  return (
    <span className="whitespace-nowrap">
      {formatMXN0(amount)}{" "}
      <span className={onDark ? "text-white/55" : "text-muted-foreground"}>
        ({pct === null ? "—" : `${pct}%`})
      </span>
    </span>
  )
}

/** % contratado (Contratado ÷ Total) como barrita de avance + texto. Relleno =
 *  color fijo del eje contratación (dark; accent sobre la banda oscura). */
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
            onDark ? "bg-nauka-accent" : "bg-nauka-dark",
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
  const gp = estadoPcts(g)
  return (
    <div className="max-h-[78vh] overflow-auto rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      <table className={TABLE}>
        <thead className="sticky top-0 z-10">
          {/* Fila 1: encabezados AGRUPADOS — deja claro que son 2 pares. Las
              celdas con rowSpan llevan el hairline (su borde inferior coincide
              con el de la fila 2). */}
          <tr className={HEAD_ROW}>
            <th
              className={cn(
                "px-3 pt-2.5 pb-2 pl-4 text-left align-bottom font-medium",
                TH_HAIRLINE,
              )}
              rowSpan={2}
            >
              Concepto
            </th>
            <th
              className="px-3 pt-2.5 pb-1 text-center font-semibold text-nauka-dark"
              colSpan={2}
            >
              Madurez
            </th>
            <th
              className={cn(
                "px-3 pt-2.5 pb-1 text-center font-semibold text-nauka-dark",
                AXIS_DIV,
              )}
              colSpan={2}
            >
              Contratación
            </th>
            <th
              className={cn(
                "px-3 pt-2.5 pb-2 text-right align-bottom font-medium",
                TH_HAIRLINE,
              )}
              rowSpan={2}
            >
              Total
            </th>
            <th
              className={cn(
                "px-3 pt-2.5 pb-2 pr-4 text-right align-bottom font-medium",
                TH_HAIRLINE,
              )}
              rowSpan={2}
            >
              % Contratado
            </th>
          </tr>
          {/* Fila 2: las 4 columnas de estado (2 por eje), con monto y % del total. */}
          <tr className={HEAD_ROW}>
            <th className={cn("px-3 pb-2 text-right font-medium", TH_HAIRLINE)}>
              Paramétrico
            </th>
            <th className={cn("px-3 pb-2 text-right font-medium", TH_HAIRLINE)}>
              Ppto
            </th>
            <th
              className={cn(
                "px-3 pb-2 text-right font-medium",
                TH_HAIRLINE,
                AXIS_DIV,
              )}
            >
              No Contratado
            </th>
            <th className={cn("px-3 pb-2 text-right font-medium", TH_HAIRLINE)}>
              Contratado
            </th>
          </tr>
        </thead>
        <tbody>
          {chapters.map((ch) => {
            const sp = estadoPcts(ch)
            return (
              <Fragment key={ch.nombre}>
                <tr>
                  <td colSpan={7} className={CHAPTER_TD}>
                    {ch.nombre}
                  </td>
                </tr>
                {ch.partidas.length === 0 ? (
                  <tr className="border-b border-nauka-subtle">
                    <td
                      colSpan={7}
                      className="px-4 py-2.5 text-muted-foreground"
                    >
                      Sin partidas en este capítulo
                    </td>
                  </tr>
                ) : (
                  ch.partidas.map((p) => {
                    const pp = estadoPcts(p)
                    return (
                      <tr key={p.id} className={ROW}>
                        <td className={cn(TD, "font-medium")}>
                          <Link
                            href={`/proyectos/${projectId}/buyout/partida?partida=${p.id}`}
                            className="underline-offset-4 decoration-nauka-accent decoration-2 transition-colors hover:underline"
                          >
                            {p.nombre}
                          </Link>
                        </td>
                        <td
                          className={cn(TD, "text-right text-muted-foreground")}
                        >
                          <MontoPct
                            amount={p.parametrico}
                            pct={pp.parametrico}
                          />
                        </td>
                        <td className={cn(TD, "text-right")}>
                          <MontoPct amount={p.ppto} pct={pp.ppto} />
                        </td>
                        <td
                          className={cn(
                            TD,
                            "text-right text-muted-foreground",
                            AXIS_DIV,
                          )}
                        >
                          <MontoPct
                            amount={p.noContratado}
                            pct={pp.noContratado}
                          />
                        </td>
                        <td
                          className={cn(
                            TD,
                            "text-right font-medium text-nauka-dark",
                          )}
                        >
                          <MontoPct amount={p.contratado} pct={pp.contratado} />
                        </td>
                        <td
                          className={cn(
                            TD,
                            "text-right font-medium text-nauka-dark",
                          )}
                        >
                          {formatMXN0(p.total)}
                        </td>
                        <td className={TD}>
                          <PctBar
                            value={pctContratado(p.contratado, p.total)}
                          />
                        </td>
                      </tr>
                    )
                  })
                )}
                {/* Subtotal del capítulo. */}
                <tr className={SUBTOTAL_ROW}>
                  <td className={SUBTOTAL_LABEL}>Subtotal {ch.nombre}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    <MontoPct amount={ch.parametrico} pct={sp.parametrico} />
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    <MontoPct amount={ch.ppto} pct={sp.ppto} />
                  </td>
                  <td
                    className={cn("px-3 py-2 text-right font-medium", AXIS_DIV)}
                  >
                    <MontoPct amount={ch.noContratado} pct={sp.noContratado} />
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    <MontoPct amount={ch.contratado} pct={sp.contratado} />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-nauka-dark">
                    {formatMXN0(ch.total)}
                  </td>
                  <td className="px-3 py-2 pr-4">
                    <PctBar value={pctContratado(ch.contratado, ch.total)} />
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
        <tfoot className={TOTAL_FOOT}>
          <tr className="bg-nauka-dark text-white">
            <td className="px-3 py-2.5 pl-4 font-semibold">TOTAL</td>
            <td className="px-3 py-2.5 text-right font-semibold">
              <MontoPct amount={g.parametrico} pct={gp.parametrico} onDark />
            </td>
            <td className="px-3 py-2.5 text-right font-semibold">
              <MontoPct amount={g.ppto} pct={gp.ppto} onDark />
            </td>
            <td
              className={cn(
                "px-3 py-2.5 text-right font-semibold",
                AXIS_DIV_DARK,
              )}
            >
              <MontoPct amount={g.noContratado} pct={gp.noContratado} onDark />
            </td>
            <td className="px-3 py-2.5 text-right font-semibold">
              <MontoPct amount={g.contratado} pct={gp.contratado} onDark />
            </td>
            <td className="px-3 py-2.5 text-right font-semibold">
              {formatMXN0(g.total)}
            </td>
            <td className="px-3 py-2.5 pr-4">
              <PctBar value={pctContratado(g.contratado, g.total)} onDark />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
