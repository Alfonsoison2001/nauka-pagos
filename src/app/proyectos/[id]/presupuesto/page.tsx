import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatMXN } from "@/lib/utils"
import type { ContratistaOption, PartidaRow } from "./actions"
import { DeletePartidaButton } from "./delete-partida-button"
import { EditPartidaButton } from "./edit-partida-button"
import { NewPartidaButton } from "./new-partida-button"
import { PdfCell } from "./pdf-cell"

export const metadata = { title: "Presupuesto" }

export default async function PresupuestoPage({
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

  // ── contratistas for dropdown + join map ───────────────────────────────────
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
  const cMap = new Map(contratistas.map((c) => [c.id, c.nombre]))
  const cIds = contratistas.map((c) => c.id)

  // ── partidas ───────────────────────────────────────────────────────────────
  let partidas: PartidaRow[] = []
  if (cIds.length > 0) {
    const { data: pRows } = await sb
      .from("partidas")
      .select(
        "id, contratista_id, nombre, presupuesto_sin_iva, iva_pct, iva_monto, presupuesto_con_iva, notas, fecha_firma, presupuesto_pdf_url",
      )
      .in("contratista_id", cIds)
      .is("deleted_at", null)
      .order("nombre")

    partidas = (pRows ?? [])
      .map((r) => ({
        id: r.id as string,
        contratista_id: r.contratista_id as string,
        contratista_nombre: cMap.get(r.contratista_id as string) ?? "",
        nombre: r.nombre as string,
        presupuesto_sin_iva: Number(r.presupuesto_sin_iva),
        iva_pct: Number(r.iva_pct),
        iva_monto: Number(r.iva_monto),
        presupuesto_con_iva: Number(r.presupuesto_con_iva),
        notas: (r.notas as string | null) ?? null,
        fecha_firma: (r.fecha_firma as string | null) ?? null,
        presupuesto_pdf_url: (r.presupuesto_pdf_url as string | null) ?? null,
      }))
      .sort((a, b) => {
        const cn = a.contratista_nombre.localeCompare(b.contratista_nombre)
        return cn !== 0 ? cn : a.nombre.localeCompare(b.nombre)
      })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <NewPartidaButton projectId={id} contratistas={contratistas} />
      </div>

      {partidas.length === 0 ? (
        <EmptyState projectId={id} contratistas={contratistas} />
      ) : (
        <PresupuestoTable partidas={partidas} projectId={id} />
      )}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  projectId,
  contratistas,
}: {
  projectId: string
  contratistas: ContratistaOption[]
}) {
  return (
    <div className="rounded-2xl border border-nauka-card-border bg-white p-12 text-center shadow-nauka-card">
      <p className="text-sm font-medium text-nauka-dark">
        Aún no hay partidas.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Sube tu primer presupuesto firmado.
      </p>
      <div className="mt-4 flex justify-center">
        <NewPartidaButton projectId={projectId} contratistas={contratistas} />
      </div>
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

function PresupuestoTable({
  partidas,
  projectId,
}: {
  partidas: PartidaRow[]
  projectId: string
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="bg-nauka-dark text-xs uppercase tracking-wider text-white/70">
            <th className="px-3 py-2.5 text-right">#</th>
            <th className="px-3 py-2.5 text-left">Contratista</th>
            <th className="px-3 py-2.5 text-left">Partida</th>
            <th className="px-3 py-2.5 text-right">Presupuesto sin IVA</th>
            <th className="px-3 py-2.5 text-right">IVA%</th>
            <th className="px-3 py-2.5 text-right">IVA monto</th>
            <th className="px-3 py-2.5 text-right">Total con IVA</th>
            <th className="px-3 py-2.5 text-left">Notas</th>
            <th className="px-3 py-2.5 text-left">PDF</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {partidas.map((p, i) => (
            <tr
              key={p.id}
              className="border-b border-nauka-subtle last:border-0 hover:bg-nauka-bg"
            >
              <td className="px-3 py-2 text-right text-muted-foreground">
                {i + 1}
              </td>
              <td className="px-3 py-2 font-medium">{p.contratista_nombre}</td>
              <td className="px-3 py-2">{p.nombre}</td>
              <td className="px-3 py-2 text-right">
                {formatMXN(p.presupuesto_sin_iva)}
              </td>
              <td className="px-3 py-2 text-right">
                {(p.iva_pct * 100).toFixed(0)}%
              </td>
              <td className="px-3 py-2 text-right">{formatMXN(p.iva_monto)}</td>
              <td className="px-3 py-2 text-right font-medium">
                {formatMXN(p.presupuesto_con_iva)}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {p.notas ?? "—"}
              </td>
              <td className="px-3 py-2">
                <PdfCell pdfPath={p.presupuesto_pdf_url} />
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-0.5">
                  <EditPartidaButton partida={p} projectId={projectId} />
                  <DeletePartidaButton
                    partidaId={p.id}
                    projectId={projectId}
                    partidaNombre={p.nombre}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
