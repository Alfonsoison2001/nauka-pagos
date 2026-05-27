"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { deleteProject } from "./actions"

type Props = {
  projectId: string
  projectName: string
}

export function DeleteProjectButton({ projectId, projectName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deleteProject(projectId)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.push("/")
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        Eliminar proyecto
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar el proyecto {projectName}?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer fácilmente. Para restaurar,
              contacta al admin.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={pending} />}
            >
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={pending}
            >
              {pending ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
