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
import { addProjectPagador, removeProjectPagador } from "./actions"
import { ConfigurationForm } from "./configuration-form"
import { DeleteProjectButton } from "./delete-project-button"

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
    .select("id, nombre")
    .is("project_id", null)
    .is("deleted_at", null)
    .order("nombre")

  const { data: projectPagadores } = await supabase
    .from("pagadores")
    .select("id, nombre")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("nombre")

  const { count: firmantesCount } = await supabase
    .from("firmantes")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)

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
            Los 4 pagadores globales aparecen en cada proyecto. Puedes agregar
            pagadores específicos solo para este proyecto.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium">Globales</p>
            <ul className="flex flex-col gap-1.5">
              {globalPagadores?.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>{p.nombre}</span>
                  <Badge variant="secondary">Global</Badge>
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
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{p.nombre}</span>
                    <form
                      action={removeProjectPagador.bind(null, p.id, project.id)}
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
              className="mt-3 flex gap-2"
            >
              <Input
                name="nombre"
                placeholder="Nombre del pagador específico"
                aria-label="Nombre del nuevo pagador"
                required
                maxLength={120}
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
            Personas que pueden firmar carátulas de este proyecto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {firmantesCount && firmantesCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              Multi-select de firmantes llega cuando esté lista la biblioteca
              global (/firmantes, día posterior).
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Aún no hay firmantes en la biblioteca global. La página /firmantes
              para crearlos llega en un día posterior.
            </p>
          )}
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
