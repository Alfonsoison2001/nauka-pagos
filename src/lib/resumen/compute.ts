// Cálculo del Resumen de un proyecto. Función PURA (sin DB): recibe filas ya
// cargadas y devuelve la estructura del dashboard. Única fuente de verdad de la
// matemática — el Consolidado (Día 7) la reutiliza por-proyecto.
//
// Convención de montos: todo CON IVA (como el Excel "Resumen Total").
// EJERCIDO = solo estimaciones con status='pagada'.

export type EstatusEstimacion = "pendiente" | "enviada" | "pagada"

export type PartidaInput = {
  id: string
  contratistaNombre: string
  partidaNombre: string
  presupuesto: number // presupuesto_con_iva
}

export type EstimacionInput = {
  partidaId: string
  monto: number // monto_con_iva
  status: EstatusEstimacion
}

export type ResumenInput = {
  partidas: PartidaInput[]
  estimaciones: EstimacionInput[]
}

export type PartidaResumen = {
  partidaId: string
  contratistaNombre: string
  partidaNombre: string
  presupuesto: number
  ejercido: number // pagada
  porPagar: number // pendiente + enviada
  /** presupuesto − ejercido − porPagar (clamp ≥ 0). Saldo no comprometido. */
  noComprometido: number
  disponible: number // presupuesto − ejercido (columna del Excel)
  pctAvance: number
  sobreEjercido: boolean
}

export type MontoCount = { count: number; monto: number }

export type ResumenData = {
  totalPresupuesto: number
  totalEjercido: number
  totalDisponible: number
  pctAvance: number
  porPartida: PartidaResumen[]
  statusBreakdown: Record<EstatusEstimacion, MontoCount>
  porPagar: MontoCount // pendiente + enviada
  sobreEjercidoCount: number
}

export function computeResumen(input: ResumenInput): ResumenData {
  const { partidas, estimaciones } = input

  // Ejercido (pagado) y por-pagar (pendiente+enviada) por partida.
  const ejercidoByPartida = new Map<string, number>()
  const porPagarByPartida = new Map<string, number>()
  const breakdown: Record<EstatusEstimacion, MontoCount> = {
    pendiente: { count: 0, monto: 0 },
    enviada: { count: 0, monto: 0 },
    pagada: { count: 0, monto: 0 },
  }

  for (const e of estimaciones) {
    const b = breakdown[e.status]
    b.count += 1
    b.monto += e.monto
    if (e.status === "pagada") {
      ejercidoByPartida.set(
        e.partidaId,
        (ejercidoByPartida.get(e.partidaId) ?? 0) + e.monto,
      )
    } else {
      // pendiente o enviada
      porPagarByPartida.set(
        e.partidaId,
        (porPagarByPartida.get(e.partidaId) ?? 0) + e.monto,
      )
    }
  }

  const porPartida: PartidaResumen[] = partidas.map((p) => {
    const ejercido = ejercidoByPartida.get(p.id) ?? 0
    const porPagar = porPagarByPartida.get(p.id) ?? 0
    const disponible = p.presupuesto - ejercido
    const noComprometido = Math.max(0, p.presupuesto - ejercido - porPagar)
    const pctAvance = p.presupuesto > 0 ? ejercido / p.presupuesto : 0
    return {
      partidaId: p.id,
      contratistaNombre: p.contratistaNombre,
      partidaNombre: p.partidaNombre,
      presupuesto: p.presupuesto,
      ejercido,
      porPagar,
      noComprometido,
      disponible,
      pctAvance,
      sobreEjercido: ejercido > p.presupuesto,
    }
  })

  // Orden: % avance descendente; desempate por presupuesto desc para estabilidad.
  porPartida.sort(
    (a, b) => b.pctAvance - a.pctAvance || b.presupuesto - a.presupuesto,
  )

  const totalPresupuesto = porPartida.reduce((s, p) => s + p.presupuesto, 0)
  const totalEjercido = porPartida.reduce((s, p) => s + p.ejercido, 0)
  const totalDisponible = totalPresupuesto - totalEjercido
  const pctAvance = totalPresupuesto > 0 ? totalEjercido / totalPresupuesto : 0

  const porPagar: MontoCount = {
    count: breakdown.pendiente.count + breakdown.enviada.count,
    monto: breakdown.pendiente.monto + breakdown.enviada.monto,
  }

  return {
    totalPresupuesto,
    totalEjercido,
    totalDisponible,
    pctAvance,
    porPartida,
    statusBreakdown: breakdown,
    porPagar,
    sobreEjercidoCount: porPartida.filter((p) => p.sobreEjercido).length,
  }
}
