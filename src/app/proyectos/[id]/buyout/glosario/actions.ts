"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getMyProfile } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// Tipos compartidos con los componentes cliente del Glosario
// ---------------------------------------------------------------------------

export type ActionResult = { error: string } | { ok: true }

/** Un capítulo del proyecto con cuántas partidas activas cuelgan de él. */
export type ChapterRow = {
  id: string
  nombre: string
  orden: number
  partidaCount: number
}

/** Una partida del catálogo del proyecto + señales para la UI (datos capturados). */
export type PartidaRow = {
  id: string
  nombre: string
  chapter_default: string | null
  unidad_driver: string | null
  orden: number
  conceptoCount: number
  itemCount: number
}

type Sb = Awaited<ReturnType<typeof createClient>>

// ---------------------------------------------------------------------------
// Zod (cliente valida en el diálogo; el servidor RE-valida aquí)
// ---------------------------------------------------------------------------

const nombre = z.string().trim().min(1, "El nombre es requerido").max(120)
const orden = z.coerce.number().int("Orden entero").min(0, "Orden ≥ 0")

const chapterCreateSchema = z.object({ nombre, orden: orden.optional() })
const chapterRenameSchema = z.object({ nombre })
const partidaSchema = z.object({
  nombre,
  chapter: z.string().trim().optional(),
  unidad_driver: z.string().trim().max(60).optional(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Guard admin server-side (además lo refuerza la RLS `is_admin()` de las tablas). */
async function requireAdmin(): Promise<string | null> {
  const profile = await getMyProfile()
  if (profile?.role !== "admin") {
    return "Solo un administrador puede editar el glosario."
  }
  return null
}

/** Traduce el error de índice único (nombre repetido) a un mensaje legible. */
function dupMessage(
  error: { code?: string } | null,
  fallback: string,
  duplicado: string,
): string {
  return error?.code === "23505" ? duplicado : fallback
}

/** Revalida las 3 pantallas que dependen del catálogo (Resumen · Partida · Glosario). */
function revalidateBuyout(projectId: string): void {
  const base = `/proyectos/${projectId}/buyout`
  revalidatePath(base)
  revalidatePath(`${base}/partida`)
  revalidatePath(`${base}/glosario`)
}

/** Verifica que el capítulo exista, esté vigente y pertenezca al proyecto. */
async function loadChapter(
  sb: Sb,
  projectId: string,
  chapterId: string,
): Promise<{ nombre: string; orden: number } | null> {
  const { data } = await sb
    .from("buyout_chapter")
    .select("nombre, orden")
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle()
  return data
    ? { nombre: data.nombre as string, orden: Number(data.orden) }
    : null
}

// ===========================================================================
// CAPÍTULOS
// ===========================================================================

/** Agrega un capítulo al proyecto. Orden opcional → al final si no se indica. */
export async function createChapter(
  projectId: string,
  input: { nombre: string; orden?: number },
): Promise<ActionResult> {
  const guard = await requireAdmin()
  if (guard) return { error: guard }
  const parsed = chapterCreateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const sb = await createClient()

  let ordenFinal = parsed.data.orden
  if (ordenFinal === undefined) {
    const { data: last } = await sb
      .from("buyout_chapter")
      .select("orden")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle()
    ordenFinal = last ? Number(last.orden) + 1 : 0
  }

  const { error } = await sb.from("buyout_chapter").insert({
    project_id: projectId,
    nombre: parsed.data.nombre,
    orden: ordenFinal,
  })
  if (error) {
    return {
      error: dupMessage(
        error,
        error.message,
        "Ya existe un capítulo con ese nombre en este proyecto.",
      ),
    }
  }
  revalidateBuyout(projectId)
  return { ok: true }
}

/**
 * Renombra un capítulo. Como las partidas se ligan al capítulo por NOMBRE
 * (`chapter_default` es texto, no FK), re-apunta también las partidas que lo
 * usaban para no dejarlas huérfanas ("Sin capítulo").
 */
export async function renameChapter(
  projectId: string,
  chapterId: string,
  nuevoNombre: string,
): Promise<ActionResult> {
  const guard = await requireAdmin()
  if (guard) return { error: guard }
  const parsed = chapterRenameSchema.safeParse({ nombre: nuevoNombre })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const sb = await createClient()

  const chapter = await loadChapter(sb, projectId, chapterId)
  if (!chapter) return { error: "Capítulo no encontrado." }
  if (chapter.nombre === parsed.data.nombre) return { ok: true }

  const { error } = await sb
    .from("buyout_chapter")
    .update({ nombre: parsed.data.nombre })
    .eq("id", chapterId)
    .eq("project_id", projectId)
  if (error) {
    return {
      error: dupMessage(
        error,
        error.message,
        "Ya existe un capítulo con ese nombre en este proyecto.",
      ),
    }
  }

  // Re-apunta las partidas que colgaban del nombre viejo (mantiene la agrupación).
  await sb
    .from("buyout_partida_catalog")
    .update({ chapter_default: parsed.data.nombre })
    .eq("project_id", projectId)
    .eq("chapter_default", chapter.nombre)
    .is("deleted_at", null)

  revalidateBuyout(projectId)
  return { ok: true }
}

/**
 * Reordena un capítulo un lugar arriba/abajo. Normaliza TODOS los `orden` a
 * 0..n-1 en el orden resultante (evita empates/huecos que traben el swap).
 */
export async function moveChapter(
  projectId: string,
  chapterId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const guard = await requireAdmin()
  if (guard) return { error: guard }
  const sb = await createClient()

  const { data } = await sb
    .from("buyout_chapter")
    .select("id, orden")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true })
  const list = (data ?? []).map((c) => c.id as string)
  const i = list.indexOf(chapterId)
  if (i === -1) return { error: "Capítulo no encontrado." }
  const j = direction === "up" ? i - 1 : i + 1
  if (j < 0 || j >= list.length)
    return { ok: true } // ya está en el borde
  ;[list[i], list[j]] = [list[j], list[i]]

  for (let k = 0; k < list.length; k++) {
    const { error } = await sb
      .from("buyout_chapter")
      .update({ orden: k })
      .eq("id", list[k])
      .eq("project_id", projectId)
    if (error) return { error: error.message }
  }
  revalidateBuyout(projectId)
  return { ok: true }
}

/** Soft-delete de un capítulo. Solo si NO tiene partidas activas colgando. */
export async function deleteChapter(
  projectId: string,
  chapterId: string,
): Promise<ActionResult> {
  const guard = await requireAdmin()
  if (guard) return { error: guard }
  const sb = await createClient()

  const chapter = await loadChapter(sb, projectId, chapterId)
  if (!chapter) return { error: "Capítulo no encontrado." }

  const { count } = await sb
    .from("buyout_partida_catalog")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("chapter_default", chapter.nombre)
    .is("deleted_at", null)
  if ((count ?? 0) > 0) {
    return {
      error:
        "El capítulo tiene partidas. Muévelas a otro capítulo o elimínalas primero.",
    }
  }

  const { error } = await sb
    .from("buyout_chapter")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", chapterId)
    .eq("project_id", projectId)
  if (error) return { error: error.message }
  revalidateBuyout(projectId)
  return { ok: true }
}

// ===========================================================================
// PARTIDAS
// ===========================================================================

/** Agrega una partida al catálogo del proyecto (capítulo + nombre + driver). */
export async function createPartida(
  projectId: string,
  input: { nombre: string; chapter?: string; unidad_driver?: string },
): Promise<ActionResult> {
  const guard = await requireAdmin()
  if (guard) return { error: guard }
  const parsed = partidaSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const sb = await createClient()

  // Orden = al final del proyecto (aparece al final de su capítulo).
  const { data: last } = await sb
    .from("buyout_partida_catalog")
    .select("orden")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle()
  const ordenFinal = last ? Number(last.orden) + 1 : 0

  const { error } = await sb.from("buyout_partida_catalog").insert({
    project_id: projectId,
    nombre: parsed.data.nombre,
    chapter_default: parsed.data.chapter || null,
    unidad_driver: parsed.data.unidad_driver || null,
    orden: ordenFinal,
  })
  if (error) {
    return {
      error: dupMessage(
        error,
        error.message,
        "Ya existe una partida con ese nombre en este proyecto.",
      ),
    }
  }
  revalidateBuyout(projectId)
  return { ok: true }
}

/** Edita una partida: renombra, mueve de capítulo y/o ajusta el driver. */
export async function updatePartida(
  projectId: string,
  partidaId: string,
  input: { nombre: string; chapter?: string; unidad_driver?: string },
): Promise<ActionResult> {
  const guard = await requireAdmin()
  if (guard) return { error: guard }
  const parsed = partidaSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const sb = await createClient()

  const { data: partida } = await sb
    .from("buyout_partida_catalog")
    .select("id")
    .eq("id", partidaId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!partida) return { error: "Partida no encontrada." }

  const { error } = await sb
    .from("buyout_partida_catalog")
    .update({
      nombre: parsed.data.nombre,
      chapter_default: parsed.data.chapter || null,
      unidad_driver: parsed.data.unidad_driver || null,
    })
    .eq("id", partidaId)
    .eq("project_id", projectId)
  if (error) {
    return {
      error: dupMessage(
        error,
        error.message,
        "Ya existe una partida con ese nombre en este proyecto.",
      ),
    }
  }
  revalidateBuyout(projectId)
  return { ok: true }
}

/**
 * Soft-delete de una partida (nunca hard-delete). Si tiene conceptos capturados
 * la confirmación se pide en el cliente; aquí solo se marca `deleted_at`. Los
 * `buyout_item`/cotizaciones quedan en la base (recuperables) pero dejan de
 * verse en Resumen/Partida al desaparecer la partida del catálogo.
 */
export async function deletePartida(
  projectId: string,
  partidaId: string,
): Promise<ActionResult> {
  const guard = await requireAdmin()
  if (guard) return { error: guard }
  const sb = await createClient()

  const { data: partida } = await sb
    .from("buyout_partida_catalog")
    .select("id")
    .eq("id", partidaId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!partida) return { error: "Partida no encontrada." }

  const { error } = await sb
    .from("buyout_partida_catalog")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", partidaId)
    .eq("project_id", projectId)
  if (error) return { error: error.message }
  revalidateBuyout(projectId)
  return { ok: true }
}
