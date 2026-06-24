# STATE — Módulo Buy-Out

> Bitácora de avance del módulo. Última actualización: **2026-06-23**.
> Spec: [`docs/SPEC-buyout.md`](SPEC-buyout.md) · Análisis del Excel: [`docs/future-modules/buyout-L3-estructura.md`](future-modules/buyout-L3-estructura.md).

## Estado actual

✅ **Slice 1 (§9.1) COMPLETO** — esquema `buyout_*` + catálogos sembrados de Lote 3.
✅ **Slice 2a COMPLETO** — armazón navegable de la sección Buy-Out (ruta `/buyout` + 3
   pantallas vacías que LEEN de `buyout_*`, sin importador y sin escribir datos).
✅ **Slice 2b COMPLETO** — **captura MANUAL** de líneas en la pantalla Partida (sin parseo de
   Excel, §5). Escribe a `buyout_item → buyout_quote → buyout_line`, con cálculos tipo Excel,
   PDF opcional por cotización y editar/borrar (soft-delete) admin-only.
✅ **Slice 2c COMPLETO** — taxonomía oficial L3 sembrada (24 partidas + 92 conceptos) ·
   concepto = dropdown · "Actualizar presupuesto" (nueva versión sin duplicar fila) ·
   Villa+Casita y Piso "NA" · pantalla Partida = **tarjetas por capítulo** con totales.
⏸️ **PAUSA para que Alfonso revise** antes de la Fase 3 (rollup al Resumen).

## Aislamiento / git (regla de la fase: rama propia, sin push)

- Rama de trabajo: **`feat/buyout`**. **Nunca se hizo push.** `main` intacto salvo el commit de docs operativos que pediste.
- Commits hechos:
  - `main` → `163c597 docs: runbook rotación keys + prompt auditoría` (solo `docs/runbook-rotacion-keys.md` + `docs/prompt-auditoria-calidad.md`). **Local, sin push.**
  - `feat/buyout` (creada desde `main`):
    - `a39e0b3 docs(buyout): spec + análisis Excel L3`
    - `9c7b959 feat(buyout): esquema + catálogos (slice 1)` ← la migración
    - (este STATE)
- Sin tocar: ninguna tabla, RLS, migración ni componente de **Pagos**.
- Nota: apareció un archivo `docs/future-modules/backlog-ideas.md` sin trackear (creado fuera de esta sesión). **Lo dejé sin tocar.**

## DB aplicada (opción B — base real, invisible sin push)

- Migración **`supabase/migrations/20260618183133_buyout_schema_and_seeds.sql`** aplicada a prod (`supabase db push`), proyecto linkeado `poesjbliusrdoftibkru`.
- `supabase migration list` → 18 migraciones, local y remoto en sync.
- Es **100% aditiva**: solo `CREATE TABLE buyout_*`, sus índices/policies/grants/triggers y seeds. La única referencia hacia Pagos es el FK nullable `buyout_quote.pagos_partida_id → public.partidas` (`ON DELETE SET NULL`), que **no altera** `partidas`.

### Verificación (vía `supabase inspect db table-stats`, conexión directa sin Docker)

| Comprobación | Resultado |
|---|---|
| Tablas `buyout_*` creadas | **14 / 14** ✓ |
| `buyout_uom` | 7 filas (M2, ML, PZA, Lote, Servicio, Mes, Semana) ✓ |
| `buyout_partida_catalog` | 23 filas (partidas canónicas) ✓ |
| `buyout_chapter` (L3) | 8 filas (capítulos del tablero) ✓ |
| `buyout_fx` (L3) | 3 filas (MXN 1 · USD 17.5 · EUR 20.5) ✓ |
| `buyout_project_meta` (L3) | 1 fila (áreas 992.61 / 665.39 / 383.75) ✓ |
| `buyout_unit` (L3) | 2 filas (Villa, Casita) ✓ |
| Tablas transaccionales (item/quote/line/falta/import_batch/month_close/month_snapshot/supplier) | 0 filas (vacías, como debe ser) ✓ |
| **Pagos intacto** | `partidas`=11, `projects`=3, `estimaciones`=28, `contratistas`=10, `firmantes`=3, `profiles`=2, `pagadores`=6 … sin cambios ✓ |
| `audit_log` | creció (los triggers `*_audit` registraron los inserts de seed — comportamiento esperado, no es un cambio de Pagos) |

### Gate local (verde)

`pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ (135 archivos) · `pnpm build` ✓ (11 rutas). El cambio es SQL+docs, sin impacto en el build de TS.

## Tablas creadas (§4 del spec)

Globales: `buyout_uom`*, `buyout_supplier`, `buyout_partida_catalog`.
Por proyecto: `buyout_project_meta`, `buyout_fx`, `buyout_chapter`, `buyout_unit`.
Núcleo: `buyout_item` → `buyout_quote` → `buyout_line`.
Soporte: `buyout_import_batch`, `buyout_falta`, `buyout_month_close`, `buyout_month_snapshot`.

Todas con `id uuid pk`, `created_at`, `deleted_at` (soft-delete), dinero `numeric(14,2)`, FKs, índices en FKs, trigger `*_audit` (reusa `fn_audit_change()` de Pagos) y **RLS por rol**: `SELECT` a `authenticated`; `INSERT/UPDATE/DELETE` solo `is_admin()`. Grants base a `authenticated` (idéntico a Pagos).

\* `buyout_uom` **no está en la lista literal del §4** — la agregué porque el §7 pide sembrar las unidades de medida (M2, ML, …) "editables por admin" y no había tabla donde vivieran. Es aditiva y vetable.

## Para revisión de Alfonso (decisiones que conviene confirmar)

1. **`buyout_uom` (tabla nueva fuera del §4).** Necesaria para sembrar/editar las unidades de medida. ¿OK o prefieres otra forma?
2. **23 partidas, no 26.** El análisis del Excel nombra 23 sin ambigüedad; el glosario dice "~26". Las ~3 restantes se reconcilian con el archivo real en el Slice 6 (el importador empata por nombre y crea las faltantes). El catálogo es editable por admin.
3. **`chapter_default` y `unidad_driver` son texto, no FK.** Los capítulos son por-proyecto (no hay fila global a la que apuntar) y son hints/defaults editables. La app los mapea por nombre/código.
4. **Mapeo capítulo↔partida y `unidad_driver`** son defaults razonables (ver seed §9.2 de la migración); ajustables sin migrar.
5. **Sembré Villa + Casita en `buyout_unit`** (más allá de la lista literal del prompt) porque L3 las tiene y el importador las necesitará. Vetable.
6. **`service_role` está bloqueado** de leer tablas vía API REST en este proyecto (config endurecida; pasa igual con las tablas de Pagos). Por eso mi grant es solo a `authenticated`, **idéntico** a Pagos. No agregué grant a `service_role`.

## Cómo revertir (si no gusta)

Crear una down-migration que haga `DROP TABLE public.buyout_* CASCADE` (las 14) — limpio, no toca Pagos. (No la creé aún; se hace en 1 archivo si decides descartar.)

## Slice 2a — armazón navegable (hecho 2026-06-23)

Solo **UI/lectura**: ni subida de archivos, ni parseo, ni escritura. Las 3 pantallas son
Server Components que leen de las tablas `buyout_*` (vacías en lo transaccional) y muestran
el **estado vacío** correcto.

### Archivos nuevos (todo aditivo, nada de Pagos tocado en su lógica)

- `src/components/buyout/buyout-sub-nav.tsx` — sub-nav propia de las 3 pantallas (Resumen ·
  Partida · Subcategoría) + link **"Volver a Pagos"**. Es un "libro distinto", no una 7ª tab.
- `src/app/proyectos/[id]/buyout/layout.tsx` — layout anidado que monta la sub-nav. El
  proyecto ya lo valida el layout padre de Pagos (sidebar + topbar siguen visibles).
- `src/app/proyectos/[id]/buyout/page.tsx` — **Resumen** (tablero): lee `buyout_chapter`,
  `buyout_partida_catalog`, `buyout_project_meta`, `buyout_fx`. Capítulos → partidas
  agrupadas; columnas **Concepto · Proveedor · Ppto Base · Ppto · Dif · $/m² · Última
  actualización · Estado**; subtotales, TOTAL y `$/m² + USD/m²` al pie, todo en **0**.
- `src/app/proyectos/[id]/buyout/partida/page.tsx` — **Partida** (formato verde): las **22
  columnas** (B…W) como encabezados, tabla vacía, botón **"Importar" deshabilitado**
  (placeholder; el importador llega en 2b). Lee `buyout_item` para el estado vacío.
- `src/app/proyectos/[id]/buyout/subcategoria/page.tsx` — **Subcategoría**: placeholder del
  historial de versiones (lee `buyout_item`; describe lo que vivirá ahí en slices posteriores).

### Toques aditivos al chrome de Pagos (2, ambos sin cambiar comportamiento de las 6 tabs)

- `src/components/sidebar.tsx` — **+** un link **"Buy-Out"** (icono `ShoppingCart`), separado
  por un divisor, dentro de cada proyecto (guardado por `projectId`, como `aprobHref`). Las 6
  tabs y su lógica de `active` quedan idénticas.
- `src/components/project-topbar.tsx` — **+** una entrada `buyout: "Buy-Out"` en `TITLES`
  para que el título del header diga "Buy-Out" en `/buyout/*` (si no, caía al fallback
  "Resumen"). Una sola línea.

### Spec refinada por Alfonso a mitad de sesión (incorporada)

`docs/SPEC-buyout.md` §6 se editó (no por mí): el módulo es **principalmente informativo**,
el Resumen gana la columna **"Última actualización (fecha de la cotización vigente)"**, y el
**Estado** debe mostrar los **2 ejes** (ppto/paramétrico + contratado/no). El armazón ya
refleja la columna **Última actualización** y los **2 slots del Estado** (madurez arriba ·
contratación abajo) como placeholders neutros vacíos + leyenda al pie; con datos (Slice 4)
cada slot toma su badge con color (patrón `estatus-badge.tsx`). El diseño de la celda de 2
ejes se eligió con un mini-panel de propuestas + verificación adversarial (server-safe, DS,
fidelidad al spec). **Dejé el cambio de `SPEC-buyout.md` SIN commitear** por si Alfonso sigue
afinándolo.

### Gate local (verde)

`pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓ (las 3 rutas
`/buyout`, `/buyout/partida`, `/buyout/subcategoria` compilan como dinámicas `ƒ`; las 6 rutas
de Pagos siguen idénticas en el manifest). Smoke test en dev: las 3 rutas responden **307 →
/login** igual que `/resumen` (ruteo + middleware OK, sin 500). **El render visual de las
tablas vacías queda detrás de auth/RLS → es justo lo que Alfonso revisa en su sesión.**

## Slice 2b — captura manual de líneas (hecho 2026-06-24)

Captura MANUAL en la pantalla Partida (NO se parsea Excel; §5 del spec). Escribe a la base.

### Archivos nuevos (todo bajo `buyout/partida/` + `lib/buyout/`; cero Pagos tocado)

- `src/lib/buyout/calc.ts` — fórmulas puras del formato verde (M=J×L, O=M×N, Q=(M+O)×P,
  R=M+O+Q, T=R×TC). Compartidas por la página (display) y la action (monto). **Verificadas**
  con casos MXN y USD (`node --experimental-strip-types`).
- `…/partida/actions.ts` — Server Actions `createLinea` / `updateLinea` / `deleteLinea` +
  `getSignedBuyoutPdfUrl`. Zod cliente+servidor. `createLinea`: resuelve proveedor (global,
  crea al vuelo), capítulo y unidad; **find-or-create `buyout_item`** por (proyecto, partida,
  concepto); baja la cotización vigente anterior (índice único 1-vigente) e inserta
  `buyout_quote` nueva **vigente** (madurez + contratado + fecha + monto_sin_iva + iva) →
  `buyout_line` (22 col). PDF opcional al bucket `proyectos` prefijo **`buyout/`**
  (`{proyecto}/buyout/{quoteId}.pdf`, admin-only por la RLS existente, sin migración).
  `deleteLinea` = soft-delete de línea+cotización; promueve la versión previa o da de baja el
  item. Escritura **admin-only** (RLS `is_admin()`).
- `…/partida/linea-form.tsx` — campos RHF+Zod del formato verde + **preview en vivo** de los
  cálculos (importe / $IVA / importe total / total MXN) según moneda y TC.
- `…/partida/linea-dialog.tsx` — dialog new/edit (mapea sentinelas, arma el FormData).
- `…/partida/nueva-linea-button.tsx` · `edit-linea-button.tsx` · `delete-linea-button.tsx` ·
  `buyout-pdf-cell.tsx` · `partida-select.tsx` (selector por `?partida=` searchParam).
- `…/partida/page.tsx` (reescrito desde el armazón) — selector de partida + (admin) "Agregar
  línea" + tabla de **22 columnas** con las líneas vigentes, cálculos derivados, badges de los
  2 ejes (madurez + contratación) y fila **Total** (Σ total MXN) + editar/borrar.

### Decisiones / simplificaciones de 2b

- **1 línea = 1 concepto (item) = 1 cotización vigente = 1 renglón.** La tabla muestra solo
  las líneas de la **cotización vigente** (`is_selected`); re-capturar el mismo concepto crea
  una **versión nueva fechada** (la anterior queda en la base para historial/Fase 5).
- **Item por (proyecto, partida, concepto).** Mismo concepto re-capturado = versión, no item
  nuevo. (El cruce con la dimensión Villa/Casita se afina si hace falta.)
- **PDF por cotización** (un PDF por quote en V1; "varias líneas comparten PDF" = futuro).
- **Presupuesto base por partida** (col `PRESUPUESTO IZ MXN BASE`) aún NO se captura aquí
  (entra con el Resumen, Fase 3).

### Gate local (verde)

`pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓ (las 3 rutas buyout
compilan; las 6 de Pagos idénticas en el manifest). Smoke test dev: `/buyout/partida` y
`?partida=…` → **307 → /login** (routing + searchParams OK, sin 500). Cálculos verificados con
el módulo real. **Agregar línea / subir PDF / RLS admin** quedan tras login → es lo que Alfonso
prueba en su sesión.

## Slice 2c — taxonomía + UX de captura (hecho 2026-06-24)

Fuente de verdad: `docs/future-modules/buyout-catalogo-L3.md`.

### Migración (aditiva, aplicada a prod con `supabase db push` — opción B)

- `supabase/migrations/20260624130000_buyout_taxonomy_l3.sql`:
  - **Tabla nueva `buyout_concepto_catalog`** (conceptos por partida) con RLS+audit+grants
    igual que el resto.
  - **Reconciliación NO destructiva del catálogo:** las 23 partidas viejas (glosario) se
    **soft-deletean** (no se borran → el FK de la línea de prueba del 2b queda intacto, la
    fila vieja existe pero invisible); se insertan las **24 partidas EXACTAS** del doc; se
    renombra el capítulo L3 `JARDINERÍA → JARDINERIA Y RIEGO`; se siembran los **92 conceptos**.
  - Unidad **`Villa + Casita`** agregada a `buyout_unit` (tipo `villa`; el CHECK no tiene combo).
- **Verificación (table-stats, conexión directa):** `buyout_concepto_catalog`=**92** ·
  `buyout_partida_catalog`=**47** (23 soft-deleted + 24 activas) · `buyout_unit`=**3**. Los 92
  conceptos confirman que los 24 nombres de partida empataron en el JOIN. (El `service_role`
  REST sigue bloqueado para leer por nombre — igual que en Slice 1; el dump pide Docker.)

### Código (todo bajo `buyout/partida/`; cero Pagos tocado)

- `actions.ts`: `createLinea` ("Agregar") ahora **SIEMPRE crea concepto nuevo** (item nuevo);
  helper compartido `insertVigenteQuoteAndLine`; **`addBudgetVersion`** ("Actualizar
  presupuesto") = nueva cotización vigente sobre el MISMO item (baja la anterior, conserva
  historial). + `ConceptoOption`.
- `linea-form.tsx`: **concepto = dropdown** del catálogo (por partida) + "Otro… (escribir)";
  **piso = dropdown** con `NA`/Sótano/PB/N1/N2/Azotea; Villa/Casita toma `Villa + Casita` del
  catálogo de unidades.
- `linea-dialog.tsx`: modo **"version"** (Actualizar, concepto bloqueado) + resolución de "Otro".
- `page.tsx`: pantalla Partida = **tarjetas por capítulo** (nombre · Σ total MXN de sus
  conceptos vigentes · indicador de datos) → clic entra a la partida (tabla de 22 col, igual
  que 2b) con su botón **Agregar** + por fila **↻ Actualizar** · ✎ Editar · 🗑 Borrar.
- Nuevos: `partida-cards.tsx`, `update-budget-button.tsx`. Eliminado: `partida-select.tsx`.

### Decisiones / notas para Alfonso

- **Línea de prueba del 2b:** había 1 item/quote/line de prueba (la base NO estaba vacía pese
  a lo asumido). Quedó **invisible y recuperable** (su partida vieja está soft-deleted); no la
  borré. Dime si la quieres limpiar.
- **"Agregar" vs "Actualizar":** Agregar = concepto NUEVO (fila nueva). Actualizar (↻ en la
  fila) = versión nueva fechada del existente (NO duplica la fila; muestra la vigente).
- **Piso** quedó con lista fija {NA, Sótano, PB, N1, N2, Azotea}. ¿Faltan pisos?
- **Gate verde:** `tsc` ✓ · `biome` ✓ · `pnpm build` ✓. Pagos intacto (manifest idéntico).
  Agregar/actualizar/PDF/RLS quedan tras login → tu prueba.

## Qué sigue

- **Fase 3 — Resumen (rollup):** que los totales/$/m² del Resumen dejen de ser 0 sumando
  (SUMIFS) las líneas vigentes por partida → capítulo → total; columnas por mes, $/m² + USD/m².
  Capturar el **presupuesto base** por partida (referencia del DIF). (El cálculo por-partida ya
  existe en las tarjetas; falta el rollup a capítulo/total en el Resumen.)
- Luego: Fase 4 estados + "qué falta" · Fase 5 historial/comparativo + marcar contratado
  (botón manual a Pagos) · Fase 6 carga real de L3 + cuadre.
- **Import de Excel = diferido** (futuro opcional, §5); la captura es manual en V1.
- **Taxonomía ya reconciliada** a las 24 partidas + 92 conceptos del doc oficial (Slice 2c).
  Pendiente: áreas Villa/Casita finas si se necesitan para $/m² por unidad.
