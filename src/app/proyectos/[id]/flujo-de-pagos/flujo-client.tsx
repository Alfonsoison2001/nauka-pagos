"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import type {
  ContratistaOption,
  EstimacionRow,
  PagadorOption,
  PartidaOption,
} from "./actions"
import type { FilterState } from "./flujo-filters"
import { FlujoFilters } from "./flujo-filters"
import { FlujoTable } from "./flujo-table"
import { NewEstimacionButton } from "./new-estimacion-button"

type Props = {
  rows: EstimacionRow[]
  contratistas: ContratistaOption[]
  partidas: PartidaOption[]
  pagadores: PagadorOption[]
  pagadoAcumByPartida: Record<string, number>
  projectId: string
}

export function FlujoClient({
  rows,
  contratistas,
  partidas,
  pagadores,
  pagadoAcumByPartida,
  projectId,
}: Props) {
  const sp = useSearchParams()
  const router = useRouter()

  const filters = useMemo<FilterState>(
    () => ({
      status: sp.get("status") ?? "",
      contratista_id: sp.get("contratista_id") ?? "",
      partida_id: sp.get("partida_id") ?? "",
      mes: sp.get("mes") ?? "",
      busqueda: sp.get("busqueda") ?? "",
    }),
    [sp],
  )

  function setFilter(key: keyof FilterState, value: string) {
    const params = new URLSearchParams(sp.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    // Reset partida when contratista changes
    if (key === "contratista_id") params.delete("partida_id")
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  function clearFilters() {
    router.replace("?", { scroll: false })
  }

  const hasFilters = Object.values(filters).some(Boolean)

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (filters.status && row.status !== filters.status) return false
      if (
        filters.contratista_id &&
        row.contratista_id !== filters.contratista_id
      )
        return false
      if (filters.partida_id && row.partida_id !== filters.partida_id)
        return false
      if (filters.mes) {
        const rowMes = row.fecha_pago?.slice(0, 7) ?? ""
        if (rowMes !== filters.mes) return false
      }
      if (filters.busqueda) {
        const q = filters.busqueda.toLowerCase()
        const haystack = [
          row.contratista_nombre,
          row.partida_nombre,
          row.numero,
          row.concepto ?? "",
          row.pagador_nombre ?? "",
          row.notas ?? "",
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [rows, filters])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Flujo de Pagos</h2>
        <NewEstimacionButton
          projectId={projectId}
          contratistas={contratistas}
          partidas={partidas}
          pagadores={pagadores}
          pagadoAcumByPartida={pagadoAcumByPartida}
        />
      </div>

      <FlujoFilters
        filters={filters}
        onFilterChange={setFilter}
        onClear={clearFilters}
        contratistas={contratistas}
        partidas={partidas}
        hasFilters={hasFilters}
      />

      {filtered.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <FlujoTable
          rows={filtered}
          projectId={projectId}
          contratistas={contratistas}
          partidas={partidas}
          pagadores={pagadores}
          pagadoAcumByPartida={pagadoAcumByPartida}
        />
      )}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-md border border-dashed p-12 text-center">
      <p className="text-sm font-medium">
        {hasFilters
          ? "No hay estimaciones que coincidan con los filtros."
          : "Aún no hay estimaciones registradas."}
      </p>
      {!hasFilters && (
        <p className="mt-1 text-sm text-muted-foreground">
          Registra la primera estimación con el botón &ldquo;Nueva
          estimación&rdquo;.
        </p>
      )}
    </div>
  )
}
