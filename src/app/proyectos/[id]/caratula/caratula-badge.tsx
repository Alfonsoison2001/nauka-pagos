import type { DocumentApproval } from "@/lib/approvals/fetch"
import { cn } from "@/lib/utils"
import type { CaratulaEstimacion } from "./page"

export type CaratulaBadgeVariant =
  | "sin-generar"
  | "rechazada"
  | "en-aprobacion"
  | "aprobada"
  | "enviada"
  | "generada"

export type CaratulaBadgeData = {
  label: string
  variant: CaratulaBadgeVariant
  /** Sub-estado en la misma card (P2): "Enviada" si una Aprobada ya salió al pagador. */
  sub?: string
}

/**
 * Badge híbrido del estado de carátula (decisión P2 del grill-me).
 * Prioridad (primer match gana): sin-generar → rechazada → en-aprobación N/M →
 * aprobada [+ sub "Enviada"] → enviada → generada.
 */
export function caratulaBadge(
  est: CaratulaEstimacion,
  approval: DocumentApproval | undefined,
): CaratulaBadgeData {
  if (!est.yaGenerada) return { label: "Sin generar", variant: "sin-generar" }
  if (approval?.latestStatus === "rechazada") {
    return { label: "Rechazada", variant: "rechazada" }
  }
  if (approval?.isOpen) {
    const total = approval.chips.length
    const aprobados = approval.chips.filter(
      (c) => c.status === "aprobada",
    ).length
    return {
      label: `En aprobación ${aprobados}/${total}`,
      variant: "en-aprobacion",
    }
  }
  if (approval?.latestStatus === "aprobada") {
    return {
      label: "Aprobada",
      variant: "aprobada",
      sub: est.enviadaAt ? "Enviada" : undefined,
    }
  }
  if (est.enviadaAt) return { label: "Enviada", variant: "enviada" }
  return { label: "Generada", variant: "generada" }
}

const VARIANT_CLASS: Record<CaratulaBadgeVariant, string> = {
  "sin-generar": "bg-slate-100 text-slate-600 ring-slate-200",
  rechazada: "bg-red-50 text-red-700 ring-red-200",
  "en-aprobacion": "bg-amber-50 text-amber-800 ring-amber-200",
  aprobada: "bg-green-50 text-green-700 ring-green-200",
  enviada: "bg-sky-50 text-sky-700 ring-sky-200",
  generada: "bg-slate-50 text-slate-500 ring-slate-200",
}

/** Render del badge: pill principal + (si aplica) mini-subtítulo "· Enviada". */
export function CaratulaBadgeView({ badge }: { badge: CaratulaBadgeData }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
          VARIANT_CLASS[badge.variant],
        )}
      >
        {badge.label}
      </span>
      {badge.sub && (
        <span className="inline-flex items-center gap-1 text-xs text-sky-600">
          <span className="size-1.5 rounded-full bg-sky-500" />
          {badge.sub}
        </span>
      )}
    </span>
  )
}
