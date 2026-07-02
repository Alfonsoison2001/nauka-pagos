"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PartidaDialog } from "./partida-dialog"

type Props = {
  projectId: string
  chapterNames: string[]
  /** Preselecciona un capítulo (p. ej. al agregar dentro de su sección). */
  defaultChapter?: string
  /** Texto del botón (default "Nueva partida"). */
  label?: string
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm"
}

/** Botón "+ Nueva partida" reutilizable: abre el diálogo de crear partida.
 *  Se usa en el Glosario y como atajo en la pantalla Partida (misma acción). */
export function NuevaPartidaButton({
  projectId,
  chapterNames,
  defaultChapter,
  label = "Nueva partida",
  variant = "default",
  size = "default",
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {label}
      </Button>
      <PartidaDialog
        mode="new"
        projectId={projectId}
        chapterNames={chapterNames}
        defaultChapter={defaultChapter}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
