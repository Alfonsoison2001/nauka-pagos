# Change Proposal — Quitar la pestaña "Subcategoría" y mover el historial de pptos a un botón "Historial" en Partida

> Estado: **PENDIENTE DE APROBACIÓN**. No se escribe código hasta que Alfonso apruebe (FASE 1 = solo plan).
> Fecha: 2026-07-03 · Rama: `feat/buyout-historial` (desde `main`, **sin push**).
> Tipo: cambio de UI/navegación del módulo **Buy-Out**. **Sin migración de schema · sin query nueva** (reusa lo que ya carga Subcategoría).
> Alcance: **solo Buy-Out**. Cero archivos, esquema, RLS o lógica de **Pagos**.

---

## 1. Contexto y objetivo

La pestaña **Subcategoría** del sub-nav de Buy-Out (Resumen · Partida · **Subcategoría** · Glosario) confunde: su
pantalla-índice (listar todos los conceptos con su total) **duplica** lo que ya se ve en Partida y en Resumen. Su
**único valor real** es el **historial de versiones de cotización** de un concepto (todas las `buyout_quote` por
fecha, con su PDF, marcando la vigente).

Ese valor **ya está semi-expuesto** en Partida: cada fila de la tabla de 22 columnas tiene un ícono 🕘 "Ver historial"
que enlaza a `…/subcategoria?item=<itemId>`. Este cambio **formaliza ese acceso** como un botón claro **"Historial"**
y **retira la pestaña** del sub-nav, para que el historial viva donde tiene sentido (junto a la línea) y el índice
confuso deje de anunciarse.

> **Modelo mental (aclarado con Alfonso):** la **Partida** (formato verde, 22 cols) es la pantalla buena. El
> **concepto** (`buyout_item`) solo aporta cuando una partida **se parte en pedazos que se cotizan por separado** —
> p. ej. **Mármol** = Suministro + Colocación, **Cocinas** = Cocina + Grill + Laundry. En partidas de **un solo
> concepto** (donde el detalle real va en la columna DETALLE), el índice de Subcategoría solo muestra filas repetidas
> que el Resumen ya agrega → de ahí que confunda. Esto **refuerza D2**: el historial se mantiene **por concepto**
> (cada versión con su proveedor), que es justo lo útil en esos casos de partida partida.

**En scope:**
- Quitar el link **"Subcategoría"** del sub-nav (dejar la ruta `/subcategoria` **intacta y viva** — anti-cleanup).
- Convertir el ícono "Ver historial" de cada fila de Partida en un botón **"Historial"** que abre un **panel de solo
  lectura** con las versiones de esa cotización (concepto + proveedor): fecha, monto, paramétrico/ppto, PDF, y **cuál
  es la vigente**.

**Fuera de scope (V1):**
- Editar el historial desde el panel (marcar vigente, ligar a Pagos, borrar versiones) → se queda **solo lectura**.
- Borrar la ruta/pantalla `/subcategoria` o su código (se conserva; ver §3 y §9).
- Cualquier cambio a rollup, cálculos, cierre de mes, captura, o al puente a Pagos.
- Cualquier cosa de **Pagos**.

---

## 2. Cómo funciona hoy (lo que leí, para fijar el terreno)

### 2.1 Sub-nav
`src/components/buyout/buyout-sub-nav.tsx` → arreglo `TABS` (líneas 10-15):
```ts
const TABS = [
  { slug: "",             label: "Resumen" },
  { slug: "partida",      label: "Partida" },
  { slug: "subcategoria", label: "Subcategoría" },   // ← ESTE se quita
  { slug: "glosario",     label: "Glosario" },
] as const
```
Se renderiza en `buyout/layout.tsx`. Quitar la entrada = quitar el link; el resto del componente no cambia.

### 2.2 La pantalla Subcategoría tiene DOS modos (`subcategoria/page.tsx`)
- **Sin `?item=` → `IndexView`**: lista todos los conceptos agrupados por partida (concepto · proveedor · N versiones ·
  total). **Este es el modo que confunde** (duplica Partida/Resumen). Su loader es
  `loadConceptoIndex()` (`lib/buyout/history.ts:176`), que reusa el rollup (`loadVigenteLines`).
- **Con `?item=<itemId>` → `HistoryView`**: el **valor real**. Muestra el `ComparativoVigente` + la `VersionsTable`
  con TODAS las versiones (`loadItemHistory()`, `lib/buyout/history.ts:60`): **Fecha · Proveedor · Moneda · Monto sin
  IVA · Total MXN · Δ vs anterior · Estado (madurez+contratación) · PDF · Vigente**. Para **admin** incluye además
  `MarcarVigenteButton` y el `ContratoPagosPanel` (puente a Pagos §8 del SPEC).

### 2.3 Modelo de versiones (lo que necesita el historial)
- Un **concepto** = un `buyout_item` (dentro de una partida). Tiene N **cotizaciones** (`buyout_quote`), **una** con
  `is_selected = true` = la **vigente**. `loadItemHistory` trae todas por `quote_date` desc y calcula el Total MXN de
  cada una con la **misma fórmula del rollup** (`calcLinea` + TC) → cuadra con Partida y Resumen.
- **Badge "N versiones"**: es `count(buyout_quote)` no borradas por `item_id`
  (`loadConceptoIndex`, líneas 187-195; y `versions.length` en el header de `HistoryView`). En el panel nuevo el
  conteo sale directo de `loadItemHistory().versions.length` — **sin query extra**.
- **Marcar vigente**: `marcarVigente()` (`subcategoria/actions.ts`) hace el swap atómico vía RPC
  `buyout_mark_vigente` (BO-09). **Crear versión nueva** (↻ "Actualizar presupuesto" en la fila de Partida):
  `addBudgetVersion()` → `insertVigenteQuoteAndLine()` (`partida/actions.ts:245,381`) baja la vigente anterior e
  inserta la nueva ya marcada vigente. **Ninguna de estas dos se toca en este cambio.**

### 2.4 Partida (dónde va el botón)
`partida/page.tsx` → tabla de 22 columnas, **una fila por `buyout_line`** (`VigenteLine`). La última columna
("Acciones", `LineaRowCells`, líneas 553-587) hoy contiene, en orden:
1. 🕘 ícono `<Link href="…/subcategoria?item=${linea.item_id}">` "Ver historial" (líneas 555-562) — **para todos**.
2. `BuyoutPdfCell` (PDF de la línea).
3. (admin) `UpdateBudgetButton` (↻), `EditLineaButton`, `DeleteLineaButton`.

Cada línea trae `linea.item_id`, `linea.quote_id`, `linea.concepto`, `linea.proveedor`.

### 2.5 Cómo se agrupan las líneas que comparten cotización
- **L3 / L44 (modo villa):** típicamente **una línea por concepto** → 1 fila = 1 concepto = 1 historial. Trivial.
- **BF (modo torre):** un concepto (`buyout_item`) consolidado tiene **varias líneas** (una por torre), y **todas
  cuelgan de la MISMA cotización vigente** (`item → is_selected quote → N líneas`, ver `loadVigenteLines`,
  `rollup.ts:202`). Por lo tanto **comparten el mismo `item_id` y el mismo historial**. Las 2-N filas de torre de un
  concepto mostrarán, cada una, un botón "Historial" que abre **el mismo** panel (el del concepto). Es redundante pero
  **no es incorrecto** (mismo contenido). → Se mantiene **un botón por fila**, siempre **keyed por `item_id`**
  (comportamiento idéntico al ícono actual). Ver Decisión **D3**.

---

## 3. QUÉ SE QUITA

**Solo una cosa:** la entrada `{ slug: "subcategoria", label: "Subcategoría" }` del arreglo `TABS` en
`buyout-sub-nav.tsx` (línea 13). El sub-nav queda: **Resumen · Partida · Glosario**.

**NO se toca / se conserva (anti-cleanup):**
- La **ruta y pantalla** `src/app/proyectos/[id]/buyout/subcategoria/` (`page.tsx`, `actions.ts`,
  `contrato-actions.ts`, y sus componentes `marcar-vigente-button.tsx`, `contrato-pagos-panel.tsx`). Siguen vivas y
  accesibles **por URL** (`/…/buyout/subcategoria` y `/…/buyout/subcategoria?item=<id>`).
- Todos los `revalidatePath("…/buyout/subcategoria")` en `partida/actions.ts` (línea 222), `subcategoria/actions.ts`
  y `subcategoria/contrato-actions.ts` → **siguen siendo válidos** (la ruta existe; solo dejó de estar en el menú).
- `loadConceptoIndex` y el `IndexView` (quedan sin link de nav, pero funcionales por URL).

> **Verificado:** el único `Link`/`href` de navegación hacia `subcategoria` fuera de su propia carpeta es el ícono de
> la fila de Partida (`partida/page.tsx:556`), que este cambio reemplaza. No hay otro punto de entrada en el menú.
> Quitar el tab **no rompe** ninguna ruta ni revalidación.

---

## 4. QUÉ SE AGREGA

### 4.1 Botón "Historial" en cada fila de Partida
En la columna **Acciones** de `LineaRowCells` se **reemplaza** el ícono-link 🕘 (líneas 555-562) por un botón
**"Historial"** (ícono `History` + texto, o ícono con `aria-label` si el ancho aprieta), **primero** del clúster de
acciones, **visible para todos** (ver historial es solo lectura). Props: `projectId`, `itemId={linea.item_id}`,
`concepto={linea.concepto}`.

- **Ubicación exacta:** por **fila de línea**, en la celda Acciones (última columna), a la izquierda del `BuyoutPdfCell`.
  Mismo lugar que el ícono actual → cero reacomodo del resto de acciones.
- **Nivel:** **concepto (`buyout_item`)**. La fila de Partida representa "concepto + proveedor (la cotización vigente)";
  el botón abre el historial de **ese concepto**, donde cada versión muestra **su** proveedor (una cotización histórica
  puede tener otro proveedor — es justo el "comparativo de proveedores" del SPEC §6.3). **No** se filtra a un solo
  proveedor (ver Decisión **D2**).

### 4.2 Panel "Historial" (slide-over / drawer, solo lectura)
Al picar el botón, abre un **panel lateral** (client component nuevo, sobre la pantalla Partida — **no navega fuera**)
con el historial de ese concepto. Contenido (todo **solo lectura** en V1):

- **Encabezado:** `concepto` · `partidaNombre` · **"N versiones"** (de `loadItemHistory().versions.length`).
- **Comparativo vigente:** la versión **vigente** destacada + Δ Total MXN y Δ% de cada versión previa (reusa la lógica
  de `ComparativoVigente`).
- **Tabla de versiones** (desc por fecha): **Fecha · Proveedor · Moneda · Monto sin IVA · Total MXN · Δ vs anterior ·
  Estado (madurez + contratación) · PDF · badge VIGENTE** en la fila seleccionada. El PDF se ve con el
  `BuyoutPdfCell` existente (URL firmada; funciona igual dentro del panel).
- **Estado vacío / una sola versión:** si el concepto tiene 1 versión, se muestra igual con la nota "solo una versión
  (la vigente); cada ↻ Actualizar presupuesto agregará una fechada aquí" (reusa el copy actual).
- **Sin acciones de escritura:** en V1 **no** hay "Marcar vigente" ni el panel "Contrato en Pagos". Esas capacidades
  admin **siguen vivas** en la ruta `/…/buyout/subcategoria?item=<id>` (por URL). Ver Decisión **D1**.

### 4.3 De dónde saca los datos (sin migración, sin query nueva)
El panel es cliente, así que necesita un puente al loader server. Se agrega **un solo Server Action delgado**
`getItemHistory(projectId, itemId)` que:
1. crea el cliente Supabase server, lee el `buyout_fx` del proyecto (igual que hoy hace `subcategoria/page.tsx`),
2. **llama a `loadItemHistory(sb, projectId, itemId, fxList)`** —el **mismo** loader que ya usa la pantalla
   Subcategoría— y devuelve `ItemHistory | null`.

No es una consulta nueva: es una **llamada al loader existente**. `loadItemHistory` ya valida que el `item` pertenezca
al `projectId` (scoping) y devuelve `null` si no. **Cero SQL nuevo, cero migración, cero cambio de datos.**

> Se carga **al abrir el panel** (lazy), no en el render de Partida, para no pagar N historiales por adelantado (BF: 55
> conceptos). Es una acción de solo lectura.

---

## 5. Archivos afectados

| Archivo | Cambio | Riesgo |
|---|---|---|
| `src/components/buyout/buyout-sub-nav.tsx` | **[QUITA]** eliminar la entrada `subcategoria` del arreglo `TABS` (1 línea). | Bajo. Solo desaparece un link. |
| `src/app/proyectos/[id]/buyout/partida/page.tsx` | **[EDITA]** en `LineaRowCells` reemplazar el `<Link>` 🕘 (líneas 555-562) por `<HistorialButton projectId itemId concepto />`. Import del nuevo componente. | Bajo. Celda Acciones aislada; el resto de la fila/tabla intacto. |
| `src/app/proyectos/[id]/buyout/partida/historial-panel.tsx` | **[NUEVO]** client component: botón + drawer de solo lectura. Reusa `BuyoutPdfCell`, `formatMXN`, `formatDate`, `DifText`, tipo `QuoteVersion`/`ItemHistory`. | Bajo (código nuevo, aislado). |
| `src/app/proyectos/[id]/buyout/partida/actions.ts` | **[EDITA]** agregar el Server Action `getItemHistory(projectId, itemId)` que envuelve `loadItemHistory`. | Bajo. Solo lectura; no toca los actions existentes. |

> **Decisión de diseño para minimizar regresión:** **no** se refactoriza `subcategoria/page.tsx`. El panel renderiza su
> propia tabla de solo lectura (JSX pequeño, reusando helpers) en lugar de extraer y compartir los componentes de la
> pantalla Subcategoría. Así la pantalla Subcategoría (que sigue viva) **no se toca** y no hay riesgo de romperla.
> DRY entre panel y pantalla queda como *follow-up* opcional. (Alternativa en Decisión **D4**.)

**No se tocan:** `rollup.ts`, `history.ts` (`loadItemHistory` se reusa tal cual), `calc.ts`, `month-close.ts`,
`pagos-link.ts`, ni `subcategoria/*`, ni nada de Pagos, ni ninguna migración.

---

## 6. ¿Query o migración nueva? → **NO**

- **Migración de schema:** **NO.** No hay tablas ni columnas nuevas. Todo el dato ya existe (`buyout_item`,
  `buyout_quote`, `buyout_line`, `buyout_fx`).
- **Query nueva:** **NO.** Se **reusa `loadItemHistory`** (el loader que ya alimenta la pantalla Subcategoría). El único
  código server nuevo es un wrapper Server Action que lo llama desde el cliente. El badge "N versiones" sale del mismo
  loader (`versions.length`) → tampoco requiere el conteo aparte de `loadConceptoIndex`.

---

## 7. Riesgos y mitigaciones

- **Se oculta el índice "todos los conceptos".** Es justo lo que confunde y queremos retirar; su info ya está en
  Partida/Resumen. Mitigación: la ruta sigue viva por URL si algún día se quiere. Riesgo funcional ~nulo.
- **Admin pierde acceso de menú a "Marcar vigente" y al puente a Pagos.** Con el tab fuera y el panel en solo lectura,
  esas acciones solo quedan por URL (`/…/subcategoria?item=<id>`). Mitigación / decisión: **D1** (recomendación:
  aceptable en V1; ↻ "Actualizar presupuesto" en la fila ya cubre el 90% —crear versión vigente— y el puente a Pagos
  se usa poco). Si Alfonso quiere, se agrega "Marcar vigente" (admin) dentro del panel en una iteración.
- **BF: botón repetido por torre.** N filas del mismo concepto → mismo panel. Redundante, inofensivo (Decisión **D3**).
- **El panel es cliente + fetch lazy.** Patrón estándar de Next (Server Action de solo lectura). El scoping por
  proyecto ya lo garantiza `loadItemHistory`. Riesgo bajo.
- **Deep-link a `/subcategoria` sin tab activo:** al entrar por URL a la pantalla vieja, ningún tab del sub-nav queda
  resaltado (cosmético). Sin impacto funcional.

---

## 8. CHECKLIST — qué DEBE seguir funcionando (verificación pre-entrega)

**Buy-Out — Resumen**
- [ ] Rollup partida→capítulo→TOTAL idéntico (no se toca `rollup.ts` ni datos).
- [ ] Modos **Vigente · Evolución · Contratación**, $/m² + USD/m², DIF, "▸ Meses", desglose por ejes: idénticos.
- [ ] Cierre/reapertura de mes y edición inline (base/meses en Evolución): intactos.

**Buy-Out — Partida**
- [ ] Tabla de 22 columnas, total del pie, orden por torre (BF) y scroll: idénticos.
- [ ] Captura: **Agregar** (`NuevaLineaButton`), ↻ **Actualizar presupuesto** (`UpdateBudgetButton`),
      **Editar** (`EditLineaButton`), **Borrar** (`DeleteLineaButton`): funcionan igual.
- [ ] Toggle **Contratado/No** por línea + estado "parcial" (BF por torre): igual.
- [ ] Subida/visualización de **PDF** por línea (subida directa a Storage + URL firmada): igual.
- [ ] El nuevo botón **"Historial"** abre el panel con las versiones correctas del concepto (fecha, monto, kind, PDF,
      vigente) y **cuadra** con la tabla Subcategoría (misma fuente `loadItemHistory`).
- [ ] Funciona en **L3/L44 (villa)** y en **BF (torre)**; visible para admin y no-admin (solo lectura).

**Buy-Out — otros**
- [ ] **Glosario** (capítulos/partidas/conceptos): intacto.
- [ ] La pantalla **Subcategoría por URL** (`?item=` y sin él) sigue cargando; "Marcar vigente" y "Contrato en Pagos"
      siguen operando por esa ruta.
- [ ] `revalidatePath(".../subcategoria")` en los actions sigue válido (la ruta existe).

**Pagos (NUNCA se toca)**
- [ ] Cero archivos/esquema/RLS/lógica de Pagos modificados. Presupuesto, Flujo de Pagos, Carátula, Aprobaciones,
      Resumen y el puente Buy-Out→Pagos (`contrato-actions.ts`, sin tocar): idénticos.

**Gate técnico**
- [ ] `pnpm tsc` ✓ · `biome` ✓ · `pnpm build` ✓ (mismas rutas; `/buyout/subcategoria` sigue existiendo).

---

## 9. Decisiones abiertas (para que Alfonso confirme antes de implementar)

| # | Pregunta | Recomendación |
|---|---|---|
| **D1** | ¿El panel es **100% lectura** o incluye la acción admin **"Marcar vigente"**? | **Recomiendo 100% lectura en V1** (como pediste). "Marcar vigente" + puente a Pagos quedan por URL en `/subcategoria?item=`. Si molesta, en V2 agregamos "Marcar vigente" (admin) dentro del panel. |
| **D2** | El historial es **por concepto** (todas sus versiones, con el proveedor de cada una), **no** filtrado a un solo proveedor. ¿Ok? | **Recomiendo sí** (por concepto). Es lo que ya existe y lo que el SPEC §6.3 llama "comparativo de proveedores". Filtrar por proveedor daría menos valor y no hay dato que lo pida. |
| **D3** | En BF, ¿**un botón por fila** (cada torre repite el botón del mismo concepto) o **uno por concepto** (dedupe)? | **Recomiendo uno por fila** (igual que hoy, keyed por `item_id`). Dedupe es cosmético y complica la tabla; se puede afinar después. |
| **D4** | ¿**Panel/drawer** en Partida (recomendado) o el botón simplemente **navega** a `/subcategoria?item=` como hoy? | **Recomiendo panel** (tu palabra fue "abre un panel", no saca al usuario de Partida, y es naturalmente solo-lectura). El "navegar" es la opción B de menor esfuerzo pero re-expone la pantalla vieja con sus acciones de edición. |

---

## 10. Plan de implementación (SOLO tras aprobación — no ahora)

1. (este doc) Alfonso aprueba y confirma D1–D4.
2. `getItemHistory(projectId, itemId)` en `partida/actions.ts` (wrapper de `loadItemHistory`).
3. `historial-panel.tsx` (botón + drawer de solo lectura, reusa `BuyoutPdfCell`/helpers).
4. Cablear el botón en `LineaRowCells` (reemplaza el ícono 🕘).
5. Quitar la entrada `subcategoria` del `TABS` del sub-nav.
6. `tsc` + `biome` + `pnpm build` verdes en **local**; commit en `feat/buyout-historial`. **Sin push.**
7. Alfonso verifica en local; si ok, decide el merge/push él.

**Commit propuesto:** `feat(buyout): historial de pptos por concepto en Partida (panel) + retira la pestaña Subcategoría`

---

*Fin del change proposal. FASE 1 = plan. Esperando aprobación de Alfonso para implementar (FASE 2).*
