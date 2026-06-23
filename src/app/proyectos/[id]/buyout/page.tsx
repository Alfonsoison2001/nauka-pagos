import { notFound } from "next/navigation"
import { Fragment } from "react"
import { createClient } from "@/lib/supabase/server"
import { formatMXN } from "@/lib/utils"

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

type Chapter = { id: string; nombre: string }
type Partida = { id: string; nombre: string; chapter_default: string | null }

/**
 * Resumen (tablero BUY OUT) — Slice 2a: ARMAZÓN. Renderiza la ESTRUCTURA real
 * del tablero (capítulos del proyecto + partidas del catálogo, agrupadas) con
 * las columnas del spec §6. Como aún NO hay cotizaciones cargadas (eso es el
 * importador del Slice 2b), todos los montos, $/m² y totales salen en cero y las
 * columnas no-monetarias (Proveedor, Dif, Estado) van vacías ("—").
 */
export default async function BuyoutResumenPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sb = await createClient()

  const { data: project } = await sb
    .from("projects")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!project) notFound()

  // Lecturas de las tablas buyout_* (catálogos sembrados en el Slice 1). Las
  // transaccionales (item/quote/line) están vacías → todo a cero.
  const [chapterRes, partidaRes, metaRes, fxRes] = await Promise.all([
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
  ])

  const chapters: Chapter[] = (chapterRes.data ?? []).map((c) => ({
    id: c.id as string,
    nombre: c.nombre as string,
  }))
  const partidas: Partida[] = (partidaRes.data ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    chapter_default: (p.chapter_default as string | null) ?? null,
  }))
  const areaInt =
    metaRes.data?.area_int != null ? Number(metaRes.data.area_int) : null
  const usdRate =
    Number((fxRes.data ?? []).find((f) => f.currency === "USD")?.rate ?? 0) ||
    null

  // Agrupa partidas del catálogo por su capítulo por defecto (texto → nombre del
  // capítulo del proyecto). Las que no empaten caen en un bucket aparte.
  const byChapter = new Map<string, Partida[]>()
  const chapterNames = new Set(chapters.map((c) => c.nombre))
  const sinCapitulo: Partida[] = []
  for (const p of partidas) {
    if (p.chapter_default && chapterNames.has(p.chapter_default)) {
      const list = byChapter.get(p.chapter_default) ?? []
      list.push(p)
      byChapter.set(p.chapter_default, list)
    } else {
      sinCapitulo.push(p)
    }
  }

  // Slice 2a: sin cotizaciones, todo es cero.
  const total = 0
  const costoM2 = areaInt ? total / areaInt : 0
  const usdM2 = areaInt && usdRate ? total / usdRate / areaInt : 0

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

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-nauka-card-border bg-white p-3 text-sm text-muted-foreground">
        Estructura del tablero Buy-Out. Aún no hay cotizaciones cargadas — se
        importan en el siguiente paso (Slice 2b). Totales y $/m² en cero.
      </div>

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
              <th className="px-3 py-2.5 text-left">Última actualización</th>
              <th className="px-3 py-2.5 text-left">
                Estado{" "}
                <span className="font-normal normal-case tracking-normal text-white/40">
                  (madurez · contratación)
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((ch) => (
              <ChapterGroup
                key={ch.id}
                nombre={ch.nombre}
                partidas={byChapter.get(ch.nombre) ?? []}
              />
            ))}
            {sinCapitulo.length > 0 ? (
              <ChapterGroup nombre="Sin capítulo" partidas={sinCapitulo} />
            ) : null}
          </tbody>
          <tfoot>
            <tr className="bg-nauka-dark text-white">
              <td className="px-3 py-2.5 font-semibold" colSpan={2}>
                TOTAL
              </td>
              <td className="px-3 py-2.5 text-right font-semibold">
                {formatMXN(total)}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold">
                {formatMXN(total)}
              </td>
              <td className="px-3 py-2.5 text-right text-white/50">—</td>
              <td className="px-3 py-2.5 text-right font-semibold">
                {formatMXN(costoM2)}
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
            {formatMXN(costoM2)}
          </span>
          {areaInt
            ? ` · área interior ${areaFormatter.format(areaInt)} m²`
            : " · área interior —"}
        </span>
        <span>
          USD/m²:{" "}
          <span className="font-medium tabular-nums text-nauka-dark">
            {usdFormatter.format(usdM2)}
          </span>
          {usdRate ? ` · TC ${usdRate}` : " · TC —"}
        </span>
      </div>

      {/* Leyenda: el Estado son 2 ejes (vacíos en el armazón; con datos = Slice 4). */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <EstadoSlots />
        <span>
          Estado · 2 ejes:{" "}
          <span className="font-medium text-nauka-dark">arriba</span> madurez
          (Paramétrico / Ppto),{" "}
          <span className="font-medium text-nauka-dark">abajo</span>{" "}
          contratación (Contratado / No contratado). Sin datos aún (Slice 4).
        </span>
      </div>
    </div>
  )
}

/** Cabecera de capítulo + sus partidas (vacías) + fila de subtotal en cero. */
function ChapterGroup({
  nombre,
  partidas,
}: {
  nombre: string
  partidas: Partida[]
}) {
  return (
    <Fragment>
      <tr className="bg-nauka-subtle">
        <td
          colSpan={8}
          className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-nauka-dark"
        >
          {nombre}
        </td>
      </tr>
      {partidas.length === 0 ? (
        <tr className="border-b border-nauka-subtle">
          <td colSpan={8} className="px-3 py-2 italic text-muted-foreground">
            Sin partidas en este capítulo
          </td>
        </tr>
      ) : (
        partidas.map((p) => (
          <tr
            key={p.id}
            className="border-b border-nauka-subtle hover:bg-nauka-bg"
          >
            <td className="px-3 py-2">{p.nombre}</td>
            <td className="px-3 py-2 text-muted-foreground">—</td>
            <td className="px-3 py-2 text-right">{formatMXN(0)}</td>
            <td className="px-3 py-2 text-right">{formatMXN(0)}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">—</td>
            <td className="px-3 py-2 text-right">{formatMXN(0)}</td>
            <td className="px-3 py-2 text-muted-foreground">—</td>
            <td className="px-3 py-2">
              <EstadoSlots />
            </td>
          </tr>
        ))
      )}
      <tr className="border-b border-nauka-subtle">
        <td
          colSpan={2}
          className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Subtotal {nombre}
        </td>
        <td className="px-3 py-2 text-right font-medium">{formatMXN(0)}</td>
        <td className="px-3 py-2 text-right font-medium">{formatMXN(0)}</td>
        <td className="px-3 py-2" />
        <td className="px-3 py-2 text-right font-medium">{formatMXN(0)}</td>
        <td className="px-3 py-2" />
        <td className="px-3 py-2" />
      </tr>
    </Fragment>
  )
}

const ESTADO_SLOT_CLS =
  "inline-flex h-5 w-fit shrink-0 items-center rounded-full border border-dashed border-nauka-neutral/50 px-2 text-[11px] font-medium leading-none text-nauka-neutral"

/**
 * Estado como 2 ejes independientes (spec §6): madurez (arriba: Paramétrico /
 * Ppto) + contratación (abajo: Contratado / No contratado). En el Slice 2a van
 * VACÍOS (placeholder neutro dashed); con datos (Slice 4) cada slot toma su
 * badge/etiqueta con color (mismo patrón que estatus-badge.tsx).
 */
function EstadoSlots() {
  return (
    <div className="flex flex-col gap-1">
      <span className={ESTADO_SLOT_CLS}>—</span>
      <span className={ESTADO_SLOT_CLS}>—</span>
    </div>
  )
}
