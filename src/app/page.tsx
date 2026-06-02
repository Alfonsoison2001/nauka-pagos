import { ClipboardCheck, Users } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { UserMenu } from "@/components/user-menu"
import { getPendingApprovalsCount } from "@/lib/approvals/fetch"
import { formatMXN, formatPct } from "@/lib/format"
import {
  computeResumen,
  type EstatusEstimacion,
  type EstimacionInput,
  type PartidaInput,
} from "@/lib/resumen/compute"
import { createClient } from "@/lib/supabase/server"

type Tile = {
  id: string
  lote: string
  pctAvance: number
  ejercido: number
  presupuesto: number
}

export default async function HomePage() {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect("/login")

  const email = user.email ?? ""
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    email.split("@")[0] ??
    "Usuario"
  const initial = fullName.charAt(0).toUpperCase() || "?"

  const { data: myProfile } = await sb
    .from("profiles")
    .select("role, firmante_id")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()
  const isAdmin = myProfile?.role === "admin"
  // Badge del pill: conteo GLOBAL (Home es vista cross-project).
  const pendingCount = myProfile
    ? await getPendingApprovalsCount(
        sb,
        myProfile.role as "admin" | "aprobador",
        (myProfile.firmante_id as string | null) ?? null,
      )
    : 0

  const { data: projRows } = await sb
    .from("projects")
    .select("id, nombre, lote")
    .is("deleted_at", null)
    .eq("status", "activo")
    .order("nombre")
  const projects = (projRows ?? []) as {
    id: string
    nombre: string
    lote: string | null
  }[]
  const projectIds = projects.map((p) => p.id)

  // Datos de los 3 proyectos en bloque; computeResumen por proyecto.
  type CRow = { id: string; nombre: string; project_id: string }
  type PRow = {
    id: string
    contratista_id: string
    nombre: string
    presupuesto_con_iva: unknown
  }
  type ERow = { partida_id: string; monto_con_iva: unknown; status: string }
  let contratistas: CRow[] = []
  let partidas: PRow[] = []
  let estimaciones: ERow[] = []

  if (projectIds.length > 0) {
    const { data: c } = await sb
      .from("contratistas")
      .select("id, nombre, project_id")
      .in("project_id", projectIds)
      .is("deleted_at", null)
    contratistas = (c ?? []) as CRow[]
    const cIds = contratistas.map((x) => x.id)
    if (cIds.length > 0) {
      const { data: p } = await sb
        .from("partidas")
        .select("id, contratista_id, nombre, presupuesto_con_iva")
        .in("contratista_id", cIds)
        .is("deleted_at", null)
      partidas = (p ?? []) as PRow[]
      const pIds = partidas.map((x) => x.id)
      if (pIds.length > 0) {
        const { data: e } = await sb
          .from("estimaciones")
          .select("partida_id, monto_con_iva, status")
          .in("partida_id", pIds)
          .is("deleted_at", null)
        estimaciones = (e ?? []) as ERow[]
      }
    }
  }

  const cById = new Map(contratistas.map((c) => [c.id, c]))

  const tiles: Tile[] = projects.map((proj) => {
    const projCIds = new Set(
      contratistas.filter((c) => c.project_id === proj.id).map((c) => c.id),
    )
    const projPartidas = partidas.filter((p) => projCIds.has(p.contratista_id))
    const projPartidaIds = new Set(projPartidas.map((p) => p.id))
    const partidaInputs: PartidaInput[] = projPartidas.map((p) => ({
      id: p.id,
      contratistaNombre: cById.get(p.contratista_id)?.nombre ?? "",
      partidaNombre: p.nombre,
      presupuesto: Number(p.presupuesto_con_iva),
    }))
    const estimacionInputs: EstimacionInput[] = estimaciones
      .filter((e) => projPartidaIds.has(e.partida_id))
      .map((e) => ({
        partidaId: e.partida_id,
        monto: Number(e.monto_con_iva),
        status: e.status as EstatusEstimacion,
      }))
    const r = computeResumen({
      partidas: partidaInputs,
      estimaciones: estimacionInputs,
    })
    return {
      id: proj.id,
      lote: proj.lote ?? proj.nombre,
      pctAvance: r.pctAvance,
      ejercido: r.totalEjercido,
      presupuesto: r.totalPresupuesto,
    }
  })

  return (
    <main className="min-h-svh bg-nauka-bg px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium text-nauka-dark">
              NAUKA Pagos
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Selecciona un proyecto
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/aprobaciones"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-nauka-card-border bg-white px-4 text-sm font-medium text-nauka-dark transition-colors hover:bg-nauka-subtle"
            >
              <ClipboardCheck className="size-4" />
              Aprobaciones
              {pendingCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
            {isAdmin ? (
              <Link
                href="/usuarios"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-nauka-card-border bg-white px-4 text-sm font-medium text-nauka-dark transition-colors hover:bg-nauka-subtle"
              >
                <Users className="size-4" />
                Usuarios
              </Link>
            ) : null}
            <UserMenu email={email} displayName={fullName} initial={initial} />
          </div>
        </header>

        {tiles.length === 0 ? (
          <div className="rounded-2xl border border-nauka-card-border bg-white p-12 text-center text-sm text-slate-500 shadow-nauka-card">
            Aún no hay proyectos.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((t) => (
              <ProjectTile key={t.id} tile={t} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function ProjectTile({ tile }: { tile: Tile }) {
  const width = Math.min(100, Math.max(0, tile.pctAvance * 100))
  return (
    <Link
      href={`/proyectos/${tile.id}/resumen`}
      className="group flex flex-col gap-3 rounded-2xl border border-nauka-card-border bg-white p-8 shadow-nauka-card transition-shadow hover:shadow-md"
    >
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {tile.lote.toUpperCase()}
      </span>
      <span className="text-4xl font-medium tabular-nums text-nauka-dark">
        {formatPct(tile.pctAvance)}
      </span>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
        <div
          className="h-full rounded-full bg-nauka-accent transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-sm text-slate-500 tabular-nums">
        {formatMXN(tile.ejercido)} pagado de {formatMXN(tile.presupuesto)}{" "}
        contratado
      </p>
      <span className="mt-2 inline-flex h-9 w-fit items-center rounded-full bg-nauka-dark px-5 text-sm font-medium text-white transition-colors group-hover:bg-nauka-dark/90">
        Entrar →
      </span>
    </Link>
  )
}
