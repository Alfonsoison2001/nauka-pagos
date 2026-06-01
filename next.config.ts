import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // @react-pdf/renderer es pesado y solo se usa server-side (generación de
  // carátulas). Mantenerlo fuera del bundle evita problemas de empaquetado.
  serverExternalPackages: ["@react-pdf/renderer"],
}

export default nextConfig
