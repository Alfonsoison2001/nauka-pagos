import { Upload } from "lucide-react"
import { notFound } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata = { title: "Buy-Out · Partida" }

// Las 22 columnas del formato verde (B…W) tal cual el Excel BUY OUT L3
// (docs/future-modules/buyout-L3-estructura.md §2). `numeric` solo alinea a la
// derecha; el detalle real lo llena el importador en el Slice 2b.
const GREEN_COLUMNS: { label: string; numeric?: boolean }[] = [
  { label: "CATEGORÍA" },
  { label: "CONCEPTO" },
  { label: "DETALLE" },
  { label: "Villa/Casita" },
  { label: "PISO" },
  { label: "DEPTO" },
  { label: "PROVEEDOR" },
  { label: "UNIDAD" },
  { label: "CANTIDAD", numeric: true },
  { label: "MONEDA" },
  { label: "$ UNITARIO", numeric: true },
  { label: "IMPORTE SIN IVA", numeric: true },
  { label: "SOBRECOSTO", numeric: true },
  { label: "TOTAL SOBRECOSTO", numeric: true },
  { label: "% IVA", numeric: true },
  { label: "$ IVA", numeric: true },
  { label: "IMPORTE TOTAL", numeric: true },
  { label: "T.C", numeric: true },
  { label: "TOTAL MXN", numeric: true },
  { label: "NOTAS" },
  { label: "PARAMETRICO/PPTO" },
  { label: "CONTRATADO/NO CONTRATADO" },
]

/**
 * Página de Partida (formato verde) — Slice 2a: ARMAZÓN. Renderiza los
 * encabezados de las 22 columnas con la tabla vacía y un botón "Importar"
 * deshabilitado (el importador llega en el Slice 2b). Lee buyout_item del
 * proyecto para confirmar que aún no hay renglones capturados.
 */
export default async function BuyoutPartidaPage({
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

  // Núcleo transaccional aún vacío (se puebla en 2b vía el importador).
  const { data: items } = await sb
    .from("buyout_item")
    .select("id")
    .eq("project_id", id)
    .is("deleted_at", null)
    .limit(1)
  const hayRenglones = (items ?? []).length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-nauka-dark">
            Renglones de la partida
          </h2>
          <p className="text-sm text-muted-foreground">
            Formato verde · 22 columnas. Selecciona e importa una partida en el
            siguiente paso.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="El importador llega en el Slice 2b"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "cursor-not-allowed",
            )}
          >
            <Upload className="size-4" />
            Importar
          </button>
          <span className="text-xs text-muted-foreground">
            Disponible en el Slice 2b
          </span>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
        <table className="w-full text-sm whitespace-nowrap tabular-nums">
          <thead className="sticky top-0 z-10">
            <tr className="bg-nauka-dark text-xs uppercase tracking-wider text-white/70">
              {GREEN_COLUMNS.map((col) => (
                <th
                  key={col.label}
                  className={cn(
                    "px-3 py-2.5",
                    col.numeric ? "text-right" : "text-left",
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={GREEN_COLUMNS.length}
                className="px-3 py-10 text-center text-sm text-muted-foreground"
              >
                {hayRenglones
                  ? "Renglones cargados (se mostrarán aquí)."
                  : "Sin renglones. Importa una partida en el Slice 2b para llenar esta tabla."}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-nauka-subtle bg-nauka-bg text-xs uppercase tracking-wider text-muted-foreground">
              <td className="px-3 py-2 font-medium">Total</td>
              <td colSpan={GREEN_COLUMNS.length - 1} className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
