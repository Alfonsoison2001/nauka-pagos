"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { moveConcepto } from "./actions"

type Props = {
  projectId: string
  conceptoId: string
  nombre: string
  isFirst: boolean
  isLast: boolean
}

/** Flechas para subir/bajar un concepto un lugar dentro de su partida. */
export function ReordenarConcepto({
  projectId,
  conceptoId,
  nombre,
  isFirst,
  isLast,
}: Props) {
  const [pending, startTransition] = useTransition()

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await moveConcepto(projectId, conceptoId, direction)
    })
  }

  return (
    <div className="inline-flex items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        disabled={pending || isFirst}
        onClick={() => move("up")}
        aria-label={`Subir ${nombre}`}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        disabled={pending || isLast}
        onClick={() => move("down")}
        aria-label={`Bajar ${nombre}`}
      >
        <ChevronDown className="size-4" />
      </Button>
    </div>
  )
}
