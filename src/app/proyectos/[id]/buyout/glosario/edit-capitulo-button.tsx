"use client"

import { Pencil } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChapterDialog } from "./chapter-dialog"

type Props = {
  projectId: string
  chapterId: string
  nombre: string
}

export function EditCapituloButton({ projectId, chapterId, nombre }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Renombrar ${nombre}`}
      >
        <Pencil className="size-4" />
      </Button>
      <ChapterDialog
        mode="rename"
        projectId={projectId}
        chapterId={chapterId}
        nombre={nombre}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
