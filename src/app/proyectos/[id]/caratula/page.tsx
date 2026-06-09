import { notFound } from "next/navigation"
import {
  type ApprovalRequestRow,
  buildDocumentApproval,
  type DocumentApproval,
  fetchCaratulaRequests,
  fetchVotesByRequest,
} from "@/lib/approvals/fetch"
import { getMyProfile } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { CaratulaClient } from "./caratula-client"

export const metadata = { title: "Carátula" }

export type CaratulaEstimacion = {
  id: string
  numero: string
  contratistaId: string
  contratistaNombre: string
  partidaNombre: string
  monto: number
  status: "pendiente" | "enviada" | "pagada"
  yaGenerada: boolean
  enviadaAt: string | null
  destinatariosPrev: string[] | null
  pagadorEmail: string | null
  fechaEstimacion: string
  pagadorNombre: string | null
}

export type CaratulaFirmanteRow = {
  nombre: string
  cargo: string
  empresa: string
}

type FirmanteJoin = {
  nombre: string
  cargo: string
  empresa: string
  deleted_at: string | null
}

export default async function CaratulaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sb = await createClient()

  const { data: project } = await sb
    .from("projects")
    .select("id, nombre, lote, caratula_iva_mode, default_emails")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!project) notFound()

  const conIva = project.caratula_iva_mode !== "sin_iva"

  // Contratistas → partidas → estimaciones (mismo patrón que Flujo de Pagos).
  const { data: cRows } = await sb
    .from("contratistas")
    .select("id, nombre, contacto_email")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("nombre")
  const contratistas = cRows ?? []
  const cIds = contratistas.map((c) => c.id)

  const contratistasMap = new Map(contratistas.map((c) => [c.id, c]))

  let estimaciones: CaratulaEstimacion[] = []
  if (cIds.length > 0) {
    const { data: pRows } = await sb
      .from("partidas")
      .select("id, contratista_id, nombre, presupuesto_con_iva")
      .in("contratista_id", cIds)
      .is("deleted_at", null)
    const partidas = pRows ?? []
    const partidasMap = new Map(partidas.map((p) => [p.id, p]))
    const pIds = partidas.map((p) => p.id)

    if (pIds.length > 0) {
      const { data: eRows } = await sb
        .from("estimaciones")
        .select(
          "id, partida_id, pagador_id, numero, monto_sin_iva, monto_con_iva, status, caratula_generada_url, caratula_enviada_at, destinatarios_email, fecha_estimacion, created_at",
        )
        .in("partida_id", pIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })

      // Email del pagador de cada estimación (destinatario de la carátula).
      const pagadorIds = [
        ...new Set(
          (eRows ?? [])
            .map((e) => e.pagador_id as string | null)
            .filter((x): x is string => Boolean(x)),
        ),
      ]
      const pagadorEmailMap = new Map<string, string | null>()
      const pagadorNombreMap = new Map<string, string | null>()
      if (pagadorIds.length > 0) {
        const { data: pagEmailRows } = await sb
          .from("pagadores")
          .select("id, email, nombre")
          .in("id", pagadorIds)
        for (const p of pagEmailRows ?? []) {
          pagadorEmailMap.set(
            p.id as string,
            (p.email as string | null) ?? null,
          )
          pagadorNombreMap.set(
            p.id as string,
            (p.nombre as string | null) ?? null,
          )
        }
      }

      estimaciones = (eRows ?? []).map((e) => {
        const partida = partidasMap.get(e.partida_id as string)
        const contratista = contratistasMap.get(partida?.contratista_id ?? "")
        const pagadorId = e.pagador_id as string | null
        return {
          id: e.id as string,
          numero: e.numero as string,
          contratistaId: partida?.contratista_id ?? "",
          contratistaNombre: contratista?.nombre ?? "",
          partidaNombre: partida?.nombre ?? "",
          monto: Number(conIva ? e.monto_con_iva : e.monto_sin_iva),
          status: e.status as "pendiente" | "enviada" | "pagada",
          yaGenerada: Boolean(e.caratula_generada_url),
          enviadaAt: (e.caratula_enviada_at as string | null) ?? null,
          destinatariosPrev: (e.destinatarios_email as string[] | null) ?? null,
          pagadorEmail: pagadorId
            ? (pagadorEmailMap.get(pagadorId) ?? null)
            : null,
          fechaEstimacion: e.fecha_estimacion as string,
          pagadorNombre: pagadorId
            ? (pagadorNombreMap.get(pagadorId) ?? null)
            : null,
        }
      })
    }
  }

  // Firmantes del proyecto (ordenados 1-3).
  const { data: pfRaw } = await sb
    .from("project_firmantes")
    .select("orden, firmantes(nombre, cargo, empresa, deleted_at)")
    .eq("project_id", id)
    .order("orden")
  const firmantes: CaratulaFirmanteRow[] = []
  const pfRows = (pfRaw ?? []) as Array<{
    orden: number
    firmantes: FirmanteJoin | FirmanteJoin[] | null
  }>
  for (const row of pfRows) {
    const f = Array.isArray(row.firmantes) ? row.firmantes[0] : row.firmantes
    if (f && !f.deleted_at) {
      firmantes.push({ nombre: f.nombre, cargo: f.cargo, empresa: f.empresa })
    }
  }

  // Estado de aprobación por estimación (rondas + votos).
  const profile = await getMyProfile()
  const estIds = estimaciones.map((e) => e.id)
  const reqs = await fetchCaratulaRequests(sb, estIds)
  const votesByReq = await fetchVotesByRequest(
    sb,
    reqs.map((r) => r.id),
  )
  const reqsByDoc = new Map<string, ApprovalRequestRow[]>()
  for (const r of reqs) {
    const arr = reqsByDoc.get(r.documentId) ?? []
    arr.push(r)
    reqsByDoc.set(r.documentId, arr)
  }
  const approvalByEst: Record<string, DocumentApproval> = {}
  for (const e of estimaciones) {
    approvalByEst[e.id] = buildDocumentApproval(
      reqsByDoc.get(e.id) ?? [],
      votesByReq,
      profile?.firmanteId ?? null,
    )
  }

  return (
    <CaratulaClient
      projectId={id}
      conIva={conIva}
      estimaciones={estimaciones}
      firmantes={firmantes}
      defaultEmails={(project.default_emails as string[] | null) ?? []}
      isAdmin={profile?.role === "admin"}
      approvalByEst={approvalByEst}
    />
  )
}
