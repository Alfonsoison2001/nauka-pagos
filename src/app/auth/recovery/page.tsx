import type { Metadata } from "next"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RecoveryForm } from "./recovery-form"

export const metadata: Metadata = {
  title: "Restablecer contraseña",
}

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>
}) {
  const { token_hash, type } = await searchParams

  return (
    <main className="flex min-h-svh items-center justify-center bg-nauka-bg p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-nauka-dark">
            Restablecer contraseña
          </CardTitle>
          <CardDescription>Define tu nueva contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          <RecoveryForm tokenHash={token_hash ?? null} type={type ?? null} />
        </CardContent>
      </Card>
    </main>
  )
}
