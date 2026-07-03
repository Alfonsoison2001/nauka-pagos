import { notFound } from "next/navigation"
import { isAdmin } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import type { ChapterRow, ConceptoRow, PartidaRow } from "./actions"
import { DeleteCapituloButton } from "./delete-capitulo-button"
import { EditCapituloButton } from "./edit-capitulo-button"
import { NuevaPartidaButton } from "./nueva-partida-button"
import { NuevoCapituloButton } from "./nuevo-capitulo-button"
import { PartidaRowView } from "./partida-row"
import { ReordenarCapitulo } from "./reordenar-capitulo"

export const metadata = { title: "Buy-Out · Glosario" }

type ConceptosByPartida = Map<string, ConceptoRow[]>
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
  const { chapters, groups, chapterNames, nextOrden, conceptosByPartida } =
    await loadGlosario(sb, id)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-nauka-dark">Glosario</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Administra los catálogos de este proyecto: capítulos, partidas y
            conceptos. Abre una partida para ver sus conceptos.
            {admin ? "" : " (solo lectura)"}
          </p>
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
            conceptosByPartida={conceptosByPartida}
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
  conceptosByPartida,
  admin,
}: {
  projectId: string
  group: Group
  chapters: ChapterRow[]
  chapterNames: string[]
  conceptosByPartida: ConceptosByPartida
  admin: boolean
}) {
  const { chapter, partidas } = group
  const idx = chapter ? chapters.findIndex((c) => c.id === chapter.id) : -1

  return (
    <section className="overflow-hidden rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      {/* Banda de capítulo con espina accent — mismo lenguaje que el Resumen. */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-nauka-subtle border-l-2 border-l-nauka-accent bg-nauka-subtle/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-nauka-dark">
            {chapter?.nombre ?? "Sin capítulo"}
          </h3>
          <span className="text-[11px] text-muted-foreground">
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
            <PartidaRowView
              key={p.id}
              projectId={projectId}
              partida={p}
              conceptos={conceptosByPartida.get(p.id) ?? []}
              chapterNames={chapterNames}
              admin={admin}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Carga de datos: capítulos + partidas + conceptos + datos capturados
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
    // El concepto se liga a los datos capturados por TEXTO (item.concepto), no FK.
    sb
      .from("buyout_item")
      .select("partida_catalog_id, concepto")
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ])

  const partidaIds = (partidaRes.data ?? []).map((p) => p.id as string)

  // Datos capturados: por partida (para la partida) y por (partida, concepto).
  const itemCountByPartida = new Map<string, number>()
  const itemCountByConcepto = new Map<string, number>()
  for (const it of itemRes.data ?? []) {
    const pid = it.partida_catalog_id as string
    itemCountByPartida.set(pid, (itemCountByPartida.get(pid) ?? 0) + 1)
    const key = `${pid}::${(it.concepto as string) ?? ""}`
    itemCountByConcepto.set(key, (itemCountByConcepto.get(key) ?? 0) + 1)
  }

  // Conceptos del catálogo (ordenados) agrupados por partida.
  const conceptosByPartida: ConceptosByPartida = new Map()
  if (partidaIds.length > 0) {
    const { data: conceptos } = await sb
      .from("buyout_concepto_catalog")
      .select("id, nombre, orden, partida_catalog_id")
      .in("partida_catalog_id", partidaIds)
      .is("deleted_at", null)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true })
    for (const c of conceptos ?? []) {
      const pid = c.partida_catalog_id as string
      const nombre = c.nombre as string
      const list = conceptosByPartida.get(pid) ?? []
      list.push({
        id: c.id as string,
        nombre,
        orden: Number(c.orden),
        itemCount: itemCountByConcepto.get(`${pid}::${nombre}`) ?? 0,
      })
      conceptosByPartida.set(pid, list)
    }
  }

  const partidas: PartidaRow[] = (partidaRes.data ?? []).map((p) => {
    const pid = p.id as string
    return {
      id: pid,
      nombre: p.nombre as string,
      chapter_default: (p.chapter_default as string | null) ?? null,
      unidad_driver: (p.unidad_driver as string | null) ?? null,
      orden: Number(p.orden),
      conceptoCount: conceptosByPartida.get(pid)?.length ?? 0,
      itemCount: itemCountByPartida.get(pid) ?? 0,
    }
  })

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

  return { chapters, groups, chapterNames, nextOrden, conceptosByPartida }
}
