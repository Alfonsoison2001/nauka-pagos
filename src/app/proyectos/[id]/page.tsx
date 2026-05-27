import { redirect } from "next/navigation"

export default async function ProjectIndexPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/proyectos/${id}/resumen`)
}
