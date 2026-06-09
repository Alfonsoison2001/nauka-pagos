"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRef, useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { updateProjectConfig } from "./actions"

type Project = {
  id: string
  nombre: string
  lote: string | null
  cliente: string
  ubicacion: string | null
  caratula_iva_mode: "con_iva" | "sin_iva"
  default_emails: string[]
  logoSignedUrl: string | null
}

// Client-side schema. The server re-validates with its own zod schema in
// actions.ts — never trust the client.
const formSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido").max(120),
  lote: z.string().trim(),
  cliente: z.string().trim().min(1, "Cliente requerido"),
  ubicacion: z.string().trim(),
  caratula_iva_mode: z.enum(["con_iva", "sin_iva"]),
  // default_emails arrives as a multi-line textarea string; the server
  // parses it into an array and validates each line as an email.
  default_emails: z.string(),
})

type FormValues = z.infer<typeof formSchema>

export function ConfigurationForm({ project }: { project: Project }) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitOk, setSubmitOk] = useState(false)
  const [pending, startTransition] = useTransition()
  const [logoPreview, setLogoPreview] = useState<string | null>(
    project.logoSignedUrl,
  )
  const logoInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: project.nombre,
      lote: project.lote ?? "",
      cliente: project.cliente,
      ubicacion: project.ubicacion ?? "",
      caratula_iva_mode: project.caratula_iva_mode,
      default_emails: project.default_emails.join("\n"),
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setLogoPreview(project.logoSignedUrl)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") setLogoPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const onSubmit = form.handleSubmit((data) => {
    setSubmitError(null)
    setSubmitOk(false)
    startTransition(async () => {
      const fd = new FormData()
      fd.append("project_id", project.id)
      fd.append("nombre", data.nombre)
      fd.append("lote", data.lote)
      fd.append("cliente", data.cliente)
      fd.append("ubicacion", data.ubicacion)
      fd.append("caratula_iva_mode", data.caratula_iva_mode)
      fd.append("default_emails", data.default_emails)
      const logoFile = logoInputRef.current?.files?.[0]
      if (logoFile) fd.append("logo", logoFile)

      const result = await updateProjectConfig({ error: null, ok: false }, fd)
      if (result.error) {
        setSubmitError(result.error)
      } else {
        setSubmitOk(true)
        // Make the saved values the new "clean" baseline so isDirty resets.
        form.reset(data)
      }
    })
  })

  const errors = form.formState.errors

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del proyecto</CardTitle>
        <CardDescription>
          Estos valores se usan en la carátula y en el resumen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="nombre"
              control={form.control}
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cf-nombre">Nombre del proyecto</Label>
                  <Input id="cf-nombre" maxLength={120} {...field} />
                  {errors.nombre ? (
                    <p className="text-xs text-destructive">
                      {errors.nombre.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <Controller
              name="lote"
              control={form.control}
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cf-lote">Lote</Label>
                  <Input id="cf-lote" {...field} />
                </div>
              )}
            />
            <Controller
              name="cliente"
              control={form.control}
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cf-cliente">Cliente</Label>
                  <Input id="cf-cliente" {...field} />
                  {errors.cliente ? (
                    <p className="text-xs text-destructive">
                      {errors.cliente.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <Controller
              name="caratula_iva_mode"
              control={form.control}
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cf-iva">IVA en carátula</Label>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={[
                      { value: "con_iva", label: "Con IVA" },
                      { value: "sin_iva", label: "Sin IVA" },
                    ]}
                  >
                    <SelectTrigger id="cf-iva">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="con_iva">Con IVA</SelectItem>
                      <SelectItem value="sin_iva">Sin IVA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
          </div>

          <Controller
            name="ubicacion"
            control={form.control}
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="cf-ubicacion">Ubicación</Label>
                <Input
                  id="cf-ubicacion"
                  placeholder="Dirección o nombre del desarrollo"
                  {...field}
                />
              </div>
            )}
          />

          <Controller
            name="default_emails"
            control={form.control}
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="cf-emails">
                  Correos default para carátulas
                </Label>
                <Textarea
                  id="cf-emails"
                  rows={4}
                  placeholder="Un correo por línea (e.g. alfonso@izarquitectos.mx)"
                  {...field}
                />
                <p className="text-xs text-muted-foreground">
                  Estos correos aparecen pre-seleccionados al enviar una
                  carátula.
                </p>
              </div>
            )}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="cf-logo">Logo del proyecto</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border bg-muted">
                {logoPreview ? (
                  // biome-ignore lint/performance/noImgElement: preview is either a data: URL (FileReader) or a Supabase Storage signed URL — next/image doesn't fit either case for this 80×80 thumbnail.
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Sin logo
                  </span>
                )}
              </div>
              {/*
                Native <input type="file"> instead of shadcn's <Input>:
                Base UI's Input wraps the FieldControl primitive which is
                designed for string-valued inputs and emits warnings when
                used with type="file" (the file picker state changes are
                seen as default-value mutations on an uncontrolled field).
              */}
              <input
                id="cf-logo"
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleFileChange}
                className="block max-w-sm text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-accent"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPG o SVG. Máximo 5MB.
            </p>
          </div>

          {submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          {submitOk ? (
            <p className="text-sm text-green-600" role="status">
              Cambios guardados.
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
