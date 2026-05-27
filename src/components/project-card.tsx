import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  id: string
  nombre: string
  lote: string | null
  ubicacion: string | null
  status: string
}

export function ProjectCard({ id, nombre, lote, ubicacion, status }: Props) {
  return (
    <Link
      href={`/proyectos/${id}/resumen`}
      className="block transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base">{nombre}</CardTitle>
            <Badge variant="secondary">{status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          {lote ? <p>Lote: {lote}</p> : null}
          {ubicacion ? <p>Ubicación: {ubicacion}</p> : null}
          {!lote && !ubicacion ? (
            <p className="italic">Sin ubicación capturada</p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  )
}
