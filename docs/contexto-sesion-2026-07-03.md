# Contexto de sesión — Buy-Out NAUKA (2026-07-03)

> Handoff de la sesión de Cowork con Alfonso. Resume estado, decisiones y pendientes
> del módulo **Buy-Out**. Complementa (no reemplaza) a `docs/STATE-buyout.md`,
> `docs/SPEC-buyout.md` y los `docs/audit-*`.

---

## 1. Dónde estamos

- **La app está EN PRODUCCIÓN** → `nauka-pagos.vercel.app`. Deploy verde.
- Último commit en `main`/producción: **`285a6ca`** (merge de las mejoras + nota de STATE).
- El Buy-Out replica el tablero de Excel (source of truth = Excel; el sistema agrega
  historial, estados, PDFs y el cruce con Pagos). Beachfront ya migrado y cuadrado.
- Trabajo por prompts: Alfonso pega prompts en **Claude Code** (que codea en su Mac);
  el asistente en Cowork **planea/asesora/dissecta Excel/mantiene docs**, NO edita código.

## 2. Qué se publicó en esta sesión

Rama `feat/buyout-mejoras` → auditada → 6 arreglos → mergeada a `main` → push a producción.

- **Auditoría READ-ONLY** (`docs/audit-buyout-mejoras-2026-07-03.md`, commit `bde39d3`):
  0🔴 0🟠 · 3🟡 · 11⚪. Salud BUENA, bien aislada, Pagos intacto.
- **6 arreglos pre-producción** (commit `41d2a9f`):
  - **M1** — revalidar Resumen + Partida + Glosario tras capturar (antes solo /partida).
  - **M2** — `renameChapter`: captura error del re-apunte de partidas; revierte si falla.
  - **M3** — `renameConcepto`: propagación con reversión (`propagateConceptoRename`).
  - **L1** — `deleteLinea`: valida `item.project_id === projectId`.
  - **L2** — `setLineaContratado`: ata línea→quote→item al proyecto.
  - **L3** — al togglear estado por línea, recomputa `buyout_quote.contratado` desde las
    líneas → el puente a Pagos queda consistente con el Resumen.
- Sin migración (tablas/RLS `buyout_*` ya viven en prod — opción B).

## 3. Decisión de esta sesión: quitar "Subcategoría", meter "Historial"

**Problema:** la pestaña **Subcategoría** confunde. En partidas de un solo concepto
(ej. Obra Civil, donde el detalle real va en la columna DETALLE y todo comparte el
concepto "Obra_Civil"), muestra filas repetidas y no aporta — el Resumen ya hace el rollup.

**Modelo mental aclarado con Alfonso:**
- **Partida** = pestaña verde de Excel = las líneas (22 cols). Es la pantalla buena.
- **Subcategoría (concepto)** = solo sirve cuando una partida se parte en pedazos que se
  cotizan por separado (Mármol = Suministro + Colocación; Cocinas = Cocina + Grill + Laundry).
- El único valor real de Subcategoría era el **historial de versiones**.

**Decisión tomada (falta implementar):**
1. **Quitar** el link "Subcategoría" del sub-nav (dejar la ruta intacta por ahora — anti-cleanup).
   Sub-nav queda: Resumen · Partida · Glosario.
2. En **Partida**, botón **"Historial"** a nivel **CONCEPTO + PROVEEDOR** (la cotización) →
   pantalla/panel con los pptos anteriores de esa misma cotización: fecha, monto,
   paramétrico/ppto, PDF, y marca cuál es el vigente. Solo lectura en V1.

**Estado:** IMPLEMENTADO en la rama `feat/buyout-historial` (Opus Max), **solo en LOCAL,
sin push**. Resultó reubicación pura: el historial ya existía (`loadItemHistory` +
ícono 🕘 → `/subcategoria?item=`); solo se movió a un **panel/drawer de solo lectura**
en Partida (botón "Historial" por fila, keyed por `item_id`), se quitó el link del sub-nav
(ruta `/subcategoria` intacta), y se agregó un wrapper de lectura `getItemHistory`.
Decisiones D1–D4: D1 panel 100% lectura · D2 por concepto (todas las versiones, cada una
con su proveedor) · D3 por fila · D4 drawer lateral. Sin migración, sin query nueva, cero Pagos.

> **PENDIENTE (Alfonso):** probar en local (números del panel == `/subcategoria?item=<id>`;
> sub-nav sin "Subcategoría"; Resumen/captura/contratado/uploads intactos en L3 y BF) →
> si pasa, **merge a main + push a producción**. Producción sigue en `285a6ca` (sin Historial).

## 4. Siguiente feature: "Pendientes / estatus de lo no cotizado" (con fable 5)

Visión: es **la mitad izquierda del tablero de Excel** que aún no se modela — el pipeline
de procura (qué falta cotizar/contratar y en qué etapa). Columnas tipo `DESIGN PRIORITY`,
`% PROGRESS`, `POTENTIAL CONTRACTOR`, `REQUIRED DATE`.

Cómo se imagina:
- Pestaña nueva **"Pendientes"** en el sub-nav.
- Lista las **partidas SIN cotización vigente** (lo "no cotizado" se deriva del estado real,
  no se teclea aparte).
- Por renglón: etapa (dropdown), prioridad, fecha requerida, posible contratista, notas.
- Cuando una partida consigue su cotización vigente, **sale sola** de pendientes. Sin doble captura.
- Vista tabla (o kanban por etapa).

**Grill-me en curso — respuestas de Alfonso hasta ahora:**
- Grano: (pregunta abierta — se recomendó **por partida**; falta confirmar explícito).
  > NOTA: en el flujo de la sesión saltamos a resolver lo de Subcategoría antes de cerrar el grill.
  > Retomar el grill de Pendientes cuando Historial esté listo.

Modelo a usar: **fable 5** (hasta el 7 de julio, tiene límite) — reservado para este feature
y para rediseños de UX/diseño.

## 5. Estrategia de modelos (Claude Code)

- **Opus 4.8 Max** → merge/push, CRUD, arreglos puntuales, auditorías read-only, ejecución.
- **fable 5** (hasta 7-jul, limitado) → feature de Pendientes, rediseño del footer del Resumen,
  UX/diseño complejo, y bug-hunts profundos de todo el código.
- Evitar modelos "fast" para trabajo con reglas estrictas.

## 6. En curso con fable 5 (corriendo en Claude Code)

Alfonso lanzó dos prompts a **fable 5**:

1. **Bug-hunt de todo el código** (READ-ONLY): leer TODA la app (Pagos + Buy-Out en `main`),
   listar bugs reales por severidad (🔴/🟠/🟡/⚪) con archivo:línea + repro + impacto, guardar
   en `docs/audit-app-completa-<fecha>.md`, y **NO arreglar nada hasta "go"**.
2. **Piloto de UI profesional** (rama `feat/ui-profesional`, desde main, sin push): escribir
   `docs/design-prompt.md` (sistema de diseño) + aplicarlo como PILOTO a UNA pantalla del
   Buy-Out (Resumen o Partida). Solo visual, cero lógica, sin renombrar columnas, Pagos intacto.
   Reaccionar al piloto antes de replicar al resto.

> **PENDIENTE:** revisar ambos entregables cuando fable termine. Del bug-hunt: priorizar
> hallazgos y decidir qué arreglar/con qué modelo. Del piloto UI: reaccionar y, si gusta,
> replicar pantalla por pantalla.

## 7. Pendientes (backlog)

**Buy-Out:**
- [ ] **Historial** — implementado en `feat/buyout-historial` (local). Probar → merge → **push**. — Opus
- [ ] **Piloto UI profesional** — corriendo con fable 5 en `feat/ui-profesional`. Revisar y replicar.
- [ ] **Bug-hunt de todo el código** — corriendo con fable 5 (read-only). Revisar reporte y priorizar.
- [ ] Feature de Pendientes (cerrar grill-me → openspec → implementar). — fable 5
- [ ] Rediseño del footer del Resumen ("no me gustó nada"). — fable 5
- [ ] Migrar **Lote 44** (necesita su Excel; hacer line-spec upfront como BF).
- [ ] Deuda de la auditoría previa: 21 🟡/⚪ + limpieza de PDFs huérfanos al reemplazar.
- [ ] Los 8 ⚪ restantes de la auditoría de mejoras (L4–L11).

**Pagos (parqueado, NO tocar sin pedir):**
- [ ] Rotación de keys → migrar a `sb_publishable_`/`sb_secret_` (los legacy ya no rotan).
      Runbook en `docs/runbook-rotacion-keys.md`.
- [ ] Respaldo de PDFs de Supabase a Dropbox (`scripts/backup-storage.mjs` listo, sin trackear;
      falta ruta Dropbox + prueba + cron).
- [ ] Arreglo de emails (no llegan; BO A1/A2/A3).
- [ ] Extras en presupuesto con PDF.
- [ ] Aplicar el mismo fix de upload directo a Storage en Pagos (latente).

## 8. Reglas / salvaguardas (SIEMPRE)

- **NUNCA push sin autorización explícita de Alfonso.**
- **NUNCA tocar código/tablas/RLS/lógica de Pagos** — excepto el puente (que INSERTA en
  contratistas/partidas de Pagos) y el sidebar/config compartido.
- Cada feature: **grill-me → openspec (change.md) → aprobar → implementar** (regla de CLAUDE.md).
- Ediciones quirúrgicas, prevención de regresión, sin "cleanup" pasadas.
- **No commitear** los archivos sin trackear: `reference/*.xlsx`, `scripts/backup-storage.mjs`.
- Keys en texto plano en `.env.local` (rotación parqueada).
- Ramas de trabajo sin borrar (puntos de retorno): `feat/buyout-mejoras`, `feat/buyout`,
  `feat/buyout-historial`.

---

## Mapa de docs (dónde está cada cosa)

- `docs/SPEC-buyout.md` — spec del módulo (data model, workflows, build order, decisiones).
- `docs/STATE-buyout.md` — estado vivo (lo mantiene Claude Code).
- `docs/audit-buyout-2026-06-29.md` — auditoría previa.
- `docs/audit-buyout-mejoras-2026-07-03.md` — auditoría de las mejoras.
- `docs/future-modules/buyout-catalogo-L3.md` / `buyout-catalogo-BF.md` — taxonomías canónicas.
- `docs/future-modules/buyout-L3-estructura.md` / `buyout-BF-estructura.md` — disección de Excel.
- `docs/future-modules/buyout-BF-lineas-spec.md` — spec exacto de líneas por partida (BF).
- `docs/future-modules/backlog-ideas.md` — ideas parqueadas.
- `docs/runbook-rotacion-keys.md` — rotación de keys.
- **`docs/contexto-sesion-2026-07-03.md`** — este archivo.
