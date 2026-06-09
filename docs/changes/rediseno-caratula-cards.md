# Change Proposal — Rediseño tab Carátula: cards agrupadas por contratista

> Estado: **PENDIENTE DE APROBACIÓN**. No se escribe código hasta que Alfonso apruebe.
> Fecha: 2026-06-09
> Tipo: rewrite de UI (la pestaña Carátula) + cambios menores de backend. Sin migración de schema.

---

## 1. Objetivo

Reemplazar el **selector único de 2 pasos** (contratista → estimación en dropdowns) de la pestaña
Carátula por una **vista de cards agrupadas por contratista**, donde cada estimación es una card
horizontal con su estado de pago + carátula de un vistazo, y se crean carátulas nuevas inline.

**En scope:**
- Rewrite de `caratula-client.tsx` a vista agrupada (grupos por contratista, fila horizontal de cards).
- **Extracción** del panel de detalle actual (preview + acciones + aprobación) a un componente reusable `<CaratulaDetailDialog>` (abierto por "Ver").
- Badge de carátula **híbrido** (badge principal + sub-estado "· Enviada").
- Card "+ Nueva carátula" → mini-modal que **crea estimación + genera carátula** en un paso.
- Orden de contratistas por **monto total de presupuesto desc** (alinea con Resumen).

**Fuera de scope:**
- Cambios al modelo de aprobación, al PDF de la carátula, o a Flujo de Pagos.
- Constancia anexa al PDF (8c, sigue pendiente aparte).
- El fix de los dropdowns Status/IVA-mode (va en su propio commit chico).

---

## 2. Decisiones del grill-me (confirmadas)

| # | Tema | Decisión |
|---|------|----------|
| P1 | "Ver" | Abre **modal/drawer** (`<CaratulaDetailDialog>`) con **preview PDF + panel de acciones completo**: firmar (aprobar/rechazar con canvas), enviar al pagador, timeline. Las cards solo tienen **acciones rápidas** en el footer. El panel hoy está **inline** en `caratula-client.tsx` → se **extrae** a componente reusable. |
| P2 | Badge Carátula | **Híbrido**: 1 badge principal por prioridad + 1 mini-subtítulo "· Enviada". Prioridad: 1) Sin generar · 2) Rechazada (rojo) · 3) En aprobación N/M (amber) · 4) **Aprobada (verde)** [+ "· Enviada" si `caratula_enviada_at`] · 5) Enviada (azul claro) · 6) Generada (gris). |
| P3 | Mini-modal | Campos: partida (filtrada), # estimación, **monto sin IVA + checkbox "Agregar IVA 16%"**, fecha, pagador. Status oculto → default **`'pendiente'`**. Concepto/Notas omitidos → `null`. Reusa `createEstimacion`. |

---

## 3. Layout / UI

```
┌─ [Contratista A]  ──────────────────────────────────────────────── (header) ─┐
│  ┌─ card ───┐ ┌─ card ───┐ ┌─ card ───┐ ┌─ + Nueva ┐   ← fila horizontal      │
│  │ Est…     │ │ Est…     │ │ Est…     │ │ carátula │     (scroll-x si no caben)│
│  └──────────┘ └──────────┘ └──────────┘ └ (dashed) ┘                          │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ [Contratista B] … (mismo patrón) ─────────────────────────────────────────────┐
```

- **Grupos** ordenados por **Σ presupuesto_con_iva de las partidas del contratista, desc**.
- Cada grupo: header con nombre del contratista + fila `flex` con `gap`, `overflow-x-auto`.
- **Card**: ancho fijo `~260px` (`w-[260px] shrink-0`), `rounded-2xl`, `border-[#C9E8E6]`, shadow sutil.

### Contenido de cada card (de arriba a abajo)
1. **Header**: `# Estimación` (Anticipo/Finiquito/Est N) + **nombre de la Partida** (text-xs gris).
2. **Monto con IVA**: `font-medium`, color `#163D4A` (nauka-dark), `tabular-nums`.
3. **Fecha estimación**: `dd/mm/yyyy`, text-xs gris.
4. **Pagador**: text-xs gris.
5. **Badge "Pago"**: Pendiente (gris) / Enviada (amber) / Pagada (verde) → reusa `<EstatusBadge>` (= `estimaciones.status`).
6. **Badge "Carátula"** (híbrido, ver §5).
7. **Footer de acciones** según estado (ver §4).

### Card "+ Nueva carátula para [Contratista]"
- Última de cada grupo, **mismo tamaño**, `border-dashed`, fondo sutil, contenido centrado.
- Click → **mini-modal** (§6).

---

## 4. Footer de acciones por estado de carátula

| Estado | Footer |
|---|---|
| **Sin generar** | `Generar` |
| **Generada** | `Ver` + kebab (Enviar a aprobación · Regenerar · Borrar) |
| **En aprobación** | `Ver` + chip de progreso (N/M) |
| **Aprobada** | `Ver` + `Descargar PDF` (+ kebab: Enviar al pagador / Regenerar / Borrar) |
| **Rechazada** | `Ver` (panel muestra el motivo) + kebab (Reenviar a aprobación · Regenerar · Borrar) |

- **"Ver"** abre `<CaratulaDetailDialog>` (preview + TODAS las acciones, incl. firmar y enviar al pagador).
- El **kebab** (menú `…`) agrupa las acciones secundarias para no saturar el footer.
- "Descargar PDF" = signed URL del PDF de la carátula (la `_generada.pdf`; cuando exista constancia 8c, esa).

> **Regresión:** toda la funcionalidad actual (generar, enviar al pagador, enviar a aprobación, aprobar/rechazar, regenerar, borrar, timeline, preview) se **preserva** — vive en el footer rápido + el `<CaratulaDetailDialog>`. Nada se pierde.

---

## 5. Lógica del badge "Carátula"

Función pura `caratulaBadge(est, approval) → { label, variant, sub? }`, prioridad (primer match gana):

```
1. !est.yaGenerada                      → { "Sin generar",        gris }
2. approval.latestStatus === 'rechazada'→ { "Rechazada",          rojo }
3. approval.isOpen                      → { `En aprobación N/M`,  amber }   // N=votos aprobados, M=total firmantes
4. approval.latestStatus === 'aprobada' → { "Aprobada",           verde, sub: est.enviadaAt ? "Enviada" : undefined }
5. est.enviadaAt                        → { "Enviada",            azul }
6. (default)                            → { "Generada",           gris claro }
```

- **N/M** se derivan de `approval` (votos aprobados / total). Render: badge principal + (si `sub`) un caption secundario "· Enviada" (dot azul), **no** un segundo chip.
- Ejemplos: `Aprobada` · `Aprobada · Enviada` · `En aprobación 2/3` · `Rechazada`.

---

## 6. Mini-modal "Nueva carátula"

- Contratista **fijo** (el del grupo, mostrado read-only).
- **Partida**: dropdown filtrado a las partidas de ese contratista (con `items`, sin el bug).
- **# Estimación**: input.
- **Monto**: `monto sin IVA` + checkbox "Agregar IVA 16%" (manda `iva_pct = 0.16 | 0`).
- **Fecha**: date picker.
- **Pagador**: dropdown (con `items`).
- **Al guardar**: `createEstimacion` → `generarCaratula(nuevoId)` → la card aparece en su grupo como "Generada".
- Si falla la generación tras crear, la estimación queda "Sin generar" (el usuario aprieta Generar). No bloqueante.

---

## 7. Componentes y backend

### Nuevos componentes (UI)
- `caratula/caratula-detail-dialog.tsx` — **extraído** del panel inline actual: preview iframe + acciones admin (Generar/Regenerar/Borrar/Enviar a aprobación/Enviar al pagador) + sección de aprobación (chips, ApproveRejectDialog, timeline). Reusa los componentes existentes (`ApproveRejectDialog`, `EnviarDialog`, `ApprovalTimeline`, `ApprovalStatusChips`, `DeleteCaratulaButton`).
- `caratula/caratula-card.tsx` — una card de estimación (badges + footer + abre el detail dialog).
- `caratula/contratista-grupo.tsx` — header + fila de cards + card "+ Nueva".
- `caratula/nueva-caratula-dialog.tsx` — el mini-modal (§6).
- `caratula/caratula-badge.ts` — la función pura de §5.

### `caratula-client.tsx` (rewrite)
- Recibe la misma data de `page.tsx` (estimaciones, firmantes, approvalByEst, isAdmin, conIva, defaultEmails).
- Agrupa por contratista, ordena por presupuesto total, renderiza `<ContratistaGrupo>` por grupo.
- Mantiene el estado optimista (al generar/borrar/crear, actualiza la card sin recargar; `router.refresh()` donde haga falta sincronizar aprobación).

### Backend (cambios menores)
- **`createEstimacion`**: extender el retorno a `{ ok: true, estimacionId }` (backward-compatible; los callers actuales ignoran el campo extra). Permite el flujo "crear + generar".
- **`page.tsx`**: agregar a la query de estimaciones `fecha_estimacion` y el **nombre del pagador** (hoy solo trae el email), y a la de partidas `presupuesto_con_iva` (para ordenar grupos). Extender el tipo `CaratulaEstimacion` con `fechaEstimacion`, `pagadorNombre`.
- Reusa sin cambios: `generarCaratula`, `regenerarCaratula`, `deleteCaratula`, `enviarCaratula`, `enviarAAprobacion` (ya con `requireAdmin` del commit anterior).

---

## 8. Estilo / design system

- Cards: `rounded-2xl`, `border-[#C9E8E6]`, `shadow-nauka-card`, fondo `bg-white`.
- Monto: color `#163D4A` (`text-nauka-dark`), `font-medium`, `tabular-nums`.
- Badges: reusa los tokens de color del proyecto (verde/amber/rojo/azul/gris) y el patrón de `<EstatusBadge>` / `<Badge>`.
- Card "+ Nueva": `border-dashed`, fondo `bg-nauka-bg`/sutil, centrada.

---

## 9. Plan de implementación

1. (este doc) apruebas el change.md.
2. Backend menor: extender `createEstimacion` (retorna id) + ampliar las queries/tipo de `page.tsx`.
3. Extraer `<CaratulaDetailDialog>` del panel inline (sin cambiar su comportamiento).
4. Crear `caratula-badge.ts`, `caratula-card.tsx`, `contratista-grupo.tsx`, `nueva-caratula-dialog.tsx`.
5. Rewrite de `caratula-client.tsx` a la vista agrupada.
6. `biome + tsc + build` → commit + push → verde en Vercel.
7. Verificas en la app.

**Commit:** `feat(caratula): rediseño a cards agrupadas por contratista + alta inline de carátula`

## 10. Riesgos / regresión

- **Regresión (lo más importante):** la pestaña Carátula es funcionalidad existente. El rewrite **debe preservar** generar/enviar/aprobar/rechazar/regenerar/borrar/timeline/preview — todo movido al footer rápido + `<CaratulaDetailDialog>`. Checklist de verificación end-to-end antes de declarar listo.
- **Build verde** antes de push; verificación visual en la app (incl. el sentido del flujo de firma y el mini-modal de alta).

---

*Fin del change proposal. Esperando aprobación de Alfonso para implementar.*
