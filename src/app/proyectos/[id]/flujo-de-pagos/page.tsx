import { notFound } from "next/navigation"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import type {
  ContratistaOption,
  EstimacionRow,
  PagadorOption,
  PartidaOption,
} from "./actions"
import { FlujoClient } from "./flujo-client"

export const metadata = { title: "Flujo de Pagos" }

export default async function FlujoDePagosPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sb = await createClient()

  // ── Verify project exists ─────────────────────────────────────────────────
  const { data: project } = await sb
    .from("projects")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!project) notFound()

  // ── Contratistas ──────────────────────────────────────────────────────────
  const { data: cRows } = await sb
    .from("contratistas")
    .select("id, nombre")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("nombre")

  const contratistas: ContratistaOption[] = (cRows ?? []).map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
  }))
  const cIds = contratistas.map((c) => c.id)

  // ── Partidas ──────────────────────────────────────────────────────────────
  let partidas: PartidaOption[] = []
  let pIds: string[] = []

  if (cIds.length > 0) {
    const { data: pRows } = await sb
      .from("partidas")
      .select(
        "id, contratista_id, nombre, presupuesto_sin_iva, iva_pct, presupuesto_con_iva",
      )
      .in("contratista_id", cIds)
      .is("deleted_at", null)
      .order("nombre")

    partidas = (pRows ?? []).map((r) => ({
      id: r.id as string,
      contratista_id: r.contratista_id as string,
      nombre: r.nombre as string,
      presupuesto_con_iva: Number(r.presupuesto_con_iva),
      iva_pct: Number(r.iva_pct),
    }))
    pIds = partidas.map((p) => p.id)
  }

  // ── Pagadores (global + per-project) ─────────────────────────────────────
  const { data: pagRows } = await sb
    .from("pagadores")
    .select("id, nombre")
    .or(`project_id.eq.${id},project_id.is.null`)
    .is("deleted_at", null)
    .order("nombre")

  const pagadores: PagadorOption[] = (pagRows ?? []).map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
  }))

  // ── Estimaciones ──────────────────────────────────────────────────────────
  let rows: EstimacionRow[] = []

  if (pIds.length > 0) {
    const { data: eRows } = await sb
      .from("estimaciones")
      .select(
        "id, partida_id, pagador_id, numero, concepto, monto_sin_iva, iva_pct, iva_monto, monto_con_iva, fecha_solicitud, fecha_pago, status, notas, caratula_generada_url, caratula_firmada_url, comprobante_pago_url",
      )
      .in("partida_id", pIds)
      .is("deleted_at", null)
      // FIX 1: oldest row first, same as Excel (newest appended at bottom)
      .order("fecha_pago", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true })

    // Maps for joining
    const partidas_map = new Map(partidas.map((p) => [p.id, p]))
    const contratistas_map = new Map(contratistas.map((c) => [c.id, c]))
    const pagadores_map = new Map(pagadores.map((p) => [p.id, p]))

    // Total pagado per partida — passed to DerivedInfo in the form
    const pagadoAcumByPartida: Record<string, number> = {}
    for (const e of eRows ?? []) {
      if (e.status === "pagada") {
        const pid = e.partida_id as string
        pagadoAcumByPartida[pid] =
          (pagadoAcumByPartida[pid] ?? 0) + Number(e.monto_con_iva)
      }
    }

    // FIX 2: running total per row (data already sorted ASC)
    const runningAcum: Record<string, number> = {}

    rows = (eRows ?? []).map((e) => {
      const partida = partidas_map.get(e.partida_id as string)
      const contratista = contratistas_map.get(partida?.contratista_id ?? "")
      const pagador = pagadores_map.get(e.pagador_id as string)
      const presupuesto = partida?.presupuesto_con_iva ?? 0

      // Accumulate before reading so pagada rows include themselves
      if (e.status === "pagada") {
        const pid = e.partida_id as string
        runningAcum[pid] = (runningAcum[pid] ?? 0) + Number(e.monto_con_iva)
      }
      const pagadoAcum = runningAcum[e.partida_id as string] ?? 0

      return {
        id: e.id as string,
        partida_id: e.partida_id as string,
        contratista_id: partida?.contratista_id ?? "",
        contratista_nombre: contratista?.nombre ?? "",
        partida_nombre: partida?.nombre ?? "",
        partida_presupuesto_con_iva: presupuesto,
        partida_iva_pct: partida?.iva_pct ?? 0,
        pagador_id: (e.pagador_id as string | null) ?? null,
        pagador_nombre: pagador?.nombre ?? null,
        numero: e.numero as string,
        concepto: (e.concepto as string | null) ?? null,
        monto_sin_iva: Number(e.monto_sin_iva),
        iva_pct: Number(e.iva_pct),
        iva_monto: Number(e.iva_monto),
        monto_con_iva: Number(e.monto_con_iva),
        fecha_solicitud: e.fecha_solicitud as string,
        fecha_pago: (e.fecha_pago as string | null) ?? null,
        status: e.status as "pendiente" | "pagada",
        notas: (e.notas as string | null) ?? null,
        caratula_generada_url:
          (e.caratula_generada_url as string | null) ?? null,
        caratula_firmada_url: (e.caratula_firmada_url as string | null) ?? null,
        comprobante_pago_url: (e.comprobante_pago_url as string | null) ?? null,
        pagado_acum: pagadoAcum,
        resto_por_pagar: presupuesto - pagadoAcum,
      }
    })

    return (
      <Suspense>
        <FlujoClient
          rows={rows}
          contratistas={contratistas}
          partidas={partidas}
          pagadores={pagadores}
          pagadoAcumByPartida={pagadoAcumByPartida}
          projectId={id}
        />
      </Suspense>
    )
  }

  // No partidas yet — still render the shell so user can add estimaciones later
  return (
    <Suspense>
      <FlujoClient
        rows={[]}
        contratistas={contratistas}
        partidas={[]}
        pagadores={pagadores}
        pagadoAcumByPartida={{}}
        projectId={id}
      />
    </Suspense>
  )
}
