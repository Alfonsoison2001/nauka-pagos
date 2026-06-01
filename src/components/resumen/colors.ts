// Colores de los 3 segmentos de composición de un presupuesto, compartidos
// entre la gráfica stacked y la barra de composición global.
export const SEGMENT_COLORS = {
  ejercido: "#16a34a", // verde-600 — pagado
  porPagar: "#eab308", // amarillo-500 — pendiente + enviada
  noComprometido: "#e5e7eb", // gris-200 — saldo no comprometido
} as const

export const SEGMENT_LABELS = {
  ejercido: "Ejercido",
  porPagar: "Por pagar",
  noComprometido: "No comprometido",
} as const
