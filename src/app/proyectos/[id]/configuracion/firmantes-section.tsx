"use client"

import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  addProjectFirmante,
  removeProjectFirmante,
  updateFirmante,
} from "./actions"

export type FirmanteItem = {
  id: string
  nombre: string
  cargo: string
  empresa: string
  email: string
  orden: number
  sharedCount: number
  otherProjects: string[]
}

type Props = {
  projectId: string
  firmantes: FirmanteItem[]
}

export function FirmantesSection({ projectId, firmantes }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {firmantes.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {firmantes.map((f) => (
            <FirmanteRow key={f.id} firmante={f} projectId={projectId} />
          ))}
        </ul>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          Ningún firmante en este proyecto todavía.
        </p>
      )}

      {firmantes.length >= 3 ? (
        <p className="text-xs text-muted-foreground">
          Máximo 3 firmantes por proyecto. Quita uno para agregar otro.
        </p>
      ) : (
        <AddFirmanteForm projectId={projectId} />
      )}
    </div>
  )
}

// ── Fila ──────────────────────────────────────────────────────────────────────

function FirmanteRow({
  firmante,
  projectId,
}: {
  firmante: FirmanteItem
  projectId: string
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRemove() {
    setError(null)
    startTransition(async () => {
      const r = await removeProjectFirmante(firmante.id, projectId)
      if ("error" in r) setError(r.error)
    })
  }

  return (
    <li className="flex flex-col gap-1 rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{firmante.nombre}</span>
            {firmante.sharedCount > 1 && (
              <Badge variant="secondary">
                Compartido con {firmante.sharedCount} proyectos
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {firmante.cargo} · {firmante.empresa} · {firmante.email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditOpen(true)}
            disabled={pending}
          >
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={pending}
            aria-label={`Quitar ${firmante.nombre}`}
          >
            Quitar
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <EditFirmanteDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        firmante={firmante}
        projectId={projectId}
      />
    </li>
  )
}

// ── Campos compartidos ──────────────────────────────────────────────────────

function FirmanteFields({
  prefix,
  defaults,
}: {
  prefix: string
  defaults?: Partial<
    Pick<FirmanteItem, "nombre" | "cargo" | "empresa" | "email">
  >
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field
        id={`${prefix}-nombre`}
        name="nombre"
        label="Nombre"
        defaultValue={defaults?.nombre}
      />
      <Field
        id={`${prefix}-cargo`}
        name="cargo"
        label="Cargo"
        defaultValue={defaults?.cargo}
      />
      <Field
        id={`${prefix}-empresa`}
        name="empresa"
        label="Empresa"
        defaultValue={defaults?.empresa}
      />
      <Field
        id={`${prefix}-email`}
        name="email"
        label="Correo"
        type="email"
        defaultValue={defaults?.email}
      />
    </div>
  )
}

function Field({
  id,
  name,
  label,
  type = "text",
  defaultValue,
}: {
  id: string
  name: string
  label: string
  type?: string
  defaultValue?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        maxLength={120}
      />
    </div>
  )
}

// ── Agregar ─────────────────────────────────────────────────────────────────

function AddFirmanteForm({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const r = await addProjectFirmante(projectId, fd)
      if ("error" in r) {
        setError(r.error)
        return
      }
      setFormKey((k) => k + 1) // reset inputs
    })
  }

  return (
    <form
      key={formKey}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-dashed p-3"
    >
      <p className="text-sm font-medium">Agregar firmante</p>
      <FirmanteFields prefix="add" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Agregando..." : "Agregar"}
        </Button>
      </div>
    </form>
  )
}

// ── Editar ────────────────────────────────────────────────────────────────────

function EditFirmanteDialog({
  open,
  onOpenChange,
  firmante,
  projectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  firmante: FirmanteItem
  projectId: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const r = await updateFirmante(firmante.id, projectId, fd)
      if ("error" in r) {
        setError(r.error)
        return
      }
      onOpenChange(false)
    })
  }

  const shared = firmante.otherProjects.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Editar firmante</DialogTitle>
        </DialogHeader>

        {shared && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            Este firmante también firma en:{" "}
            <strong>{firmante.otherProjects.join(", ")}</strong>. Los cambios
            aplican a los {firmante.sharedCount} proyectos.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FirmanteFields prefix={`edit-${firmante.id}`} defaults={firmante} />
          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="mt-4">
            <DialogClose
              render={
                <Button variant="outline" type="button" disabled={pending} />
              }
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
