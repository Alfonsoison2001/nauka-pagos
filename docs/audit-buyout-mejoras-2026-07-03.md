# Auditoría de calidad — Buy-Out `feat/buyout-mejoras` (pre-merge)

> **Fecha:** 2026-07-03 · **Rama:** `feat/buyout-mejoras` (9 commits sobre `main`, ya publicada) ·
> **Alcance:** auditoría READ-ONLY de **solo los cambios nuevos** que aún NO están en `main`/producción,
> antes de mergear. `git diff main..feat/buyout-mejoras` = **26 archivos / ~3,037 líneas** (25 de código + STATE).
> **Base:** `main` (b3220c8) ya contiene todo `feat/buyout`; la auditoría previa
> (`docs/audit-buyout-2026-06-29.md`, 26 hallazgos) cubrió lo que hoy está en `main`. **Aquí solo se auditan
> los 9 commits nuevos.**
> **Naturaleza:** no se modificó ni "arregló" nada; las recomendaciones se anotan, no se implementan.
> **Método:** lectura directa de cada archivo del diff + verificación adversarial de cada afirmación contra el
> archivo real (se cita `archivo:línea`) + revisión de la RLS de Storage, los índices únicos y el rollup. Se
> corrieron finders por área + un verificador escéptico por hallazgo (25 agentes). Las decisiones conscientes
> documentadas en `STATE-buyout.md` **no** se reportan como bug; los hallazgos previos ya en `main`
> (BO-13, BO-17…) se citan como contexto pero **no** se re-reportan.

---

## 1. Resumen ejecutivo

**Salud: BUENA.** Los 9 commits son de alta calidad y **muy bien aislados**. Verificado contra el código real:

- **Cero 🔴 y cero 🟠.** Ningún hallazgo corrompe dinero, rompe el cuadre, evade seguridad, filtra secretos ni
  toca Pagos. El módulo entra a merge en buen estado.
- **Seguridad reforzada respecto a la auditoría previa.** Las **11** acciones de escritura del Glosario y las
  **2** funciones nuevas de Partida (`deleteLinea`, `setLineaContratado`) **sí** llevan guard admin server-side
  (`getMyProfile().role==='admin'`) — cerrando parte del patrón BO-17. La subida directa de PDF se apoya en una
  **RLS de Storage real** (`INSERT proyectos = bucket_id='proyectos' AND is_admin()`, migración
  `20260609201429`), y `safeBuyoutPdfPath` es una defensa-en-profundidad sólida (prefijo `{projectId}/buyout/`
  + `.pdf` + sin `..`).
- **Aislamiento: PASA.** El diff toca **solo** Buy-Out + `env.ts` + `next.config.ts` + STATE. Cero páginas,
  acciones, libs o migraciones de Pagos. `env.ts` es infra compartida pero el cambio es **behavior-preserving**
  para Pagos y **no filtra** ningún secreto server-only al cliente (solo `NEXT_PUBLIC_*` se referencian literal).
- **`env.ts` y `next.config.ts`: correctos.** El fix de inlineo de `NEXT_PUBLIC_*` es correcto y no expone
  secretos; `bodySizeLimit: "10mb"` es aditivo y no afecta la lógica de Pagos.
- **Torre/Depto y rollup: intactos.** L3/L44 (modo "villa") quedan idénticos; el rollup agrupa por partida y
  suma `total_mxn`, así que la dimensión torre/depto (solo display) **no** altera TOTAL ni $/m². El estado
  por-línea (`buyout_line.kind/contratado`) se lee con **fallback correcto** a la cotización → L3 sin cambios.

El riesgo residual es **robustez operativa** (errores tragados en escrituras multi-paso, revalidación de caché,
scoping por proyecto de defensa-en-profundidad), todo de impacto bajo/medio, recuperable, sin efecto en dinero.

**Los 3 riesgos más importantes (ninguno bloqueante):**

1. 🟡 **Caché stale tras capturar una línea nueva.** `createLinea`/`addBudgetVersion` solo revalidan
   `…/buyout/partida`; **no** revalidan el **Resumen** (total del tablero) ni el **Glosario** nuevo
   (contadores "con datos"). Es el **único hallazgo que un usuario normal SÍ verá** en el flujo feliz: tras
   agregar un concepto, el total del Resumen y los contadores del Glosario pueden quedar desactualizados en una
   navegación cliente hasta que otra acción revalide o se recargue.
2. 🟡 **Renombres de catálogo multi-paso con error tragado.** `renameChapter` (re-apunta partidas) y
   `renameConcepto` (propaga a `buyout_item`/`buyout_line`) hacen la 2ª/3ª escritura **sin revisar `.error`** y
   devuelven `ok:true`. Ante un fallo transitorio quedan **partidas huérfanas** ("Sin capítulo") o el **nombre
   desincronizado** entre catálogo y renglones, reportando éxito. Impacto solo de display, recuperable.
3. ⚪ **Falta de scoping por proyecto** en `deleteLinea`/`setLineaContratado` (defensa en profundidad): la RLS
   `buyout_*` gatea por `is_admin()` **global**, no por proyecto, y estas acciones confían en los ids del
   cliente sin verificar que pertenezcan a `projectId`. Sin escalación (todos los admins son globales), pero es
   la misma clase de hueco que BO-18, ahora en funciones nuevas.

**Conteo:** 🔴 0 · 🟠 0 · 🟡 3 · ⚪ 11 (14 hallazgos verificados; 3 candidatos descartados, ver §7).
**Recomendación global:** mergeable. Idealmente arreglar M1 (revalidación) antes del merge por ser el más
visible; M2/M3 y los ⚪ pueden ir como deuda post-merge.

---

## 2. Veredicto de aislamiento — ✅ PASA

Verificado en el diff y en el código runtime:

- **Archivos del diff:** 18 de `buyout/glosario/*` + 6 de `buyout/partida/*` + `components/buyout/buyout-sub-nav.tsx`
  (+1 línea, la pestaña Glosario) + `src/lib/env.ts` + `next.config.ts` + `docs/STATE-buyout.md`. **Ningún**
  archivo de Pagos (páginas, actions, libs), **ninguna** migración.
- **`env.ts`** (infra compartida): el cambio pasa de `process.env[name]` (dinámico) a la **referencia literal**
  `process.env.NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` para que Next lo inlinee en el bundle cliente. Server-side
  da los mismos valores y el mismo throw si falta → **Pagos lee su env igual que antes**. El módulo **solo**
  contiene los 2 `NEXT_PUBLIC_*`; los secretos server-only (service role, Resend) viven en otro módulo → **no**
  se inlinean. Sin fuga.
- **`next.config.ts`**: `experimental.serverActions.bodySizeLimit = "10mb"` es aditivo (destapa el límite del
  framework para uploads de Pagos y Buy-Out); no cambia lógica de Pagos.

---

## 3. Hallazgos por severidad

> Formato: **ID · severidad** · `archivo:línea` — qué · por qué · recomendación (no implementada).

### 🟡 Medios

**M1 · 🟡 · `partida/actions.ts:368` (`createLinea`) y `:421` (`addBudgetVersion`).**
**Qué:** al capturar, ambas acciones solo llaman `revalidatePath(\`…/buyout/partida\`)`. **No** revalidan el
Resumen (`…/buyout`) ni el Glosario (`…/buyout/glosario`), a diferencia de `updateLinea`/`deleteLinea`/
`setLineaContratado`, que usan `revalidateEstado` (Resumen · Partida · Subcategoría).
**Por qué:** `createLinea` inserta un `buyout_item` + cotización vigente + línea nuevos → cambia el **total del
rollup** del Resumen y los **contadores "con datos"** del Glosario (`itemCount`, derivado de `buyout_item`,
`glosario/page.tsx:190-205`). Como solo se revalida `/partida`, el total del Resumen y los contadores nuevos del
Glosario se sirven **stale** desde la Router Cache en navegación cliente hasta que otra acción revalide o el
usuario recargue (en recarga dura la página SSR con cookies tiende a renderizar dinámico). Es el hallazgo **más
alcanzable**: pasa en cada alta de concepto, en el flujo feliz, y toca las dos pantallas estrella (total del
tablero + el Glosario recién estrenado).
**Recomendación:** que `createLinea`/`addBudgetVersion` revaliden el mismo conjunto que las mutaciones de
catálogo (Resumen + Partida + Glosario), reusando un helper compartido de revalidación.

**M2 · 🟡 · `glosario/actions.ts:184-189` (+ return incondicional `:192`) — `renameChapter`.**
**Qué:** tras renombrar el capítulo (UPDATE con check de `.error`, `:168-181`), el re-apunte de partidas
(`buyout_partida_catalog.chapter_default` viejo→nuevo, `:184-189`) se ejecuta **sin capturar `.error`**, y la
acción devuelve `{ ok: true }` incondicionalmente (`:192`).
**Por qué:** ese re-apunte es justo el mecanismo que evita huérfanas (el vínculo capítulo↔partida es por TEXTO,
no FK). El capítulo se renombra **primero** (statement separado, sin transacción); si el re-apunte falla (timeout
en catálogo grande, error transitorio de red/RLS), **todas** las partidas quedan con el `chapter_default` viejo y
caen en "Sin capítulo" (`glosario/page.tsx:258-261`) mientras la UI reporta éxito, sin reintento. No hay pérdida
de dinero (el rollup agrupa por `partida_catalog_id`, no por nombre de capítulo) y es recuperable renombrando de
nuevo o moviendo las partidas.
**Recomendación:** capturar el `.error` del re-apunte y propagarlo (o avisar) en vez del `ok:true` incondicional;
idealmente atomizar rename+re-apunte en un RPC/transacción.

**M3 · 🟡 · `glosario/actions.ts:549-557` (+ return `:561`) — `renameConcepto`.**
**Qué:** tras renombrar el concepto en el catálogo (UPDATE con check, `:519-531`), las propagaciones a
`buyout_item.concepto` (`:549`) y `buyout_line.concepto` (`:551-556`) **ignoran su `.error`**, y se devuelve
`{ ok: true }` incondicional.
**Por qué:** si el catálogo + `buyout_item` se actualizan pero `buyout_line` falla (transitorio), la pantalla
Partida (22 col, que lee `buyout_line.concepto`) muestra el nombre **viejo** mientras el catálogo/dropdown y el
conteo "con datos" (por `buyout_item`) muestran el **nuevo** → desincronización invisible, sin reintento,
contradiciendo la coherencia que promete el propio docstring. No cambia montos (rollup por
`partida_catalog_id`). Reachability baja (requiere un fallo transitorio entre dos UPDATEs), por eso 🟡 y no
mayor. Ligado a **L5** (el early-return bloquea el "reingresa el mismo nombre para resincronizar").
**Recomendación:** capturar/propagar el `.error` de ambas propagaciones (o loguear + avisar) en vez de
`ok:true`; idealmente mover catálogo + ambas propagaciones a un solo RPC/transacción.

### ⚪ Bajos

**L1 · ⚪ · `partida/actions.ts:505-574` — `deleteLinea`.**
**Qué:** no verifica que `lineId`/`quoteId`/`itemId` pertenezcan a `projectId` (que solo se usa para
`revalidateEstado`). Toda escritura se hace por los ids que manda el cliente (`.eq("id", lineId)`,
`.eq("quote_id", quoteId)`, `.eq("item_id", itemId)`).
**Por qué:** la RLS `buyout_*` gatea por `is_admin()` **global**, no por proyecto. Un admin (o una llamada
construida a mano) con ids de un proyecto + `projectId` de otro borraría filas del primero y revalidaría el
segundo. Sin escalación (los 2 usuarios son admin en todo) y es soft-delete recuperable → defensa en profundidad.
Misma clase que BO-18, ahora en la función nueva (que **sí** ganó el guard admin y el chequeo de hermanas, pero
no el scoping). No confunde con hermanas ni versiones históricas: el chequeo de "última línea viva" filtra por
la **misma** `quote_id` (`:527-532`) — correcto.
**Recomendación:** resolver `buyout_item.project_id` por `itemId` y confirmar `=== projectId` antes de mutar,
como hace `addBudgetVersion` (`:391-398`). (`buyout_line` no tiene `project_id`; el scope va vía
`line→quote→item`.)

**L2 · ⚪ · `partida/actions.ts:597-601` — `setLineaContratado`.**
**Qué:** el toggle actualiza `buyout_line.contratado` filtrando **solo** por `.eq("id", lineId)`, sin verificar
que la línea pertenezca a `projectId` (usado solo para `revalidateEstado`).
**Por qué:** idéntico a L1 (clase BO-18 en función nueva; sí tiene guard admin `:593`). Impacto: cambiar el
estado de la línea equivocada + revalidar el proyecto equivocado ante ids cruzados. Defensa en profundidad.
**Recomendación:** atar la línea al proyecto vía `line→quote→item.project_id` antes del UPDATE.

**L3 · ⚪ · `partida/actions.ts:588-606` (`setLineaContratado`) vs `subcategoria/contrato-actions.ts:63,123`.**
**Qué:** `setLineaContratado` escribe **solo** `buyout_line.contratado` y deja `buyout_quote.contratado`
**stale** (por diseño, para que una cotización de varias líneas quede "parcial"). Pero el rollup lee el estado
**por línea** (`rollup.ts:288` = `l.contratado ?? Boolean(q.contratado)`) mientras el **puente a Pagos** lee el
estado **de la cotización** (`contrato-actions.ts:123`).
**Por qué:** tras usar la píldora rápida, el Resumen puede mostrar una partida como "% contratado" alto
(línea) mientras el panel de puente / Pagos la sigue viendo **no contratada** (cotización). Es coherente en el
eje del rollup, pero las dos señales de contratación divergen. Probablemente **intencional** (el comentario de
la función lo sugiere), pero la divergencia **no está documentada** y puede confundir. Responde a FOCO #3: el
rollup/parcial/% es internamente consistente; la inconsistencia es **rollup (línea) ↔ puente (cotización)**.
**Recomendación:** documentar la decisión, o (si se quiere unificar) reflejar el toggle también en
`buyout_quote.contratado` cuando corresponda.

**L4 · ⚪ · `glosario/actions.ts:115-132` — `createChapter`.**
**Qué:** respeta un `orden` explícito del cliente e inserta verbatim, sin normalizar contra los capítulos
existentes → posibles empates de `orden` (no hay índice único en `orden`, confirmado).
**Por qué:** dos capítulos pueden compartir `orden` hasta que un `moveChapter` re-normalice; el orden de
despliegue es `(orden, created_at)` → desempate determinista. Solo display, se auto-corrige.
**Recomendación:** ignorar el `orden` del cliente y agregar en `max+1` (como `createPartida`), o normalizar
tras insertar.

**L5 · ⚪ · `glosario/actions.ts:516-517` — `renameConcepto` early-return.**
**Qué:** si el nombre nuevo == el actual del catálogo, retorna `{ ok: true }` **antes** de propagar.
**Por qué:** reingresar el mismo nombre es el gesto natural para "forzar resync" si `buyout_item`/`buyout_line`
quedaron desincronizados (p. ej. tras M3, o filas legacy/importadas con texto distinto). El early-return impide
esa reparación por UI.
**Recomendación:** quitar el early-return (la propagación es idempotente) o solo cortar si un chequeo confirma
que no hay renglones con nombre divergente. Baja prioridad; importa como ruta de reparación de M3.

**L6 · ⚪ · `partida/page.tsx:297-332` (deriva deptos) + `linea-form.tsx:266-267`.**
**Qué:** en modo torre, el dropdown de Depto se deriva plano de los 8 deptos y es **independiente** de la Torre
seleccionada; sin restricción cruzada (ni Zod refine cliente/servidor). Se puede guardar un par inconsistente
(p. ej. Torre 1 + "301 PB", que es depto de T2).
**Por qué:** `villa_casita` y `depto` son dimensiones de **display** (no alimentan el rollup) → dinero y cuadre
intactos; el impacto es solo coherencia visual en la tabla de 22 columnas. Nota: "Dos Torres" legítimamente
abarca ambas, así que un acople rígido no siempre aplica.
**Recomendación:** derivar la torre del prefijo T1/T2 del depto al guardar, o filtrar el dropdown de Depto por
la Torre elegida — confirmando antes la UX deseada.

**L7 · ⚪ · `glosario/actions.ts:223-230` (`moveChapter`) y `:595-601` (`moveConcepto`).**
**Qué:** re-numeran `orden` en un loop de UPDATEs por fila; ante error en el k-ésimo devuelven `{ error }` a
media, dejando 0..k-1 renumerados y k..n-1 con su `orden` viejo.
**Por qué:** un fallo a media deja el orden parcialmente normalizado (empates/huecos), justo lo que la
normalización busca evitar. Solo display, se auto-corrige en el siguiente reorden exitoso. Código nuevo.
**Recomendación:** hacer el renumerado en un solo UPDATE batch/RPC (todo-o-nada), o documentar el
comportamiento de fallo parcial.

**L8 · ⚪ · `glosario/actions.ts:247-264` — `deleteChapter` (TOCTOU).**
**Qué:** lee el conteo de partidas activas (`:247-252`) y, en query separada, hace el soft-delete (`:260-264`).
**Por qué:** entre ambas, un `createPartida`/`updatePartida` concurrente podría colgar una partida del capítulo
y quedar soft-deleteado con partidas activas apuntando a su nombre (→ "Sin capítulo"). Muy improbable en app de
un solo admin; nota de defensa en profundidad.
**Recomendación:** aceptar dado el uso mono-admin, o guardar con delete condicional / constraint si la
concurrencia llegara a importar.

**L9 · ⚪ · `glosario/page.tsx:173-268` (queries `:174-217`) — `loadGlosario`.**
**Qué:** las 3 queries paralelas (chapters/partidas/items) y la de conceptos **no** inspeccionan `.error`, y el
mapeo usa muchos casts `as string`/`as string | null` sobre filas Supabase sin tipar.
**Por qué:** ante un error transitorio, `.data` es `null`, el `?? []` lo traga y el Glosario **se renderiza
vacío** sin señal de fallo (un admin creería el catálogo vacío). Los casts hacen que un cambio de columna falle
en runtime, no en compilación (misma clase que BO-22, en archivo nuevo + errores ignorados).
**Recomendación:** revisar `.error` de las queries del loader (distinguir "sin filas" de "falló"); tipar los
selects (tipos generados de supabase-js o `Row` explícito) en vez de `as`.

**L10 · ⚪ · `partida/page.tsx:400-480` — `LineasTable` (81 líneas).**
**Qué:** la función quedó en 81 líneas, apenas sobre el límite de 80 de CLAUDE.md (el bloque de comentario del
scroll `overflow-x-auto` la empujó). Nit de estilo; sin efecto runtime. Los totales del pie usan `lineas.reduce`
(orden-independiente) y las tarjetas usan `allLineas`/`totalsByPartida` sin ordenar → la suma no cambia por el
sort por torre.
**Recomendación:** extraer el `tfoot` o el mapa de headers a un helper. Baja prioridad (funciones vecinas ya
excedían el límite antes de esta rama).

**L11 · ⚪ · `glosario/actions.ts:55-78` vs `partida/actions.ts:218-234` — duplicación de helpers.**
**Qué:** `requireAdmin` y los helpers de revalidación están duplicados entre los dos archivos de acciones, con
cobertura de rutas **distinta** (glosario: Resumen·Partida·Glosario; partida: Resumen·Partida·Subcategoría).
**Por qué:** dos guards admin casi idénticos + dos helpers de revalidación con subconjuntos incompletos es el
tipo de boilerplate que facilita el drift de cobertura (es parte de por qué existe M1). Nota de mantenibilidad;
la diferencia de cobertura por-concern es en sí intencional.
**Recomendación:** extraer un `requireAdmin` y un `revalidateBuyout(projectId)` compartidos (que cubran las 4
rutas) a un módulo común — **sopesando** la regla de "ediciones quirúrgicas, sin pasadas de cleanup" de CLAUDE.md.

---

## 4. FOCO ESPECIAL — veredicto por área

| # | Área de foco | Veredicto | Notas |
|---|---|---|---|
| 1 | **Subida de PDF directa a Storage** | ✅ **Sólido** | RLS admin real (`INSERT proyectos = is_admin()`, mig. `20260609201429`) → un no-admin **no** sube. `safeBuyoutPdfPath` (prefijo `{projectId}/buyout/` + `.pdf` + sin `..`) es defensa-en-profundidad sólida y **se aplica en las 3** acciones que persisten (`createLinea`/`addBudgetVersion`/`updateLinea`). Validación cliente tipo+≤50MB. Objetos huérfanos al reemplazar/fallar = **tradeoff documentado** (STATE 311-314). |
| 2 | **Borrado individual por línea** (`deleteLinea`) | ✅ **Correcto** (1 caveat) | Borra **solo** la línea (`.eq("id", lineId)`); no toca hermanas. Chequeo "última línea viva" por **la misma** `quote_id` = correcto (no cuenta versiones históricas). Limpia cotización vacía y **promueve** la versión previa o baja el item → no deja concepto sin vigente. Guard admin ✅. Caveats: **L1** (sin scoping de proyecto) y el error-swallow del bloque de limpieza `:541-570` = **pre-existente BO-13**, no re-reportado. |
| 3 | **Estado por línea** (`contratado`/`kind`) | ✅ **Consistente** (1 nota) | Rollup lee línea con **fallback** a cotización (`rollup.ts:288`) → L3 sin cambios, BF "parcial" correcto; % por dinero cuadra (complemento derivado). Guard admin ✅ (`setLineaContratado`). Nota **L3**: el toggle deja `quote.contratado` stale → Resumen (línea) puede divergir del puente a Pagos (cotización). |
| 4 | **Glosario CRUD** | ✅ **Sólido** | **11/11** acciones con guard admin server-side + RLS `is_admin()`. **Scoping por proyecto** en todas (capítulos por `project_id`; partidas/conceptos verificados vía `loadChapter`/`loadConceptoScoped`/`partidaEnProyecto` — **no** se puede tocar catálogo de otro proyecto). Soft-delete correcto (nunca hard-delete). Índices únicos parciales `WHERE deleted_at IS NULL` → `dupMessage` (23505) funciona. Zod cliente+servidor. Caveats: **M2/M3** (errores tragados), **L4/L5/L7/L8/L9** (robustez). |
| 5 | **`env.ts` + `next.config.ts`** | ✅ **Correcto** | Inlineo literal de `NEXT_PUBLIC_*` correcto; server-side igual; **sin fuga** de secretos (solo 2 vars públicas en el módulo). `bodySizeLimit` aditivo. **Pagos intacto.** |
| 6 | **Torre/Depto/Dos Torres** | ✅ **Correcto** | Modo detectado por `buyout_unit.tipo='depto'`; BF = Torre 1/2 + depto dropdown, L3/L44 **idénticos** (villa/casita + depto libre). Torre→`villa_casita` texto; edición conserva valor legacy ("Compartido"). **Rollup/cuadre intactos** (dimensión solo display; suma por partida). Caveat: **L6** (par torre/depto sin restricción cruzada, solo display). |

---

## 5. Lo que está sólido (verificado)

- **Aislamiento de Pagos** a nivel diff y runtime (§2); `env.ts`/`next.config.ts` behavior-preserving.
- **Guards admin server-side** en **todas** las acciones nuevas (11 Glosario + `deleteLinea` + `setLineaContratado`).
- **RLS de Storage real** para la subida directa (`INSERT proyectos = is_admin()`), path-agnóstica, con
  `safeBuyoutPdfPath` como defensa-en-profundidad server-side aplicada en las 3 acciones que persisten `pdf_url`.
- **Scoping por proyecto completo** en el Glosario (capítulos, partidas y conceptos), verificado contra ids
  cruzados (`loadChapter`, `partidaEnProyecto`, `loadConceptoScoped`).
- **Índices únicos parciales** correctos `(project_id, nombre)` / `(partida_catalog_id, nombre)`
  `WHERE deleted_at IS NULL` → soft-delete + recrear con el mismo nombre permitido; `dupMessage` legible.
- **Rollup intacto**: estado por-línea con fallback a cotización; TOTAL/$/m²/cuadre no dependen de torre/depto ni
  del orden de las líneas (suma por partida).
- **Captura atómica** (patrón BO-10 preservado): la línea se inserta tras la cotización con `pdf_url` en el mismo
  INSERT; un fallo de PDF avisa (ámbar) y **no** aborta ni deja el concepto sin renglón.
- **Sin `console.log`** de depuración en producción (solo un `console.error` legítimo en `contratado-toggle.tsx`).

---

## 6. Tabla final priorizada

| # | Sev | Hallazgo | Archivo:línea | Acción recomendada |
|---|-----|----------|---------------|--------------------|
| M1 | 🟡 | `createLinea`/`addBudgetVersion` no revalidan Resumen ni Glosario → totales/contadores stale | `partida/actions.ts:368,421` | Revalidar Resumen+Partida+Glosario (helper compartido) |
| M2 | 🟡 | `renameChapter`: `.error` del re-apunte de partidas tragado → huérfanas en fallo transitorio | `glosario/actions.ts:184-189,192` | Capturar/propagar el error; atomizar rename+re-apunte |
| M3 | 🟡 | `renameConcepto`: `.error` de propagación item/line tragado → nombre desincronizado | `glosario/actions.ts:549-557,561` | Capturar/propagar; atomizar en RPC |
| L1 | ⚪ | `deleteLinea` sin scoping de proyecto (clase BO-18, función nueva) | `partida/actions.ts:505-574` | Validar `item.project_id === projectId` (vía line→quote→item) |
| L2 | ⚪ | `setLineaContratado` sin scoping de proyecto (clase BO-18, función nueva) | `partida/actions.ts:597-601` | Atar la línea al proyecto antes del UPDATE |
| L3 | ⚪ | Toggle deja `quote.contratado` stale → Resumen (línea) ↔ puente a Pagos (cotización) divergen | `partida/actions.ts:588-606` · `contrato-actions.ts:123` | Documentar la decisión (o reflejar en la cotización) |
| L4 | ⚪ | `createChapter` respeta `orden` del cliente → posibles empates (se auto-corrige) | `glosario/actions.ts:115-132` | Ignorar orden del cliente / normalizar |
| L5 | ⚪ | `renameConcepto` early-return bloquea el "reingresa el mismo nombre para resync" | `glosario/actions.ts:516-517` | Quitar early-return o resync condicional |
| L6 | ⚪ | Par Torre/Depto sin restricción cruzada (Torre 1 + depto de T2) — solo display | `partida/page.tsx:297-332` · `linea-form.tsx:266` | Derivar torre del depto / filtrar dropdown |
| L7 | ⚪ | `moveChapter`/`moveConcepto` renumeran en loop no atómico (se auto-corrige) | `glosario/actions.ts:223-230,595-601` | Renumerar en un batch/RPC |
| L8 | ⚪ | `deleteChapter` TOCTOU entre conteo y soft-delete (mono-admin → improbable) | `glosario/actions.ts:247-264` | Delete condicional / aceptar |
| L9 | ⚪ | `loadGlosario`: casts `as` sin tipar + `.error` de queries ignorado → Glosario vacío en error | `glosario/page.tsx:173-268` | Revisar `.error`; tipar filas |
| L10 | ⚪ | `LineasTable` 81 líneas (>80 de CLAUDE.md) | `partida/page.tsx:400-480` | Extraer helper |
| L11 | ⚪ | `requireAdmin`/revalidate duplicados entre archivos de acciones | `glosario/actions.ts:55-78` · `partida/actions.ts:218-234` | Extraer a módulo común (sopesar regla anti-cleanup) |

---

## 7. Candidatos descartados (transparencia)

Verificados contra el archivo real y **descartados** (no se reportan como bug):

- **`safeBuyoutPdfPath` "tira" un PDF válido en silencio** (`partida/actions.ts:202-211`) — no reachable en el
  flujo normal: el cliente construye `\`${projectId}/buyout/${uuid}.pdf\`` con el **mismo** `projectId` que pasa
  a la acción; un uuid hex + `.pdf` **siempre** pasa `startsWith`/`endsWith`/sin `..`. Solo fallaría por
  tampering (que es exactamente lo que debe rechazar) o un bug futuro del cliente. Es **defensa en profundidad
  funcionando como diseñado** (STATE 304-307). **Descartado.**
- **`deleteLinea`: los 4 writes de limpieza de última línea ignoran `.error` sin transacción**
  (`partida/actions.ts:541-570`) — real, pero es la **misma función y el mismo bloque** ya reportado como
  **BO-13** en la auditoría previa (`docs/audit-buyout-2026-06-29.md`). El código nuevo del commit (el chequeo
  de hermanas `:527-537`) **sí** captura su error; el bloque de limpieza es pre-existente. Regla: no re-reportar
  hallazgos previos salvo que código **nuevo** reintroduzca el patrón en función **nueva**. **Descartado**
  (contexto, no re-report).
- **`createLinea`/`addBudgetVersion`/`updateLinea` sin guard admin server-side** — es **BO-17** pre-existente
  (dependen de la RLS `is_admin()`, que **sí** bloquea a un no-admin con error crudo). Las funciones se tocaron
  en esta rama pero el hueco es previo; las funciones **nuevas** (`deleteLinea`/`setLineaContratado`) y **todo**
  el Glosario **sí** llevan el guard. Se menciona como contexto en §4/§5, **no** se re-reporta.

---

*Auditoría READ-ONLY. No se modificó código. Único entregable: este reporte.*
