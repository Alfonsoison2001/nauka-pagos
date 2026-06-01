import type {
  CaratulaFirmante,
  CaratulaProps,
} from "@/components/caratula/caratula-document"
import { formatDate } from "@/lib/format/fecha"
import { numeroALetras } from "@/lib/format/numero-a-letras"
import { createClient } from "@/lib/supabase/server"
import { formatMXN } from "@/lib/utils"

// Forma del join project_firmantes → firmantes (sin tipos generados de la DB).
type FirmanteJoin = {
  nombre: string
  cargo: string
  empresa: string
  deleted_at: string | null
}
type MontoRow = {
  monto_sin_iva: unknown
  monto_con_iva: unknown
  fecha_solicitud: string
  created_at: string
}

export type CaratulaData = {
  props: CaratulaProps
  meta: {
    lote: string
    numero: string
    contratistaNombre: string
    partidaNombre: string
    importe: number
    montoFormatted: string
    montoLetra: string
    contactoEmail: string | null
    defaultEmails: string[]
  }
}

/**
 * Ensambla CaratulaProps + metadata para una estimación, resolviendo montos
 * con/sin IVA según project.caratula_iva_mode y el acumulado contratado: la
 * suma de TODAS las estimaciones de la partida con fecha ≤ esta, incluyéndola,
 * sin importar el estatus de pago (estándar de obra: refleja el avance
 * contratado, asumiendo que esta estimación será pagada).
 */
export async function buildCaratulaData(
  estimacionId: string,
  projectId: string,
): Promise<{ error: string } | { data: CaratulaData }> {
  const sb = await createClient()

  const { data: est } = await sb
    .from("estimaciones")
    .select(
      "id, partida_id, numero, monto_sin_iva, monto_con_iva, fecha_solicitud, created_at",
    )
    .eq("id", estimacionId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!est) return { error: "Estimación no encontrada" }

  const { data: partida } = await sb
    .from("partidas")
    .select(
      "id, nombre, contratista_id, presupuesto_sin_iva, presupuesto_con_iva",
    )
    .eq("id", est.partida_id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!partida) return { error: "Partida no encontrada" }

  const { data: contratista } = await sb
    .from("contratistas")
    .select("nombre, contacto_email")
    .eq("id", partida.contratista_id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!contratista) return { error: "Contratista no encontrado" }

  const { data: project } = await sb
    .from("projects")
    .select("nombre, lote, caratula_iva_mode, default_emails, logo_url")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!project) return { error: "Proyecto no encontrado" }

  // Todas las estimaciones de la partida (para el acumulado contratado).
  const { data: allEstRaw } = await sb
    .from("estimaciones")
    .select("monto_sin_iva, monto_con_iva, fecha_solicitud, created_at")
    .eq("partida_id", est.partida_id)
    .is("deleted_at", null)

  // Firmantes del proyecto (ordenados 1-3).
  const { data: pfRaw } = await sb
    .from("project_firmantes")
    .select("orden, firmantes(nombre, cargo, empresa, deleted_at)")
    .eq("project_id", projectId)
    .order("orden")

  const conIva = project.caratula_iva_mode !== "sin_iva"
  const pick = (r: { monto_sin_iva: unknown; monto_con_iva: unknown }) =>
    Number(conIva ? r.monto_con_iva : r.monto_sin_iva)

  const importe = pick(est)
  const ppto = Number(
    conIva ? partida.presupuesto_con_iva : partida.presupuesto_sin_iva,
  )

  // Acumulado contratado: suma de TODAS las estimaciones de la partida con
  // fecha ≤ esta, INCLUYÉNDOLA, sin importar el estatus de pago. El desempate
  // por created_at asegura incluir esta cuando hay misma fecha.
  const thisFecha = est.fecha_solicitud as string
  const thisCreated = est.created_at as string
  const allEst = (allEstRaw ?? []) as MontoRow[]
  let acumulado = 0
  for (const r of allEst) {
    if (
      r.fecha_solicitud < thisFecha ||
      (r.fecha_solicitud === thisFecha && r.created_at <= thisCreated)
    ) {
      acumulado += pick(r)
    }
  }
  // Header "antes" = Contrato Total − estimaciones ANTERIORES (sin esta).
  const acumuladoAntes = acumulado - importe
  const saldoPorEjercerHeader = ppto - acumuladoAntes
  // "Por Ejercer (después)" = PPTO − ACUMULADO (que ya incluye esta).
  const porEjercer = ppto - acumulado

  const firmantes: CaratulaFirmante[] = []
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

  // Logo como data URI (bucket privado) si existe.
  let logoSrc: string | null = null
  if (project.logo_url) {
    const { data: blob } = await sb.storage
      .from("proyectos")
      .download(project.logo_url)
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer())
      const mime = blob.type || "image/png"
      logoSrc = `data:${mime};base64,${buf.toString("base64")}`
    }
  }

  const lote = (project.lote as string | null) ?? ""

  const props: CaratulaProps = {
    logoSrc,
    contratistaNombre: contratista.nombre as string,
    partidaNombre: partida.nombre as string,
    ubicacion: lote,
    numero: est.numero as string,
    fecha: formatDate(est.fecha_solicitud as string),
    contratoTotal: ppto,
    saldoPorEjercerHeader,
    importe,
    acumulado,
    ppto,
    porEjercer,
    firmantes,
  }

  return {
    data: {
      props,
      meta: {
        lote,
        numero: est.numero as string,
        contratistaNombre: contratista.nombre as string,
        partidaNombre: partida.nombre as string,
        importe,
        montoFormatted: formatMXN(importe),
        montoLetra: numeroALetras(importe),
        contactoEmail: (contratista.contacto_email as string | null) ?? null,
        defaultEmails: (project.default_emails as string[] | null) ?? [],
      },
    },
  }
}
