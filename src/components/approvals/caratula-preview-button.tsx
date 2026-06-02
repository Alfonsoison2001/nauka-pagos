"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type CaratulaBanner = {
  tone: "green" | "red" | "amber"
  text: string
}

type Props = {
  previewUrl: string | null
  titulo: string
  banner?: CaratulaBanner | null
}

const BANNER_CLS: Record<CaratulaBanner["tone"], string> = {
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
}

/** Abre el PDF de la carátula en un modal. Deshabilitado si no se ha generado. */
export function CaratulaPreviewButton({ previewUrl, titulo, banner }: Props) {
  const [open, setOpen] = useState(false)

  if (!previewUrl) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        title="Falta generar carátula"
      >
        Ver carátula
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Ver carátula
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        {banner ? (
          <div
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium",
              BANNER_CLS[banner.tone],
            )}
          >
            {banner.text}
          </div>
        ) : null}
        <iframe
          title="Carátula"
          src={previewUrl}
          className="h-[70vh] w-full rounded-md border border-nauka-card-border"
        />
      </DialogContent>
    </Dialog>
  )
}
