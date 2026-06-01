// Helpers de formato reusables (moneda, fecha, número→letras).
// formatMXN sigue viviendo en src/lib/utils.ts (lo importan varios módulos);
// se re-exporta aquí para tener un único punto de entrada de formato.

export { formatMXN } from "@/lib/utils"
export { formatDate } from "./fecha"
export { numeroALetras } from "./numero-a-letras"
