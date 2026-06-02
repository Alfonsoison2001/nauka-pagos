import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { UserMenu } from "@/components/user-menu"
import { requireAdmin } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import {
  type FirmanteOption,
  type UsuarioRow,
  UsuariosClient,
} from "./usuarios-client"

export const metadata = { title: "Usuarios" }

type FirmanteJoin = { nombre: string } | { nombre: string }[] | null

export default async function UsuariosPage() {
  const me = await requireAdmin()
  const sb = await createClient()

  const { data: profRaw } = await sb
    .from("profiles")
    .select(
      "id, email, nombre, role, firmante_id, deleted_at, firmantes(nombre)",
    )
    .order("role")
    .order("nombre")

  const profiles = (profRaw ?? []) as Array<{
    id: string
    email: string
    nombre: string
    role: "admin" | "aprobador"
    firmante_id: string | null
    deleted_at: string | null
    firmantes: FirmanteJoin
  }>

  const usuarios: UsuarioRow[] = profiles.map((p) => {
    const f = Array.isArray(p.firmantes) ? p.firmantes[0] : p.firmantes
    return {
      id: p.id,
      email: p.email,
      nombre: p.nombre,
      role: p.role,
      firmanteNombre: f?.nombre ?? null,
      active: !p.deleted_at,
      isSelf: p.id === me.id,
    }
  })

  const { data: firmRaw } = await sb
    .from("firmantes")
    .select("id, nombre, empresa")
    .is("deleted_at", null)
    .order("nombre")
  const firmantes: FirmanteOption[] = (firmRaw ?? []).map((f) => ({
    id: f.id as string,
    label: `${f.nombre as string} · ${f.empresa as string}`,
  }))

  const initial = me.nombre.charAt(0).toUpperCase() || "?"

  return (
    <main className="min-h-svh bg-nauka-bg px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-nauka-dark"
            >
              <ArrowLeft className="size-4" />
              Inicio
            </Link>
            <h1 className="text-3xl font-medium text-nauka-dark">Usuarios</h1>
            <p className="mt-1 text-sm text-slate-500">
              Invita y administra quién entra a la plataforma y con qué rol.
            </p>
          </div>
          <UserMenu
            email={me.email}
            displayName={me.nombre}
            initial={initial}
          />
        </header>

        <UsuariosClient usuarios={usuarios} firmantes={firmantes} />
      </div>
    </main>
  )
}
