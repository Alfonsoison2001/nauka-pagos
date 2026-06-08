"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { updatePassword } from "./actions"

const schema = z
  .object({
    password: z
      .string()
      .min(12, "Mínimo 12 caracteres")
      .regex(/[A-Z]/, "Incluye una mayúscula")
      .regex(/[a-z]/, "Incluye una minúscula")
      .regex(/[0-9]/, "Incluye un número")
      .regex(/[^A-Za-z0-9]/, "Incluye un símbolo"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  })

type Values = z.infer<typeof schema>

type Phase = "verifying" | "ready" | "invalid"

export function RecoveryForm({
  tokenHash,
  type,
}: {
  tokenHash: string | null
  type: string | null
}) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("verifying")
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const verified = useRef(false)

  // Verifica el token de recovery UNA sola vez (ref evita doble verifyOtp en
  // StrictMode). El browser client persiste la sesión en cookies, de modo que
  // el server action updatePassword pueda leerla.
  useEffect(() => {
    if (verified.current) return
    verified.current = true
    if (!tokenHash || type !== "recovery") {
      setPhase("invalid")
      return
    }
    const sb = createClient()
    sb.auth
      .verifyOtp({ token_hash: tokenHash, type: "recovery" })
      .then(({ error }) => setPhase(error ? "invalid" : "ready"))
      .catch(() => setPhase("invalid"))
  }, [tokenHash, type])

  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  })

  function onSubmit(values: Values) {
    setServerError(null)
    startTransition(async () => {
      const r = await updatePassword(values.password)
      if ("error" in r) {
        setServerError(r.error)
        return
      }
      router.push("/?flash=password-updated")
    })
  }

  if (phase === "verifying") {
    return <p className="text-sm text-muted-foreground">Validando el enlace…</p>
  }

  if (phase === "invalid") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-destructive" role="alert">
          Link inválido o expirado. Solicita un nuevo recovery.
        </p>
        <Link
          href="/login"
          className="text-sm text-nauka-dark underline-offset-4 hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-password">Nueva contraseña</Label>
            <Input
              id="rec-password"
              type="password"
              autoComplete="new-password"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
            {formState.errors.password ? (
              <p className="text-sm text-destructive">
                {formState.errors.password.message}
              </p>
            ) : null}
          </div>
        )}
      />
      <Controller
        control={control}
        name="confirm"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-confirm">Confirmar nueva contraseña</Label>
            <Input
              id="rec-confirm"
              type="password"
              autoComplete="new-password"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
            {formState.errors.confirm ? (
              <p className="text-sm text-destructive">
                {formState.errors.confirm.message}
              </p>
            ) : null}
          </div>
        )}
      />
      {serverError ? (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Actualizando…" : "Actualizar contraseña"}
      </Button>
    </form>
  )
}
