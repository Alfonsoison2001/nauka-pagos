"use client"

import { useSearchParams } from "next/navigation"
import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  type LoginState,
  login,
  type MagicLinkState,
  sendMagicLink,
} from "./actions"

const loginInitial: LoginState = { error: null }
const magicInitial: MagicLinkState = { error: null, sent: false }

type Mode = "password" | "magic"

function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? busy : idle}
    </Button>
  )
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("password")
  const searchParams = useSearchParams()
  const callbackError = searchParams.get("error") === "auth"

  return (
    <div className="flex flex-col gap-4">
      {callbackError ? (
        <p className="text-sm text-destructive" role="alert">
          El enlace no es válido o expiró. Solicita uno nuevo.
        </p>
      ) : null}

      {mode === "password" ? (
        <PasswordForm onUseMagic={() => setMode("magic")} />
      ) : (
        <MagicForm onUsePassword={() => setMode("password")} />
      )}
    </div>
  )
}

function PasswordForm({ onUseMagic }: { onUseMagic: () => void }) {
  const [state, formAction] = useActionState(login, loginInitial)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton idle="Iniciar sesión" busy="Iniciando..." />
      <button
        type="button"
        onClick={onUseMagic}
        className="text-center text-sm text-nauka-dark underline-offset-4 hover:underline"
      >
        Entrar con enlace mágico
      </button>
    </form>
  )
}

function MagicForm({ onUsePassword }: { onUsePassword: () => void }) {
  const [state, formAction] = useActionState(sendMagicLink, magicInitial)

  if (state.sent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Si tu correo está registrado, te enviamos un enlace para entrar.
          Revisa tu bandeja.
        </p>
        <button
          type="button"
          onClick={onUsePassword}
          className="text-center text-sm text-nauka-dark underline-offset-4 hover:underline"
        >
          Volver a contraseña
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="magic-email">Email</Label>
        <Input
          id="magic-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton idle="Enviar enlace mágico" busy="Enviando..." />
      <button
        type="button"
        onClick={onUsePassword}
        className="text-center text-sm text-nauka-dark underline-offset-4 hover:underline"
      >
        Usar contraseña
      </button>
    </form>
  )
}
