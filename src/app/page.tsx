import { redirect } from "next/navigation"
import { TopNav } from "@/components/top-nav"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Middleware already enforces this, but defensive in case the matcher
    // ever skips this route by mistake.
    redirect("/login")
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Usuario"

  return (
    <div className="min-h-svh">
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Bienvenido {fullName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Día 2 reemplazará este placeholder con el Consolidado real.
        </p>
      </main>
    </div>
  )
}
