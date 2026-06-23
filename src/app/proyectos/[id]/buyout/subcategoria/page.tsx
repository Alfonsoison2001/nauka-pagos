import { FileClock } from "lucide-react"
import { notFound } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Buy-Out · Subcategoría" }

// Lo que vivirá aquí cuando haya datos (spec §6.3): versiones fechadas de la
// cotización (cada una con su PDF), la vigente resaltada, comparativo de
// proveedores y el botón "marcar contratado".
const FUTURO = [
  "Versiones de la cotización por fecha, cada una con su PDF.",
  "La cotización vigente resaltada (la eliges tú; default la más reciente).",
  "Comparativo de proveedores para la misma subcategoría.",
  "Botón “marcar contratado” + liga manual al contrato de Pagos.",
]

/**
 * Subcategoría (historial de versiones) — Slice 2a: ARMAZÓN. Placeholder del
 * historial. Lee buyout_quote para confirmar que aún no hay cotizaciones; el
 * contenido real (versiones, comparativo, marcar contratado) llega en slices
 * posteriores.
 */
export default async function BuyoutSubcategoriaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sb = await createClient()

  const { data: project } = await sb
    .from("projects")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!project) notFound()

  // Cotizaciones del proyecto (vía sus items). Aún vacío en el Slice 2a.
  const { data: items } = await sb
    .from("buyout_item")
    .select("id")
    .eq("project_id", id)
    .is("deleted_at", null)
    .limit(1)
  const hayCotizaciones = (items ?? []).length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de versiones</CardTitle>
        <CardDescription>
          Cotizaciones fechadas de una subcategoría, su comparativo y el estado
          de contratación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-dashed border-nauka-card-border p-8 text-center">
          <FileClock className="mx-auto size-8 text-nauka-neutral" />
          <p className="mt-3 text-sm font-medium text-nauka-dark">
            {hayCotizaciones
              ? "Selecciona una subcategoría para ver su historial."
              : "Aún no hay cotizaciones."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            El historial se llena al importar cotizaciones (Slice 2b en
            adelante).
          </p>
          <ul className="mx-auto mt-5 flex max-w-md flex-col gap-2 text-left text-sm text-muted-foreground">
            {FUTURO.map((linea) => (
              <li key={linea} className="flex gap-2">
                <span className="text-nauka-accent">•</span>
                <span>{linea}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
