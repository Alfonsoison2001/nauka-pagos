import { Resend } from "resend"
import { getResendConfig } from "@/lib/env-server"

/**
 * Cliente Resend listo para usar, o null si falta RESEND_API_KEY.
 * Devuelve también el remitente (`from`) resuelto desde el entorno.
 *
 * Server-only: importar solo desde server actions.
 */
export function getResend(): { resend: Resend; from: string } | null {
  const cfg = getResendConfig()
  if (!cfg) return null
  return { resend: new Resend(cfg.apiKey), from: cfg.from }
}
