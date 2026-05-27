"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const schema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido").max(120),
  lote: z.string().trim().optional(),
  ubicacion: z.string().trim().optional(),
  cliente: z.string().trim().default("NAUKA"),
  caratula_iva_mode: z.enum(["con_iva", "sin_iva"]).default("con_iva"),
})

export type CreateProjectResult = { error: string } | { id: string }

export async function createProject(
  formData: FormData,
): Promise<CreateProjectResult> {
  const parsed = schema.safeParse({
    nombre: formData.get("nombre"),
    lote: formData.get("lote") || undefined,
    ubicacion: formData.get("ubicacion") || undefined,
    cliente: formData.get("cliente") || undefined,
    caratula_iva_mode: formData.get("caratula_iva_mode") || undefined,
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .insert({
      nombre: parsed.data.nombre,
      lote: parsed.data.lote || null,
      ubicacion: parsed.data.ubicacion || null,
      cliente: parsed.data.cliente,
      caratula_iva_mode: parsed.data.caratula_iva_mode,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { error: error?.message ?? "No se pudo crear el proyecto" }
  }

  revalidatePath("/", "layout")
  return { id: data.id }
}
