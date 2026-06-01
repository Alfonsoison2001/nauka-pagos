import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CaratulaClient } from "./caratula-client"

export const metadata = { title: "Carátula" }

export type CaratulaEstimacion = {
  id: string
  numero: string
  contratistaNombre: string
  contratistaEmail: string | null
  partidaNombre: string
  monto: number
  status: "pendiente" | "enviada" | "pagada"
  yaGenerada: boolean
  enviadaAt: string | null
  destinatariosPrev: string[] | null
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
      .select("id, contratista_id, nombre")
      .in("contratista_id", cIds)
      .is("deleted_at", null)
    const partidas = pRows ?? []
    const partidasMap = new Map(partidas.map((p) => [p.id, p]))
    const pIds = partidas.map((p) => p.id)

    if (pIds.length > 0) {
      const { data: eRows } = await sb
        .from("estimaciones")
        .select(
          "id, partida_id, numero, monto_sin_iva, monto_con_iva, status, caratula_generada_url, caratula_enviada_at, destinatarios_email, fecha_estimacion, created_at",
        )
        .in("partida_id", pIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })

      estimaciones = (eRows ?? []).map((e) => {
        const partida = partidasMap.get(e.partida_id as string)
        const contratista = contratistasMap.get(partida?.contratista_id ?? "")
        return {
          id: e.id as string,
          numero: e.numero as string,
          contratistaNombre: contratista?.nombre ?? "",
          contratistaEmail:
            (contratista?.contacto_email as string | null) ?? null,
          partidaNombre: partida?.nombre ?? "",
          monto: Number(conIva ? e.monto_con_iva : e.monto_sin_iva),
          status: e.status as "pendiente" | "enviada" | "pagada",
          yaGenerada: Boolean(e.caratula_generada_url),
          enviadaAt: (e.caratula_enviada_at as string | null) ?? null,
          destinatariosPrev: (e.destinatarios_email as string[] | null) ?? null,
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

  return (
    <CaratulaClient
      projectId={id}
      conIva={conIva}
      estimaciones={estimaciones}
      firmantes={firmantes}
      defaultEmails={(project.default_emails as string[] | null) ?? []}
    />
  )
}
