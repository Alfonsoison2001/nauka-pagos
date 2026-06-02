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

/**
 * Format an ISO timestamp as dd/mm/yyyy HH:mm (24h). For approval timelines y
 * la constancia ("aprobado el día Y a las HH:MM"). Returns "—" for null/empty.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: es })
  } catch {
    return iso
  }
}
