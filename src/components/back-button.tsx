"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

/** Botón "atrás" que regresa a la página anterior (no al Home). */
export function BackButton({ label = "Atrás" }: { label?: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-nauka-dark"
    >
      <ArrowLeft className="size-4" />
      {label}
    </button>
  )
}
