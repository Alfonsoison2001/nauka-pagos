"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatMXN, formatPct } from "@/lib/format"
import { SEGMENT_COLORS, SEGMENT_LABELS } from "./colors"

export type ChartDatum = {
  name: string // etiqueta corta para el eje
  full: string // nombre completo (tooltip)
  presupuesto: number
  ejercido: number
  porPagar: number
  noComprometido: number
  pctAvance: number
}

/** Compacto para el eje Y: $1.0M / $212k / $800. */
function compactMXN(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${value}`
}

type TooltipDatum = {
  payload?: ChartDatum
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipDatum[]
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="rounded-md border bg-popover p-2.5 text-xs shadow-md">
      <p className="mb-1 font-medium">{d.full}</p>
      <Row
        color={SEGMENT_COLORS.ejercido}
        label={SEGMENT_LABELS.ejercido}
        value={d.ejercido}
      />
      <Row
        color={SEGMENT_COLORS.porPagar}
        label={SEGMENT_LABELS.porPagar}
        value={d.porPagar}
      />
      <Row
        color={SEGMENT_COLORS.noComprometido}
        label={SEGMENT_LABELS.noComprometido}
        value={d.noComprometido}
      />
      <p className="mt-1 border-t pt-1 text-muted-foreground">
        Avance:{" "}
        <span className="font-medium text-foreground">
          {formatPct(d.pctAvance)}
        </span>
      </p>
    </div>
  )
}

function Row({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: number
}) {
  return (
    <p className="flex items-center gap-1.5 tabular-nums">
      <span
        className="size-2 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{formatMXN(value)}</span>
    </p>
  )
}

type Props = {
  data: ChartDatum[]
}

/** Barra apilada por partida: Ejercido / Por pagar / No comprometido. */
export function PresupuestoEjercidoChart({ data }: Props) {
  return (
    <div className="rounded-2xl border border-nauka-card-border bg-nauka-card p-6 shadow-nauka-card">
      <p className="mb-4 text-sm font-semibold text-nauka-dark">
        Composición del presupuesto por partida
      </p>
      <ResponsiveContainer
        width="100%"
        height={Math.max(220, data.length * 52)}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#e5e7eb"
          />
          <XAxis
            type="number"
            tickFormatter={compactMXN}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            stackId="ppto"
            dataKey="ejercido"
            name={SEGMENT_LABELS.ejercido}
            fill={SEGMENT_COLORS.ejercido}
          />
          <Bar
            stackId="ppto"
            dataKey="porPagar"
            name={SEGMENT_LABELS.porPagar}
            fill={SEGMENT_COLORS.porPagar}
          />
          <Bar
            stackId="ppto"
            dataKey="noComprometido"
            name={SEGMENT_LABELS.noComprometido}
            fill={SEGMENT_COLORS.noComprometido}
            radius={[0, 3, 3, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
