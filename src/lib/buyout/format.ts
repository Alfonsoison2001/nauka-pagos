// Formato de despliegue del Buy-Out: montos SIN decimales (pesos enteros).
// El dato en BD sigue siendo numeric(14,2); esto SOLO cambia cómo se muestra
// en las tablas del Resumen (es-MX). No reemplaza `formatMXN` global (lo usa
// Pagos con 2 decimales) — es un formateador propio del módulo Buy-Out.

const mxn0 = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
})
const usd0 = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

/** $ 1,234,568 (es-MX, MXN, sin decimales). El `|| 0` evita "-$0". */
export function formatMXN0(value: number): string {
  return mxn0.format(value || 0)
}

/** US$ 1,235 (es-MX, USD, sin decimales). Para $/m² en USD del pie. */
export function formatUSD0(value: number): string {
  return usd0.format(value || 0)
}
