# STATE — Módulo Buy-Out

> Bitácora de avance del módulo. Última actualización: **2026-06-25**.
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
✅ **Fase 3a COMPLETA** — **Resumen FUNCIONAL**: rollup real (partida→capítulo→TOTAL),
   presupuesto **base por partida** (tabla + seed 24 + editable admin), **DIF**, **$/m² + USD/m²**,
   **Estado agregado** (madurez · contratación, con "parcial") y **última actualización** reales.
✅ **Fase 3b COMPLETA** — **corte mensual + modo Evolución**: acción admin "Cerrar mes" (foto del
   total vigente por partida → `buyout_month_close` + `buyout_month_snapshot`), recerrar/reabrir,
   y **modo Evolución** (Base + meses cerrados + mes en curso en vivo + Dif, rellena 0 donde no
   había). Toggle Vigente/Evolución. **Sin migración nueva** (las tablas son del Slice 1).
✅ **Fase 5 (parcial) — Historial de pptos** (pantalla Subcategoría, §6.3): versiones por concepto
   (todas las `buyout_quote` por fecha desc, **vigente** resaltada, **Δ vs anterior**, PDF, estado de
   2 ejes), acción admin **"Marcar vigente"** (refleja al instante en Resumen y Partida vía
   revalidate), **índice de conceptos** y **"Ver historial"** por fila en Partida. + 2 arreglos
   (Evolución: el mes en curso ya cerrado **colapsa en UNA columna** con "cerrado ✓" /
   "desactualizado"; `pnpm dev` abre el navegador). **Sin migración nueva.**
✅ **Fase 5 (mejoras de visualización · 2026-06-25 · sesión 2)** — dos mejoras pedidas por Alfonso,
   ambas **sin migración**: (1) **Comparativo vigente vs anteriores** en el historial (panel con la
   versión vigente como referencia + Δ Total MXN y Δ% de cada versión previa, verde/rojo) y (2)
   **columnas de meses expandibles** en el Resumen **Vigente** (botón "▸ Meses", colapsado por
   default, que intercala los meses cerrados entre Ppto Base y PPTO Vigente, reusando los snapshots
   de Evolución). Detalle abajo.
✅ **Fase 5 (ajuste · 2026-06-25 · sesión 3)** — el grupo **"▸ Meses"** del Vigente ahora incluye una
   columna por **cada** mes cerrado, **incluido el mes actual si ya está cerrado** (antes lo excluía).
   **Evolución intacta**, **sin migración**. Detalle abajo.
⏸️ **PAUSA para que Alfonso pruebe.** Pendiente Fase 5: **marcar contratado** + botón manual a Pagos.
   Pendiente Resumen: modos **Contratado-vs-No** / **Qué falta**.

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

## Fase 3a — Resumen funcional (hecho 2026-06-24)

El tablero Resumen dejó de mostrar 0: **suma de verdad**. Sin corte mensual/Evolución ni los
modos Contratado-vs-No / Qué falta (eso es 3b).

### Migración (aditiva, aplicada a prod con `supabase db push` — opción B)

- `supabase/migrations/20260624150000_buyout_partida_base_and_cleanup.sql`:
  - **Tabla nueva `buyout_partida_base`** (`project_id`, `partida_catalog_id`, `monto_base
    numeric(14,2)`) con índice único parcial `(project_id, partida_catalog_id) WHERE deleted_at
    IS NULL`, RLS (SELECT auth · escritura `is_admin()`), audit `fn_audit_change()` y grants —
    idéntica al resto de `buyout_*`.
  - **Seed de las 24 bases** del doc oficial (Lote 3, col `PRESUPUESTO IZ MXN BASE`). Empata por
    nombre EXACTO contra las 24 partidas activas. Idempotente. **Verificado: 24 filas** en
    `buyout_partida_base` (table-stats).
  - **Limpieza de la línea de prueba del 2b:** soft-delete de `buyout_item`/`buyout_quote`/
    `buyout_line` **solo** cuando el `partida_catalog_id` del item apunta a una partida
    **soft-deleted** (taxonomía vieja). No toca nada capturado sobre la taxonomía nueva (24
    activas) → cualquier captura de tu revisión 2c queda intacta. Idempotente.
- `supabase migration list` → local y remoto en sync (última: `20260624150000`). Pagos intacto.

### Código (todo bajo `buyout/` + `lib/buyout/`; cero Pagos tocado)

- **`src/lib/buyout/rollup.ts` (nuevo)** — fuente ÚNICA del rollup que comparten las tarjetas de
  Partida y el Resumen (no pueden divergir): `loadVigenteLines()` (carga item→cotización
  vigente→renglón; movido tal cual desde la página Partida) + funciones **puras** `aggregateLines`
  (total Σ MXN, madurez/contratación agregadas con "parcial", última fecha, proveedores) y
  `difPct`. Las puras se **verificaron con node** (3 conceptos, 2 partidas, 2 capítulos: cuadra
  línea→partida→capítulo→TOTAL, $/m², USD/m² y DIF, incl. base=0 → "—").
- **`buyout/page.tsx` (Resumen, reescrito desde el armazón)** — rollup partida→capítulo→TOTAL;
  columnas **Ppto Base** (editable) · **Ppto** (Σ vigente) · **Dif** ((vigente÷base)−1, "—" si
  base=0 o sin datos) · **$/m²** por partida · **Última actualización** (fecha de la cotización
  vigente más reciente) · **Estado** (2 ejes agregados). Subtotal por capítulo, TOTAL, y `$/m² +
  USD/m²` al pie (área interior 992.61, TC USD). **Subtotal** ahora alineado a la IZQUIERDA en la
  columna Concepto con los números bajo sus columnas (corrige lo que reportaste).
- **`buyout/actions.ts` (nuevo)** — `setPartidaBase` (upsert admin-only de la base, Zod, RLS).
- **`buyout/base-cell.tsx` (nuevo)** — celda "Ppto Base" editable en sitio (admin) / solo lectura.
- **`buyout/partida/page.tsx`** — quirúrgico: usa `loadVigenteLines`/`VigenteLine` del módulo
  compartido (antes tenía su copia local); la tabla de 22 col y las tarjetas quedan idénticas.

### Notas / decisiones para Alfonso

- **DIF por partida y capítulo** = `(Σ vigente ÷ base) − 1`. Si la base es 0 (TRAMITES,
  INGENIERIAS, ALBAÑILERIA, PISO HIDRONICO, CASITA) o aún no hay conceptos vigentes → **"—"**
  (no rompe). Color sutil: sobre base = rojo, bajo base = verde.
- **Estado agregado de la partida:** madurez = todas ppto→Ppto / todas paramétrico→Paramétrico /
  mezcla→**Parcial**; contratación = todas sí→Contratado / todas no→No contratado /
  mezcla→**Parcial**. Proveedor = único nombre, "Varios" si hay >1, "—" si ninguno.
- **Base editable:** lápiz en la celda Ppto Base (solo admin); guarda con `setPartidaBase`.
- **Gate verde:** `tsc` ✓ · `biome` ✓ (solo `scripts/backup-storage.mjs` —fuera de alcance,
  sin trackear— marca errores) · `pnpm build` ✓ (las 3 rutas buyout dinámicas; las 6 de Pagos
  idénticas en el manifest). Editar base / rollup con datos reales quedan tras login → tu prueba.

## Fase 3b — corte mensual + modo Evolución (hecho 2026-06-24)

El comparativo mes a mes del Excel (columnas PPTO MARZO/ABRIL/MAYO/JUNIO…). **Sin migración
nueva:** usa `buyout_month_close` + `buyout_month_snapshot` ya creadas en el Slice 1 (con su
RLS `is_admin()`, audit y grants). Faltan aún **Contratado vs No** y **Qué falta** (siguiente).

### Modelo del cierre (decisiones)

- **"Cerrar mes" = foto del MES EN CURSO.** Congela el total MXN vigente por partida (misma
  fuente única que el Resumen → nunca difieren) en `buyout_month_close (periodo yyyy-mm)` +
  `buyout_month_snapshot` (una fila por partida **con conceptos vigentes**; las demás se
  rellenan 0 en la vista). La acción **solo** cierra el mes actual (los totales vivos solo
  representan "hoy"); no se puede cerrar un mes pasado con datos de hoy.
- **Recerrar = sobrescribe la foto** (baja la anterior por soft-delete, escribe la nueva).
  **Reabrir** = baja foto + cierre (soft-delete, recuperable) → su columna desaparece. Ninguna
  de las dos toca el histórico de **otros** meses.
- **Etiqueta legible** "Ppto Junio 2026"; el mes vivo es "Ppto Junio 2026 (en curso)". Si el
  mes en curso ya está cerrado, aparecen ambas columnas (la foto congelada + el vivo): justo
  permite ver si la foto sigue al día o si ya hay drift.
- **Escritura admin-only:** las actions checan `getMyProfile().role==='admin'` y la RLS de las
  tablas (`is_admin()`) lo refuerza. `closed_by` = auth user actual.

### Código (todo bajo `buyout/` + `lib/buyout/`; cero Pagos tocado)

- **`src/lib/buyout/month-close.ts` (nuevo)** — helpers: `currentPeriodo()`, `periodoShort()`,
  `periodoLabel()`, `loadClosedMonths()`, `loadSnapshots()` (Map<close, Map<partida, total>>).
- **`src/lib/buyout/rollup.ts`** — `loadPartidaAggs()`: fuente ÚNICA del agregado vigente por
  partida que comparten el Resumen (columna Ppto / mes en curso) y el cierre (la foto).
- **`buyout/actions.ts`** — `cerrarMesActual(projectId)` (find-or-create cierre del periodo +
  sobrescribe snapshot) y `reabrirMes(projectId, periodo)` (soft-delete cierre + foto).
- **`buyout/page.tsx`** — toggle por `?modo=evolucion` (Server Component); en Vigente, idéntico
  a 3a; en Evolución, rinde la rejilla. `DifText` extraído a módulo compartido.
- **`buyout/evolucion-table.tsx` (nuevo)** — rejilla: Base + cada mes cerrado + en curso + Dif,
  subtotal por capítulo y TOTAL; rellena 0 donde un mes no tiene la partida (sin huecos).
- **`buyout/resumen-mode-toggle.tsx`** (toggle) · **`cerrar-mes-button.tsx`** (admin, diálogo
  de confirmación) · **`reabrir-mes-button.tsx`** (admin, en la cabecera de cada mes cerrado) ·
  **`dif-text.tsx`** (DifText compartido).

### Verificación

- **Gate verde:** `tsc` ✓ · `biome` ✓ · `pnpm build` ✓ (11 rutas; las 6 de Pagos idénticas en
  el manifest, las 3 buyout dinámicas).
- **Cálculo (node, lógica real de las etiquetas + rejilla):** cerrar congela los totales;
  un concepto **nuevo** aparece en **0** en el mes ya cerrado y con su valor en el mes en curso;
  el **Dif cuadra** (ej. A 100/80 = +25%, base 0 → "—", TOTAL 150/80 = +87.5%). Etiquetas:
  "Ppto Junio 2026" / "… (en curso)".
- **Cerrar/reabrir/RLS y la rejilla con datos reales** quedan tras login → tu prueba.

## Fase 5 (parcial) — Historial de pptos + 2 arreglos (hecho 2026-06-25)

Pantalla **Subcategoría = historial de pptos** (SPEC §6.3) + dos arreglos pedidos. **Sin migración
nueva** (usa `buyout_item`/`buyout_quote`/`buyout_line` del Slice 1).

### Historial (Subcategoría)
- **`src/lib/buyout/history.ts` (nuevo)** — `loadItemHistory()` (item validado vs proyecto + TODAS
  sus cotizaciones no borradas por fecha desc, con el renglón de cada una → monto sin IVA y total
  MXN vía `calcLinea`+TC, **misma fórmula que el rollup** → cuadra con Partida/Resumen) y
  `loadConceptoIndex()` (índice de conceptos reusando `loadVigenteLines`, con Nº de versiones).
- **`buyout/subcategoria/page.tsx` (reescrito)** — con `?item=` rinde la tabla de versiones
  (Fecha · Proveedor · Moneda · Monto sin IVA · Total MXN · **Δ vs anterior** · Estado 2 ejes · PDF
  · **VIGENTE**), la vigente resaltada; estado vacío si 0/1 versión. Sin `?item=`, el índice de
  conceptos agrupado por partida. El PDF reusa `BuyoutPdfCell`.
- **`buyout/subcategoria/actions.ts` (nuevo)** — `marcarVigente(projectId, itemId, quoteId)`:
  admin-only (`getMyProfile`), valida item∈proyecto y quote∈item, baja la vigente anterior y sube la
  elegida (1-vigente por item), actualiza `selected_quote_id`, **revalida Resumen + Partida +
  Subcategoría** → cambio instantáneo. RLS `is_admin()` lo refuerza.
- **`buyout/subcategoria/marcar-vigente-button.tsx` (nuevo)** — botón admin con diálogo de confirmación.
- **`buyout/partida/page.tsx`** — quirúrgico: **"Ver historial"** (icono, todos los roles) por fila
  → `subcategoria?item=<item>`.

### Arreglos
- **A — Evolución colapsa el mes en curso ya cerrado:** las columnas congeladas son solo los meses
  cerrados **anteriores** (`frozenMonths`); el mes en curso es **una sola** columna (total vivo) con
  badge **"cerrado ✓"** si ya tiene foto y **"desactualizado"** si el vivo difiere de la foto (drift
  **por partida**); conserva **Reabrir** en su cabecera. Tocados: `buyout/page.tsx`,
  `buyout/evolucion-table.tsx` (prop `enCursoLabel` → objeto `enCurso`).
- **B — `pnpm dev` abre el navegador:** el script `dev` de `package.json` espera el puerto 3000
  (`nc -z`, ≤30s) y hace `open http://localhost:3000` una vez, en segundo plano. `build`/`start` sin
  tocar.

### Gate verde
`tsc` ✓ · `biome` ✓ · `pnpm build` ✓ (las 3 rutas buyout dinámicas; las 6 de Pagos idénticas en el
manifest). Render tras login/RLS → prueba de Alfonso: actualizar un concepto varias veces y ver
todas las versiones con la nueva como vigente; marcar otra como vigente y verla reflejada al
instante en Resumen y Partida.

## Fase 5 (mejoras de visualización) — comparativo de versiones + meses expandibles (hecho 2026-06-25, sesión 2)

Dos mejoras de **visualización** pedidas por Alfonso. **Sin migración nueva** (todo es UI sobre las
tablas y libs ya existentes); **Pagos intacto**; las 6 rutas de Pagos idénticas en el manifest.

### Mejora 1 — Historial: comparativo vigente vs anteriores (pantalla Subcategoría)
- **`buyout/subcategoria/page.tsx`** — nuevo panel **`ComparativoVigente`** (+ `ComparativoRow`)
  **encima** de la tabla de versiones: la versión **vigente** destacada como referencia (banda
  emerald con proveedor · fecha · Total MXN) y, frente a **cada versión anterior**, su
  **Δ = vigente − versión** en MXN y **Δ%** (verde = el vigente quedó más barato · rojo = más caro,
  misma convención que el resto del módulo). Reusa `DeltaCell` (Δ MXN, ya existía) y **`DifText`**
  (Δ%, importado de `../dif-text`) → **no se duplicó** lógica de formato/color.
- Es **solo informativo**: NO toca la tabla de versiones ni **"Marcar vigente"** (intactos). Aparece
  solo cuando hay **≥2 versiones** y existe una vigente (con 1 sola versión devuelve `null`).
- Complementa la columna **"Δ vs anterior"** (paso entre cotizaciones consecutivas) que ya tenía la
  tabla: el panel responde la otra pregunta — **cuánto difiere cada versión histórica de la que hoy
  usamos** (útil sobre todo cuando la vigente NO es la más reciente).

### Mejora 2 — Resumen Vigente: columnas de meses expandibles
- **`buyout/meses-toggle.tsx` (nuevo, client)** — botón **"▸ Meses"** (chevron que rota). El estado
  vive en el searchParam **`?meses=open`** (mismo patrón que el toggle Vigente/Evolución) → la tabla
  siempre se rinde **bien formada en el servidor** (sin columnas ocultas ni `colSpan` a medias) y la
  vista por default (colapsada) queda **idéntica** a antes. Colapsado por default; `scroll={false}`.
- **`buyout/page.tsx`** — en modo Vigente, cuando `?meses=open`, intercala **entre Ppto Base y Ppto**
  una columna por cada **mes cerrado anterior** (foto congelada `buyout_month_snapshot`), con sus
  celdas en filas de partida, subtotal de capítulo y TOTAL; los `colSpan` de las cabeceras de
  capítulo crecen `8 → 8+N`. El botón solo aparece si hay **≥1 mes cerrado anterior** que revelar.
- **Misma fuente que el corte mensual / Evolución** (`lib/buyout/month-close.ts` `loadSnapshots` +
  `lib/buyout/rollup.ts` `loadPartidaAggs`): los números **cuadran** con Evolución por construcción.
  Conceptos nuevos salen en **$0** en meses previos (la celda usa `snapshot ?? 0`).

### Decisión documentada (fusión Evolución sí/no)
- **Evolución se queda como está** (vista dedicada siempre-expandida, foco en Dif vs base). NO se
  fusionó: tocarla arriesgaba una vista ya probada, y el Vigente expandible cubre el "ver la
  evolución sin salir del Vigente" que pidió Alfonso. Ambos **comparten** las libs de cierre/rollup
  (cero lógica duplicada).
- **El "mes en curso" NO es una columna nueva: es la columna `PPTO Vigente`** (total vivo de hoy). El
  grupo expandible añade los meses cerrados → **`PPTO Vigente`** sigue siendo el vivo, sin duplicar.
  Una leyenda bajo la tabla lo aclara. **⚠️ Ajustado en sesión 3 (ver abajo):** originalmente el grupo
  excluía el mes actual; ahora **SÍ** incluye el mes actual **como columna congelada cuando ya está
  cerrado** (p. ej. "Ppto Junio 2026" tras cerrar Junio), junto a `PPTO Vigente` (vivo).

### Gate verde
`pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓ (las 3 rutas buyout
dinámicas; **las 6 de Pagos idénticas** en el manifest). El render tras login/RLS → prueba de Alfonso:
en un concepto con varias versiones, ver el panel "Comparativo vs vigente" con sus Δ; en el Resumen
Vigente, "▸ Meses" expande/colapsa las columnas y cuadran con el modo Evolución.

## Fase 5 (ajuste) — incluir el mes actual cerrado en el grupo "▸ Meses" del Vigente (hecho 2026-06-25, sesión 3)

Alfonso quiere **conservar AMBAS vistas** (Vigente + Evolución). El cierre de mes se hace en
**Evolución (queda igual)**. El único ajuste fue en **Vigente**: el grupo colapsable **"▸ Meses"**
ahora muestra **una columna por CADA mes cerrado, INCLUYENDO el mes actual si ya está cerrado**
(antes lo excluía). **Sin migración**, **Evolución intacta**, **Pagos intacto**.

### Cambio (todo en `buyout/page.tsx`)
- Nueva variable **`vigenteMonths`** = `closedMonths.map(...)` → **todos** los meses cerrados (incl. el
  mes actual si cerró). Es la fuente de las columnas del grupo del Vigente (`mesesCols`).
- **Evolución NO se toca:** `frozenMonths` (meses cerrados *anteriores*) + `enCurso` (columna viva,
  colapsa la foto del mes en curso) siguen exactamente igual; `EvolucionTable` recibe `months={evoMonths}`
  como antes. La rama `modo === "evolucion"` quedó idéntica.
- **Botón "▸ Meses"** ahora aparece/cuenta con `closedMonths.length` (antes `frozenMonths.length`), y
  **`needSnapshots`** se dispara con `closedMonths.length > 0` → así, si **solo** el mes actual está
  cerrado, igual se cargan los snapshots y se ve su columna.
- Colapsado (default) la vista Vigente queda **byte-idéntica** a antes (con `mesesCols=[]` no se rinde
  ninguna celda extra y los `colSpan` siguen en 8). Leyenda actualizada.

### Por qué cuadra (misma fuente, sin duplicar)
- Las columnas usan `buyout_month_snapshot` vía `loadSnapshots` (la **foto** congelada al cerrar) y el
  total vivo viene del **mismo** `loadPartidaAggs` del rollup → idénticos a Evolución. La columna del
  mes actual cerrado muestra su **foto**; `PPTO Vigente` muestra el **vivo de hoy**: si se editó algo
  tras cerrar, difieren (drift visible) — igual que el "desactualizado" de Evolución.
- Conceptos/partidas nuevos que no existían en un mes → **$0** en esa columna (`snapshot ?? 0`).

### Gate verde
`pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓ (las 3 rutas buyout dinámicas;
**las 6 de Pagos idénticas** en el manifest). Render tras login/RLS → prueba de Alfonso: con **Junio
cerrado**, en **Vigente** el **"▸ Meses"** abre y muestra la columna **"Ppto Junio 2026"**; colapsado
todo queda igual que antes; **Evolución intacta**; **Pagos intacto**.

## Qué sigue

- **Resumen (resto):** modos **Contratado vs No** (% por dinero) y **Qué falta** (nota libre por
  partida no contratada).
- Luego: **Fase 5 (resto):** marcar contratado + botón manual a Pagos (el historial/comparativo ya
  está) · Fase 6 carga real de L3 + cuadre.
- **Import de Excel = diferido** (futuro opcional, §5); la captura es manual en V1.
- **Taxonomía ya reconciliada** a las 24 partidas + 92 conceptos del doc oficial (Slice 2c).
  Pendiente: áreas Villa/Casita finas si se necesitan para $/m² por unidad.
