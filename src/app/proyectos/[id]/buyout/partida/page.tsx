import { notFound } from "next/navigation"
import { isAdmin } from "@/lib/auth/roles"
import { calcLinea } from "@/lib/buyout/calc"
import { createClient } from "@/lib/supabase/server"
import { cn, formatMXN } from "@/lib/utils"
import type { LineaRow, PartidaOption } from "./actions"
import { BuyoutPdfCell } from "./buyout-pdf-cell"
import { DeleteLineaButton } from "./delete-linea-button"
import { EditLineaButton } from "./edit-linea-button"
import type { Catalogs } from "./linea-dialog"
import { NuevaLineaButton } from "./nueva-linea-button"
import { PartidaSelect } from "./partida-select"

export const metadata = { title: "Buy-Out · Partida" }

// Las 22 columnas del formato verde (B…W) — docs/future-modules/buyout-L3-estructura.md §2.
const GREEN_COLUMNS: { label: string; numeric?: boolean }[] = [
  { label: "CATEGORÍA" },
  { label: "CONCEPTO" },
  { label: "DETALLE" },
  { label: "Villa/Casita" },
  { label: "PISO" },
  { label: "DEPTO" },
  { label: "PROVEEDOR" },
  { label: "UNIDAD" },
  { label: "CANTIDAD", numeric: true },
  { label: "MONEDA" },
  { label: "$ UNITARIO", numeric: true },
  { label: "IMPORTE SIN IVA", numeric: true },
  { label: "SOBRECOSTO", numeric: true },
  { label: "TOTAL SOBRECOSTO", numeric: true },
  { label: "% IVA", numeric: true },
  { label: "$ IVA", numeric: true },
  { label: "IMPORTE TOTAL", numeric: true },
  { label: "T.C", numeric: true },
  { label: "TOTAL MXN", numeric: true },
  { label: "NOTAS" },
  { label: "PARAMETRICO/PPTO" },
  { label: "CONTRATADO/NO CONTRATADO" },
]
const TOTAL_COLS = GREEN_COLUMNS.length + 1 // + columna de acciones

const numberFmt = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const pctLabel = (fraction: number) => `${+(fraction * 100).toFixed(2)}%`

type LineaConCalc = LineaRow & { tc: number; partidaNombre: string }

export default async function BuyoutPartidaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ partida?: string }>
}) {
  const { id } = await params
  const { partida: selectedPartidaId = null } = await searchParams
  const sb = await createClient()

  const { data: project } = await sb
    .from("projects")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!project) notFound()

  const admin = await isAdmin()
  const { data: catRows } = await sb
    .from("buyout_partida_catalog")
    .select("id, nombre")
    .is("deleted_at", null)
    .order("orden")
  const partidas: PartidaOption[] = (catRows ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
  }))
  const partidaNombre =
    partidas.find((p) => p.id === selectedPartidaId)?.nombre ?? ""

  // Catálogos del formulario + líneas de la partida elegida.
  const empty: Catalogs = { suppliers: [], units: [], uoms: [], currencies: [] }
  let catalogs = empty
  let lineas: LineaConCalc[] = []

  if (selectedPartidaId) {
    const [supRes, unitRes, uomRes, fxRes] = await Promise.all([
      sb
        .from("buyout_supplier")
        .select("id, nombre")
        .is("deleted_at", null)
        .order("nombre"),
      sb
        .from("buyout_unit")
        .select("id, nombre")
        .eq("project_id", id)
        .is("deleted_at", null)
        .order("nombre"),
      sb
        .from("buyout_uom")
        .select("codigo, nombre")
        .is("deleted_at", null)
        .order("orden"),
      sb
        .from("buyout_fx")
        .select("currency, rate")
        .eq("project_id", id)
        .is("deleted_at", null),
    ])
    catalogs = {
      suppliers: (supRes.data ?? []).map((s) => ({
        id: s.id as string,
        nombre: s.nombre as string,
      })),
      units: (unitRes.data ?? []).map((u) => ({
        id: u.id as string,
        nombre: u.nombre as string,
      })),
      uoms: (uomRes.data ?? []).map((u) => ({
        codigo: u.codigo as string,
        nombre: u.nombre as string,
      })),
      currencies: (fxRes.data ?? []).map((c) => ({
        currency: c.currency as string,
        rate: Number(c.rate),
      })),
    }
    lineas = await loadLineas(
      sb,
      id,
      selectedPartidaId,
      catalogs,
      partidaNombre,
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-nauka-dark">Partida</span>
          <PartidaSelect
            projectId={id}
            partidas={partidas}
            selected={selectedPartidaId}
          />
        </div>
        {selectedPartidaId && admin ? (
          <NuevaLineaButton
            projectId={id}
            partidaCatalogId={selectedPartidaId}
            catalogs={catalogs}
          />
        ) : null}
      </div>

      {!selectedPartidaId ? (
        <div className="rounded-2xl border border-nauka-card-border bg-white p-12 text-center shadow-nauka-card">
          <p className="text-sm font-medium text-nauka-dark">
            Selecciona una partida.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige una partida del catálogo para capturar y ver sus líneas en el
            formato verde de 22 columnas.
          </p>
        </div>
      ) : (
        <LineasTable
          projectId={id}
          lineas={lineas}
          catalogs={catalogs}
          admin={admin}
        />
      )}
    </div>
  )
}

// --- carga de líneas (item → cotización vigente → renglón) ------------------

type Sb = Awaited<ReturnType<typeof createClient>>

async function loadLineas(
  sb: Sb,
  projectId: string,
  partidaCatalogId: string,
  catalogs: Catalogs,
  partidaNombre: string,
): Promise<LineaConCalc[]> {
  const { data: itemRows } = await sb
    .from("buyout_item")
    .select("id")
    .eq("project_id", projectId)
    .eq("partida_catalog_id", partidaCatalogId)
    .is("deleted_at", null)
  const itemIds = (itemRows ?? []).map((r) => r.id as string)
  if (itemIds.length === 0) return []

  const { data: quoteRows } = await sb
    .from("buyout_quote")
    .select("id, item_id, supplier_id, quote_date, kind, contratado, pdf_url")
    .in("item_id", itemIds)
    .eq("is_selected", true)
    .is("deleted_at", null)
  const quotes = quoteRows ?? []
  const quoteById = new Map(quotes.map((q) => [q.id as string, q]))
  const quoteIds = quotes.map((q) => q.id as string)
  if (quoteIds.length === 0) return []

  const { data: lineRows } = await sb
    .from("buyout_line")
    .select(
      "id, quote_id, concepto, detalle, villa_casita, piso, depto, proveedor, unidad, cantidad, moneda, unitario, sobrecosto_pct, iva_pct, notas",
    )
    .in("quote_id", quoteIds)
    .is("deleted_at", null)
    .order("created_at")

  const rateOf = (cur: string) =>
    catalogs.currencies.find((c) => c.currency === cur)?.rate ?? 1

  return (lineRows ?? []).map((l) => {
    const q = quoteById.get(l.quote_id as string)
    const moneda = (l.moneda as string) ?? "MXN"
    return {
      id: l.id as string,
      quote_id: l.quote_id as string,
      item_id: (q?.item_id as string) ?? "",
      concepto: (l.concepto as string) ?? "",
      detalle: (l.detalle as string | null) ?? null,
      villa_casita: (l.villa_casita as string | null) ?? null,
      piso: (l.piso as string | null) ?? null,
      depto: (l.depto as string | null) ?? null,
      proveedor: (l.proveedor as string | null) ?? null,
      unidad: (l.unidad as string | null) ?? null,
      cantidad: Number(l.cantidad ?? 0),
      moneda,
      unitario: Number(l.unitario ?? 0),
      sobrecosto_pct: Number(l.sobrecosto_pct ?? 0),
      iva_pct: Number(l.iva_pct ?? 0),
      notas: (l.notas as string | null) ?? null,
      kind: (q?.kind as "parametrico" | "ppto") ?? "ppto",
      contratado: Boolean(q?.contratado),
      quote_date: (q?.quote_date as string) ?? "",
      pdf_url: (q?.pdf_url as string | null) ?? null,
      supplier_id: (q?.supplier_id as string | null) ?? null,
      tc: rateOf(moneda),
      partidaNombre,
    }
  })
}

// --- tabla de 22 columnas + acciones ----------------------------------------

function LineasTable({
  projectId,
  lineas,
  catalogs,
  admin,
}: {
  projectId: string
  lineas: LineaConCalc[]
  catalogs: Catalogs
  admin: boolean
}) {
  const totalMxn = lineas.reduce((acc, l) => {
    const c = calcLinea({
      cantidad: l.cantidad,
      unitario: l.unitario,
      sobrecostoPct: l.sobrecosto_pct,
      ivaPct: l.iva_pct,
      tc: l.tc,
    })
    return acc + c.totalMxn
  }, 0)

  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      <table className="w-full whitespace-nowrap text-sm tabular-nums">
        <thead className="sticky top-0 z-10">
          <tr className="bg-nauka-dark text-xs uppercase tracking-wider text-white/70">
            {GREEN_COLUMNS.map((col) => (
              <th
                key={col.label}
                className={cn(
                  "px-3 py-2.5",
                  col.numeric ? "text-right" : "text-left",
                )}
              >
                {col.label}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {lineas.length === 0 ? (
            <tr>
              <td
                colSpan={TOTAL_COLS}
                className="px-3 py-10 text-center text-sm text-muted-foreground"
              >
                Sin líneas. Usa “Agregar línea” para capturar la primera.
              </td>
            </tr>
          ) : (
            lineas.map((l) => (
              <LineaRowCells
                key={l.id}
                projectId={projectId}
                linea={l}
                catalogs={catalogs}
                admin={admin}
              />
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-nauka-subtle bg-nauka-bg text-xs uppercase tracking-wider text-muted-foreground">
            <td colSpan={18} className="px-3 py-2 text-right font-medium">
              Total
            </td>
            <td className="px-3 py-2 text-right font-semibold text-nauka-dark">
              {formatMXN(totalMxn)}
            </td>
            <td colSpan={4} className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function LineaRowCells({
  projectId,
  linea,
  catalogs,
  admin,
}: {
  projectId: string
  linea: LineaConCalc
  catalogs: Catalogs
  admin: boolean
}) {
  const c = calcLinea({
    cantidad: linea.cantidad,
    unitario: linea.unitario,
    sobrecostoPct: linea.sobrecosto_pct,
    ivaPct: linea.iva_pct,
    tc: linea.tc,
  })
  const dash = (v: string | null) => v || "—"

  return (
    <tr className="border-b border-nauka-subtle hover:bg-nauka-bg">
      <td className="px-3 py-2">{dash(linea.partidaNombre)}</td>
      <td className="px-3 py-2 font-medium">{dash(linea.concepto)}</td>
      <td className="px-3 py-2 text-muted-foreground">{dash(linea.detalle)}</td>
      <td className="px-3 py-2">{dash(linea.villa_casita)}</td>
      <td className="px-3 py-2">{dash(linea.piso)}</td>
      <td className="px-3 py-2">{dash(linea.depto)}</td>
      <td className="px-3 py-2">{dash(linea.proveedor)}</td>
      <td className="px-3 py-2">{dash(linea.unidad)}</td>
      <td className="px-3 py-2 text-right">
        {numberFmt.format(linea.cantidad)}
      </td>
      <td className="px-3 py-2">{linea.moneda}</td>
      <td className="px-3 py-2 text-right">
        {numberFmt.format(linea.unitario)}
      </td>
      <td className="px-3 py-2 text-right">
        {numberFmt.format(c.importeSinIva)}
      </td>
      <td className="px-3 py-2 text-right">{pctLabel(linea.sobrecosto_pct)}</td>
      <td className="px-3 py-2 text-right">
        {numberFmt.format(c.totalSobrecosto)}
      </td>
      <td className="px-3 py-2 text-right">{pctLabel(linea.iva_pct)}</td>
      <td className="px-3 py-2 text-right">{numberFmt.format(c.iva)}</td>
      <td className="px-3 py-2 text-right">
        {numberFmt.format(c.importeTotal)}
      </td>
      <td className="px-3 py-2 text-right text-muted-foreground">{linea.tc}</td>
      <td className="px-3 py-2 text-right font-medium">
        {formatMXN(c.totalMxn)}
      </td>
      <td className="max-w-[16rem] truncate px-3 py-2 text-muted-foreground">
        {dash(linea.notas)}
      </td>
      <td className="px-3 py-2">
        <EstadoBadge kind={linea.kind} />
      </td>
      <td className="px-3 py-2">
        <EstadoBadge contratado={linea.contratado} />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <BuyoutPdfCell pdfPath={linea.pdf_url} />
          {admin ? (
            <>
              <EditLineaButton
                projectId={projectId}
                linea={linea}
                catalogs={catalogs}
              />
              <DeleteLineaButton
                lineId={linea.id}
                quoteId={linea.quote_id}
                itemId={linea.item_id}
                projectId={projectId}
                concepto={linea.concepto}
              />
            </>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

const PILL =
  "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium"

function EstadoBadge({
  kind,
  contratado,
}: {
  kind?: "parametrico" | "ppto"
  contratado?: boolean
}) {
  if (kind) {
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
