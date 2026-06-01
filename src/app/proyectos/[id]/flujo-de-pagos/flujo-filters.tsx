"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ContratistaOption, PartidaOption } from "./actions"

export type FilterState = {
  status: string
  contratista_id: string
  partida_id: string
  mes: string
  busqueda: string
}

type Props = {
  filters: FilterState
  onFilterChange: (key: keyof FilterState, value: string) => void
  onClear: () => void
  contratistas: ContratistaOption[]
  partidas: PartidaOption[]
  hasFilters: boolean
}

export function FlujoFilters({
  filters,
  onFilterChange,
  onClear,
  contratistas,
  partidas,
  hasFilters,
}: Props) {
  const visiblePartidas = filters.contratista_id
    ? partidas.filter((p) => p.contratista_id === filters.contratista_id)
    : partidas

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status */}
      <Select
        value={filters.status || "__all__"}
        onValueChange={(v) =>
          onFilterChange("status", !v || v === "__all__" ? "" : v)
        }
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Estatus" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos los estatus</SelectItem>
          <SelectItem value="pendiente">Pendiente</SelectItem>
          <SelectItem value="enviada">Enviada</SelectItem>
          <SelectItem value="pagada">Pagada</SelectItem>
        </SelectContent>
      </Select>

      {/* Contratista */}
      <Select
        value={filters.contratista_id || "__all__"}
        onValueChange={(v) =>
          onFilterChange("contratista_id", !v || v === "__all__" ? "" : v)
        }
      >
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="Contratista" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos los contratistas</SelectItem>
          {contratistas.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Partida */}
      <Select
        value={filters.partida_id || "__all__"}
        onValueChange={(v) =>
          onFilterChange("partida_id", !v || v === "__all__" ? "" : v)
        }
      >
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="Partida" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todas las partidas</SelectItem>
          {visiblePartidas.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Mes / Año */}
      <input
        type="month"
        value={filters.mes}
        onChange={(e) => onFilterChange("mes", e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-3 text-xs shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        placeholder="Mes/Año"
      />

      {/* Búsqueda libre */}
      <Input
        className="h-8 w-48 text-xs"
        placeholder="Buscar…"
        value={filters.busqueda}
        onChange={(e) => onFilterChange("busqueda", e.target.value)}
      />

      {/* Limpiar filtros */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={onClear}
        >
          <X className="mr-1 size-3" />
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}
