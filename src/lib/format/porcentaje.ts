/** Formatea una fracción (0.578) como porcentaje "57.8%" (1 decimal). */
export function formatPct(fraction: number): string {
  if (!Number.isFinite(fraction)) return "0%"
  return `${(fraction * 100).toFixed(1)}%`
}
