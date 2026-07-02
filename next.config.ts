import type { NextConfig } from "next"

// Fix M1 — headers de seguridad HTTP.
// Los headers de abajo van ENFORCED (protegen desde ya): HSTS, X-Frame-Options,
// nosniff, Referrer-Policy y una Permissions-Policy mínima.
// La CSP va en modo SOLO-REPORTE (Content-Security-Policy-Report-Only): NO
// bloquea nada, solo reporta violaciones en la consola del navegador. Es el
// primer paso recomendado por la auditoría: observar qué necesitaría una CSP
// enforced antes de activarla, sin riesgo de romper la app. Se deja a propósito
// permisiva donde Next/Tailwind lo exigen ('unsafe-inline') y abierta a Supabase
// (API + realtime + Storage de las carátulas/comprobantes).
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' blob: https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

const securityHeaders = [
  // HSTS: fuerza HTTPS (Vercel ya redirige; esto lo refuerza en el navegador).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // Anti-clickjacking (protege el botón de aprobación de un clic).
  { key: "X-Frame-Options", value: "DENY" },
  // Evita MIME-sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No filtrar la URL completa como Referer a otros orígenes.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactivar APIs potentes que la app no usa.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // CSP en modo observación (no enforcement).
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
]

const nextConfig: NextConfig = {
  // Límite del body de los Server Actions. Por defecto Next.js lo corta en 1 MB
  // y rechaza el request ANTES de llegar a la validación de la app ("Body
  // exceeded 1 MB limit"). Los uploads de PDF (Buy-Out y Pagos) permiten hasta
  // 10 MB por archivo; subimos el límite a 10 MB para que el request pase y sea
  // la propia validación de tamaño (cliente + servidor, "máximo 10 MB") la que
  // acepte/rechace. No afecta la lógica de Pagos, solo destapa el mismo límite.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // @react-pdf/renderer es pesado y solo se usa server-side (generación de
  // carátulas). Mantenerlo fuera del bundle evita problemas de empaquetado.
  serverExternalPackages: ["@react-pdf/renderer"],
  // El logo del PDF se lee de public/ en runtime (server action); asegurar que
  // el asset viaje en el bundle serverless de la ruta de carátula en Vercel.
  outputFileTracingIncludes: {
    "/proyectos/[id]/caratula": ["./public/logo-nauka.png"],
  },
  // Aplica los headers de seguridad a todas las rutas.
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }]
  },
}

export default nextConfig
