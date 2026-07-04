"use client"

import { History } from "lucide-react"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ItemHistory, QuoteVersion } from "@/lib/buyout/history"
import { formatDate } from "@/lib/format/fecha"
import { cn, formatMXN } from "@/lib/utils"
import { DifText } from "../dif-text"
import { getItemHistory } from "./actions"
import { BuyoutPdfCell } from "./buyout-pdf-cell"

type Props = {
  projectId: string
  itemId: string
  concepto: string
}

// DialogContent es un modal centrado; lo re-posicionamos como PANEL LATERAL derecho
// (drawer) solo con clases —sin tocar el primitivo compartido (que también usa Pagos).
// tailwind-merge deja ganar estas clases sobre las base (top/left/translate/rounded/
// display/gap/padding/max-w). D4: es un panel lateral, no navega a la pantalla vieja.
const PANEL_CLASS =
  "top-0 right-0 bottom-0 left-auto h-dvh w-full max-w-md sm:max-w-md translate-x-0 translate-y-0 flex flex-col gap-0 rounded-none rounded-l-2xl p-0 overflow-hidden"

/**
 * Botón "Historial" de cada fila de la Partida (a nivel concepto = buyout_item).
 * Abre un panel lateral de SOLO LECTURA con todas las versiones de cotización de
 * ese concepto (fecha, proveedor, monto, paramétrico/ppto, PDF) y marca cuál es la
 * vigente. Reusa `getItemHistory` → `loadItemHistory` (la misma fuente que la
 * pantalla Subcategoría) → cuadra con Resumen/Partida. Visible para todos (ver
 * historial no edita nada). D1: sin "Marcar vigente" ni puente a Pagos aquí; eso
 * sigue en `/buyout/subcategoria?item=`.
 */
export function HistorialButton({ projectId, itemId, concepto }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [history, setHistory] = useState<ItemHistory | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Carga perezosa al abrir (no en el render de la tabla). Se guarda contra
    // `history` (no un flag "loaded") → si una carga falló, reabrir REINTENTA;
    // ya cargado (aunque sea sin versiones) no re-consulta.
    if (next && !history && !pending) {
      setError(null)
      startTransition(async () => {
        const res = await getItemHistory(projectId, itemId)
        if (res === null) {
          setError("No se pudo cargar el historial de este concepto.")
        } else {
          setHistory(res)
        }
      })
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => handleOpenChange(true)}
        aria-label={`Ver historial de ${concepto}`}
        title="Ver historial de versiones"
        className="text-nauka-dark"
      >
        <History className="size-3.5" />
        Historial
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={PANEL_CLASS}>
          <PanelHeader concepto={concepto} history={history} />
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {pending && !history ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Cargando historial…
              </p>
            ) : error ? (
              <p className="rounded-xl border border-dashed border-nauka-card-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                {error}
              </p>
            ) : history ? (
              <HistoryBody history={history} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PanelHeader({
  concepto,
  history,
}: {
  concepto: string
  history: ItemHistory | null
}) {
  const n = history?.versions.length ?? null
  return (
    <div className="border-b border-nauka-subtle px-4 py-4 pr-12">
      <DialogTitle className="truncate text-nauka-dark">
        {concepto || "Concepto"}
      </DialogTitle>
      <DialogDescription className="mt-1">
        {history?.partidaNombre ? `${history.partidaNombre} · ` : ""}
        {n === null
          ? "Historial de versiones"
          : n === 0
            ? "sin versiones"
            : `${n} ${n === 1 ? "versión" : "versiones"}`}
        . La <span className="font-medium text-nauka-dark">vigente</span> es la
        que usan el Resumen y la Partida.
      </DialogDescription>
    </div>
  )
}

function HistoryBody({ history }: { history: ItemHistory }) {
  const { versions } = history
  if (versions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-nauka-card-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
        Este concepto aún no tiene cotizaciones. Captúralas desde la Partida.
      </p>
    )
  }
  const vigente = versions.find((v) => v.isSelected) ?? null
  const previas = versions.filter((v) => !v.isSelected)
  return (
    <div className="flex flex-col gap-4">
      {/* Comparativo compacto (solo si hay vigente y versiones previas). */}
      {vigente && previas.length > 0 ? (
        <Comparativo vigente={vigente} previas={previas} />
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Versiones (más reciente primero)
        </p>
        {versions.map((v, i) => {
          const anterior = versions[i + 1]
          const delta = anterior ? v.totalMxn - anterior.totalMxn : null
          return <VersionCard key={v.quoteId} version={v} delta={delta} />
        })}
      </div>

      {versions.length === 1 ? (
        <p className="rounded-xl border border-dashed border-nauka-card-border bg-white px-4 py-3 text-xs text-muted-foreground">
          Solo hay <span className="font-medium text-nauka-dark">una</span>{" "}
          versión (la vigente). Cada{" "}
          <span className="font-medium text-nauka-dark">
            ↻ Actualizar presupuesto
          </span>{" "}
          en la Partida agrega una versión fechada aquí para comparar.
        </p>
      ) : null}
    </div>
  )
}

/**
 * Comparativo compacto: la versión vigente como referencia + cada versión anterior
 * con su Δ% de Total MXN frente al vigente (verde = el vigente quedó más barato,
 * rojo = más caro). Misma convención que la pantalla Subcategoría. Solo informativo.
 */
function Comparativo({
  vigente,
  previas,
}: {
  vigente: QuoteVersion
  previas: QuoteVersion[]
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-nauka-card-border bg-white">
      <div className="flex items-center justify-between gap-2 bg-emerald-50/70 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <VigenteBadge />
          <span className="truncate text-sm font-medium text-nauka-dark">
            {vigente.proveedor || "Sin proveedor"}
          </span>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-nauka-dark">
          {formatMXN(vigente.totalMxn)}
        </span>
      </div>
      <ul className="divide-y divide-nauka-subtle">
        {previas.map((v) => {
          const deltaPct =
            v.totalMxn > 0 ? vigente.totalMxn / v.totalMxn - 1 : null
          return (
            <li
              key={v.quoteId}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-sm text-nauka-dark">
                  {v.proveedor || "Sin proveedor"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(v.quoteDate)}
                </span>
              </div>
              <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-sm text-muted-foreground">
                  {formatMXN(v.totalMxn)}
                </span>
                <span className="w-14 text-right text-xs">
                  <DifText dif={deltaPct} />
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function VersionCard({
  version: v,
  delta,
}: {
  version: QuoteVersion
  delta: number | null
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-3",
        v.isSelected
          ? "border-emerald-200 bg-emerald-50/70"
          : "border-nauka-card-border bg-white",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-nauka-dark">
          {formatDate(v.quoteDate)}
        </span>
        {v.isSelected ? (
          <VigenteBadge />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      <p className="mt-0.5 truncate text-sm text-muted-foreground">
        {v.proveedor || "Sin proveedor"} · {v.moneda}
      </p>

      <div className="mt-2 flex items-baseline justify-between gap-2 tabular-nums">
        <span className="text-base font-semibold text-nauka-dark">
          {formatMXN(v.totalMxn)}
        </span>
        <span className="text-xs">
          <DeltaCell delta={delta} />
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <MaturityPill kind={v.kind} />
        <ContratacionPill contratado={v.contratado} />
        <span className="ml-auto">
          <BuyoutPdfCell pdfPath={v.pdfPath} />
        </span>
      </div>
    </div>
  )
}

// --- helpers de presentación (locales al panel, solo lectura) ---------------

const PILL =
  "inline-flex h-5 w-fit items-center rounded-full px-2 text-[11px] font-medium leading-none"

function MaturityPill({ kind }: { kind: "parametrico" | "ppto" }) {
  return (
    <span
      className={cn(
        PILL,
        kind === "ppto"
          ? "bg-green-100 text-green-700"
          : "bg-amber-100 text-amber-700",
      )}
    >
      {kind === "ppto" ? "Ppto" : "Paramétrico"}
    </span>
  )
}

function ContratacionPill({ contratado }: { contratado: boolean }) {
  return (
    <span
      className={cn(
        PILL,
        contratado
          ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-600",
      )}
    >
      {contratado ? "Contratado" : "No contratado"}
    </span>
  )
}

function VigenteBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
      Vigente
    </span>
  )
}

/** Δ del Total MXN frente a la versión anterior (más antigua). */
function DeltaCell({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-muted-foreground">—</span>
  if (Math.abs(delta) < 0.005)
    return <span className="text-muted-foreground">=</span>
  const up = delta > 0
  return (
    <span className={up ? "text-red-600" : "text-emerald-600"}>
      {up ? "+" : "−"}
      {formatMXN(Math.abs(delta))} vs anterior
    </span>
  )
}
