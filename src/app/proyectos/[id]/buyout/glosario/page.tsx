import { BookText } from "lucide-react"
import { notFound } from "next/navigation"
import { isAdmin } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import type { ChapterRow, PartidaRow } from "./actions"
import { DeleteCapituloButton } from "./delete-capitulo-button"
import { DeletePartidaButton } from "./delete-partida-button"
import { EditCapituloButton } from "./edit-capitulo-button"
import { EditPartidaButton } from "./edit-partida-button"
import { NuevaPartidaButton } from "./nueva-partida-button"
import { NuevoCapituloButton } from "./nuevo-capitulo-button"
import { ReordenarCapitulo } from "./reordenar-capitulo"

export const metadata = { title: "Buy-Out · Glosario" }

type Group = { chapter: ChapterRow | null; partidas: PartidaRow[] }

export default async function BuyoutGlosarioPage({
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

  const admin = await isAdmin()
  const { chapters, groups, chapterNames, nextOrden } = await loadGlosario(
    sb,
    id,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-nauka-subtle text-nauka-dark">
            <BookText className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-nauka-dark">Glosario</h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              Administra los catálogos de este proyecto: capítulos y partidas.
              {admin ? "" : " (solo lectura)"}
            </p>
          </div>
        </div>
        {admin ? (
          <NuevoCapituloButton projectId={id} nextOrden={nextOrden} />
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <ChapterSection
            key={g.chapter?.id ?? "sin-capitulo"}
            projectId={id}
            group={g}
            chapters={chapters}
            chapterNames={chapterNames}
            admin={admin}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sección de un capítulo (o el grupo "Sin capítulo") con sus partidas
// ---------------------------------------------------------------------------

function ChapterSection({
  projectId,
  group,
  chapters,
  chapterNames,
  admin,
}: {
  projectId: string
  group: Group
  chapters: ChapterRow[]
  chapterNames: string[]
  admin: boolean
}) {
  const { chapter, partidas } = group
  const idx = chapter ? chapters.findIndex((c) => c.id === chapter.id) : -1

  return (
    <section className="overflow-hidden rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-nauka-subtle bg-nauka-bg px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-nauka-dark">
            {chapter?.nombre ?? "Sin capítulo"}
          </h3>
          <span className="text-xs text-muted-foreground">
            {partidas.length} partida{partidas.length === 1 ? "" : "s"}
          </span>
        </div>
        {admin ? (
          <div className="flex items-center gap-1">
            {chapter ? (
              <>
                <ReordenarCapitulo
                  projectId={projectId}
                  chapterId={chapter.id}
                  nombre={chapter.nombre}
                  isFirst={idx === 0}
                  isLast={idx === chapters.length - 1}
                />
                <EditCapituloButton
                  projectId={projectId}
                  chapterId={chapter.id}
                  nombre={chapter.nombre}
                />
                <DeleteCapituloButton
                  projectId={projectId}
                  chapterId={chapter.id}
                  nombre={chapter.nombre}
                  partidaCount={chapter.partidaCount}
                />
              </>
            ) : null}
            <NuevaPartidaButton
              projectId={projectId}
              chapterNames={chapterNames}
              defaultChapter={chapter?.nombre}
              label="Partida"
              variant="ghost"
              size="sm"
            />
          </div>
        ) : null}
      </header>

      {partidas.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Sin partidas en este capítulo.
        </p>
      ) : (
        <ul className="divide-y divide-nauka-subtle">
          {partidas.map((p) => (
            <PartidaRowItem
              key={p.id}
              projectId={projectId}
              partida={p}
              chapterNames={chapterNames}
              admin={admin}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function PartidaRowItem({
  projectId,
  partida,
  chapterNames,
  admin,
}: {
  projectId: string
  partida: PartidaRow
  chapterNames: string[]
  admin: boolean
}) {
  const conDatos = partida.itemCount > 0
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-nauka-bg">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          title={conDatos ? "Con datos capturados" : "Sin datos"}
          className={cn(
            "inline-block size-2 shrink-0 rounded-full",
            conDatos ? "bg-nauka-success" : "bg-nauka-neutral/40",
          )}
        />
        <span className="truncate text-sm font-medium text-nauka-dark">
          {partida.nombre}
        </span>
        {partida.unidad_driver ? (
          <span className="shrink-0 rounded-full bg-nauka-subtle px-2 py-0.5 text-xs text-muted-foreground">
            {partida.unidad_driver}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {partida.conceptoCount > 0
            ? `${partida.conceptoCount} concepto${partida.conceptoCount === 1 ? "" : "s"}`
            : "—"}
        </span>
        {admin ? (
          <div className="flex items-center">
            <EditPartidaButton
              projectId={projectId}
              chapterNames={chapterNames}
              partida={{
                id: partida.id,
                nombre: partida.nombre,
                chapter_default: partida.chapter_default,
                unidad_driver: partida.unidad_driver,
              }}
            />
            <DeletePartidaButton
              projectId={projectId}
              partidaId={partida.id}
              nombre={partida.nombre}
              itemCount={partida.itemCount}
            />
          </div>
        ) : null}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Carga de datos: capítulos + partidas + conteos (conceptos / datos capturados)
// ---------------------------------------------------------------------------

type Sb = Awaited<ReturnType<typeof createClient>>

async function loadGlosario(sb: Sb, projectId: string) {
  const [chapterRes, partidaRes, itemRes] = await Promise.all([
    sb
      .from("buyout_chapter")
      .select("id, nombre, orden")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
    sb
      .from("buyout_partida_catalog")
      .select("id, nombre, chapter_default, unidad_driver, orden")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("orden", { ascending: true }),
    sb
      .from("buyout_item")
      .select("partida_catalog_id")
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ])

  const partidaIds = (partidaRes.data ?? []).map((p) => p.id as string)
  const conceptoCount = new Map<string, number>()
  if (partidaIds.length > 0) {
    const { data: conceptos } = await sb
      .from("buyout_concepto_catalog")
      .select("partida_catalog_id")
      .in("partida_catalog_id", partidaIds)
      .is("deleted_at", null)
    for (const c of conceptos ?? []) {
      const k = c.partida_catalog_id as string
      conceptoCount.set(k, (conceptoCount.get(k) ?? 0) + 1)
    }
  }
  const itemCount = new Map<string, number>()
  for (const it of itemRes.data ?? []) {
    const k = it.partida_catalog_id as string
    itemCount.set(k, (itemCount.get(k) ?? 0) + 1)
  }

  const partidas: PartidaRow[] = (partidaRes.data ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    chapter_default: (p.chapter_default as string | null) ?? null,
    unidad_driver: (p.unidad_driver as string | null) ?? null,
    orden: Number(p.orden),
    conceptoCount: conceptoCount.get(p.id as string) ?? 0,
    itemCount: itemCount.get(p.id as string) ?? 0,
  }))

  const chapterNames = (chapterRes.data ?? []).map((c) => c.nombre as string)
  const known = new Set(chapterNames)
  const chapters: ChapterRow[] = (chapterRes.data ?? []).map((c) => ({
    id: c.id as string,
    nombre: c.nombre as string,
    orden: Number(c.orden),
    partidaCount: partidas.filter((p) => p.chapter_default === c.nombre).length,
  }))

  const groups: Group[] = chapters.map((c) => ({
    chapter: c,
    partidas: partidas.filter((p) => p.chapter_default === c.nombre),
  }))
  const sinCap = partidas.filter(
    (p) => !p.chapter_default || !known.has(p.chapter_default),
  )
  if (sinCap.length > 0) groups.push({ chapter: null, partidas: sinCap })

  const nextOrden = chapters.length
    ? Math.max(...chapters.map((c) => c.orden)) + 1
    : 0

  return { chapters, groups, chapterNames, nextOrden }
}
