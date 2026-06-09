"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { createProject } from "@/app/proyectos/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewProjectDialog({ open, onOpenChange }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createProject(formData)
      if ("error" in result) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      router.push(`/proyectos/${result.id}/resumen`)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>
            Captura los datos básicos. Puedes editarlos después desde
            Configuración del proyecto.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="np-nombre">Nombre</Label>
            <Input
              id="np-nombre"
              name="nombre"
              required
              placeholder="NAUKA Lote X"
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="np-lote">Lote</Label>
              <Input
                id="np-lote"
                name="lote"
                placeholder="Lote X"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="np-cliente">Cliente</Label>
              <Input
                id="np-cliente"
                name="cliente"
                defaultValue="NAUKA"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="np-ubicacion">Ubicación</Label>
            <Input
              id="np-ubicacion"
              name="ubicacion"
              placeholder="Dirección o nombre del desarrollo"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="np-iva">IVA en carátula</Label>
            <Select
              name="caratula_iva_mode"
              defaultValue="con_iva"
              items={[
                { value: "con_iva", label: "Con IVA" },
                { value: "sin_iva", label: "Sin IVA" },
              ]}
            >
              <SelectTrigger id="np-iva">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="con_iva">Con IVA</SelectItem>
                <SelectItem value="sin_iva">Sin IVA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando..." : "Crear proyecto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
