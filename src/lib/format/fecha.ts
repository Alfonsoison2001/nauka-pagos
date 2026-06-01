import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

/**
 * Format an ISO date string (yyyy-mm-dd) as dd/mm/yyyy.
 * Returns "—" for null/empty. Falls back to the raw input if unparseable.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: es })
  } catch {
    return iso
  }
}
