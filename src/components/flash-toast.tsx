"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

// Toast efímero leído de ?flash=<clave>. Sin dependencias: aparece arriba a la
// derecha, se auto-oculta y limpia el query param.
const MESSAGES: Record<string, string> = {
  "password-updated": "Contraseña actualizada",
}

export function FlashToast() {
  const params = useSearchParams()
  const router = useRouter()
  const flash = params.get("flash")
  const message = flash ? MESSAGES[flash] : undefined
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) return
    setVisible(true)
    const hide = setTimeout(() => setVisible(false), 4000)
    const clean = setTimeout(() => router.replace("/", { scroll: false }), 4200)
    return () => {
      clearTimeout(hide)
      clearTimeout(clean)
    }
  }, [message, router])

  if (!visible || !message) return null

  return (
    <div
      role="status"
      className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-lg bg-nauka-dark px-4 py-3 text-sm font-medium text-white shadow-lg"
    >
      ✓ {message}
    </div>
  )
}
