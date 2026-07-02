"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChapterDialog } from "./chapter-dialog"

type Props = {
  projectId: string
  nextOrden: number
}

export function NuevoCapituloButton({ projectId, nextOrden }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nuevo capítulo
      </Button>
      <ChapterDialog
        mode="new"
        projectId={projectId}
        nextOrden={nextOrden}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
