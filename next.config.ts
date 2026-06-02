import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // @react-pdf/renderer es pesado y solo se usa server-side (generación de
  // carátulas). Mantenerlo fuera del bundle evita problemas de empaquetado.
  serverExternalPackages: ["@react-pdf/renderer"],
  // El logo del PDF se lee de public/ en runtime (server action); asegurar que
  // el asset viaje en el bundle serverless de la ruta de carátula en Vercel.
  outputFileTracingIncludes: {
    "/proyectos/[id]/caratula": ["./public/logo-nauka.png"],
  },
}

export default nextConfig
