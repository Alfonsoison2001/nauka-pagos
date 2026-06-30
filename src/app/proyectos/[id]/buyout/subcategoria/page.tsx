import { ArrowLeft, ChevronRight, FileClock } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { isAdmin } from "@/lib/auth/roles"
import {
  type ConceptoIndexRow,
  type ItemHistory,
  loadConceptoIndex,
  loadItemHistory,
  type QuoteVersion,
} from "@/lib/buyout/history"
import { loadPagosLinkInfo, type PagosLinkInfo } from "@/lib/buyout/pagos-link"
import { formatDate } from "@/lib/format/fecha"
import { createClient } from "@/lib/supabase/server"
import { cn, formatMXN } from "@/lib/utils"
import { DifText } from "../dif-text"
import type { CurrencyOption } from "../partida/actions"
import { BuyoutPdfCell } from "../partida/buyout-pdf-cell"
import { ContratoPagosPanel } from "./contrato-pagos-panel"
import { MarcarVigenteButton } from "./marcar-vigente-button"

export const metadata = { title: "Buy-Out · Subcategoría" }

/**
 * Subcategoría (historial de pptos) — SPEC-buyout.md §6.3. Con `?item=` muestra
 * TODAS las versiones (buyout_quote) de un concepto por fecha desc, la vigente
 * resaltada, comparativo de montos y la acción admin "Marcar vigente". Sin `?item=`
 * muestra el índice de conceptos para elegir uno.
 */
export default async function BuyoutSubcategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ item?: string }>
}) {
  const { id } = await params
  const { item: itemId } = await searchParams
  const sb = await createClient()

  const { data: project } = await sb
    .from("projects")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!project) notFound()

  const admin = await isAdmin()
  const { data: fxRows } = await sb
    .from("buyout_fx")
    .select("currency, rate")
    .eq("project_id", id)
    .is("deleted_at", null)
  const fxList: CurrencyOption[] = (fxRows ?? []).map((c) => ({
    currency: c.currency as string,
    rate: Number(c.rate),
  }))

  if (itemId) {
    const history = await loadItemHistory(sb, id, itemId, fxList)
    if (!history) return <ConceptoNoEncontrado projectId={id} />
    const vigente = history.versions.find((v) => v.isSelected) ?? null
    const pagosLink = vigente
      ? await loadPagosLinkInfo(sb, vigente.pagosPartidaId)
      : null
    return (
      <HistoryView
        projectId={id}
        history={history}
        admin={admin}
        vigente={vigente}
        pagosLink={pagosLink}
      />
    )
  }

  // Índice de conceptos (sin uno elegido) → agrupado por partida (orden de catálogo).
  const { data: partidaRows } = await sb
    .from("buyout_partida_catalog")
    .select("id, nombre")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("orden")
  const partidas = (partidaRows ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
  }))
  const partidaNombreById = new Map(partidas.map((p) => [p.id, p.nombre]))
  const index = await loadConceptoIndex(sb, id, fxList, partidaNombreById)
  return <IndexView projectId={id} partidas={partidas} index={index} />
}

// --- Vista de historial de un concepto --------------------------------------

function HistoryView({
  projectId,
  history,
  admin,
  vigente,
  pagosLink,
}: {
  projectId: string
  history: ItemHistory
  admin: boolean
  vigente: QuoteVersion | null
  pagosLink: PagosLinkInfo | null
}) {
  const { versions } = history
  const sola = versions.length <= 1
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href={`/proyectos/${projectId}/buyout/partida?partida=${history.partidaCatalogId}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-nauka-dark"
        >
          <ArrowLeft className="size-4" />
          Volver a {history.partidaNombre || "la partida"}
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-semibold text-nauka-dark">
            {history.concepto || "Concepto"}
          </h2>
          <Link
            href={`/proyectos/${projectId}/buyout/subcategoria`}
            className="text-sm text-muted-foreground underline-offset-3 hover:underline"
          >
            Todos los conceptos
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          {history.partidaNombre} ·{" "}
          {versions.length === 0
            ? "sin versiones"
            : `${versions.length} ${versions.length === 1 ? "versión" : "versiones"}`}
          . La cotización <span className="font-medium">vigente</span> es la que
          usan el Resumen y la Partida.
        </p>
      </div>

      {vigente ? (
        <ContratoPagosPanel
          projectId={projectId}
          itemId={history.itemId}
          admin={admin}
          contratado={vigente.contratado}
          link={pagosLink}
          staleLink={Boolean(vigente.pagosPartidaId) && !pagosLink}
          conceptoNombre={history.concepto}
          proveedor={vigente.proveedor}
          totalMxn={vigente.totalMxn}
        />
      ) : null}

      {versions.length === 0 ? (
        <EmptyBox
          titulo="Este concepto aún no tiene cotizaciones."
          detalle="Captura la primera desde la pantalla Partida."
        />
      ) : (
        <>
          <ComparativoVigente versions={versions} />
          <VersionsTable
            projectId={projectId}
            itemId={history.itemId}
            versions={versions}
            admin={admin}
          />
          {sola ? (
            <p className="rounded-xl border border-dashed border-nauka-card-border bg-white px-4 py-3 text-sm text-muted-foreground">
              Solo hay <span className="font-medium text-nauka-dark">una</span>{" "}
              versión (la vigente). Cuando uses{" "}
              <span className="font-medium text-nauka-dark">
                ↻ Actualizar presupuesto
              </span>{" "}
              en la Partida, cada nueva versión fechada aparecerá aquí para
              comparar.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

function VersionsTable({
  projectId,
  itemId,
  versions,
  admin,
}: {
  projectId: string
  itemId: string
  versions: QuoteVersion[]
  admin: boolean
}) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      <table className="w-full whitespace-nowrap text-sm tabular-nums">
        <thead className="sticky top-0 z-10">
          <tr className="bg-nauka-dark text-xs uppercase tracking-wider text-white/70">
            <th className="px-3 py-2.5 text-left">Fecha</th>
            <th className="px-3 py-2.5 text-left">Proveedor</th>
            <th className="px-3 py-2.5 text-left">Moneda</th>
            <th className="px-3 py-2.5 text-right">Monto sin IVA</th>
            <th className="px-3 py-2.5 text-right">Total MXN</th>
            <th className="px-3 py-2.5 text-right">Δ vs anterior</th>
            <th className="px-3 py-2.5 text-left">Estado</th>
            <th className="px-3 py-2.5 text-left">PDF</th>
            <th className="px-3 py-2.5 text-right">Vigente</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v, i) => {
            const anterior = versions[i + 1]
            const delta = anterior ? v.totalMxn - anterior.totalMxn : null
            return (
              <VersionRow
                key={v.quoteId}
                projectId={projectId}
                itemId={itemId}
                version={v}
                delta={delta}
                admin={admin}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function VersionRow({
  projectId,
  itemId,
  version: v,
  delta,
  admin,
}: {
  projectId: string
  itemId: string
  version: QuoteVersion
  delta: number | null
  admin: boolean
}) {
  return (
    <tr
      className={cn(
        "border-b border-nauka-subtle",
        v.isSelected ? "bg-emerald-50/70" : "hover:bg-nauka-bg",
      )}
    >
      <td className="px-3 py-2.5">{formatDate(v.quoteDate)}</td>
      <td className="px-3 py-2.5 font-medium">{v.proveedor || "—"}</td>
      <td className="px-3 py-2.5">{v.moneda}</td>
      <td className="px-3 py-2.5 text-right">{formatMXN(v.montoSinIva)}</td>
      <td className="px-3 py-2.5 text-right font-medium text-nauka-dark">
        {formatMXN(v.totalMxn)}
      </td>
      <td className="px-3 py-2.5 text-right">
        <DeltaCell delta={delta} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-col gap-1">
          <MaturityPill kind={v.kind} />
          <ContratacionPill contratado={v.contratado} />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <BuyoutPdfCell pdfPath={v.pdfPath} />
      </td>
      <td className="px-3 py-2.5 text-right">
        {v.isSelected ? (
          <VigenteBadge />
        ) : admin ? (
          <MarcarVigenteButton
            projectId={projectId}
            itemId={itemId}
            quoteId={v.quoteId}
            etiqueta={`${v.proveedor || "Sin proveedor"} · ${formatDate(v.quoteDate)}`}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}

// --- Comparativo vigente vs versiones anteriores ----------------------------

/**
 * Vista de COMPARACIÓN del historial: la versión VIGENTE destacada como referencia
 * y, frente a cada versión anterior, su diferencia de Total MXN (Δ) y Δ% — para ver
 * de un vistazo cuánto cambió el ppto respecto a las previas. Δ = vigente − versión:
 * verde si el vigente quedó más barato, rojo si más caro (misma convención que el
 * resto del módulo). Es solo informativo; NO toca "Marcar vigente". Devuelve null si
 * no hay vigente o no hay versiones anteriores (una sola versión → nada que comparar).
 */
function ComparativoVigente({ versions }: { versions: QuoteVersion[] }) {
  const vigente = versions.find((v) => v.isSelected)
  const previas = versions.filter((v) => !v.isSelected)
  if (!vigente || previas.length === 0) return null
  return (
    <section className="overflow-hidden rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-nauka-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-nauka-dark">
          Comparativo vs vigente
        </h3>
        <p className="text-xs text-muted-foreground">
          Δ = cuánto cambia el ppto vigente frente a cada versión anterior
          (verde = el vigente quedó más barato · rojo = más caro).
        </p>
      </header>
      {/* Vigente = referencia destacada. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-emerald-50/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <VigenteBadge />
          <span className="truncate text-sm font-medium text-nauka-dark">
            {vigente.proveedor || "Sin proveedor"}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDate(vigente.quoteDate)}
          </span>
        </div>
        <span className="shrink-0 text-base font-semibold tabular-nums text-nauka-dark">
          {formatMXN(vigente.totalMxn)}
        </span>
      </div>
      {/* Cada versión anterior, con su Δ frente al vigente. */}
      <ul className="divide-y divide-nauka-subtle">
        {previas.map((v) => (
          <ComparativoRow key={v.quoteId} vigente={vigente} version={v} />
        ))}
      </ul>
    </section>
  )
}

function ComparativoRow({
  vigente,
  version: v,
}: {
  vigente: QuoteVersion
  version: QuoteVersion
}) {
  const deltaMxn = vigente.totalMxn - v.totalMxn
  const deltaPct = v.totalMxn > 0 ? vigente.totalMxn / v.totalMxn - 1 : null
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-0.5 px-4 py-2.5">
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-sm text-nauka-dark">
          {v.proveedor || "Sin proveedor"}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDate(v.quoteDate)}
        </span>
      </div>
      <span className="w-36 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {formatMXN(v.totalMxn)}
      </span>
      <span className="w-32 shrink-0 text-right text-sm tabular-nums">
        <DeltaCell delta={deltaMxn} />
      </span>
      <span className="w-16 shrink-0 text-right text-sm tabular-nums">
        <DifText dif={deltaPct} />
      </span>
    </li>
  )
}

// --- Índice de conceptos (sin uno elegido) ----------------------------------

function IndexView({
  projectId,
  partidas,
  index,
}: {
  projectId: string
  partidas: { id: string; nombre: string }[]
  index: ConceptoIndexRow[]
}) {
  const groups = partidas
    .map((p) => ({
      nombre: p.nombre,
      rows: index.filter((r) => r.partidaCatalogId === p.id),
    }))
    .filter((g) => g.rows.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-nauka-dark">
          Historial de pptos
        </h2>
        <p className="text-sm text-muted-foreground">
          Elige un concepto para ver todas sus versiones de cotización. También
          puedes entrar desde “Ver historial” en cada fila de una Partida.
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyBox
          titulo="Aún no hay conceptos con cotizaciones."
          detalle="Captura el primer concepto desde la pantalla Partida."
        />
      ) : (
        groups.map((g) => (
          <div
            key={g.nombre}
            className="overflow-hidden rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card"
          >
            <div className="border-b border-nauka-subtle bg-nauka-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wider text-nauka-dark">
              {g.nombre}
            </div>
            <ul>
              {g.rows.map((r) => (
                <li key={r.itemId}>
                  <Link
                    href={`/proyectos/${projectId}/buyout/subcategoria?item=${r.itemId}`}
                    className="flex items-center gap-3 border-b border-nauka-subtle px-3 py-2.5 last:border-b-0 hover:bg-nauka-bg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-nauka-dark">
                        {r.concepto}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.proveedor || "Sin proveedor"} · {r.versions}{" "}
                        {r.versions === 1 ? "versión" : "versiones"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <MaturityPill kind={r.kind} />
                    </div>
                    <span className="shrink-0 text-right font-medium tabular-nums text-nauka-dark">
                      {formatMXN(r.totalMxn)}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}

// --- helpers de presentación ------------------------------------------------

function ConceptoNoEncontrado({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-col gap-4">
      <EmptyBox
        titulo="Concepto no encontrado."
        detalle="Puede que se haya eliminado o no pertenezca a este proyecto."
      />
      <Link
        href={`/proyectos/${projectId}/buyout/subcategoria`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-nauka-dark"
      >
        <ArrowLeft className="size-4" />
        Todos los conceptos
      </Link>
    </div>
  )
}

function EmptyBox({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-nauka-card-border bg-white p-10 text-center">
      <FileClock className="mx-auto size-8 text-nauka-neutral" />
      <p className="mt-3 text-sm font-medium text-nauka-dark">{titulo}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detalle}</p>
    </div>
  )
}

function DeltaCell({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-muted-foreground">—</span>
  if (Math.abs(delta) < 0.005)
    return <span className="text-muted-foreground">=</span>
  const up = delta > 0
  return (
    <span className={up ? "text-red-600" : "text-emerald-600"}>
      {up ? "+" : "−"}
      {formatMXN(Math.abs(delta))}
    </span>
  )
}

const PILL =
  "inline-flex h-5 w-fit items-center rounded-full px-2 text-[11px] font-medium leading-none"

function MaturityPill({ kind }: { kind: "parametrico" | "ppto" }) {
  return (
    <span
      className={cn(
        PILL,
        kind === "ppto"
          ? "bg-green-100 text-green-700"
          : "bg-amber-100 text-amber-700",
      )}
    >
      {kind === "ppto" ? "Ppto" : "Paramétrico"}
    </span>
  )
}

function ContratacionPill({ contratado }: { contratado: boolean }) {
  return (
    <span
      className={cn(
        PILL,
        contratado
          ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-600",
      )}
    >
      {contratado ? "Contratado" : "No contratado"}
    </span>
  )
}

function VigenteBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
      Vigente
    </span>
  )
}
