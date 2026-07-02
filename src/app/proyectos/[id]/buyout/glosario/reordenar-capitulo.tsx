"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { moveChapter } from "./actions"

type Props = {
  projectId: string
  chapterId: string
  nombre: string
  isFirst: boolean
  isLast: boolean
}

/** Flechas para subir/bajar un capítulo un lugar en el tablero. */
export function ReordenarCapitulo({
  projectId,
  chapterId,
  nombre,
  isFirst,
  isLast,
}: Props) {
  const [pending, startTransition] = useTransition()

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await moveChapter(projectId, chapterId, direction)
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
