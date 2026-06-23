import { BuyoutSubNav } from "@/components/buyout/buyout-sub-nav"

/**
 * Layout de la sección Buy-Out. Vive ANIDADO dentro del layout del proyecto
 * (sidebar + topbar de Pagos siguen visibles para conservar el contexto y
 * permitir volver a Pagos), pero monta su PROPIA sub-navegación de las 3
 * pantallas del módulo (SPEC-buyout.md §6). El proyecto ya fue validado por el
 * layout padre `proyectos/[id]/layout.tsx`, así que aquí no se re-consulta.
 */
export default async function BuyoutLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="flex flex-col gap-6">
      <BuyoutSubNav projectId={id} />
      {children}
    </div>
  )
}
