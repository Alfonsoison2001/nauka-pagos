/**
 * Client-side helper to remember the last project the user was viewing.
 * Used to preselect the project selector when the user opens the app fresh.
 *
 * Storage: localStorage on the browser only (SSR-safe via window check).
 * Key: nauka.lastProjectId
 */

const KEY = "nauka.lastProjectId"

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
