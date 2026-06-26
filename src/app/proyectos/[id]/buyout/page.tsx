import {
  Activity,
  Building2,
  Calendar,
  Clock,
  Coins,
  Ruler,
  Tag,
  Target,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Fragment } from "react"
import { isAdmin } from "@/lib/auth/roles"
import { formatMXN0, formatUSD0 } from "@/lib/buyout/format"
import {
  currentPeriodo,
  loadClosedMonths,
  loadSnapshots,
  periodoLabel,
  periodoShort,
} from "@/lib/buyout/month-close"
import {
  aggregateLines,
  difPct,
  loadPartidaAggs,
  type PartidaAgg,
} from "@/lib/buyout/rollup"
import { formatDate } from "@/lib/format/fecha"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { CerrarMesButton } from "./cerrar-mes-button"
import { type ContraChapter, ContratacionTable } from "./contratacion-table"
import { DifBadge } from "./dif-text"
import {
  type EvoChapter,
  EvolucionTable,
  type EvoMonth,
} from "./evolucion-table"
import { MesesToggle } from "./meses-toggle"
import { type ResumenMode, ResumenModeToggle } from "./resumen-mode-toggle"
import { HEAD_ROW, Th } from "./table-ui"

export const metadata = { title: "Buy-Out · Resumen" }

const areaFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type PartidaView = {
  id: string
  nombre: string
  chapterDefault: string | null
  base: number
  agg: PartidaAgg
  dif: number | null
}
type ChapterView = {
  nombre: string
  partidas: PartidaView[]
  total: number
  base: number
  count: number
  dif: number | null
}

/**
 * Resumen (tablero BUY OUT) — Fase 3a: FUNCIONAL. Suma de verdad. Por cada
 * partida, total = Σ del total MXN de la cotización VIGENTE de cada concepto
 * (rollup de `lib/buyout/rollup`), luego partida → capítulo → TOTAL. Muestra
 * Ppto Base (solo-lectura aquí; se edita en Evolución), Ppto vigente, DIF
 * (vigente ÷ base − 1), $/m², última actualización y el Estado agregado (madurez ·
 * contratación). $/m² + USD/m² al pie. Misma fuente que las tarjetas de Partida.
 */
export default async function BuyoutResumenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ modo?: string; meses?: string }>
}) {
  const { id } = await params
  const { modo: modoParam, meses: mesesParam } = await searchParams
  const modo: ResumenMode =
    modoParam === "evolucion"
      ? "evolucion"
      : modoParam === "contratacion"
        ? "contratacion"
        : "vigente"
  // Grupo de columnas de meses (solo en Vigente): colapsado por default.
  const mesesOpen = modo === "vigente" && mesesParam === "open"
  const sb = await createClient()

  const { data: project } = await sb
    .from("projects")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!project) notFound()

  const admin = await isAdmin()

  const [chapterRes, partidaRes, metaRes, fxRes, baseRes] = await Promise.all([
    sb
      .from("buyout_chapter")
      .select("id, nombre")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("orden"),
    sb
      .from("buyout_partida_catalog")
      .select("id, nombre, chapter_default")
      .is("deleted_at", null)
      .order("orden"),
    sb
      .from("buyout_project_meta")
      .select("area_int")
      .eq("project_id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    sb
      .from("buyout_fx")
      .select("currency, rate")
      .eq("project_id", id)
      .is("deleted_at", null),
    sb
      .from("buyout_partida_base")
      .select("partida_catalog_id, monto_base")
      .eq("project_id", id)
      .is("deleted_at", null),
  ])

  const chapters = (chapterRes.data ?? []).map((c) => c.nombre as string)
  const partidas = (partidaRes.data ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    chapter_default: (p.chapter_default as string | null) ?? null,
  }))
  const areaInt =
    metaRes.data?.area_int != null ? Number(metaRes.data.area_int) : null
  const fxList = (fxRes.data ?? []).map((c) => ({
    currency: c.currency as string,
    rate: Number(c.rate),
  }))
  const usdRate = fxList.find((f) => f.currency === "USD")?.rate || null
  const baseByPartida = new Map<string, number>(
    (baseRes.data ?? []).map((b) => [
      b.partida_catalog_id as string,
      Number(b.monto_base),
    ]),
  )

  // Rollup: líneas vigentes → agregado por partida (misma fuente que Partida y
  // que el cierre de mes → nunca difieren).
  const partidaNombreById = new Map(partidas.map((p) => [p.id, p.nombre]))
  const aggs = await loadPartidaAggs(sb, id, fxList, partidaNombreById)
  const emptyAgg = aggregateLines([])

  const partidaViews: PartidaView[] = partidas.map((p) => {
    const agg = aggs.get(p.id) ?? emptyAgg
    const base = baseByPartida.get(p.id) ?? 0
    return {
      id: p.id,
      nombre: p.nombre,
      chapterDefault: p.chapter_default,
      base,
      agg,
      dif: agg.count === 0 ? null : difPct(agg.total, base),
    }
  })

  const chapterViews = groupByChapter(chapters, partidaViews)
  const total = chapterViews.reduce((a, c) => a + c.total, 0)
  const totalBase = chapterViews.reduce((a, c) => a + c.base, 0)
  const totalCount = chapterViews.reduce((a, c) => a + c.count, 0)
  const totalDif = totalCount === 0 ? null : difPct(total, totalBase)
  const costoM2 = areaInt ? total / areaInt : null
  const usdM2 = areaInt && usdRate ? total / usdRate / areaInt : null

  if (chapters.length === 0) {
    return (
      <div className="rounded-2xl border border-nauka-card-border bg-white p-12 text-center shadow-nauka-card">
        <p className="text-sm font-medium text-nauka-dark">
          Este proyecto aún no tiene capítulos de Buy-Out.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          El módulo arranca con Lote 3 (capítulos y catálogos ya sembrados).
        </p>
      </div>
    )
  }

  // Cierre mensual / Evolución (SPEC §6): meses cerrados = columnas CONGELADAS.
  // Un mes cerrado es solo una foto (buyout_month_snapshot); NO se compara con el
  // total vivo ni avisa nada (sin "desactualizado"). Las MISMAS columnas de mes
  // alimentan Evolución y el grupo "▸ Meses" del Vigente (mismas etiquetas, valores
  // y orden). La columna viva "PPTO Vigente" es aparte: el total de hoy.
  const periodoActual = currentPeriodo()
  const closedMonths = await loadClosedMonths(sb, id)
  const currentClosed = closedMonths.some((m) => m.periodo === periodoActual)
  // ÚNICO set de columnas de mes = TODOS los meses cerrados (incl. el actual si ya
  // cerró), ascendentes. Lo comparten Evolución y el grupo "▸ Meses" del Vigente.
  const monthCols: EvoMonth[] = closedMonths.map((m) => ({
    id: m.id,
    periodo: m.periodo,
    label: periodoLabel(m.periodo),
    short: periodoShort(m.periodo),
  }))
  // Fotos congeladas (buyout_month_snapshot): mismo origen para ambas vistas.
  const needSnapshots =
    (modo === "evolucion" || mesesOpen) && closedMonths.length > 0
  const snapshotByMonth = needSnapshots
    ? await loadSnapshots(
        sb,
        closedMonths.map((m) => m.id),
      )
    : new Map<string, Map<string, number>>()
  // En el Vigente, las columnas de mes solo se intercalan si "▸ Meses" está abierto.
  const mesesCols: EvoMonth[] = mesesOpen ? monthCols : []
  const evoChapters: EvoChapter[] = chapterViews.map((ch) => ({
    nombre: ch.nombre,
    base: ch.base,
    total: ch.total,
    dif: ch.dif,
    partidas: ch.partidas.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      base: p.base,
      total: p.agg.total,
      dif: p.dif,
    })),
  }))
  // CONTRATACIÓN (modo aparte): el mismo total vigente por partida, partido por
  // estado en 2 ejes (madurez · contratación). Sale de los buckets del rollup
  // (mismas `aggs`) → Total/subtotales/TOTAL cuadran con Vigente por construcción.
  // Solo se arma en este modo (no toca Vigente/Evolución).
  const contraChapters: ContraChapter[] =
    modo === "contratacion"
      ? chapterViews.map((ch) => ({
          nombre: ch.nombre,
          partidas: ch.partidas.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            parametrico: p.agg.parametrico,
            ppto: p.agg.ppto,
            noContratado: p.agg.noContratado,
            contratado: p.agg.contratado,
            total: p.agg.total,
          })),
          parametrico: ch.partidas.reduce((a, p) => a + p.agg.parametrico, 0),
          ppto: ch.partidas.reduce((a, p) => a + p.agg.ppto, 0),
          noContratado: ch.partidas.reduce((a, p) => a + p.agg.noContratado, 0),
          contratado: ch.partidas.reduce((a, p) => a + p.agg.contratado, 0),
          total: ch.total,
        }))
      : []
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: toggle Vigente/Evolución + (admin) Cerrar mes en curso. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResumenModeToggle modo={modo} />
        {admin ? (
          <CerrarMesButton
            projectId={id}
            periodoShort={periodoShort(periodoActual)}
            yaCerrado={currentClosed}
          />
        ) : null}
      </div>

      {modo === "evolucion" ? (
        <>
          {closedMonths.length === 0 ? (
            <p className="rounded-xl border border-dashed border-nauka-card-border bg-white px-4 py-3 text-sm text-muted-foreground">
              Aún no hay meses cerrados.{" "}
              {admin
                ? "Usa “Cerrar mes” para congelar la foto del mes en curso y empezar el comparativo."
                : "El administrador puede cerrar el mes para empezar el comparativo."}
            </p>
          ) : null}
          <EvolucionTable
            projectId={id}
            chapters={evoChapters}
            months={monthCols}
            snapshotByMonth={snapshotByMonth}
            enCursoLabel="PPTO Vigente"
            totalBase={totalBase}
            total={total}
            totalDif={totalDif}
            admin={admin}
          />
          <p className="text-sm text-muted-foreground">
            Cada columna de mes es la foto congelada del total vigente por
            partida al cerrar ese mes (incluye el mes actual si ya está
            cerrado);{" "}
            <span className="font-medium text-nauka-dark">PPTO Vigente</span> es
            el total vivo de hoy. Dif compara el Ppto Base contra PPTO Vigente
            (lo más reciente). Conceptos/partidas nuevos aparecen en $0 en los
            meses previos. Aquí (admin) se edita con el lápiz el{" "}
            <span className="font-medium text-nauka-dark">Ppto Base</span> y
            cualquier celda de mes; en Vigente son solo-lectura. ↩ reabre el
            mes.
          </p>
        </>
      ) : modo === "contratacion" ? (
        <>
          <ContratacionTable projectId={id} chapters={contraChapters} />
          <p className="text-sm text-muted-foreground">
            Dos cortes del{" "}
            <span className="font-medium text-nauka-dark">mismo</span> total
            vigente, por dos ejes independientes:{" "}
            <span className="font-medium text-nauka-dark">Madurez</span>{" "}
            (Paramétrico + Ppto = Total) y{" "}
            <span className="font-medium text-nauka-dark">Contratación</span>{" "}
            (No Contratado + Contratado = Total). El{" "}
            <span className="font-medium text-nauka-dark">% Contratado</span> es
            el avance por dinero (Contratado ÷ Total). El Total cuadra con el
            modo Vigente.
          </p>
        </>
      ) : (
        <>
          {/* Grupo de columnas de meses (colapsable): aparece si hay ≥1 mes cerrado
              que revelar (incluye el mes actual si ya está cerrado). */}
          {closedMonths.length > 0 ? (
            <div className="flex justify-end">
              <MesesToggle open={mesesOpen} count={closedMonths.length} />
            </div>
          ) : null}

          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
            <table className="w-full text-sm tabular-nums">
              <thead className="sticky top-0 z-10">
                <tr className={cn(HEAD_ROW, "border-b border-nauka-subtle")}>
                  <Th icon={Tag}>Concepto</Th>
                  <Th icon={Building2}>Proveedor</Th>
                  <Th icon={Target} align="right">
                    Ppto Base
                  </Th>
                  {mesesCols.map((m) => (
                    <Th
                      key={m.id}
                      icon={Calendar}
                      align="right"
                      className="whitespace-nowrap"
                    >
                      {m.label}
                    </Th>
                  ))}
                  <Th icon={Coins} align="right">
                    Ppto
                  </Th>
                  <Th icon={TrendingUp} align="right">
                    Dif
                  </Th>
                  <Th icon={Ruler} align="right">
                    $/m²
                  </Th>
                  <Th icon={Clock}>Última actualización</Th>
                  <Th icon={Activity}>
                    Estado{" "}
                    <span className="font-normal normal-case tracking-normal text-nauka-neutral">
                      (madurez · contratación)
                    </span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {chapterViews.map((ch) => (
                  <ChapterGroup
                    key={ch.nombre}
                    chapter={ch}
                    projectId={id}
                    areaInt={areaInt}
                    months={mesesCols}
                    snapshotByMonth={snapshotByMonth}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-nauka-dark text-white">
                  <td className="px-4 py-3 font-semibold" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatMXN0(totalBase)}
                  </td>
                  {mesesCols.map((m) => (
                    <td
                      key={m.id}
                      className="px-4 py-3 text-right font-semibold"
                    >
                      {formatMXN0(
                        partidaViews.reduce(
                          (a, p) =>
                            a + (snapshotByMonth.get(m.id)?.get(p.id) ?? 0),
                          0,
                        ),
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatMXN0(total)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    <DifBadge dif={totalDif} onDark />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {costoM2 != null ? formatMXN0(costoM2) : "—"}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>

          {mesesOpen ? (
            <p className="text-sm text-muted-foreground">
              Cada columna de mes es la foto congelada del total vigente por
              partida al cerrar ese mes (incluye el mes actual si ya está
              cerrado);{" "}
              <span className="font-medium text-nauka-dark">PPTO Vigente</span>{" "}
              es el total vivo de hoy. Conceptos nuevos aparecen en $0 en los
              meses previos a su captura. Cuadra con el corte mensual (modo
              Evolución).
            </p>
          ) : null}

          {/* Pie: $/m² interior + USD/m² (spec §6). */}
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
            <span>
              $/m² interior:{" "}
              <span className="font-medium tabular-nums text-nauka-dark">
                {costoM2 != null ? formatMXN0(costoM2) : "—"}
              </span>
              {areaInt
                ? ` · área interior ${areaFormatter.format(areaInt)} m²`
                : " · área interior —"}
            </span>
            <span>
              USD/m²:{" "}
              <span className="font-medium tabular-nums text-nauka-dark">
                {usdM2 != null ? formatUSD0(usdM2) : "—"}
              </span>
              {usdRate ? ` · TC ${usdRate}` : " · TC —"}
            </span>
          </div>

          {/* Leyenda: el Estado son 2 ejes con % (madurez arriba · contratación abajo). */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <EstadoCell ppto={60} contratado={70} total={100} />
            <span>
              Estado · 2 ejes con %:{" "}
              <span className="font-medium text-nauka-dark">arriba</span>{" "}
              madurez (la barra verde = % en Ppto, el resto Paramétrico),{" "}
              <span className="font-medium text-nauka-dark">abajo</span>{" "}
              contratación (barra verde = % Contratado, el resto No contratado).
              Los % cuadran con el modo{" "}
              <span className="font-medium text-nauka-dark">Contratación</span>.
            </span>
          </div>
        </>
      )}
    </div>
  )
}

/** Agrupa las partidas por capítulo (orden de capítulos) + rollup del capítulo.
 *  Las que no empaten con un capítulo conocido caen en "Sin capítulo". */
function groupByChapter(
  chapters: string[],
  partidaViews: PartidaView[],
): ChapterView[] {
  const known = new Set(chapters)
  const build = (nombre: string, list: PartidaView[]): ChapterView => {
    const total = list.reduce((a, p) => a + p.agg.total, 0)
    const base = list.reduce((a, p) => a + p.base, 0)
    const count = list.reduce((a, p) => a + p.agg.count, 0)
    return {
      nombre,
      partidas: list,
      total,
      base,
      count,
      dif: count === 0 ? null : difPct(total, base),
    }
  }
  const groups = chapters.map((ch) =>
    build(
      ch,
      partidaViews.filter((p) => p.chapterDefault === ch),
    ),
  )
  const sinCap = partidaViews.filter(
    (p) => !p.chapterDefault || !known.has(p.chapterDefault),
  )
  if (sinCap.length > 0) groups.push(build("Sin capítulo", sinCap))
  return groups
}

// --- fila de capítulo + sus partidas + subtotal -----------------------------

function ChapterGroup({
  chapter,
  projectId,
  areaInt,
  months,
  snapshotByMonth,
}: {
  chapter: ChapterView
  projectId: string
  areaInt: number | null
  months: EvoMonth[]
  snapshotByMonth: Map<string, Map<string, number>>
}) {
  const perM2 = (v: number) => (areaInt ? formatMXN0(v / areaInt) : "—")
  const snap = (monthId: string, partidaId: string) =>
    snapshotByMonth.get(monthId)?.get(partidaId) ?? 0
  return (
    <Fragment>
      <tr className="bg-nauka-subtle">
        <td
          colSpan={8 + months.length}
          className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-nauka-dark"
        >
          {chapter.nombre}
        </td>
      </tr>
      {chapter.partidas.length === 0 ? (
        <tr className="border-b border-nauka-subtle">
          <td
            colSpan={8 + months.length}
            className="px-4 py-3 italic text-muted-foreground"
          >
            Sin partidas en este capítulo
          </td>
        </tr>
      ) : (
        chapter.partidas.map((p) => (
          <tr
            key={p.id}
            className="h-12 border-b border-nauka-subtle transition-colors hover:bg-nauka-bg"
          >
            <td className="px-4 py-3">
              <Link
                href={`/proyectos/${projectId}/buyout/partida?partida=${p.id}`}
                className="transition-colors hover:text-nauka-accent"
              >
                {p.nombre}
              </Link>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {proveedorLabel(p.agg.proveedores)}
            </td>
            {/* Ppto Base = solo-lectura aquí; la edición vive en Evolución. */}
            <td className="px-4 py-3 text-right">{formatMXN0(p.base)}</td>
            {months.map((m) => (
              <td
                key={m.id}
                className="px-4 py-3 text-right text-muted-foreground"
              >
                {formatMXN0(snap(m.id, p.id))}
              </td>
            ))}
            <td className="px-4 py-3 text-right font-medium text-nauka-dark">
              {formatMXN0(p.agg.total)}
            </td>
            <td className="px-4 py-3 text-right">
              <DifBadge dif={p.dif} />
            </td>
            <td className="px-4 py-3 text-right text-muted-foreground">
              {perM2(p.agg.total)}
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {p.agg.lastUpdate ? formatDate(p.agg.lastUpdate) : "—"}
            </td>
            <td className="px-4 py-3">
              <EstadoCell
                ppto={p.agg.ppto}
                contratado={p.agg.contratado}
                total={p.agg.total}
              />
            </td>
          </tr>
        ))
      )}
      {/* Subtotal del capítulo: etiqueta a la IZQUIERDA en Concepto, números
          alineados bajo sus columnas (corrige el "Subtotal" mal puesto). */}
      <tr className="border-b border-nauka-subtle bg-nauka-bg/60">
        <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Subtotal {chapter.nombre}
        </td>
        <td className="px-4 py-2.5" />
        <td className="px-4 py-2.5 text-right font-medium">
          {formatMXN0(chapter.base)}
        </td>
        {months.map((m) => (
          <td
            key={m.id}
            className="px-4 py-2.5 text-right font-medium text-muted-foreground"
          >
            {formatMXN0(
              chapter.partidas.reduce((a, p) => a + snap(m.id, p.id), 0),
            )}
          </td>
        ))}
        <td className="px-4 py-2.5 text-right font-semibold text-nauka-dark">
          {formatMXN0(chapter.total)}
        </td>
        <td className="px-4 py-2.5 text-right font-medium">
          <DifBadge dif={chapter.dif} />
        </td>
        <td className="px-4 py-2.5 text-right font-medium">
          {perM2(chapter.total)}
        </td>
        <td className="px-4 py-2.5" />
        <td className="px-4 py-2.5" />
      </tr>
    </Fragment>
  )
}

// --- helpers de presentación ------------------------------------------------

function proveedorLabel(provs: string[]): string {
  if (provs.length === 0) return "—"
  if (provs.length === 1) return provs[0]
  return "Varios"
}

// Estado: 2 mini-barras de % por eje (madurez · contratación). El % reusa las
// cubetas del rollup (p.agg: ppto/contratado/total) — % = cubeta ÷ total —
// anclando ppto/contratado y derivando el complemento, IDÉNTICO al modo
// Contratación (contratacion-table.tsx → estadoPcts) para que los números
// CUADREN. Verde (relleno) = Ppto/Contratado; gris (track) = Paramétrico/No
// contratado. total ≤ 0 → placeholder neutro "—" (sin barras).
const ESTADO_PLACEHOLDER_CLS =
  "inline-flex items-center gap-1.5 text-xs leading-none text-nauka-neutral"

/** Mini-barra de un eje: % verde (success) sobre track gris (subtle). */
function EjeBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-nauka-subtle">
      <div
        className="h-full rounded-full bg-nauka-success"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

/** Fila de un eje: barra + etiqueta. 100% en un estado → solo ese (sin "·"). */
function EjeRow({
  pct,
  domLabel,
  restoAbbr,
  restoFull,
}: {
  pct: number
  /** Estado "verde" (dominante de la barra): "Ppto" / "Contratado". */
  domLabel: string
  /** Abreviación del resto en modo mezcla: "Param." / "No". */
  restoAbbr: string
  /** Nombre completo del resto cuando está al 100%: "Paramétrico" / "No contratado". */
  restoFull: string
}) {
  const resto = 100 - pct
  const text =
    pct === 100
      ? `${domLabel} 100%`
      : pct === 0
        ? `${restoFull} 100%`
        : `${domLabel} ${pct}% · ${restoAbbr} ${resto}%`
  return (
    <div className="flex items-center gap-2">
      <EjeBar pct={pct} />
      <span className="whitespace-nowrap text-[11px] leading-none text-muted-foreground tabular-nums">
        {text}
      </span>
    </div>
  )
}

/**
 * Estado de 2 ejes con % (spec §6): madurez arriba (Ppto vs Paramétrico) ·
 * contratación abajo (Contratado vs No contratado). El % de cada eje sale de las
 * cubetas del rollup (cubeta ÷ total), con la MISMA fórmula del modo Contratación
 * → los números cuadran. total ≤ 0 → "—".
 */
function EstadoCell({
  ppto,
  contratado,
  total,
}: {
  ppto: number
  contratado: number
  total: number
}) {
  if (!(total > 0)) {
    return (
      <span className={ESTADO_PLACEHOLDER_CLS}>
        <span className="size-2 shrink-0 rounded-full border border-nauka-neutral/50" />
        —
      </span>
    )
  }
  const pptoPct = Math.round((ppto / total) * 100)
  const contratadoPct = Math.round((contratado / total) * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <EjeRow
        pct={pptoPct}
        domLabel="Ppto"
        restoAbbr="Param."
        restoFull="Paramétrico"
      />
      <EjeRow
        pct={contratadoPct}
        domLabel="Contratado"
        restoAbbr="No"
        restoFull="No contratado"
      />
    </div>
  )
}
