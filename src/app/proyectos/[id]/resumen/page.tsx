import { notFound } from "next/navigation"
import { AvanceHero } from "@/components/resumen/avance-hero"
import { CompositionBar } from "@/components/resumen/composition-bar"
import {
  EstimacionMiniList,
  type MiniRow,
} from "@/components/resumen/estimacion-mini-list"
import { KpiCard } from "@/components/resumen/kpi-card"
import { PartidaResumenTable } from "@/components/resumen/partida-resumen-table"
import {
  type ChartDatum,
  PresupuestoEjercidoChart,
} from "@/components/resumen/presupuesto-ejercido-chart"
import { StatusBreakdown } from "@/components/resumen/status-breakdown"
import { formatMXN } from "@/lib/format"
import {
  computeResumen,
  type EstatusEstimacion,
  type PartidaInput,
} from "@/lib/resumen/compute"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Resumen" }

const PAGOS_LIMIT = 10

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

const byFechaDesc = (a: MiniRow, b: MiniRow) =>
  b.fechaEstimacion.localeCompare(a.fechaEstimacion)

export default async function ResumenPage({
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

  // Contratistas → partidas → estimaciones (mismo patrón que Flujo de Pagos).
  const { data: cRows } = await sb
    .from("contratistas")
    .select("id, nombre")
    .eq("project_id", id)
    .is("deleted_at", null)
  const contratistas = cRows ?? []
  const cMap = new Map(
    contratistas.map((c) => [c.id as string, c.nombre as string]),
  )
  const cIds = contratistas.map((c) => c.id as string)

  let partidaInputs: PartidaInput[] = []
  let estimacionRows: MiniRow[] = []

  if (cIds.length > 0) {
    const { data: pRows } = await sb
      .from("partidas")
      .select("id, contratista_id, nombre, presupuesto_con_iva")
      .in("contratista_id", cIds)
      .is("deleted_at", null)
    const partidas = pRows ?? []
    partidaInputs = partidas.map((p) => ({
      id: p.id as string,
      contratistaNombre: cMap.get(p.contratista_id as string) ?? "",
      partidaNombre: p.nombre as string,
      presupuesto: Number(p.presupuesto_con_iva),
    }))
    const partidaMap = new Map(partidaInputs.map((p) => [p.id, p]))
    const pIds = partidaInputs.map((p) => p.id)

    if (pIds.length > 0) {
      const { data: eRows } = await sb
        .from("estimaciones")
        .select(
          "id, partida_id, numero, monto_con_iva, status, fecha_estimacion",
        )
        .in("partida_id", pIds)
        .is("deleted_at", null)
      estimacionRows = (eRows ?? []).map((e) => {
        const pi = partidaMap.get(e.partida_id as string)
        return {
          id: e.id as string,
          partidaId: e.partida_id as string,
          numero: e.numero as string,
          contratistaNombre: pi?.contratistaNombre ?? "",
          partidaNombre: pi?.partidaNombre ?? "",
          status: e.status as EstatusEstimacion,
          fechaEstimacion: e.fecha_estimacion as string,
          monto: Number(e.monto_con_iva),
        }
      })
    }
  }

  if (partidaInputs.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium">Sin partidas</p>
        <p className="mt-2">
          Captura contratos (partidas) en la pestaña Presupuesto para ver el
          resumen del proyecto.
        </p>
      </div>
    )
  }

  const r = computeResumen({
    partidas: partidaInputs,
    estimaciones: estimacionRows.map((e) => ({
      partidaId: e.partidaId,
      monto: e.monto,
      status: e.status,
    })),
  })

  const totalNoComprometido = Math.max(
    0,
    r.totalPresupuesto - r.totalEjercido - r.porPagar.monto,
  )

  const sobreEjercidoNames = r.porPartida
    .filter((p) => p.sobreEjercido)
    .map((p) => `${p.contratistaNombre} — ${p.partidaNombre}`)

  const porPagarList = estimacionRows
    .filter((e) => e.status !== "pagada")
    .sort(byFechaDesc)
  const ultimosPagos = estimacionRows
    .filter((e) => e.status === "pagada")
    .sort(byFechaDesc)
    .slice(0, PAGOS_LIMIT)

  const chartData: ChartDatum[] = r.porPartida.map((p) => ({
    name: truncate(p.partidaNombre, 16),
    full: `${p.contratistaNombre} — ${p.partidaNombre}`,
    presupuesto: p.presupuesto,
    ejercido: p.ejercido,
    porPagar: p.porPagar,
    noComprometido: p.noComprometido,
    pctAvance: p.pctAvance,
  }))

  return (
    <div className="flex flex-col gap-6">
      {sobreEjercidoNames.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          ⚠ {sobreEjercidoNames.length} partida
          {sobreEjercidoNames.length === 1 ? "" : "s"} con ejercido mayor al
          presupuesto (sobre-ejercido):{" "}
          <span className="font-medium">{sobreEjercidoNames.join("; ")}</span>.
        </div>
      )}

      <AvanceHero
        pctAvance={r.pctAvance}
        ejercido={r.totalEjercido}
        presupuesto={r.totalPresupuesto}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Presupuesto total"
          value={formatMXN(r.totalPresupuesto)}
        />
        <KpiCard
          label="Ejercido"
          value={formatMXN(r.totalEjercido)}
          tone="positive"
          hint={`${r.statusBreakdown.pagada.count} pagadas`}
        />
        <KpiCard
          label="Disponible"
          value={formatMXN(r.totalDisponible)}
          tone={r.totalDisponible < 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Por pagar"
          value={formatMXN(r.porPagar.monto)}
          tone="muted"
          hint={`${r.porPagar.count} estimaciones (pendiente + enviada)`}
        />
      </div>

      <StatusBreakdown projectId={id} statusBreakdown={r.statusBreakdown} />

      <CompositionBar
        ejercido={r.totalEjercido}
        porPagar={r.porPagar.monto}
        noComprometido={totalNoComprometido}
        total={r.totalPresupuesto}
      />

      <PresupuestoEjercidoChart data={chartData} />

      <PartidaResumenTable
        projectId={id}
        porPartida={r.porPartida}
        estimaciones={estimacionRows}
        totalPresupuesto={r.totalPresupuesto}
        totalEjercido={r.totalEjercido}
        totalDisponible={r.totalDisponible}
        pctAvance={r.pctAvance}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Estimaciones por pagar</h2>
        <EstimacionMiniList
          projectId={id}
          rows={porPagarList}
          emptyMessage="Sin estimaciones pendientes"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Últimos pagos</h2>
        <EstimacionMiniList
          projectId={id}
          rows={ultimosPagos}
          emptyMessage="Sin pagos registrados"
        />
      </section>
    </div>
  )
}
