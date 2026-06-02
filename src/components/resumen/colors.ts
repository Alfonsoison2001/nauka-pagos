// Colores de los 3 segmentos de composición de un presupuesto, compartidos
// entre la gráfica stacked y la barra de composición global.
// Paleta monocromática azul + gris (design-prompt.md): NO verde, NO amarillo.
export const SEGMENT_COLORS = {
  ejercido: "#7fcfcb", // NAUKA accent (claro) — pagado
  porPagar: "#163d4a", // NAUKA dark (fuerte) — pendiente + enviada
  noComprometido: "#e5e7eb", // gris-200 — saldo no comprometido
} as const

export const SEGMENT_LABELS = {
  ejercido: "Ejercido",
  porPagar: "Por pagar",
  noComprometido: "No comprometido",
} as const
