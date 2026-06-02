/**
 * Recuerda el último proyecto que el usuario estaba viendo.
 *
 * - localStorage (cliente): para el preselect/hint del selector de proyecto.
 * - Cookie `nauka_last_project` (SSR-legible): la escribe el middleware en cada
 *   navegación a /proyectos/[id], y la leen layouts server fuera de un proyecto
 *   (p. ej. /aprobaciones) para apuntar los links del sidebar al último
 *   proyecto. Ver src/lib/supabase/middleware.ts y last-project-server.ts.
 */

const KEY = "nauka.lastProjectId"
export const LAST_PROJECT_COOKIE = "nauka_last_project"

export function getLastProjectId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setLastProjectId(id: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, id)
  } catch {
    // Quota exceeded or storage disabled — silently ignore.
  }
}

export function clearLastProjectId(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
