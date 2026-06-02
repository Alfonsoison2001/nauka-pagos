import { createClient as createAdminSupabase } from "@supabase/supabase-js"
import { env } from "@/lib/env"
import { getServiceRoleKey } from "@/lib/env-server"

/**
 * Cliente Supabase con service-role. SERVER-ONLY.
 *
 * Uso EXCLUSIVO: la Admin API de Auth (invitar usuarios, generar enlaces). NO
 * se usa para leer/escribir tablas — el service_role de este proyecto no tiene
 * grants de tabla; las operaciones de datos van por el cliente SSR autenticado
 * (que respeta RLS). Nunca importar esto desde un componente cliente.
 *
 * Devuelve null si SUPABASE_SERVICE_ROLE_KEY no está configurada, para que la
 * acción que lo use muestre un error claro en vez de romper.
 */
export function createAdminClient() {
  const serviceRoleKey = getServiceRoleKey()
  if (!serviceRoleKey) return null

  return createAdminSupabase(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
