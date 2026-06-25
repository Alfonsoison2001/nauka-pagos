import Link from "next/link"
import { notFound } from "next/navigation"
import { Fragment } from "react"
import { isAdmin } from "@/lib/auth/roles"
import {
  currentPeriodo,
  loadClosedMonths,
  loadSnapshots,
  periodoLabel,
  periodoShort,
} from "@/lib/buyout/month-close"
import {
  aggregateLines,
  type Contratacion,
  difPct,
  loadPartidaAggs,
  type Maturity,
  type PartidaAgg,
} from "@/lib/buyout/rollup"
import { formatDate } from "@/lib/format/fecha"
import { createClient } from "@/lib/supabase/server"
import { cn, formatMXN } from "@/lib/utils"
import { BaseCell } from "./base-cell"
import { CerrarMesButton } from "./cerrar-mes-button"
import { DifText } from "./dif-text"
import { type EvoChapter, EvolucionTable } from "./evolucion-table"
import { type ResumenMode, ResumenModeToggle } from "./resumen-mode-toggle"

export const metadata = { title: "Buy-Out · Resumen" }

const usdFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})
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
 * Ppto Base (editable), Ppto vigente, DIF (vigente ÷ base − 1), $/m², última
 * actualización y el Estado agregado (madurez · contratación). $/m² + USD/m² al
 * pie. Misma fuente de datos que las tarjetas de Partida → nunca difieren.
 */
export default async function BuyoutResumenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ modo?: string }>
}) {
  const { id } = await params
  const { modo: modoParam } = await searchParams
  const modo: ResumenMode = modoParam === "evolucion" ? "evolucion" : "vigente"
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

  // Cierre mensual / Evolución (SPEC §6): meses cerrados + fotos congeladas.
  // El mes EN CURSO se muestra siempre en UNA sola columna (su total vivo). Si ya
  // está cerrado, esa columna lleva "cerrado ✓" en vez de duplicarse con su foto; y
  // si el vivo difiere de la foto (se editó tras cerrar), se marca "desactualizado".
  const periodoActual = currentPeriodo()
  const closedMonths = await loadClosedMonths(sb, id)
  const currentClose = closedMonths.find((m) => m.periodo === periodoActual)
  const currentClosed = currentClose != null
  // Columnas congeladas = meses cerrados ANTERIORES (el en curso se colapsa abajo).
  const frozenMonths = closedMonths.filter((m) => m.periodo !== periodoActual)
  const evoMonths = frozenMonths.map((m) => ({
    id: m.id,
    periodo: m.periodo,
    label: periodoLabel(m.periodo),
    short: periodoShort(m.periodo),
  }))
  const snapshotByMonth =
    modo === "evolucion"
      ? await loadSnapshots(
          sb,
          closedMonths.map((m) => m.id),
        )
      : new Map<string, Map<string, number>>()
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
  // ¿La foto del mes en curso quedó desfasada vs el total vivo de hoy? (drift por
  // partida: alguna difiere → la columna en curso se marca "desactualizado".)
  const currentSnap = currentClose
    ? snapshotByMonth.get(currentClose.id)
    : undefined
  const enCursoDrift = currentClosed
    ? evoChapters.some((ch) =>
        ch.partidas.some(
          (p) => Math.abs(p.total - (currentSnap?.get(p.id) ?? 0)) > 0.005,
        ),
      )
    : false
  const enCurso = {
    label: periodoLabel(periodoActual, !currentClosed),
    closed: currentClosed,
    drift: enCursoDrift,
    periodo: periodoActual,
    short: periodoShort(periodoActual),
  }

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
            months={evoMonths}
            snapshotByMonth={snapshotByMonth}
            enCurso={enCurso}
            totalBase={totalBase}
            total={total}
            totalDif={totalDif}
            admin={admin}
          />
          <p className="text-sm text-muted-foreground">
            Cada columna de mes es la foto congelada del total vigente por
            partida al cerrarlo;{" "}
            <span className="font-medium text-nauka-dark">{enCurso.label}</span>{" "}
            es el total vivo de hoy
            {enCurso.closed
              ? " (ya cerrado: la foto y el vivo van en una sola columna; si difieren, se marca “desactualizado” y puedes Actualizar foto)"
              : ""}
            . Dif compara el Ppto Base contra el mes más reciente (el en curso).
            Donde un mes no tenía una partida, se muestra $0 para alinear la
            rejilla.
          </p>
        </>
      ) : (
        <>
          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
            <table className="w-full text-sm tabular-nums">
              <thead className="sticky top-0 z-10">
                <tr className="bg-nauka-dark text-xs uppercase tracking-wider text-white/70">
                  <th className="px-3 py-2.5 text-left">Concepto</th>
                  <th className="px-3 py-2.5 text-left">Proveedor</th>
                  <th className="px-3 py-2.5 text-right">Ppto Base</th>
                  <th className="px-3 py-2.5 text-right">Ppto</th>
                  <th className="px-3 py-2.5 text-right">Dif</th>
                  <th className="px-3 py-2.5 text-right">$/m²</th>
                  <th className="px-3 py-2.5 text-left">
                    Última actualización
                  </th>
                  <th className="px-3 py-2.5 text-left">
                    Estado{" "}
                    <span className="font-normal normal-case tracking-normal text-white/40">
                      (madurez · contratación)
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {chapterViews.map((ch) => (
                  <ChapterGroup
                    key={ch.nombre}
                    chapter={ch}
                    projectId={id}
                    areaInt={areaInt}
                    admin={admin}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-nauka-dark text-white">
                  <td className="px-3 py-2.5 font-semibold" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">
                    {formatMXN(totalBase)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">
                    {formatMXN(total)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">
                    <DifText dif={totalDif} onDark />
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">
                    {costoM2 != null ? formatMXN(costoM2) : "—"}
                  </td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pie: $/m² interior + USD/m² (spec §6). */}
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
            <span>
              $/m² interior:{" "}
              <span className="font-medium tabular-nums text-nauka-dark">
                {costoM2 != null ? formatMXN(costoM2) : "—"}
              </span>
              {areaInt
                ? ` · área interior ${areaFormatter.format(areaInt)} m²`
                : " · área interior —"}
            </span>
            <span>
              USD/m²:{" "}
              <span className="font-medium tabular-nums text-nauka-dark">
                {usdM2 != null ? usdFormatter.format(usdM2) : "—"}
              </span>
              {usdRate ? ` · TC ${usdRate}` : " · TC —"}
            </span>
          </div>

          {/* Leyenda: el Estado son 2 ejes (madurez arriba · contratación abajo). */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <EstadoCell madurez="parcial" contratacion="parcial" />
            <span>
              Estado · 2 ejes:{" "}
              <span className="font-medium text-nauka-dark">arriba</span>{" "}
              madurez (Paramétrico / Ppto / Parcial),{" "}
              <span className="font-medium text-nauka-dark">abajo</span>{" "}
              contratación (Contratado / No contratado / Parcial).{" "}
              <span className="font-medium text-nauka-dark">Parcial</span> = la
              partida mezcla estados entre sus conceptos.
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
  admin,
}: {
  chapter: ChapterView
  projectId: string
  areaInt: number | null
  admin: boolean
}) {
  const perM2 = (v: number) => (areaInt ? formatMXN(v / areaInt) : "—")
  return (
    <Fragment>
      <tr className="bg-nauka-subtle">
        <td
          colSpan={8}
          className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-nauka-dark"
        >
          {chapter.nombre}
        </td>
      </tr>
      {chapter.partidas.length === 0 ? (
        <tr className="border-b border-nauka-subtle">
          <td colSpan={8} className="px-3 py-2 italic text-muted-foreground">
            Sin partidas en este capítulo
          </td>
        </tr>
      ) : (
        chapter.partidas.map((p) => (
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
            <td className="px-3 py-2 text-muted-foreground">
              {proveedorLabel(p.agg.proveedores)}
            </td>
            <td className="px-3 py-2 text-right">
              <BaseCell
                projectId={projectId}
                partidaCatalogId={p.id}
                monto={p.base}
                admin={admin}
              />
            </td>
            <td className="px-3 py-2 text-right">{formatMXN(p.agg.total)}</td>
            <td className="px-3 py-2 text-right">
              <DifText dif={p.dif} />
            </td>
            <td className="px-3 py-2 text-right">{perM2(p.agg.total)}</td>
            <td className="px-3 py-2 text-muted-foreground">
              {p.agg.lastUpdate ? formatDate(p.agg.lastUpdate) : "—"}
            </td>
            <td className="px-3 py-2">
              <EstadoCell
                madurez={p.agg.madurez}
                contratacion={p.agg.contratacion}
              />
            </td>
          </tr>
        ))
      )}
      {/* Subtotal del capítulo: etiqueta a la IZQUIERDA en Concepto, números
          alineados bajo sus columnas (corrige el "Subtotal" mal puesto). */}
      <tr className="border-b border-nauka-subtle bg-nauka-bg/60">
        <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Subtotal {chapter.nombre}
        </td>
        <td className="px-3 py-2" />
        <td className="px-3 py-2 text-right font-medium">
          {formatMXN(chapter.base)}
        </td>
        <td className="px-3 py-2 text-right font-semibold text-nauka-dark">
          {formatMXN(chapter.total)}
        </td>
        <td className="px-3 py-2 text-right font-medium">
          <DifText dif={chapter.dif} />
        </td>
        <td className="px-3 py-2 text-right font-medium">
          {perM2(chapter.total)}
        </td>
        <td className="px-3 py-2" />
        <td className="px-3 py-2" />
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

const ESTADO_SLOT_CLS =
  "inline-flex h-5 w-fit shrink-0 items-center rounded-full px-2 text-[11px] font-medium leading-none"

function MaturityBadge({ value }: { value: Maturity | null }) {
  if (value === null) {
    return (
      <span
        className={cn(
          ESTADO_SLOT_CLS,
          "border border-dashed border-nauka-neutral/50 text-nauka-neutral",
        )}
      >
        —
      </span>
    )
  }
  const map: Record<Maturity, { label: string; cls: string }> = {
    ppto: { label: "Ppto", cls: "bg-green-100 text-green-700" },
    parametrico: { label: "Paramétrico", cls: "bg-amber-100 text-amber-700" },
    parcial: { label: "Parcial", cls: "bg-blue-100 text-blue-700" },
  }
  const { label, cls } = map[value]
  return <span className={cn(ESTADO_SLOT_CLS, cls)}>{label}</span>
}

function ContratacionBadge({ value }: { value: Contratacion | null }) {
  if (value === null) {
    return (
      <span
        className={cn(
          ESTADO_SLOT_CLS,
          "border border-dashed border-nauka-neutral/50 text-nauka-neutral",
        )}
      >
        —
      </span>
    )
  }
  const map: Record<Contratacion, { label: string; cls: string }> = {
    contratado: { label: "Contratado", cls: "bg-green-100 text-green-700" },
    no_contratado: {
      label: "No contratado",
      cls: "bg-slate-100 text-slate-600",
    },
    parcial: { label: "Parcial", cls: "bg-blue-100 text-blue-700" },
  }
  const { label, cls } = map[value]
  return <span className={cn(ESTADO_SLOT_CLS, cls)}>{label}</span>
}

/** Estado de 2 ejes (spec §6): madurez arriba · contratación abajo. */
function EstadoCell({
  madurez,
  contratacion,
}: {
  madurez: Maturity | null
  contratacion: Contratacion | null
}) {
  return (
    <div className="flex flex-col gap-1">
      <MaturityBadge value={madurez} />
      <ContratacionBadge value={contratacion} />
    </div>
  )
}
