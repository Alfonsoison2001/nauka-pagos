import { ArrowLeft, History } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { isAdmin } from "@/lib/auth/roles"
import { calcLinea } from "@/lib/buyout/calc"
import { loadVigenteLines, type VigenteLine } from "@/lib/buyout/rollup"
import { createClient } from "@/lib/supabase/server"
import { cn, formatMXN } from "@/lib/utils"
import { NuevaPartidaButton } from "../glosario/nueva-partida-button"
import type {
  ConceptoOption,
  CurrencyOption,
  KVOption,
  UnitMode,
} from "./actions"
import { BuyoutPdfCell } from "./buyout-pdf-cell"
import { DeleteLineaButton } from "./delete-linea-button"
import { EditLineaButton } from "./edit-linea-button"
import type { Catalogs } from "./linea-dialog"
import { NuevaLineaButton } from "./nueva-linea-button"
import { type ChapterGroup, PartidaCards } from "./partida-cards"
import { UpdateBudgetButton } from "./update-budget-button"

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

type Sb = Awaited<ReturnType<typeof createClient>>
type PartidaCat = { id: string; nombre: string; chapter_default: string | null }

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

  // Capítulos (orden) + partidas (24, con su capítulo) + TC del proyecto.
  const [chapterRes, partidaRes, fxRes] = await Promise.all([
    sb
      .from("buyout_chapter")
      .select("nombre")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("orden"),
    sb
      .from("buyout_partida_catalog")
      .select("id, nombre, chapter_default")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("orden"),
    sb
      .from("buyout_fx")
      .select("currency, rate")
      .eq("project_id", id)
      .is("deleted_at", null),
  ])
  const chapters = (chapterRes.data ?? []).map((c) => c.nombre as string)
  const partidas: PartidaCat[] = (partidaRes.data ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    chapter_default: (p.chapter_default as string | null) ?? null,
  }))
  const fxList: CurrencyOption[] = (fxRes.data ?? []).map((c) => ({
    currency: c.currency as string,
    rate: Number(c.rate),
  }))
  const partidaNombreById = new Map(partidas.map((p) => [p.id, p.nombre]))

  // Todas las líneas vigentes del proyecto (una sola pasada) → totales por
  // partida (para las tarjetas) y líneas de la partida elegida (para la tabla).
  const allLineas = await loadVigenteLines(sb, id, fxList, partidaNombreById)
  const totalsByPartida = new Map<string, { total: number; count: number }>()
  for (const l of allLineas) {
    const c = calcLinea({
      cantidad: l.cantidad,
      unitario: l.unitario,
      sobrecostoPct: l.sobrecosto_pct,
      ivaPct: l.iva_pct,
      tc: l.tc,
    })
    const cur = totalsByPartida.get(l.partida_catalog_id) ?? {
      total: 0,
      count: 0,
    }
    cur.total += c.totalMxn
    cur.count += 1
    totalsByPartida.set(l.partida_catalog_id, cur)
  }

  if (partidas.length === 0) {
    return (
      <div className="rounded-2xl border border-nauka-card-border bg-white p-12 text-center shadow-nauka-card">
        <p className="text-sm font-medium text-nauka-dark">
          Este proyecto aún no tiene partidas de Buy-Out.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          El catálogo (taxonomía L3) está sembrado para Lote 3.
        </p>
      </div>
    )
  }

  // ── Vista de partida seleccionada ─────────────────────────────────────────
  if (selectedPartidaId) {
    const partidaNombre = partidaNombreById.get(selectedPartidaId) ?? "Partida"
    const catalogs = await loadCatalogs(sb, id, selectedPartidaId)
    const lineasRaw = allLineas.filter(
      (l) => l.partida_catalog_id === selectedPartidaId,
    )
    // BF (modo torre): agrupa las líneas por torre (Torre 1 → Torre 2 → resto),
    // con el mismo orden de conceptos en cada bloque. L3/L44: orden actual intacto.
    const lineas =
      catalogs.unitMode === "torre" ? sortLineasByTorre(lineasRaw) : lineasRaw
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Link
              href={`/proyectos/${id}/buyout/partida`}
              className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-nauka-dark"
            >
              <ArrowLeft className="size-4" />
              Todas las partidas
            </Link>
            <h2 className="text-lg font-semibold text-nauka-dark">
              {partidaNombre}
            </h2>
          </div>
          {admin ? (
            <div className="flex flex-col items-end gap-1">
              <NuevaLineaButton
                projectId={id}
                partidaCatalogId={selectedPartidaId}
                catalogs={catalogs}
              />
              <span className="max-w-xs text-right text-xs text-muted-foreground">
                “Agregar” = concepto nuevo. Para versionar uno existente, usa ↻
                Actualizar presupuesto en su fila.
              </span>
            </div>
          ) : null}
        </div>
        <LineasTable
          projectId={id}
          lineas={lineas}
          catalogs={catalogs}
          admin={admin}
        />
      </div>
    )
  }

  // ── Vista de tarjetas (todas las partidas por capítulo) ───────────────────
  const groups = buildGroups(chapters, partidas, totalsByPartida)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-nauka-dark">Partidas</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Elige una partida para capturar y ver sus conceptos (formato verde
            de 22 columnas). El total es la suma de sus conceptos vigentes.
          </p>
        </div>
        {admin ? (
          <NuevaPartidaButton projectId={id} chapterNames={chapters} />
        ) : null}
      </div>
      <PartidaCards projectId={id} groups={groups} />
    </div>
  )
}

/** Agrupa las partidas por capítulo (orden de capítulos), con sus totales. */
function buildGroups(
  chapters: string[],
  partidas: PartidaCat[],
  totals: Map<string, { total: number; count: number }>,
): ChapterGroup[] {
  const cardOf = (p: PartidaCat) => ({
    id: p.id,
    nombre: p.nombre,
    total: totals.get(p.id)?.total ?? 0,
    count: totals.get(p.id)?.count ?? 0,
  })
  const known = new Set(chapters)
  const groups: ChapterGroup[] = chapters
    .map((ch) => ({
      nombre: ch,
      partidas: partidas.filter((p) => p.chapter_default === ch).map(cardOf),
    }))
    .filter((g) => g.partidas.length > 0)
  const sinCap = partidas.filter(
    (p) => !p.chapter_default || !known.has(p.chapter_default),
  )
  if (sinCap.length > 0) {
    groups.push({ nombre: "Sin capítulo", partidas: sinCap.map(cardOf) })
  }
  return groups
}

// --- orden de líneas por torre (solo BF) ------------------------------------

/** Rango de torre para ordenar: "Torre 1" → 1, "Torre 2" → 2, … ; "Compartido"/otros/sin torre → al final. */
function torreRank(villaCasita: string | null): number {
  const m = villaCasita?.match(/torre\s*(\d+)/i)
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY
}

/**
 * Ordena las líneas de una partida (BF) por TORRE primero (Torre 1 → Torre 2 →
 * "Compartido"/otros al final) y, dentro de cada torre, con el MISMO orden de
 * conceptos: la clave de concepto = su primera aparición en la lista original,
 * así ambos bloques de torre listan los conceptos en idéntico orden. Solo cambia
 * el orden de DESPLIEGUE; no toca montos ni el total (la suma es la misma).
 */
function sortLineasByTorre(lineas: VigenteLine[]): VigenteLine[] {
  const conceptOrder = new Map<string, number>()
  lineas.forEach((l, i) => {
    if (!conceptOrder.has(l.concepto)) conceptOrder.set(l.concepto, i)
  })
  return [...lineas].sort((a, b) => {
    const ra = torreRank(a.villa_casita)
    const rb = torreRank(b.villa_casita)
    if (ra !== rb) return ra < rb ? -1 : 1
    const ca = conceptOrder.get(a.concepto) ?? 0
    const cb = conceptOrder.get(b.concepto) ?? 0
    if (ca !== cb) return ca - cb
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

// --- catálogos del formulario -----------------------------------------------

/**
 * BF: `buyout_unit` son los 8 DEPTOS con la torre en el prefijo del nombre
 * ("T1 · 101 (PB)"). Derivamos las TORRES distintas (Torre 1 / Torre 2) y la
 * lista de DEPTOS ("101 PB") para que la captura separe ambos campos. L3/L44 no
 * tienen deptos → modo "villa" (comportamiento actual: villa/casita por unit_id).
 */
function deriveTorreDepto(units: { nombre: string; tipo: string }[]): {
  unitMode: UnitMode
  torres: KVOption[]
  deptos: KVOption[]
} {
  const deptoUnits = units.filter((u) => u.tipo === "depto")
  if (deptoUnits.length === 0) {
    return { unitMode: "villa", torres: [], deptos: [] }
  }
  const torreLabels: string[] = []
  const deptos: KVOption[] = []
  for (const u of deptoUnits) {
    const sepIdx = u.nombre.indexOf(" · ")
    const prefix = sepIdx >= 0 ? u.nombre.slice(0, sepIdx).trim() : ""
    const rest =
      sepIdx >= 0 ? u.nombre.slice(sepIdx + 3).trim() : u.nombre.trim()
    const m = prefix.match(/^T\s*(\d+)$/i)
    if (m) {
      const torreLabel = `Torre ${m[1]}`
      if (!torreLabels.includes(torreLabel)) torreLabels.push(torreLabel)
    }
    // "101 (PB)" → "101 PB" · "102/103 (Dúplex)" → "102/103 Dúplex".
    const deptoLabel = rest.replace(/[()]/g, "").replace(/\s+/g, " ").trim()
    deptos.push({ value: deptoLabel, label: deptoLabel })
  }
  return {
    unitMode: "torre",
    torres: torreLabels.map((t) => ({ value: t, label: t })),
    deptos,
  }
}

async function loadCatalogs(
  sb: Sb,
  projectId: string,
  partidaCatalogId: string,
): Promise<Catalogs> {
  const [conRes, supRes, unitRes, uomRes, fxRes] = await Promise.all([
    sb
      .from("buyout_concepto_catalog")
      .select("id, nombre")
      .eq("partida_catalog_id", partidaCatalogId)
      .is("deleted_at", null)
      .order("orden"),
    sb
      .from("buyout_supplier")
      .select("id, nombre")
      .is("deleted_at", null)
      .order("nombre"),
    sb
      .from("buyout_unit")
      .select("id, nombre, tipo")
      .eq("project_id", projectId)
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
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ])
  return {
    conceptos: (conRes.data ?? []).map((c) => ({
      id: c.id as string,
      nombre: c.nombre as string,
    })) satisfies ConceptoOption[],
    suppliers: (supRes.data ?? []).map((s) => ({
      id: s.id as string,
      nombre: s.nombre as string,
    })),
    units: (unitRes.data ?? []).map((u) => ({
      id: u.id as string,
      nombre: u.nombre as string,
    })),
    ...deriveTorreDepto(
      (unitRes.data ?? []).map((u) => ({
        nombre: u.nombre as string,
        tipo: u.tipo as string,
      })),
    ),
    uoms: (uomRes.data ?? []).map((u) => ({
      codigo: u.codigo as string,
      nombre: u.nombre as string,
    })),
    currencies: (fxRes.data ?? []).map((c) => ({
      currency: c.currency as string,
      rate: Number(c.rate),
    })),
  }
}

// --- tabla de 22 columnas + acciones ----------------------------------------

function LineasTable({
  projectId,
  lineas,
  catalogs,
  admin,
}: {
  projectId: string
  lineas: VigenteLine[]
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
    // overflow-x-auto = scroll HORIZONTAL de las 22 columnas dentro de la caja;
    // sin cap de altura → el scroll VERTICAL es el de la página y se alcanzan
    // TODAS las filas (antes `max-h-[70vh] overflow-auto` atrapaba las de abajo).
    <div className="overflow-x-auto rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      <table className="w-full whitespace-nowrap text-sm tabular-nums">
        <thead>
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
                Sin líneas. Usa “Agregar” para capturar el primer concepto.
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
  linea: VigenteLine
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
          <Link
            href={`/proyectos/${projectId}/buyout/subcategoria?item=${linea.item_id}`}
            title="Ver historial de versiones"
            aria-label={`Ver historial de ${linea.concepto}`}
            className="inline-flex size-7 items-center justify-center rounded-full text-nauka-dark transition-colors hover:bg-muted"
          >
            <History className="size-4" />
          </Link>
          <BuyoutPdfCell pdfPath={linea.pdf_url} />
          {admin ? (
            <>
              <UpdateBudgetButton
                projectId={projectId}
                linea={linea}
                catalogs={catalogs}
              />
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
