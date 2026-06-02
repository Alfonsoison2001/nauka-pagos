import { notFound } from "next/navigation"
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
import { createClient } from "@/lib/supabase/server"
import {
  addProjectPagador,
  removeProjectPagador,
  updatePagadorEmail,
} from "./actions"
import { ConfigurationForm } from "./configuration-form"
import { DeleteProjectButton } from "./delete-project-button"
import { type FirmanteItem, FirmantesSection } from "./firmantes-section"

export const metadata = {
  title: "Configuración",
}

export default async function ConfiguracionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, nombre, lote, cliente, ubicacion, caratula_iva_mode, default_emails, logo_url",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!project) {
    notFound()
  }

  // Generate a signed URL for the logo preview (bucket is private)
  let logoSignedUrl: string | null = null
  if (project.logo_url) {
    const { data: signed } = await supabase.storage
      .from("proyectos")
      .createSignedUrl(project.logo_url, 60 * 60) // 1h
    logoSignedUrl = signed?.signedUrl ?? null
  }

  const { data: globalPagadores } = await supabase
    .from("pagadores")
    .select("id, nombre, email")
    .is("project_id", null)
    .is("deleted_at", null)
    .order("nombre")

  const { data: projectPagadores } = await supabase
    .from("pagadores")
    .select("id, nombre, email")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("nombre")

  // Firmantes de este proyecto + info de "compartido con N proyectos"
  type FJoin = {
    id: string
    nombre: string
    cargo: string
    empresa: string
    email: string
    deleted_at: string | null
  }
  const { data: pfRaw } = await supabase
    .from("project_firmantes")
    .select(
      "orden, firmante_id, firmantes(id, nombre, cargo, empresa, email, deleted_at)",
    )
    .eq("project_id", id)
    .order("orden")
  const pfRows = (pfRaw ?? []) as Array<{
    orden: number
    firmante_id: string
    firmantes: FJoin | FJoin[] | null
  }>
  const projectFirmantes = pfRows
    .map((row) => {
      const f = Array.isArray(row.firmantes) ? row.firmantes[0] : row.firmantes
      return f && !f.deleted_at ? { orden: row.orden, f } : null
    })
    .filter((x): x is { orden: number; f: FJoin } => x !== null)
  const firmanteIds = projectFirmantes.map((x) => x.f.id)

  // Sharing: cuántos (y cuáles) proyectos activos firma cada uno
  type PJoin = { id: string; nombre: string; deleted_at: string | null }
  const otherProjectsByFirmante = new Map<string, string[]>()
  const countByFirmante = new Map<string, number>()
  if (firmanteIds.length > 0) {
    const { data: linksRaw } = await supabase
      .from("project_firmantes")
      .select("firmante_id, projects(id, nombre, deleted_at)")
      .in("firmante_id", firmanteIds)
    const linkRows = (linksRaw ?? []) as Array<{
      firmante_id: string
      projects: PJoin | PJoin[] | null
    }>
    for (const row of linkRows) {
      const p = Array.isArray(row.projects) ? row.projects[0] : row.projects
      if (!p || p.deleted_at) continue
      countByFirmante.set(
        row.firmante_id,
        (countByFirmante.get(row.firmante_id) ?? 0) + 1,
      )
      if (p.id !== id) {
        const arr = otherProjectsByFirmante.get(row.firmante_id) ?? []
        arr.push(p.nombre)
        otherProjectsByFirmante.set(row.firmante_id, arr)
      }
    }
  }

  const firmantesItems: FirmanteItem[] = projectFirmantes.map(
    ({ orden, f }) => ({
      id: f.id,
      nombre: f.nombre,
      cargo: f.cargo,
      empresa: f.empresa,
      email: f.email,
      orden,
      sharedCount: countByFirmante.get(f.id) ?? 1,
      otherProjects: otherProjectsByFirmante.get(f.id) ?? [],
    }),
  )

  return (
    <div className="flex flex-col gap-6">
      <ConfigurationForm
        project={{
          id: project.id,
          nombre: project.nombre,
          lote: project.lote,
          cliente: project.cliente,
          ubicacion: project.ubicacion,
          caratula_iva_mode: project.caratula_iva_mode as "con_iva" | "sin_iva",
          default_emails: project.default_emails ?? [],
          logoSignedUrl,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Pagadores</CardTitle>
          <CardDescription>
            Quién mueve el dinero (Salomon Ison, Fasja, NAUKA…). Su correo es el
            destinatario de la carátula / solicitud de pago. Editar el correo de
            un pagador global aplica a todos los proyectos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium">Globales</p>
            <ul className="flex flex-col gap-1.5">
              {globalPagadores?.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span>{p.nombre}</span>
                    <Badge variant="secondary">Global</Badge>
                  </div>
                  <PagadorEmailForm
                    pagadorId={p.id}
                    projectId={project.id}
                    nombre={p.nombre}
                    email={p.email ?? null}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              Específicos de este proyecto
            </p>
            {projectPagadores && projectPagadores.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {projectPagadores.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>{p.nombre}</span>
                    <div className="flex items-center gap-2">
                      <PagadorEmailForm
                        pagadorId={p.id}
                        projectId={project.id}
                        nombre={p.nombre}
                        email={p.email ?? null}
                      />
                      <form
                        action={removeProjectPagador.bind(
                          null,
                          p.id,
                          project.id,
                        )}
                      >
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          aria-label={`Quitar ${p.nombre}`}
                        >
                          Quitar
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                Ninguno todavía.
              </p>
            )}
            <form
              action={addProjectPagador.bind(null, project.id)}
              className="mt-3 flex flex-col gap-2 sm:flex-row"
            >
              <Input
                name="nombre"
                placeholder="Nombre del pagador"
                aria-label="Nombre del nuevo pagador"
                required
                maxLength={120}
              />
              <Input
                name="email"
                type="email"
                placeholder="Correo (opcional)"
                aria-label="Correo del nuevo pagador"
              />
              <Button type="submit">Agregar</Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firmantes asignados</CardTitle>
          <CardDescription>
            Personas que firman las carátulas de este proyecto (bloque de
            autorizaciones, máximo 3).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FirmantesSection projectId={project.id} firmantes={firmantesItems} />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de peligro</CardTitle>
          <CardDescription>
            Las acciones de esta sección son difíciles de revertir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteProjectButton
            projectId={project.id}
            projectName={project.nombre}
          />
        </CardContent>
      </Card>
    </div>
  )
}

/** Editor inline del correo de un pagador (destinatario de la carátula). */
function PagadorEmailForm({
  pagadorId,
  projectId,
  nombre,
  email,
}: {
  pagadorId: string
  projectId: string
  nombre: string
  email: string | null
}) {
  return (
    <form
      action={updatePagadorEmail.bind(null, pagadorId, projectId)}
      className="flex items-center gap-2"
    >
      <Input
        name="email"
        type="email"
        defaultValue={email ?? ""}
        placeholder="correo@pagador.com"
        aria-label={`Correo de ${nombre}`}
        className="h-8 w-full sm:w-56"
      />
      <Button type="submit" variant="ghost" size="sm">
        Guardar
      </Button>
    </form>
  )
}
