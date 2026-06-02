"use client"

import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { inviteUser, setUserActive, updateUserRole } from "./actions"

export type UsuarioRow = {
  id: string
  email: string
  nombre: string
  role: "admin" | "aprobador"
  firmanteNombre: string | null
  active: boolean
  isSelf: boolean
}
export type FirmanteOption = { id: string; label: string }

const selectCls =
  "h-9 rounded-lg border border-nauka-card-border bg-white px-2.5 text-sm text-nauka-dark focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"

export function UsuariosClient({
  usuarios,
  firmantes,
}: {
  usuarios: UsuarioRow[]
  firmantes: FirmanteOption[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <InviteCard firmantes={firmantes} />
      <UsersCard usuarios={usuarios} />
    </div>
  )
}

function Field({
  id,
  name,
  label,
  type = "text",
}: {
  id: string
  name: string
  label: string
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} required maxLength={120} />
    </div>
  )
}

function InviteCard({ firmantes }: { firmantes: FirmanteOption[] }) {
  const [role, setRole] = useState<"admin" | "aprobador">("aprobador")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [formKey, setFormKey] = useState(0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    setOk(false)
    startTransition(async () => {
      const r = await inviteUser(fd)
      if ("error" in r) {
        setError(r.error)
        return
      }
      setOk(true)
      setRole("aprobador")
      setFormKey((k) => k + 1)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitar usuario</CardTitle>
        <CardDescription>
          Se le enviará un enlace de acceso (magic link) por correo. Los
          aprobadores pueden vincularse a un firmante para que sus firmas
          coincidan con las carátulas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          key={formKey}
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <Field id="inv-nombre" name="nombre" label="Nombre" />
          <Field id="inv-email" name="email" label="Correo" type="email" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-role">Rol</Label>
            <select
              id="inv-role"
              name="role"
              className={selectCls}
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "aprobador")}
            >
              <option value="aprobador">Aprobador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {role === "aprobador" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-firmante">Firmante vinculado</Label>
              <select
                id="inv-firmante"
                name="firmante_id"
                className={selectCls}
                defaultValue=""
              >
                <option value="">— Sin vincular —</option>
                {firmantes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Invitando..." : "Enviar invitación"}
            </Button>
            {ok ? (
              <span className="text-sm text-green-700">
                Invitación enviada.
              </span>
            ) : null}
            {error ? (
              <span className="text-sm text-destructive">{error}</span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function UsersCard({ usuarios }: { usuarios: UsuarioRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios de la plataforma</CardTitle>
      </CardHeader>
      <CardContent>
        {usuarios.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            Aún no hay usuarios.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {usuarios.map((u) => (
              <UserRow key={u.id} u={u} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function UserRow({ u }: { u: UsuarioRow }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function changeRole(role: string) {
    setError(null)
    startTransition(async () => {
      const r = await updateUserRole(u.id, role)
      if ("error" in r) setError(r.error)
    })
  }
  function toggleActive() {
    setError(null)
    startTransition(async () => {
      const r = await setUserActive(u.id, !u.active)
      if ("error" in r) setError(r.error)
    })
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-1 rounded-md border px-3 py-2",
        !u.active && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{u.nombre}</span>
            {u.isSelf ? <Badge variant="secondary">Tú</Badge> : null}
            {!u.active ? <Badge variant="secondary">Inactivo</Badge> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {u.email}
            {u.firmanteNombre ? ` · firma como ${u.firmanteNombre}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            key={u.role}
            defaultValue={u.role}
            className={selectCls}
            disabled={pending || u.isSelf}
            onChange={(e) => changeRole(e.target.value)}
            aria-label={`Rol de ${u.nombre}`}
          >
            <option value="aprobador">Aprobador</option>
            <option value="admin">Administrador</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || u.isSelf}
            onClick={toggleActive}
          >
            {u.active ? "Desactivar" : "Activar"}
          </Button>
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </li>
  )
}
