# Change Proposal — Día 6: Tab Resumen (per-proyecto, KPIs)

> Estado: **PENDIENTE DE APROBACIÓN**. No se implementa hasta que Alfonso apruebe.
> Fecha: 2026-06-01

---

## 1. Objetivo

Construir el tab **Resumen** (reemplaza "Resumen Total" del Excel), primera pantalla
al entrar a un proyecto (`/proyectos/[id]` ya redirige a `/resumen`). Dashboard tipo
fintech, **read-only**, con: hero de avance, KPI cards, tabla por partida con barras de
avance, y una gráfica de barras Presupuesto vs Ejercido. Sin migración (solo lectura de
tablas existentes).

Fuera de scope hoy: Resumen Mensual (otra pestaña), Consolidado (Día 7), cotizaciones
(módulo futuro), acciones de mutación, filtros por fecha, sección de próximos vencimientos.

---

## 2. Decisiones (grill-me)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Hero | **Ppto vs Avance**: % avance + barra de progreso, enmarcado Presupuesto vs Ejercido. Debajo, KPI cards + desglose de estatus. Estética fintech con shadcn. |
| 2 | Histórico vs filtro | **Histórico/acumulado total, sin filtro de fecha.** El desglose mensual vive en Resumen Mensual. |
| 3 | Qué es "ejercido" | **EJERCIDO = solo `status='pagada'`** (dinero real, fiel al Excel). **"Por pagar" KPI = `pendiente` + `enviada`** (todo lo no pagado; ambos son compromiso financiero). |
| 4 | Qué partidas | **Todas** las partidas (incluso ejercido $0), ordenadas por **% avance desc**. |
| 5 | Gráficas | KPI **cards** + **progress bars en la tabla** (% avance por fila) + **barras "Presupuesto vs Ejercido por partida"**. Sin donut. "Pagos por mes" se queda en Resumen Mensual. |
| 6 | Próximos vencimientos | **No incluir sección.** No hay campo de vencimiento; `enviada` ya se ve en KPIs y Flujo. |
| 7 | Alertas | **Solo sobre-ejercido** (Ejercido > Presupuesto): fila resaltada + badge rojo. Aparece solo si ocurre. |
| 8 | Read-only vs acciones | **Read-only** (solo navegación). Mutaciones en Flujo/Carátula. |
| 9 | Links contextuales | Fila de partida → Flujo `?partida_id=`; KPIs de estatus → Flujo `?status=enviada`/`pagada`. Reusa filtros-por-URL existentes. |
| 10 | Reuso Consolidado | **Helper de cálculo puro** `computeResumen` + componentes reusables. Día 7 reutiliza la misma matemática. |
| 11 | Cotizaciones | **Omitir** por ahora (módulo futuro, sin datos). Sin placeholder. |

---

## 3. Datos (sin migración — solo lectura)

Reusa las tablas existentes. La página (server component) hace los mismos fetches que
`flujo-de-pagos/page.tsx`:
- `contratistas` (id, nombre) del proyecto.
- `partidas` (id, contratista_id, nombre, presupuesto_con_iva) de esos contratistas.
- `estimaciones` (partida_id, monto_con_iva, status) no borradas de esas partidas.

Todo en **con IVA** (como el Excel: PRESUPUESTO/EJERCIDO con IVA).

---

## 4. Cálculo — `computeResumen` (helper puro, reusable)

`src/lib/resumen/compute.ts`. Función pura (sin DB): recibe filas ya cargadas, devuelve
la estructura del resumen. **Única fuente de verdad** de la matemática (Día 7 la reutiliza).

```ts
type ResumenInput = {
  partidas: { id, contratistaId, contratistaNombre, partidaNombre, presupuesto }[]
  estimaciones: { partidaId, monto, status }[]   // monto = monto_con_iva
}

type PartidaResumen = {
  partidaId, contratistaNombre, partidaNombre,
  presupuesto, ejercido, disponible, pctAvance, sobreEjercido  // ejercido>presupuesto
}

type ResumenData = {
  totalPresupuesto, totalEjercido, totalDisponible, pctAvance,
  porPartida: PartidaResumen[]                 // ordenado por pctAvance desc
  statusBreakdown: {                           // conteo + monto por estatus (drill-down)
    pendiente: { count, monto },
    enviada:   { count, monto },
    pagada:    { count, monto },
  }
  porPagar: { count, monto }                   // pendiente + enviada (KPI agregado)
  sobreEjercidoCount: number
}
```

Reglas:
- `ejercido` (por partida y total) = Σ `monto` de estimaciones con `status='pagada'`.
- `pctAvance` = ejercido / presupuesto (0 si presupuesto 0; puede pasar 100% → sobre-ejercido).
- `disponible` = presupuesto − ejercido.
- `statusBreakdown` cuenta TODAS las estimaciones por estatus (para los KPIs secundarios).

---

## 5. Layout (fintech, shadcn) y componentes

```
src/lib/resumen/compute.ts          # computeResumen + tipos (puro, reusable)
src/lib/format/porcentaje.ts        # formatPct(0.578) -> "57.8%"  (+ re-export en index)

src/components/resumen/             # presentacionales reusables (Consolidado Día 7)
  kpi-card.tsx                      # card etiqueta + valor + sublabel/acento
  avance-hero.tsx                   # % avance grande + barra + "Ejercido X de Ppto Y"
  presupuesto-ejercido-chart.tsx    # "use client" — Recharts barras agrupadas por partida
  status-breakdown.tsx              # chips Pendiente/Enviada/Pagada (count+monto) con link a Flujo
  partida-resumen-table.tsx         # tabla por partida + progress bar por fila + link + highlight sobre-ejercido

src/app/proyectos/[id]/resumen/page.tsx   # server: fetch → computeResumen → render (reemplaza placeholder)
```

**Estructura de la página (de arriba a abajo):**
1. **Hero** (`AvanceHero`): "% Avance" grande + barra de progreso; subtítulo "Ejercido {formatMXN} de {formatMXN} contratado".
2. **KPI cards** (`KpiCard` × 4): Total Presupuesto · Total Ejercido (pagado) · Disponible · Por pagar (pendiente + enviada: monto + count). La card "Por pagar" es agregada (no clickeable).
2b. **Status breakdown** (`status-breakdown`): chips Pendiente/Enviada/Pagada (count + monto), cada uno con link a Flujo `?status=<ese>` (drill-down per-status).
3. **Gráfica** (`PresupuestoEjercidoChart`): barras agrupadas Presupuesto vs Ejercido por partida.
4. **Tabla** (`PartidaResumenTable`): Contratista · Partida · Presupuesto · Ejercido · % Avance (con progress bar) · Disponible. Fila sobre-ejercida resaltada (rojo). Fila clickeable → `…/flujo-de-pagos?partida_id={id}`. Fila TOTAL al final.
5. **Estado vacío**: si no hay partidas → mensaje "Sin partidas; captúralas en Presupuesto".

- **Server components por defecto.** Solo `presupuesto-ejercido-chart.tsx` es `"use client"`
  (Recharts es client-only). Los links usan `next/link` (funcionan en server components).
- Recharts ya está en el stack (no nuevas deps). Sin migración. Sin tocar Flujo/Carátula/Config
  (solo se leen tablas).

---

## 6. Navegación contextual (links)
- Fila de partida → `/proyectos/[id]/flujo-de-pagos?partida_id={partidaId}`.
- KPI "Por pagar" (enviadas) → `…/flujo-de-pagos?status=enviada`.
- KPI "Ejercido/pagado" → `…/flujo-de-pagos?status=pagada`.
- (`flujo-client.tsx` ya inicializa sus filtros desde la URL — verificado.)

---

## 7. Validación
1. `pnpm dlx @biomejs/biome check .`, `pnpm tsc --noEmit`, `pnpm build` (3 verde).
2. Test del cálculo: con datos del Excel (SAMSTORGAM ppto 212,790.40 / ejercido 106,395.20
   → 50% avance / disponible 106,395.20; TOTAL ppto 1,019,792.01 / ejercido 589,748.01 /
   58.3% / disponible 430,043.996). Verificar que `computeResumen` cuadre.
3. Regresión: Flujo de Pagos, Carátula y Configuración intactos (Resumen solo lee).

---

## 8. Supuestos a confirmar (puedes vetar)
1. **Con IVA** en todos los montos del Resumen (como el Excel). El `caratula_iva_mode` NO
   aplica aquí (es solo para el PDF de carátula).
2. KPI cards = 4: Presupuesto, Ejercido, Disponible, Por pagar (enviadas). Si quieres otro
   set, dímelo.
3. Bar chart por **partida** (no por contratista), label = nombre de partida (abreviado si
   es largo). Con muchas partidas podría apretarse; con ~5-6 está bien.
4. Helper `formatPct` nuevo en `src/lib/format/` (1 decimal: "57.8%").
