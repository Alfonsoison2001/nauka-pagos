import {
  BadgeCheck,
  FileCheck,
  FileText,
  type LucideIcon,
  Mail,
  ReceiptText,
  Send,
  Stamp,
} from "lucide-react"
import { redirect } from "next/navigation"
import {
  type CaratulaBadgeData,
  CaratulaBadgeView,
} from "@/app/proyectos/[id]/caratula/caratula-badge"
import { BackButton } from "@/components/back-button"
import { EstatusBadge } from "@/components/estatus-badge"
import { Sidebar } from "@/components/sidebar"
import { getPendingApprovalsCount } from "@/lib/approvals/fetch"
import { getMyProfile } from "@/lib/auth/roles"
import { getLastProjectIdCookie } from "@/lib/last-project-server"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "¿Cómo funciona?" }

function firstNameOf(value: string): string {
  const first = value.trim().split(/\s+/)[0] ?? "Usuario"
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export default async function GuiaPage() {
  const profile = await getMyProfile()
  if (!profile) redirect("/login")
  const isAdmin = profile.role === "admin"
  const sb = await createClient()

  const { data: projRows } = await sb
    .from("projects")
    .select("id, nombre")
    .is("deleted_at", null)
    .eq("status", "activo")
    .order("nombre")
  const projects = (projRows ?? []).map((p) => ({ id: p.id as string }))
  const cookieProjectId = await getLastProjectIdCookie()
  const sidebarProjectId =
    cookieProjectId && projects.some((p) => p.id === cookieProjectId)
      ? cookieProjectId
      : (projects[0]?.id ?? "")
  const pendingCount = await getPendingApprovalsCount(
    sb,
    profile.role,
    profile.firmanteId,
  )

  return (
    <div className="flex min-h-svh">
      <Sidebar
        projectId={sidebarProjectId}
        greetingName={firstNameOf(profile.nombre)}
        isAdmin={isAdmin}
        pendingCount={pendingCount}
      />
      <div className="flex min-w-0 flex-1 flex-col bg-nauka-bg">
        <main className="px-6 py-8 sm:px-12 sm:py-10">
          <div className="mx-auto flex max-w-3xl flex-col gap-10">
            <header>
              <BackButton />
              <h1 className="text-3xl font-medium text-nauka-dark">
                ¿Cómo funciona?
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                El proceso completo de una carátula de pago, de principio a fin.
              </p>
            </header>

            <CicloSection />
            <BadgesPagoSection />
            <BadgesCaratulaSection />
            <RolesSection />
            <FaqSection />
          </div>
        </main>
      </div>
    </div>
  )
}

// ── El ciclo en 7 pasos ───────────────────────────────────────────────────────

type Paso = { icon: LucideIcon; titulo: string; detalle: string }

const PASOS: Paso[] = [
  {
    icon: FileCheck,
    titulo: "Presupuesto firmado",
    detalle:
      "Se carga el presupuesto del contratista (con su PDF firmado) en la pestaña Presupuesto. Define las partidas y el monto de contrato.",
  },
  {
    icon: ReceiptText,
    titulo: "Estimación",
    detalle:
      "Se registra una estimación en Flujo de Pagos (partida, #, monto, fecha, pagador). Es cada solicitud de pago contra el presupuesto.",
  },
  {
    icon: FileText,
    titulo: "Generar carátula",
    detalle:
      "Se genera el PDF de la carátula con los datos de la estimación y los firmantes del proyecto.",
  },
  {
    icon: Send,
    titulo: "Enviar a aprobación",
    detalle:
      "Crea una solicitud con un voto por cada firmante. Puedes hacerlo en un solo paso desde “+ Nueva carátula” con el checkbox “Enviar a aprobación al guardar” (activado por defecto).",
  },
  {
    icon: Stamp,
    titulo: "Firmantes aprueban / rechazan",
    detalle:
      "Cada firmante revisa el PDF y aprueba o rechaza con motivo. El admin puede decidir en representación de un firmante (queda registrado).",
  },
  {
    icon: Mail,
    titulo: "Enviar al pagador",
    detalle:
      "Una vez aprobada, se envía la carátula al pagador por correo. Al terminar puedes marcar la estimación como Enviada con un clic.",
  },
  {
    icon: BadgeCheck,
    titulo: "Pago + comprobante",
    detalle:
      "Cuando se paga, marca la estimación como Pagada y adjunta el comprobante. Puedes subirlo en el mismo guardado.",
  },
]

function CicloSection() {
  return (
    <Section titulo="El ciclo, paso a paso">
      <ol className="flex flex-col gap-3">
        {PASOS.map((p, i) => (
          <li
            key={p.titulo}
            className="flex gap-4 rounded-2xl border border-nauka-card-border bg-white p-4 shadow-nauka-card"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-nauka-accent/30 font-medium text-nauka-dark tabular-nums">
              {i + 1}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p.icon className="size-4 text-nauka-dark" />
                <p className="font-medium text-nauka-dark">{p.titulo}</p>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">{p.detalle}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

// ── Badges de PAGO ────────────────────────────────────────────────────────────

function BadgesPagoSection() {
  return (
    <Section
      titulo="Badges de pago (status de la estimación)"
      subtitulo="Es manual: tú decides cuándo cambiarlo."
    >
      <BadgeTable
        rows={[
          {
            badge: <EstatusBadge status="pendiente" />,
            desc: "Registrada, todavía no enviada ni pagada.",
          },
          {
            badge: <EstatusBadge status="enviada" />,
            desc: "Carátula enviada al pagador; en espera del pago.",
          },
          {
            badge: <EstatusBadge status="pagada" />,
            desc: "Pago realizado. Idealmente con su comprobante adjunto.",
          },
        ]}
      />
    </Section>
  )
}

// ── Badges de CARÁTULA ────────────────────────────────────────────────────────

function caratulaBadgeData(
  label: string,
  variant: CaratulaBadgeData["variant"],
): CaratulaBadgeData {
  return { label, variant }
}

function BadgesCaratulaSection() {
  return (
    <Section
      titulo="Badges de carátula (estado del documento y su aprobación)"
      subtitulo="Reflejan dónde va la carátula en el proceso."
    >
      <BadgeTable
        rows={[
          {
            badge: (
              <CaratulaBadgeView
                badge={caratulaBadgeData("Sin generar", "sin-generar")}
              />
            ),
            desc: "La estimación existe pero todavía no se generó el PDF.",
          },
          {
            badge: (
              <CaratulaBadgeView
                badge={caratulaBadgeData("Generada", "generada")}
              />
            ),
            desc: "PDF generado, aún no enviado a aprobación.",
          },
          {
            badge: (
              <CaratulaBadgeView
                badge={caratulaBadgeData("En aprobación 1/2", "en-aprobacion")}
              />
            ),
            desc: "Solicitud abierta; 1 de 2 firmantes ya aprobaron.",
          },
          {
            badge: (
              <CaratulaBadgeView
                badge={caratulaBadgeData("Aprobada", "aprobada")}
              />
            ),
            desc: "Todos los firmantes aprobaron. Lista para enviar al pagador.",
          },
          {
            badge: (
              <CaratulaBadgeView
                badge={caratulaBadgeData("Enviada", "enviada")}
              />
            ),
            desc: "Aprobada y ya enviada al pagador por correo.",
          },
          {
            badge: (
              <CaratulaBadgeView
                badge={caratulaBadgeData("Rechazada", "rechazada")}
              />
            ),
            desc: "Un firmante la rechazó con motivo. Corrige y reenvía (ronda nueva).",
          },
          {
            badge: (
              <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-600">
                Cancelada
              </span>
            ),
            desc: "El admin canceló la solicitud en curso. Los votos quedan en el historial y la carátula vuelve a Generada para corregir y reenviar.",
          },
        ]}
      />
    </Section>
  )
}

// ── Quién hace qué ────────────────────────────────────────────────────────────

function RolesSection() {
  return (
    <Section titulo="¿Quién hace qué?">
      <div className="grid gap-4 sm:grid-cols-2">
        <RoleCard
          titulo="Admin"
          quienes="Alfonso, Jessica"
          puntos={[
            "Captura estimaciones y genera/edita carátulas.",
            "Envía a aprobación; cancela o elimina rondas.",
            "Envía la carátula al pagador.",
            "Marca el status de pago y gestiona comprobantes.",
            "Puede decidir en representación de un firmante.",
          ]}
        />
        <RoleCard
          titulo="Aprobador"
          quienes="José, Marcos, Edy"
          puntos={[
            "Revisa las carátulas que requieren su firma.",
            "Aprueba o rechaza con motivo.",
            "Ve el historial completo de aprobación.",
            "No edita datos ni envía correos.",
          ]}
        />
      </div>
    </Section>
  )
}

function RoleCard({
  titulo,
  quienes,
  puntos,
}: {
  titulo: string
  quienes: string
  puntos: string[]
}) {
  return (
    <div className="rounded-2xl border border-nauka-card-border bg-white p-5 shadow-nauka-card">
      <p className="font-medium text-nauka-dark">{titulo}</p>
      <p className="text-xs text-slate-500">{quienes}</p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-slate-600">
        {puntos.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-nauka-accent" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ: { q: string; a: string }[] = [
  {
    q: "¿Qué pasa si rechazan una carátula?",
    a: "Queda como Rechazada con el motivo visible en el historial. Corrige los datos (o regenera el PDF) y vuelve a “Enviar a aprobación”: se abre una ronda nueva.",
  },
  {
    q: "¿Cómo cancelo una solicitud en curso?",
    a: "Como admin, en la card de Aprobaciones o en el detalle de la carátula, usa “Cancelar solicitud” (con un motivo opcional). Los votos emitidos quedan en el historial y la carátula vuelve a Generada.",
  },
  {
    q: "¿Puedo editar una estimación con la aprobación en curso?",
    a: "No mientras la ronda esté abierta: los firmantes verían un PDF desactualizado. Cancela la solicitud primero; luego edita y vuelve a enviar.",
  },
  {
    q: "¿Qué es el Pagado Acum.?",
    a: "Es la suma de las estimaciones pagadas de la partida hasta esa fila inclusive. “Resto por Pagar” = Presupuesto − Pagado Acum.",
  },
  {
    q: "¿Cómo comparto una aprobación por WhatsApp?",
    a: "Usa “Copiar link” en la card de Aprobaciones o en el detalle de la carátula y pégalo en WhatsApp. Abre la bandeja filtrada por ese proyecto.",
  },
]

function FaqSection() {
  return (
    <Section titulo="Preguntas frecuentes">
      <div className="flex flex-col gap-2">
        {FAQ.map((f) => (
          <details
            key={f.q}
            className="rounded-2xl border border-nauka-card-border bg-white p-4 shadow-nauka-card"
          >
            <summary className="cursor-pointer font-medium text-nauka-dark">
              {f.q}
            </summary>
            <p className="mt-2 text-sm text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}

// ── Helpers de layout ─────────────────────────────────────────────────────────

function Section({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-lg font-medium text-nauka-dark">{titulo}</h2>
      {subtitulo ? (
        <p className="mb-3 text-sm text-slate-500">{subtitulo}</p>
      ) : (
        <div className="mb-3" />
      )}
      {children}
    </section>
  )
}

function BadgeTable({
  rows,
}: {
  rows: { badge: React.ReactNode; desc: string }[]
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      {rows.map((r, i) => (
        <div
          key={r.desc}
          className={`flex items-start gap-4 p-4 ${
            i > 0 ? "border-t border-nauka-subtle" : ""
          }`}
        >
          <div className="w-32 shrink-0">{r.badge}</div>
          <p className="text-sm text-slate-600">{r.desc}</p>
        </div>
      ))}
    </div>
  )
}
