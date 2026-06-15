import { redirect } from "next/navigation"
import { ApprovalStatusChips } from "@/components/approvals/approval-status-chips"
import { ApprovalTimeline } from "@/components/approvals/approval-timeline"
import { ApproveRejectDialog } from "@/components/approvals/approve-reject-dialog"
import { CancelarAprobacionButton } from "@/components/approvals/cancelar-aprobacion-button"
import {
  type CaratulaBanner,
  CaratulaPreviewButton,
} from "@/components/approvals/caratula-preview-button"
import { CopiarLinkButton } from "@/components/approvals/copiar-link-button"
import { RecordarButton } from "@/components/approvals/recordar-button"
import { BackButton } from "@/components/back-button"
import { Sidebar } from "@/components/sidebar"
import {
  type ApprovalRequestRow,
  buildDocumentApproval,
  type DocumentApproval,
  fetchCaratulaRequests,
  fetchVotesByRequest,
} from "@/lib/approvals/fetch"
import { getMyProfile } from "@/lib/auth/roles"
import { formatDate } from "@/lib/format/fecha"
import { getLastProjectIdCookie } from "@/lib/last-project-server"
import { getUnreadNotificationsCount } from "@/lib/notifications/fetch"
import { createClient } from "@/lib/supabase/server"
import { formatMXN } from "@/lib/utils"
import { ProyectoFilter } from "./proyecto-filter"

function firstNameOf(value: string): string {
  const first = value.trim().split(/\s+/)[0] ?? "Usuario"
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export const metadata = { title: "Aprobaciones" }

type Item = {
  documentId: string
  projectId: string
  projectLabel: string
  contratista: string
  partida: string
  numero: string
  monto: number
  previewUrl: string | null
  approval: DocumentApproval
}

export default async function AprobacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ proyecto?: string }>
}) {
  const profile = await getMyProfile()
  if (!profile) redirect("/login")
  const isAdmin = profile.role === "admin"
  const sb = await createClient()

  // Proyectos para el dropdown de filtro + validación del param.
  const { proyecto } = await searchParams
  const { data: projRows } = await sb
    .from("projects")
    .select("id, nombre")
    .is("deleted_at", null)
    .eq("status", "activo")
    .order("nombre")
  const projects = (projRows ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
  }))
  const selectedProyecto =
    proyecto && projects.some((p) => p.id === proyecto) ? proyecto : ""

  const requests = await fetchCaratulaRequests(sb)
  const votesByRequest = await fetchVotesByRequest(
    sb,
    requests.map((r) => r.id),
  )

  const byDoc = new Map<string, ApprovalRequestRow[]>()
  for (const r of requests) {
    const arr = byDoc.get(r.documentId) ?? []
    arr.push(r)
    byDoc.set(r.documentId, arr)
  }
  const documentIds = [...byDoc.keys()]

  const ctx = await loadCaratulaContext(sb, documentIds, requests)

  const items: Item[] = documentIds.map((docId) => {
    const c = ctx.get(docId)
    return {
      documentId: docId,
      projectId: c?.projectId ?? "",
      projectLabel: c?.projectLabel ?? "—",
      contratista: c?.contratista ?? "—",
      partida: c?.partida ?? "—",
      numero: c?.numero ?? "—",
      monto: c?.monto ?? 0,
      previewUrl: c?.previewUrl ?? null,
      approval: buildDocumentApproval(
        byDoc.get(docId) ?? [],
        votesByRequest,
        profile.firmanteId,
      ),
    }
  })

  // Filtro por proyecto (vive en la URL: ?proyecto=ID; sin query = todos).
  const visibleItems = selectedProyecto
    ? items.filter((i) => i.projectId === selectedProyecto)
    : items

  // Abiertas primero; dentro de abiertas, las accionables por mí arriba.
  const open = visibleItems
    .filter((i) => i.approval.isOpen)
    .sort(
      (a, b) =>
        (b.approval.myPendingApprovalId ? 1 : 0) -
        (a.approval.myPendingApprovalId ? 1 : 0),
    )
  const resolved = visibleItems.filter((i) => !i.approval.isOpen)

  // Badge del sidebar = notificaciones no leídas (8d).
  const unreadCount = await getUnreadNotificationsCount(sb)
  // Tabs del sidebar → último proyecto visitado (cookie). Badge/link → filtro.
  const cookieProjectId = await getLastProjectIdCookie()
  const sidebarProjectId =
    cookieProjectId && projects.some((p) => p.id === cookieProjectId)
      ? cookieProjectId
      : (projects[0]?.id ?? "")
  const aprobacionesHref = selectedProyecto
    ? `/aprobaciones?proyecto=${selectedProyecto}`
    : "/aprobaciones"

  return (
    <div className="flex min-h-svh">
      <Sidebar
        projectId={sidebarProjectId}
        greetingName={firstNameOf(profile.nombre)}
        isAdmin={isAdmin}
        unreadCount={unreadCount}
        aprobacionesHref={aprobacionesHref}
        hideOnMobile
      />
      <div className="flex min-w-0 flex-1 flex-col bg-nauka-bg">
        <main className="px-6 py-8 sm:px-12 sm:py-10">
          <div className="mx-auto max-w-3xl">
            <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <BackButton />
                <h1 className="text-3xl font-medium text-nauka-dark">
                  Aprobaciones
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {isAdmin
                    ? "Carátulas en aprobación y su historial."
                    : "Carátulas que requieren tu firma."}
                </p>
              </div>
              <ProyectoFilter projects={projects} selected={selectedProyecto} />
            </header>

            {visibleItems.length === 0 ? (
              <div className="rounded-2xl border border-nauka-card-border bg-white p-12 text-center text-sm text-slate-500 shadow-nauka-card">
                {selectedProyecto
                  ? "No hay aprobaciones para este proyecto."
                  : "No hay aprobaciones todavía."}
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <Section title="En aprobación" empty="Nada en aprobación.">
                  {open.map((i) => (
                    <ItemCard key={i.documentId} item={i} isAdmin={isAdmin} />
                  ))}
                </Section>
                {resolved.length > 0 ? (
                  <Section title="Resueltas" empty="">
                    {resolved.map((i) => (
                      <ItemCard key={i.documentId} item={i} isAdmin={isAdmin} />
                    ))}
                  </Section>
                ) : null}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

/** Banner de estado para el modal de preview (verde/rojo/ámbar). */
function buildBanner(a: DocumentApproval): CaratulaBanner | null {
  if (!a.hasRequests || !a.latestStatus) return null
  if (a.latestStatus === "aprobada") {
    const names = a.chips.map((c) => c.firmanteNombre).join(", ")
    const dates = (a.rounds[0]?.votes ?? [])
      .map((v) => v.decidedAt)
      .filter((d): d is string => Boolean(d))
      .sort()
    const last = dates.at(-1)
    return {
      tone: "green",
      text: `✓ Carátula aprobada · ${names}${last ? ` · ${formatDate(last)}` : ""}`,
    }
  }
  if (a.latestStatus === "rechazada") {
    return {
      tone: "red",
      text: `✗ Rechazada${a.rejectionMotivo ? ` · motivo: ${a.rejectionMotivo}` : ""}`,
    }
  }
  if (a.latestStatus === "en_aprobacion") {
    const aprob = a.chips.filter((c) => c.status === "aprobada").length
    return {
      tone: "amber",
      text: `○ En aprobación · ${aprob}/${a.chips.length} firmas`,
    }
  }
  return null
}

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode[]
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {children.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-col gap-3">{children}</div>
      )}
    </section>
  )
}

function ItemCard({ item, isAdmin }: { item: Item; isAdmin: boolean }) {
  const { approval } = item
  const titulo = `Est. ${item.numero} · ${item.contratista}`

  return (
    <article
      id={`est-${item.documentId}`}
      className="scroll-mt-6 rounded-2xl border border-nauka-card-border bg-white p-5 shadow-nauka-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {item.projectLabel}
          </p>
          <p className="mt-0.5 font-medium text-nauka-dark">{titulo}</p>
          <p className="text-sm text-slate-500 tabular-nums">
            {item.partida} · {formatMXN(item.monto)}
          </p>
        </div>
        <CaratulaPreviewButton
          previewUrl={item.previewUrl}
          titulo={`${item.projectLabel} · ${titulo}`}
          banner={buildBanner(approval)}
        />
      </div>

      <div className="mt-3">
        <ApprovalStatusChips
          status={approval.latestStatus ?? "en_aprobacion"}
          votes={approval.chips}
        />
      </div>

      {approval.rejectionMotivo ? (
        <p className="mt-2 text-sm text-red-700">
          Motivo: {approval.rejectionMotivo}
        </p>
      ) : null}

      {approval.isOpen ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {approval.myPendingApprovalId ? (
            <ApproveRejectDialog
              approvalId={approval.myPendingApprovalId}
              caratulaTitulo={`${item.projectLabel} · ${titulo}`}
              previewUrl={item.previewUrl}
              triggerLabel="Revisar y firmar"
            />
          ) : null}
          {isAdmin
            ? approval.pendingVotes
                .filter((pv) => pv.approvalId !== approval.myPendingApprovalId)
                .map((pv) => (
                  <ApproveRejectDialog
                    key={pv.approvalId}
                    approvalId={pv.approvalId}
                    caratulaTitulo={`${item.projectLabel} · ${titulo}`}
                    previewUrl={item.previewUrl}
                    onBehalfFirmante={pv.firmanteNombre}
                    triggerLabel={`Decidir por ${pv.firmanteNombre}`}
                  />
                ))
            : null}
          {isAdmin && approval.openRequestId ? (
            <RecordarButton requestId={approval.openRequestId} />
          ) : null}
          {isAdmin && approval.openRequestId ? (
            <CancelarAprobacionButton requestId={approval.openRequestId} />
          ) : null}
          <CopiarLinkButton projectId={item.projectId} />
        </div>
      ) : null}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-slate-500 hover:text-nauka-dark">
          Historial
        </summary>
        <div className="mt-2">
          <ApprovalTimeline rounds={approval.rounds} isAdmin={isAdmin} />
        </div>
      </details>
    </article>
  )
}

// ── Contexto de carátula (estimación → partida → contratista → proyecto) ──────

type CaratulaContext = {
  projectId: string
  projectLabel: string
  contratista: string
  partida: string
  numero: string
  monto: number
  previewUrl: string | null
}

async function loadCaratulaContext(
  sb: Awaited<ReturnType<typeof createClient>>,
  documentIds: string[],
  requests: ApprovalRequestRow[],
): Promise<Map<string, CaratulaContext>> {
  const out = new Map<string, CaratulaContext>()
  if (documentIds.length === 0) return out

  const { data: estRaw } = await sb
    .from("estimaciones")
    .select("id, numero, monto_con_iva, partida_id, caratula_generada_url")
    .in("id", documentIds)
  const est = (estRaw ?? []) as {
    id: string
    numero: string
    monto_con_iva: unknown
    partida_id: string
    caratula_generada_url: string | null
  }[]

  const partidaIds = [...new Set(est.map((e) => e.partida_id))]
  const { data: partRaw } = await sb
    .from("partidas")
    .select("id, nombre, contratista_id")
    .in(
      "id",
      partidaIds.length > 0
        ? partidaIds
        : ["00000000-0000-0000-0000-000000000000"],
    )
  const partidas = (partRaw ?? []) as {
    id: string
    nombre: string
    contratista_id: string
  }[]
  const partById = new Map(partidas.map((p) => [p.id, p]))

  const contratistaIds = [...new Set(partidas.map((p) => p.contratista_id))]
  const { data: contRaw } = await sb
    .from("contratistas")
    .select("id, nombre")
    .in(
      "id",
      contratistaIds.length > 0
        ? contratistaIds
        : ["00000000-0000-0000-0000-000000000000"],
    )
  const contById = new Map(
    ((contRaw ?? []) as { id: string; nombre: string }[]).map((c) => [
      c.id,
      c.nombre,
    ]),
  )

  // Proyecto por documento (desde la request).
  const projectByDoc = new Map(requests.map((r) => [r.documentId, r.projectId]))
  const projectIds = [...new Set(requests.map((r) => r.projectId))]
  const { data: projRaw } = await sb
    .from("projects")
    .select("id, nombre, lote")
    .in(
      "id",
      projectIds.length > 0
        ? projectIds
        : ["00000000-0000-0000-0000-000000000000"],
    )
  const projById = new Map(
    (
      (projRaw ?? []) as { id: string; nombre: string; lote: string | null }[]
    ).map((p) => [p.id, p.lote ?? p.nombre]),
  )

  for (const e of est) {
    const part = partById.get(e.partida_id)
    const projectId = projectByDoc.get(e.id) ?? ""
    let previewUrl: string | null = null
    if (e.caratula_generada_url) {
      const { data: signed } = await sb.storage
        .from("proyectos")
        .createSignedUrl(e.caratula_generada_url, 600)
      previewUrl = signed?.signedUrl ?? null
    }
    out.set(e.id, {
      projectId,
      projectLabel: projById.get(projectId) ?? "—",
      contratista: part ? (contById.get(part.contratista_id) ?? "—") : "—",
      partida: part?.nombre ?? "—",
      numero: e.numero,
      monto: Number(e.monto_con_iva),
      previewUrl,
    })
  }
  return out
}
