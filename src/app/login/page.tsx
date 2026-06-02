import type { Metadata } from "next"
import { Suspense } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Iniciar sesión",
}

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-nauka-bg p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-nauka-dark">NAUKA Pagos</CardTitle>
          <CardDescription>Inicia sesión para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  )
}
