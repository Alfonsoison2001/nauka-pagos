import { cookies } from "next/headers"
import { LAST_PROJECT_COOKIE } from "./last-project"

/**
 * Lee el último proyecto activo desde la cookie (server-only). Lo usan layouts
 * que renderizan el sidebar fuera de un proyecto (p. ej. /aprobaciones) para
 * apuntar los links de proyecto al último visitado, no al primero alfabético.
 */
export async function getLastProjectIdCookie(): Promise<string | null> {
  const store = await cookies()
  return store.get(LAST_PROJECT_COOKIE)?.value ?? null
}
