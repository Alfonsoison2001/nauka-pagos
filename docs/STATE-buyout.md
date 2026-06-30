# STATE — Módulo Buy-Out

> Bitácora de avance del módulo. Última actualización: **2026-06-29**.
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
✅ **Modo Contratación (desglose por estado · 2026-06-25 · sesión 4)** — tercer modo del Resumen
   (toggle **Vigente · Evolución · Contratación**, mismo patrón `?modo=`). Desglosa el total vigente
   por partida en los **2 ejes independientes** (madurez · contratación). **Sin migración**,
   **Vigente/Evolución idénticos**, **Pagos intacto**. Detalle abajo.
✅ **Contratación · % por cubeta (2026-06-25 · sesión 5)** — cada cubeta (Paramétrico · Ppto · No
   Contratado · Contratado) muestra ahora su **monto Y su % del total de la partida** (ej.
   "$240,700 (67%)", % atenuado). Cada par suma **100%** (complemento derivado → sin descuadre por
   redondeo); base 0 → "—". También en subtotales de capítulo y TOTAL general. **Solo presentación**
   (cero queries; reusa las cubetas del rollup). Detalle abajo.
✅ **Meses congelados sin "desactualizado" (2026-06-25 · sesión 6)** — quitada la lógica de **drift**
   y los badges **"cerrado ✓" / "desactualizado"** en ambas vistas. Un mes cerrado es **solo una
   columna congelada** (su snapshot); no se compara con lo vivo ni avisa. **Mismas columnas de mes**
   en Evolución y en "▸ Meses" del Vigente (`monthCols` único). Botón "Actualizar foto" → **"Actualizar
   mes"** (re-toma el total de hoy); **Reabrir (↩)** se conserva. **Sin migración**; `cerrarMesActual`/
   `reabrirMes` sin tocar; **Pagos intacto**. Detalle abajo.
✅ **Meses editables inline + etiqueta dinámica (2026-06-25 · sesión 7)** — en **Evolución**, cada celda
   de un mes cerrado (por partida) es **editable a mano con lápiz** (admin), igual que el Ppto Base
   (`MonthCell` → Server Action **`setMonthSnapshot`**). Sirve para **cualquier** mes cerrado, incluido
   uno **pasado** (corregir Junio estando en Julio). Sobrescribe **solo** ese `buyout_month_snapshot`;
   **no toca el rollup vivo** ni otros meses. En "▸ Meses" del Vigente las celdas siguen **solo-lectura**
   (mismos valores). Botón de cierre con **etiqueta dinámica**: "Cerrar `<Mes> <Año>`" / "Actualizar
   `<Mes> <Año>`". **Sin migración**; **Pagos intacto**. Detalle abajo.
✅ **Ppto Base editable solo en Evolución (2026-06-25 · sesión 8)** — se **movió** la edición inline del
   Ppto Base (lápiz / `setPartidaBase`) de **Vigente → Evolución**; en **Vigente** queda **solo-lectura**
   (`{formatMXN}`, sin lápiz). Mismo criterio que las celdas de mes → **toda la edición vive en
   Evolución**, Vigente es de consulta. Misma fuente (`buyout_partida_base`) en ambas vistas; **DIF y
   rollup sin tocar**. **Sin migración**; **Pagos intacto**. Detalle abajo.
✅ **Puente a Pagos — crear/ligar contrato desde contratado (2026-06-25 · sesión 9)** — el **cruce**
   de SPEC-buyout.md §8 (V1 manual). En el **historial** de un concepto (Subcategoría), si su cotización
   **vigente** está **contratada**, un panel **"Contrato en Pagos"** deja al admin **crear/ligar** el
   contrato en la sección **Presupuesto de Pagos** (crea contratista por proveedor si no existe + partida
   = el concepto, monto/IVA/PDF heredados) y guarda el enlace en `buyout_quote.pagos_partida_id`. Ya ligado:
   indicador **"Ligado a Pagos"** + enlace a Presupuesto + **Re-sincronizar** (actualiza el monto). **Sin
   migración** (reusa el FK del Slice 1); **Pagos intacto** (solo INSERT/UPDATE de datos reusando su
   estructura, sin tocar esquema/RLS/componentes/lógica). Detalle abajo.
✅ **Puente a Pagos — fecha del ppto al contrato (2026-06-25 · sesión 10)** — al crear/re-sincronizar el
   contrato, ahora también pasa la **fecha de la cotización vigente** (`quote_date`) al campo de fecha de
   la partida de Pagos (`partidas.fecha_firma`, la col "Fecha presupuesto" que ya rinde Presupuesto). En el
   panel **"Ligado a Pagos"** se muestra esa fecha. **Sin migración** (`fecha_firma` ya existe); **Pagos
   intacto** (cero archivos de Pagos tocados). Detalle abajo.
✅ **Rediseño visual de las 3 tablas del Resumen (2026-06-25 · sesión 11)** — pasada **solo de estilo/formato**
   sobre Vigente · Evolución · Contratación: contenedor limpio (ya tenía esquinas redondeadas/borde sutil),
   **header gris muy claro** con texto chico + **un icono por columna** (antes header oscuro), filas con más
   aire (~48px), **montos SIN decimales** (formato es-MX; BD sigue `numeric(14,2)`), **DIF como pill con
   flecha** (sobre-ppto=rojo↑ · bajo=verde↓ · sin dato=gris), **Estado en puntos de color + texto** (2 ejes
   apilados, antes pills). Contratación conserva su header agrupado "Madurez ‖ Contratación" + barra de %
   Contratado. **Cero cambios de datos/cálculos/lógica** (rollup, edición inline, cierre de mes, modos, %,
   marcar vigente, puente a Pagos intactos); **Pagos intacto**; **sin migración**. Detalle abajo.
✅ **% por eje en la celda Estado del Vigente (2026-06-25 · sesión 12)** — en el modo **Vigente**, la columna
   **Estado** pasó de puntos (solo estado dominante / "Parcial") a **2 mini-barras de %** por partida:
   **Madurez** (barra verde = % en Ppto; etiqueta "Ppto X% · Param. Y%") y **Contratación** (barra verde =
   % Contratado; "Contratado X% · No Y%"). El % reusa las **cubetas del rollup** (`p.agg.ppto/contratado/
   total`) con la **misma fórmula** que el modo Contratación (`estadoPcts`) → los números **cuadran**. 100%
   en un estado → solo ese; `total ≤ 0` → "—". **Solo presentación** (cero queries/cálculos nuevos);
   **Evolución/Contratación/Pagos intactos**; **sin migración**. **1 archivo** (`buyout/page.tsx`). Detalle abajo.
✅ **Pulido visual del Resumen — pie en tarjetas + layout de meses + tabla full-width (2026-06-25 · sesión 13)** —
   4 ajustes **solo de presentación** sobre el Resumen, **1 archivo** (`buyout/page.tsx`): (#2) el **pie** pasó de
   una línea de texto a **4 tarjetas de métrica** ("$/m² interior", "USD/m²", "Área interior", "Tipo de cambio";
   label chico + número grande, fondo `nauka-subtle`, grid responsivo) y se **quitó por completo la leyenda del
   Estado**; (#3) el botón **Cerrar/Actualizar mes** ya **no aparece en Vigente** — vive **solo en Evolución**
   (admin); (#4) el toggle **"▸ Meses (n)"** subió a la **barra superior** (misma fila que las pestañas, a la
   derecha), eliminando el hueco vertical; (#5) la **tabla del Vigente** quedó **full-width**, más legible
   (`text-[15px]`) y con filas cómodas (`h-14`). Montos sin decimales; área y TC con decimales. **Cero cambios de
   datos/cálculos**; **Evolución/Contratación/Pagos intactos**; **sin migración**. Detalle abajo.
✅ **Sidebar reorganizado en 3 secciones — Pagos / Buy-Out / General (2026-06-25 · sesión 14)** — el sidebar
   (componente **compartido** con Pagos) se reagrupó: **Home** suelto arriba → **PAGOS** (Resumen · Presupuesto ·
   Flujo de Pagos · Carátula · Aprobaciones) → **BUY-OUT** (Buy-Out, solo dentro de un proyecto) → **GENERAL**
   (Configuración · Usuarios · ¿Cómo funciona?) → **Cerrar sesión** abajo. Encabezados de sección sutiles
   (`text-[11px]` mayúsculas `text-white/40`) con el divisor existente. **Resumen Mensual oculto del menú** con
   flag `hidden: true` (su ruta `/proyectos/[id]/resumen-mensual` **sigue viva y accesible por URL**;
   reactivar = quitar el flag). **Solo reordena/agrupa/oculta links** — cero cambios de rutas/páginas/lógica/datos
   de Pagos ni Buy-Out; saludo + campana + Cerrar sesión sin tocar. **1 archivo** (`components/sidebar.tsx`).
   Detalle abajo.
✅ **Robustez PRE-MERGE del puente a Pagos (2026-06-29 · auditoría) — BO-01/02/08** — 3 arreglos quirúrgicos
   de la auditoría (`docs/audit-buyout-2026-06-29.md`), **2 archivos** (`subcategoria/contrato-actions.ts`,
   `lib/buyout/rollup.ts`): **BO-01** TC de divisa sin fallback a 1 (USD/EUR sin TC → **aborta** la escritura
   a Pagos en vez de registrar un monto ~17-20× subestimado; MXN=1 sigue legítimo); **BO-02** el puente ya
   **no adopta/pisa** una partida capturada manualmente en Pagos por coincidencia de nombre (solo reutiliza
   las que él creó/ligó; manual homónima → avisa, en crear **y** en re-sincronizar); **BO-08** cada select
   que alimenta el dinero revisa su `.error` (error de Supabase ≠ "no encontrado" → aborta). **Pagos intacto**
   (cero esquema/RLS/lógica de Pagos tocados); **sin migración**. Detalle abajo.
✅ **Atomicidad PRE-MERGE (2026-06-29 · auditoría) — BO-09/10** — 2 arreglos quirúrgicos de la auditoría
   (`docs/audit-buyout-2026-06-29.md`): **BO-09** `marcarVigente` hace el swap (baja anterior → sube elegida →
   apunta item) **atómico** vía RPC `buyout_mark_vigente` (1 transacción Postgres) → un fallo a media ya **no**
   deja al concepto **sin vigente** (no desaparece del rollup); **BO-10** la captura inserta la **línea ANTES**
   del PDF y un **fallo de PDF ya no aborta** (la línea queda guardada; se **avisa** en ámbar para reintentar al
   editar). **1 migración aditiva** (solo una función `buyout_*`, aplicada a prod con `db push` — opción B) +
   **3 archivos** (`subcategoria/actions.ts`, `partida/actions.ts`, `partida/linea-dialog.tsx`). **Pagos
   intacto**; **sin tocar** ninguna tabla/RLS/lógica de Pagos. Detalle abajo.
✅ **Catálogo de partidas POR-PROYECTO + Seed CIMIENTO de Beachfront (2026-06-29 · sesión cimiento BF)** —
   **Parte 1:** `buyout_partida_catalog` pasó de **global** a **por-proyecto** (nueva col `project_id` FK
   projects + índice único `(project_id, nombre)` en vez de solo `nombre`); **TODAS** las 47 filas
   existentes (24 activas + 23 soft-deleted) se **backfillearon a Lote 3** y las 3 pantallas + la acción de
   cierre filtran por proyecto (`.eq("project_id", id)`). `buyout_concepto_catalog` NO necesita `project_id`
   (cuelga de la partida → aislado transitivamente). **L3 queda idéntico.** **Parte 2:** sembrado el
   **cimiento de NAUKA Beachfront** desde `reference/NAUKA - BUY OUT BF 290626.xlsx` (valores, no fórmulas):
   **12 capítulos** (orden del prompt), **32 partidas**, **63 conceptos**, **32 bases** (col E `PRESUPUESTO
   IZ MXN BASE`, Σ = 427,161,130 = TOTAL PRESUPUESTO), **TC** MXN1/USD17.5/EUR22, **área interior 2927.6 m²**
   (Torre1 AIA + Torre2 AIA) y **8 deptos** (solo referencia). **2 migraciones aditivas** auto-verificadas
   (DO-block transaccional) aplicadas a prod (`db push`, opción B). **Pagos intacto**; BF separado de L3
   (cada proyecto ve solo lo suyo). Detalle abajo. **NO es el volcado de conceptos/cotizaciones reales de BF
   (etapa 2).**
✅ **Catálogo de BF EXACTO al doc oficial (2026-06-29 · sesión BF exacto)** — el seed del cimiento tenía
   desviaciones vs el tablero real (12 capítulos con GARDEN/INFRAESTRUCTURA promovidos y PILAS bajo OBRA
   CIVIL; partidas Closets/FFE del glosario). Se dejó el catálogo de BF **EXACTAMENTE** como
   `docs/future-modules/buyout-catalogo-BF.md` (confirmado por Alfonso): **11 capítulos** (DISEÑO · PILAS ·
   OBRA CIVIL · MEP · ACABADOS · COLOCACIONES · ALBERCAS · JARDINERIA Y RIEGO · ELEVADOR · EXTERIORES ·
   OTROS), **30 partidas** (PILAS = capítulo propio; GARDEN AND PRIVACY WALLS e INFRAESTRUCTURA = partidas
   bajo EXTERIORES; **sin Closets/FFE** como partida), **64 conceptos** ("Closets" sigue como concepto de
   CARPINTERIAS; OTROS = Otros · Fire Pit · Acustica). **1 migración** `20260629150000` que **limpia**
   (hard delete, seguro: 0 `buyout_item` de BF) y **re-siembra desde el doc**; CASCADE borró conceptos+bases
   viejos; **TC, área y 8 deptos conservados**; bases re-mapeadas (Σ = 427,161,130 = TOTAL del tablero). DO-block
   transaccional verificó 11/30/64/30 + L3 intacto (24 part / 8 cap). **L3 idéntico · Pagos intacto · cero DDL.**
✅ **VOLCADO de conceptos/cotizaciones de BF (etapa 2b · 2026-06-29 · sesión volcado BF)** — cargados los
   datos REALES de Beachfront desde `reference/NAUKA - BUY OUT BF 290626.xlsx` (valores calculados, mismo
   parseo del preview `docs/buyout-bf-volcado-preview.md` que cuadró 30/30). **Migración `20260629160000`**
   aplicada a prod (`db push`, opción B). **144 items / 144 cotizaciones / 1,732 líneas** (143 conceptos de
   las 30 partidas + **CONTINGENCIAS** con su concepto "Adicionales"; 1,730 líneas + 2 de Contingencias).
   **Cuadre AL CENTAVO en las 31 partidas**, verificado **transaccionalmente** (DO-block recomputa el rollup
   por partida y compara contra los totales del Excel = los del preview; rollback si falla). Decisiones de
   Alfonso aplicadas: **concepto fino del tab = un item** (Iluminacion 30 cuartos, Griferia 9 baños, etc.;
   `buyout_concepto_catalog` de BF extendido de 64 → con los conceptos finos, idempotente); **CONTINGENCIAS**
   = capítulo propio (orden 12, tras OTROS) + partida (orden 31) + base 0, con su volcado ($12M); **quote_date
   = 2026-06-29** (fecha del archivo, no hay fecha por línea en las verdes); **proveedor NA → cotización
   `kind=parametrico`** (sin supplier); **"REJILLAS?"** cargado tal cual y marcado en notas. Detalles del
   modelo y del cuadre abajo. **L3 idéntico · Pagos intacto · solo data de BF.**
✅ **FIX de escala: paginar el fetch de líneas del rollup (2026-06-29 · sesión fix cap)** — tras el volcado,
   en BF muchas partidas salían en **$0** (Carpinterias, Albercas, Jardinería, Elevador, Exteriores, Garden,
   Infraestructura, Otros, Contingencias; Griferia parcial). **Causa raíz:** `loadVigenteLines` (`lib/buyout/
   rollup.ts`) traía las líneas vigentes en **UNA consulta sin paginar**, y PostgREST corta a **`max_rows=1000`**
   (`supabase/config.toml`); BF tiene **1,732** líneas → se descartaban ~732 en silencio. Los **datos en la base
   estaban completos** (la migración cuadró en SQL, donde el cap no aplica); solo el fetch se truncaba. **Fix
   (solo código, 1 archivo):** helper `fetchAllRows` que pagina con `.range(off, off+999)` en bloques de 1000
   hasta una página incompleta, aplicado a las 3 queries (items · cotizaciones · líneas) con **orden estable**
   (`id` como desempate; las 1,732 líneas comparten `created_at` por venir de un solo INSERT, así que sin orden
   único se duplicarían/saltarían filas entre páginas). **Sin migración, sin cambio de esquema/datos, sin tocar
   la lógica del rollup** (solo se asegura traer TODAS las filas). Verificado: test del mecanismo con la forma
   real de BF → nuevo trae 1,732 (sin dup/saltos, todas las partidas completas), el viejo perdía exactamente
   esas 10 partidas. **L3 idéntico** (usa el mismo loader; <1000 líneas → una sola página, orden por `created_at`
   preservado) · **Pagos intacto** (no usa código de Buy-Out). Gate verde. Detalle abajo.
✅ **RE-VOLCADO de BF AGRUPADO por partida × torre (2026-06-29 · sesión agrupado)** — Alfonso quiere BF como su
   tablero: **pocas líneas por partida** (1-2 por torre), no el detalle de 1,732 renglones del 2b. **Migración
   `20260629170000`** (db push, opción B) **re-agrupa** las filas de cada verde por **(PARTIDA × TORRE × madurez
   × contratación)**; cada grupo = **UNA línea** con la **suma de su TOTAL MXN** → **72 líneas** (vs 1,732).
   TORRE de la col TORRE (o inferida del depto: 1xx/2xx=T1, 3xx/4xx=T2; sin torre clara = "Compartido").
   Proveedor = dominante no-NA del grupo (NULL→sin proveedor). **PDF NO se carga** (manual después); se conserva
   la NOTA (folio/fecha). Cada grupo = item + cotización **vigente** (kind=madurez, contratado=contratación) +
   1 línea MXN (cant=1, sobrecosto=0, iva=0, unitario=Σ). **Cuadre AL CENTAVO por partida** (mismos targets que
   el 2b/preview; el monto no cambia, solo se agrupa), verificado transaccionalmente (rollback si falla).
   **El estado ahora sale bien:** agrupar por estado hace que un concepto medio-contratado salga **"parcial"** —
   p. ej. **PILAS = ppto · contratación PARCIAL (50%)** (Torre 1 contratado / Torre 2 no), que antes salía
   "No contratado". 11 partidas con eje parcial, con % exacto por dinero. Grupos en **$0 descartados** (no
   aportan monto; evitan "parcial" espurio) → EXCAVACION/MADERA quedan sin líneas ($0, correcto). **Reemplaza
   el transaccional del 2b** (cleanup primero). **NO toca el catálogo** (capítulos/partidas/conceptos/bases) ·
   **L3 idéntico · Pagos intacto · solo data de BF.** Detalle abajo.
✅ **RE-VOLCADO FINAL de BF según SPEC de líneas por partida (2026-06-29 · sesión spec)** — Alfonso escribió
   `docs/future-modules/buyout-BF-lineas-spec.md` con el criterio EXACTO de cuántas líneas y cómo por partida.
   **Migración `20260629180000`** (db push) re-vuelca BF siguiéndola al pie de la letra → **109 líneas**, conteo
   por partida **idéntico a la spec** (verificado). Patrones: **0.5-espejo** (Imper, Inst×3, Automat, Aire,
   Iluminación, Acabados, +Herreria) = 2 líneas cantidad 0.5, unitario = ppto total; **por torre real** (Obra
   Civil, Albañilería) y **1 ppto×2 torres** (Albercas, Griferías, Elevador, Infraestructura, Contingencias);
   **N pptos×2 torres** (Ingenierías 14, Vidrios 8, Cocinas 6, Jardinería 4, Exteriores 12, Otros 4 por concepto;
   Mármol 4 por categoría Suministro/Colocación; Pilas 6 y Garden 6 por detalle); **Carpinterías 4** por
   madurez×torre; **Arquitectura 2** por concepto (Diseño Arq + Diseño Jard); **Preliminares 3** por ppto
   (Despalme/Malla/Plataformas); **Condiciones Generales 4** = TAL CUAL el re-volcado anterior. Excavación/Madera
   = 0. **Cuadre AL CENTAVO por partida** (mismos targets; el monto no cambia, solo cómo se reparte), verificado
   transaccionalmente (rollback si falla). Estado por línea = dato real → **Pilas sale parcial** (T1 contratado /
   T2 no). **2 huecos de la spec** (no listaba Herreria ni Excavación): Excavación→0 (target $0); **Herreria→0.5-
   espejo 2 líneas paramétrico ($4.64M) por defecto — CONFIRMAR con Alfonso.** Reemplaza el transaccional del
   re-volcado agrupado. **NO toca catálogo · L3 idéntico · Pagos intacto.** Detalle abajo.
✅ **3 ajustes del Resumen BF (2026-06-29 · sesión ajustes Resumen)** — (1) **Contingencias FUERA del TOTAL:** el
   gran TOTAL (y $/m², DIF, desglose) **excluye** la partida `CONTINGENCIAS`; se muestra en una fila aparte
   **abajo** ("Contingencias / Adicional · fuera del TOTAL", $12M), como en el Excel (bajo el TOTAL PRESUPUESTO).
   Aplica a las 3 vistas. Identificada por nombre en código (`esAdicional`), sin tocar datos. (2) **Desglose del
   TOTAL por los 2 ejes:** dos tarjetas bajo el total — **Madurez** (Ppto $233.5M 56% · Paramétrico $186.7M 44%)
   y **Contratación** (Contratado $96.8M 23% · No contratado $323.4M 77%), reusando las cubetas del rollup (sin
   recalcular). En modo Contratación se omite (la tabla ya lo desglosa). (3) **Conceptos descriptivos sin torre:**
   los `buyout_item` de BF pasaron a nombres del origen (concepto/detalle) **sin** sufijo "· Torre X"/estado
   (la torre va en su columna); duplicados por (partida, concepto) **consolidados** en 1 item con sus líneas por
   torre → **55 items / 109 líneas** (antes 109 items). Para no perder el "parcial" al consolidar (ej. PILAS:
   Torre 1 contratada / Torre 2 no), se agregó **estado POR LÍNEA** (`buyout_line.kind/contratado` nullable,
   aditivas) y el rollup lee el de la línea con fallback al de la cotización → **L3 idéntico** (líneas sin estado
   → cae a la cotización). **Cuadre por partida intacto** (mismos montos; verificado transaccional, 31/31).
   **L3 idéntico · Pagos intacto.** Migración `20260629190000` (db push). Detalle abajo.
⏸️ **PAUSA para que Alfonso revise BF en el navegador** (Contingencias fuera del total + desglose por ejes +
   conceptos descriptivos). Pendiente: confirmar Herreria. Pendiente Fase 5: **marcar contratado** como acción dedicada (hoy se marca al editar la línea).
   Pendiente Resumen: modo **Qué falta**. Pendiente BF (si se decide tras revisar): **desglose por depto**
   (hoy torre/piso/depto van como texto en la línea, grano = total del proyecto).

## Aislamiento / git (regla de la fase: rama propia, sin push)

- Rama de trabajo: **`feat/buyout`**. **Nunca se hizo push.** `main` intacto salvo el commit de docs operativos que pediste.
- Commits hechos:
  - `main` → `163c597 docs: runbook rotación keys + prompt auditoría` (solo `docs/runbook-rotacion-keys.md` + `docs/prompt-auditoria-calidad.md`). **Local, sin push.**
  - `feat/buyout` (creada desde `main`):
    - `a39e0b3 docs(buyout): spec + análisis Excel L3`
    - `9c7b959 feat(buyout): esquema + catálogos (slice 1)` ← la migración
    - … (slices 2a–5, modos, puente a Pagos, auditoría BO-01…10 — ver historial) …
    - `b6108e5 fix(buyout): atomicidad de marcar-vigente y captura sin perder línea [BO-09/10]`
    - **(sesión cimiento BF, 2026-06-29):** `feat(buyout): catálogo de partidas por-proyecto` +
      `feat(buyout): sembrar cimiento de Beachfront` (2 commits). **Local, sin push.**
    - **(sesión BF exacto, 2026-06-29):** `fix(buyout): catálogo de BF exacto al tablero (11 capítulos, desde doc)`. **Local, sin push.**
    - **(sesión preview BF, 2026-06-29):** `docs(buyout): preview de volcado BF (etapa 2a)`. **Local, sin push.**
    - **(sesión volcado BF, 2026-06-29):** `feat(buyout): volcado de conceptos de BF (etapa 2b)` (migración `20260629160000` + STATE). **Local, sin push.**
    - **(sesión fix cap, 2026-06-29):** `fix(buyout): paginar fetch de líneas del rollup (cap max_rows) [escala BF]` (`src/lib/buyout/rollup.ts` + STATE; solo código, sin migración). **Local, sin push.**
    - **(sesión agrupado, 2026-06-29):** `fix(buyout): re-volcado BF agrupado por partida×torre` (migración `20260629170000` + STATE; re-data de BF, sin tocar catálogo). **Local, sin push.**
    - **(sesión spec, 2026-06-29):** `fix(buyout): re-volcado BF según spec de líneas por partida` (migración `20260629180000` + `buyout-BF-lineas-spec.md` + STATE). **Local, sin push.**
    - **(sesión ajustes Resumen, 2026-06-29):** `feat(buyout): contingencias fuera del total + desglose por ejes en total + conceptos descriptivos` (migración `20260629190000` + `rollup.ts` + `buyout/page.tsx` + STATE). **Local, sin push.**
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

## Modo Contratación — desglose por estado (hecho 2026-06-25, sesión 4)

Tercer modo del Resumen (SPEC-buyout.md §6, "Contratado vs No"). Es un modo **APARTE**: no toca
las columnas ni la lógica de Vigente/Evolución. **Sin migración** (reusa el rollup vigente).

### Qué muestra
- Toggle del Resumen ahora con **3 pestañas**: **Vigente · Evolución · Contratación** (mismo patrón
  `?modo=contratacion`). Vigente y Evolución quedan **idénticos**.
- Por cada partida (agrupadas por capítulo), el **total MXN de la cotización VIGENTE** de sus
  conceptos, partido por estado en **2 ejes INDEPENDIENTES** (las cols V/W del Excel):
  - **Madurez:** `Paramétrico` (Σ conceptos `kind=parametrico`) · `Ppto` (Σ `kind=ppto`).
  - **Contratación:** `No Contratado` (Σ `contratado=false`) · `Contratado` (Σ `contratado=true`).
  - **Total** y **% Contratado** (= Contratado ÷ Total, avance por dinero).
- Los dos ejes son **dos cortes del mismo total** → `Paramétrico+Ppto = Total` y
  `NoContratado+Contratado = Total`. Encabezados **agrupados** ("Madurez | Contratación") + un
  **divisor vertical** entre los 2 pares para que se lea claro. **% Contratado con barrita** de
  avance (verde) + texto.
- **Subtotal por capítulo** + **TOTAL general** + **% Contratado global**.

### Cómo cuadra (sin duplicar lógica)
- **`src/lib/buyout/rollup.ts`** — extendí `PartidaAgg` con 4 cubetas (`parametrico`, `ppto`,
  `noContratado`, `contratado`) y `aggregateLines` las acumula **en la MISMA pasada** que `total`,
  reusando el mismo `t = lineTotalMxn(l)`. Por construcción cada par suma exactamente el total y el
  TOTAL del desglose **iguala** el total Vigente (misma fuente, mismas `aggs` del rollup) → **cero
  queries extra**, **cero lógica nueva de carga**. Vigente/Evolución siguen leyendo `agg.total` igual.
- **`buyout/page.tsx`** — parseo de `?modo=contratacion`, arma `contraChapters` (solo en este modo)
  desde `chapterViews` ya calculados, y rinde `<ContratacionTable>`. Vigente/Evolución sin cambios.
- **`buyout/contratacion-table.tsx` (nuevo)** — la tabla del modo (Server Component, patrón de
  `EvolucionTable`): encabezado agrupado de 2 filas, separador entre ejes, filas por partida con
  links a Partida, subtotal por capítulo y TOTAL + % global con barrita.
- **`buyout/resumen-mode-toggle.tsx`** — `ResumenMode` += `"contratacion"` + 3ª pestaña.

### Verificación
- **Cálculo (node, partida mixta mármol):** suministro+pulido contratados, colocación+cenefa(USD) no;
  suministro+colocación ppto, cenefa+pulido paramétrico → Paramétrico $102,660 + Ppto $256,940 =
  **Total $359,600**; No Contratado $118,900 + Contratado $240,700 = **$359,600**; **% = 66.9%**.
  Subtotales y TOTAL general cuadran; `grand.total` = Σ total MXN vigente de todas las líneas ✓.
- **Gate verde:** `pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓ (las 3
  rutas buyout dinámicas; **las 6 de Pagos idénticas** en el manifest). Render tras login/RLS → prueba
  de Alfonso: en una partida con conceptos mezclados, ver las 4 columnas y que cada par sume el Total;
  subtotales y TOTAL cuadran con el modo Vigente.

## Modo Contratación · % por cubeta (hecho 2026-06-25, sesión 5)

Mejora **solo de presentación** sobre el modo Contratación. **Un solo archivo tocado**
(`buyout/contratacion-table.tsx`); **sin migración**, **sin queries nuevas**, **rollup intacto**,
**Vigente/Evolución sin tocar**, **Pagos intacto**.

### Qué cambió
- Cada una de las **4 cubetas** (Paramétrico · Ppto · No Contratado · Contratado) muestra ahora su
  **monto Y su % del total de esa fila**, en línea y con el % **atenuado** (`text-muted-foreground`
  / `text-white/55` en la fila oscura): ej. **"$ 240,700.00 (67%)"**. El monto hereda el color de
  la celda (No Contratado atenuado, Contratado en verde); el % va en tono secundario → se lee limpio.
- Aplica igual a las **filas de Subtotal por capítulo** y al **TOTAL general** (cada % sobre su propio
  total de fila).
- La columna headline **% Contratado** (barrita de avance, una decimal) **se conserva** tal cual.

### Cómo cuadra (cada par = 100%, sin descuadre por redondeo)
- Helper puro **`estadoPcts(row)`**: para que `%Paramétrico + %Ppto = 100%` y
  `%NoContratado + %Contratado = 100%` **exactos** pese al redondeo a entero, **ancla** `ppto` y
  `contratado` (los redondea) y **deriva el complemento** (`parametrico = 100 − %ppto`,
  `noContratado = 100 − %contratado`). Así nunca aparece 99% ni 101% en un par.
- **Total = 0** (partida vacía) → cada % es `null` → la celda muestra **"—"** (no divide entre 0).
- Componente **`MontoPct`** (monto + % atenuado en línea) reemplaza el `formatMXN` suelto en las 12
  celdas de cubeta (4 partida + 4 subtotal + 4 TOTAL). Reusa las cubetas que ya trae cada
  `ContraPartida`/`ContraChapter` desde el rollup → **cero cálculo de carga nuevo**.

### Verificación
- **Cálculo (node, `estadoPcts`):** mármol mixta → Madurez 29% + 71% = 100%, Contratación 33% + 67%
  = 100%; casos de redondeo límite (12.5/87.5 → 12%+88%; 0.5/99.5 → 0%+100% y 99%+1%) **siempre
  100%**; base 0 → "—". El Contratado del mármol da **67%** (= el ejemplo pedido).
- **Gate verde:** `pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓ (las 3
  rutas buyout dinámicas; **las 6 de Pagos idénticas** en el manifest). Render tras login/RLS → prueba
  de Alfonso: en una partida mixta, cada cubeta muestra su % y cada par suma 100%; subtotales y TOTAL
  igual; el Total sigue cuadrando con Vigente.

## Meses congelados sin "desactualizado" (hecho 2026-06-25, sesión 6)

Quitar la fricción del aviso "desactualizado" / "Actualizar foto" al editar tras cerrar un mes, y
**unificar** las columnas de mes entre Evolución y Vigente. **Sin migración**; las Server Actions de
cierre (`cerrarMesActual` / `reabrirMes`) **no se tocaron**; **Pagos intacto**. 4 archivos.

### Qué cambió
- **Fuera el drift y los badges.** Se eliminó el cálculo `enCursoDrift` (comparar total vivo vs foto)
  y los badges **"cerrado ✓"** y **"desactualizado"** de la columna del mes en curso (Evolución). Un
  mes cerrado ya **no se compara con lo vivo**; es solo su foto congelada.
- **Columnas de mes unificadas (req. clave).** Antes Evolución usaba `frozenMonths` (cerrados *excepto*
  el actual) + el mes en curso como columna **viva** con badges; Vigente usaba `vigenteMonths` (*todos*
  los cerrados). Ahora hay **un único `monthCols` = TODOS los meses cerrados** (incl. el actual si ya
  cerró), que alimenta **ambas** vistas → **mismas etiquetas** (`periodoLabel` "Ppto Junio 2026"),
  **mismos valores congelados** (`buyout_month_snapshot`) y **mismo orden** (ascendente por periodo).
- **Columna viva aparte.** En Evolución la última columna de datos pasó de "Ppto {mes} (en curso)" con
  badges a **"PPTO Vigente"** (el total vivo de hoy), sin badges ni Reabrir. Es el análogo de la
  columna **Ppto** del Vigente (mismo `p.total` del rollup). Dif = Base vs PPTO Vigente (lo más
  reciente), igual que antes.
- **Botón "Actualizar mes".** `CerrarMesButton`: cuando el mes ya está cerrado, el botón pasó de
  **"Actualizar foto"** a **"Actualizar mes"** (re-toma el total vigente de hoy y sobrescribe el valor
  congelado del mes en curso; misma action `cerrarMesActual`). Textos del diálogo actualizados.
- **Reabrir (↩) conservado.** Cada columna de mes cerrado en Evolución mantiene su `ReabrirMesButton`
  (admin). Como el mes actual cerrado ahora es **una columna de mes normal**, su ↩ vive en su propia
  cabecera (antes estaba en la columna "en curso").
- **Limpieza:** `periodoLabel(periodo, enCurso?)` perdió el parámetro muerto (el sufijo "(en curso)"
  ya no se usa) → `periodoLabel(periodo)`.

### Archivos
- **`buyout/page.tsx`** — `monthCols` único (reemplaza `frozenMonths`/`evoMonths`/`vigenteMonths`);
  borrado el bloque de drift (`currentSnap`/`enCursoDrift`/`enCurso`); `EvolucionTable` recibe
  `months={monthCols}` + `enCursoLabel="PPTO Vigente"`; leyenda de Evolución reescrita (sin "foto/
  desactualizado"). El render del Vigente y su grupo "▸ Meses" quedan **iguales** (ya usaban todos los
  meses cerrados).
- **`buyout/evolucion-table.tsx`** — fuera el tipo `EnCurso` y los imports `Check`/`TriangleAlert`;
  prop `enCurso` → `enCursoLabel: string`; cabecera de la columna viva simplificada a solo la etiqueta.
- **`buyout/cerrar-mes-button.tsx`** — "Actualizar foto" → "Actualizar mes" + textos del diálogo.
- **`lib/buyout/month-close.ts`** — `periodoLabel` sin el parámetro `enCurso` muerto.

### Por qué se conserva el congelado (no cambia al editar)
Las columnas de mes leen **solo** de `snapshotByMonth` (la foto escrita por `cerrarMesActual` al
cerrar). Editar un concepto cambia el **rollup vivo** (`loadPartidaAggs` → `p.total` → "PPTO Vigente" /
"Ppto"), **no** el snapshot. Por eso un mes cerrado no se mueve al editar, y "Actualizar mes" es la
única forma de re-tomarlo. Conceptos nuevos que no existían en un mes → **$0** en esa columna
(`snapshot ?? 0`).

### Decisión (consistencia de columnas)
El **valor/etiqueta/orden** de las columnas de mes ahora es idéntico entre Evolución y "▸ Meses". El
botón **Reabrir (↩)** se mantiene **solo en Evolución** (es la vista de gestión del comparativo); el
grupo "▸ Meses" del Vigente sigue siendo solo-lectura de columnas, como antes. Si Alfonso quiere ↩
también en Vigente, es un añadido trivial (admin-only) — se deja fuera por mínimo alcance.

### Verificación
- **Gate verde:** `pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓ (las 3
  rutas buyout dinámicas; **las 6 de Pagos idénticas** en el manifest). Render tras login/RLS → prueba
  de Alfonso: cerrar un mes congela su columna; editar un concepto después **no** mueve el mes cerrado
  ni muestra "desactualizado"; **"Actualizar mes"** sí re-toma el valor; **Evolución y Vigente muestran
  las mismas columnas de mes**; conceptos nuevos salen en $0 en meses previos.

## Meses editables inline + etiqueta dinámica (hecho 2026-06-25, sesión 7)

Edición manual del valor congelado de un mes por partida (como el lápiz del Ppto Base) y etiqueta
dinámica del botón de cierre. **Sin migración** (reusa `buyout_month_snapshot` del Slice 1, con su
índice único parcial, RLS `is_admin()` y audit). **Cerrar/Reabrir y el rollup sin tocar**; **Pagos
intacto**. 5 archivos (1 nuevo).

### Qué cambió
- **Celdas de mes editables (Evolución).** Cada celda de un mes cerrado —por partida— es **editable
  inline con lápiz** para admin (no-admin = solo lectura), idéntica en UX a `BaseCell`. Componente
  nuevo **`buyout/month-cell.tsx`** (`MonthCell`).
- **Server Action `setMonthSnapshot(projectId, monthCloseId, partidaCatalogId, totalMxn)`** en
  `buyout/actions.ts`: Zod + admin-only (`getMyProfile`, lo refuerza la RLS). Valida que el cierre
  **pertenezca al proyecto** (no se puede editar la foto de otro proyecto vía un id arbitrario).
  **Upsert** del par (mes, partida) respetando el índice único parcial
  `(month_close_id, partida_catalog_id) WHERE deleted_at IS NULL`: **update** si existe, **insert** si
  no (p. ej. una partida que estaba en $0 ese mes). `revalidatePath`. Dinero `numeric(14,2)`.
- **Cualquier mes, incluido pasado.** La action filtra por `month_close_id` (no por periodo actual) →
  se puede corregir **Junio estando en Julio**. La columna del mes vive en `monthCols` (todos los
  cerrados), así que su celda es editable sin importar qué mes esté en curso.
- **Etiqueta dinámica del botón** (`CerrarMesButton`): mes en curso **no cerrado** → "Cerrar
  `<Mes> <Año>`"; **ya cerrado** → "Actualizar `<Mes> <Año>`" (re-toma la foto del mes en curso; misma
  action `cerrarMesActual`, sin cambio de funcionalidad). Antes decía "Cerrar mes · …".
- **Reabrir (↩)** por columna de mes cerrado en Evolución: **conservado** (sin cambios).
- **Subtotales de capítulo y TOTAL** de cada mes siguen **solo-lectura** (son sumas; se recalculan al
  revalidar tras editar una celda).

### Por qué no afecta el rollup vivo ni otros meses
`setMonthSnapshot` escribe **una sola fila** de `buyout_month_snapshot` (la del par mes/partida). No
toca `buyout_line`/`buyout_quote` (fuente del rollup) → la columna **PPTO Vigente** (vivo) y el modo
Vigente quedan igual. No toca otras filas → otras partidas y otros meses intactos. Tras guardar,
`revalidatePath` re-renderiza: la celda, su subtotal, el TOTAL y —misma fuente— el "▸ Meses" del
Vigente reflejan el nuevo valor; el rollup vivo no se mueve.

### Unificación Evolución ↔ Vigente (se mantiene)
Las columnas de mes siguen saliendo del **único `monthCols`** (todos los cerrados) y del mismo
`snapshotByMonth` → **mismos valores, etiquetas y orden** en ambas vistas. La **edición vive solo en
Evolución**; en "▸ Meses" del Vigente las celdas son solo-lectura (muestran el mismo snapshot, ya
editado si se cambió).

### Archivos
- **`buyout/month-cell.tsx` (nuevo)** — celda editable (clon de `BaseCell`, llama `setMonthSnapshot`).
- **`buyout/actions.ts`** — `setMonthSnapshot` (al final, junto a las actions de mes).
- **`buyout/evolucion-table.tsx`** — la celda de mes por partida usa `<MonthCell>` (subtotal/TOTAL sin
  cambio); doc comment actualizado.
- **`buyout/cerrar-mes-button.tsx`** — etiqueta "Cerrar/Actualizar `<Mes> <Año>`".
- **`buyout/page.tsx`** — leyenda de Evolución menciona la edición con lápiz.

### Verificación
- **Gate verde:** `pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓ (las 3 rutas
  buyout dinámicas; **las 6 de Pagos idénticas** en el manifest). Render/escritura tras login/RLS →
  prueba de Alfonso: con el lápiz, editar el valor de **Junio** por partida estando en cualquier mes;
  el cambio **persiste** y **no mueve** PPTO Vigente; la etiqueta del botón cambia según el mes en
  curso esté cerrado o no; "▸ Meses" del Vigente muestra el mismo valor editado (solo-lectura).

## Ppto Base editable solo en Evolución (hecho 2026-06-25, sesión 8)

Un único lugar de edición = **Evolución** (mismo criterio que las celdas de mes). El Ppto Base por
partida pasó de editable en Vigente a editable en Evolución; en Vigente queda **solo-lectura**.
**Sin migración**, **sin nuevas actions** (reusa `setPartidaBase`), **DIF/rollup sin tocar**;
**Pagos intacto**. 2 archivos.

### Qué cambió
- **Evolución** (`buyout/evolucion-table.tsx`): la celda **Ppto Base** por partida pasó de
  `{formatMXN(p.base)}` (solo-lectura, atenuada) a **`<BaseCell>`** (editable inline con lápiz,
  admin), igual que las celdas de mes (`MonthCell`). Se quitó el `text-muted-foreground` para que se
  vea como celda editable. Subtotal de capítulo y TOTAL del Base siguen solo-lectura (son sumas).
- **Vigente** (`buyout/page.tsx`, `ChapterGroup`): la celda Ppto Base pasó de **`<BaseCell>`** a
  **`{formatMXN(p.base)}`** (solo-lectura, sin lápiz). Se quitó el import de `BaseCell` y el prop
  `admin` de `ChapterGroup` (ya no lo usaba nadie más ahí) + su call site.
- **Leyenda de Evolución** y doc-comments actualizados: "aquí (admin) se edita el Ppto Base y las
  celdas de mes; en Vigente son solo-lectura".

### Por qué cuadra (misma fuente, DIF intacto)
Ambas vistas leen `p.base` del mismo `baseByPartida` (de `buyout_partida_base`) → **mismo valor**.
`setPartidaBase` (sin cambios) hace `revalidatePath` al guardar → Vigente y Evolución recargan la
base y **recalculan el DIF** (`difPct(total, base)`, sin tocar) en el servidor. No se tocó el rollup
ni la fórmula del DIF; solo **dónde** se dispara la edición. La captura de conceptos sigue en la
pantalla **Partida** como hoy.

### Verificación
- **Gate verde:** `pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓ (las 3
  rutas buyout dinámicas; **las 6 de Pagos idénticas** en el manifest). Render/escritura tras
  login/RLS → prueba de Alfonso: en **Evolución**, editar el Ppto Base de una partida con el lápiz;
  el valor se ve **igual en Vigente** (sin lápiz) y el **DIF cuadra** en ambas; ninguna otra columna
  cambia.

## Puente a Pagos — crear/ligar contrato desde contratado (hecho 2026-06-25, sesión 9)

El **cruce** de SPEC-buyout.md §8 en su forma **V1 manual**: al marcar un concepto **contratado**, ligarlo
a un contrato en la sección **Presupuesto de Pagos** para registrar pagos. **Sin migración** (reusa el FK
`buyout_quote.pagos_partida_id → public.partidas` que existe desde el Slice 1). 5 archivos (3 nuevos).

### Alcance respecto a Pagos (importante)
- **SÍ escribe en tablas de Pagos** (`contratistas`, `partidas`): es el propósito del puente. Reusa su
  **estructura existente** — mismas columnas, FKs, `numeric(14,2)`, **columnas generadas**
  (`iva_monto`/`presupuesto_con_iva` NO se insertan), índice único `(contratista_id, nombre)`, soft-delete
  y triggers de audit (`fn_audit_change()` corre solo en el INSERT/UPDATE).
- **NO modifica** esquema, RLS, componentes ni lógica de Pagos. No se tocó ningún archivo de Pagos. El
  enlace a la pantalla va a `/proyectos/[id]/presupuesto` (sin deep-anchor para no tocar su page).

### Qué muestra / hace (pantalla Subcategoría = historial del concepto)
- Panel **"Contrato en Pagos"** arriba del historial cuando existe una cotización vigente:
  - **No contratado:** texto guía (marca la vigente como Contratada al editar la línea en la Partida).
  - **Contratado y sin ligar (admin):** botón **"Crear/ligar contrato en Pagos"** con diálogo de
    confirmación (muestra proveedor, concepto y total con IVA).
  - **Ya ligado:** indicador **"Ligado a Pagos"** + `<contratista> · <partida>` + enlace **"Ver en
    Presupuesto"** + (admin) botón **"Re-sincronizar"**.
- **Crear** = (1) contratista por proveedor: lo busca en el proyecto por nombre exacto y lo crea si no
  existe (mismo criterio que la captura de Presupuesto de Pagos); (2) **una partida por concepto**
  (nombre = concepto) bajo ese contratista, `presupuesto_sin_iva` = base sin IVA en MXN, `iva_pct` = el de
  la cotización, y **hereda el PDF** (copia el PDF del buyout a `…/presupuestos/{partidaId}.pdf`); (3)
  guarda `buyout_quote.pagos_partida_id`. **Re-sincronizar** = actualiza solo `presupuesto_sin_iva` +
  `iva_pct` de esa partida con el monto contratado actual (no toca contratista/nombre/PDF/pagos).

### Monto que cuadra (decisión)
`presupuesto_sin_iva` (Pagos) = **(importe sin IVA + sobrecosto) × TC**, redondeado a 2 decimales; el IVA
lo aplica Pagos vía `iva_pct` → su columna generada **`presupuesto_con_iva` = el Total MXN (col T)** que
muestra el Buy-Out. Verificado con node (MXN, USD+sobrecosto, EUR iva 0, decimales): **cuadra al centavo**
en los 4 casos. En el caso común (MXN, sobrecosto 0) la base = `cantidad×unitario`, el valor literal.

### Idempotencia / soft-delete
- No duplica: si la cotización vigente ya apunta a una partida **viva**, la acción es no-op (devuelve la
  existente). Defensa extra: si ya existe una partida con ese nombre bajo el contratista, la **reutiliza**
  sin pisar su monto (cubre re-ligar tras cambiar la vigente, sin clobber de una partida manual).
- **Soft-delete:** `loadPagosLinkInfo` ignora partidas con `deleted_at` → si Alfonso borra la partida de
  prueba en Pagos, el panel vuelve a ofrecer "crear" (con aviso de que la anterior ya no existe).
  Re-sincronizar sobre una partida borrada devuelve error legible (no escribe).
- **Admin-only:** ambas actions checan `getMyProfile().role==='admin'` (lo refuerza la RLS de
  `contratistas`/`partidas` de Pagos). El botón solo se muestra a admin.

### Archivos
- **`src/lib/buyout/pagos-link.ts` (nuevo)** — `loadPagosLinkInfo` (estado del enlace, ignora borradas) +
  `contratoBaseMxn` (base sin IVA en MXN, puro, reusa `calcLinea`).
- **`src/lib/buyout/history.ts`** — `QuoteVersion` += `pagosPartidaId` (un campo en el select + el map).
- **`buyout/subcategoria/contrato-actions.ts` (nuevo)** — Server Actions `crearContratoPagos` /
  `resincronizarContratoPagos` (Zod no aplica: no hay form, solo ids; validan item∈proyecto + estado).
- **`buyout/subcategoria/contrato-pagos-panel.tsx` (nuevo, client)** — el panel + diálogos de confirmación
  (patrón de `MarcarVigenteButton`).
- **`buyout/subcategoria/page.tsx`** — carga el enlace de la vigente y monta el panel (quirúrgico).

### Gate verde
`pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓ (las 3 rutas buyout dinámicas;
**las 6 de Pagos idénticas** en el manifest). El render/escritura quedan tras login/RLS → prueba de Alfonso
(ver "Qué sigue"). ⚠️ La partida creada **se verá en Pagos real** (Presupuesto): usar un concepto de
prueba y **borrarla** si era prueba.

## Puente a Pagos — fecha del ppto al contrato (hecho 2026-06-25, sesión 10)

Pequeño complemento del puente: la partida que se crea/liga en Pagos **no traía fecha**. Ahora se pasa la
**fecha de la cotización vigente** (`buyout_quote.quote_date`) al campo de fecha de la partida de Pagos.
**Sin migración** (el campo ya existe); **Pagos intacto** (cero archivos de Pagos tocados). 3 archivos.

### Qué cambió
- **Campo destino = `partidas.fecha_firma`** (tipo `date`, nullable). Es la columna que la pantalla
  **Presupuesto** ya rinde como **"Fecha presupuesto"** (`formatDate(p.fecha_firma)`), así que la fecha se
  ve **sin tocar ningún componente de Pagos**. No existe campo separado de "fecha de contrato" en
  `partidas`; `fecha_firma` es el único campo de fecha y es el correcto (fecha del ppto firmado/contrato).
- **Crear** (`crearContratoPagos`): el INSERT de la partida nueva ahora incluye
  `fecha_firma: v.quoteDate ?? null`. La ruta de **reúso** (cuando ya existe una partida con ese nombre)
  **no** pisa la fecha (no-clobber, igual que el monto) → Re-sincronizar la completa.
- **Re-sincronizar** (`resincronizarContratoPagos`): el UPDATE ahora setea `fecha_firma` junto con
  `presupuesto_sin_iva` e `iva_pct`. Si la partida estaba **sin fecha**, la **completa** (requisito 4).
- **`loadVigenteContrato`**: el SELECT de `buyout_quote` añade `quote_date`; `VigenteContrato` += `quoteDate`.
- **`pagos-link.ts`**: `loadPagosLinkInfo` lee `partidas.fecha_firma`; `PagosLinkInfo` += `fecha`.
- **Panel "Ligado a Pagos"**: muestra la fecha (`formatDate(link.fecha)`) cuando existe.

### Por qué cuadra / no rompe nada
- `quote_date` es `date NOT NULL` → siempre hay fecha; el `?? null` es defensivo. La columna destino es
  `date` nullable → acepta el string ISO `yyyy-mm-dd` tal cual (igual que la captura de Presupuesto de
  Pagos, que hace `fecha_firma: d.fecha_firma || null`). **No** se tocan las columnas generadas
  (`iva_monto`, `presupuesto_con_iva`). El trigger de audit corre normal en el UPDATE/INSERT.
- **Archivos tocados:** `contrato-actions.ts`, `pagos-link.ts`, `contrato-pagos-panel.tsx` — **ningún
  archivo de Pagos**, ninguna migración, ningún cambio de RLS.

### Gate verde
`pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓ (**las 6 de Pagos idénticas** en el
manifest). Cambio revisado con un workflow multi-agente (correctness · regresión Pagos · requisitos/edge),
cada hallazgo verificado adversarialmente. Render/escritura tras login/RLS → prueba de Alfonso.

## Rediseño visual de las 3 tablas del Resumen (hecho 2026-06-25, sesión 11)

Pasada **100% de presentación** sobre las 3 vistas del Resumen (Vigente · Evolución · Contratación) para que
se lean más limpias. **No cambia datos, cálculos ni lógica.** Usa los **tokens NAUKA existentes**
(`nauka-*` de `globals.css` + colores semánticos), **sin hardcodear hexes ni inventar paleta**. **Sin
migración**; **Pagos intacto** (cero archivos de Pagos tocados); las 6 rutas de Pagos idénticas en el
manifest. 8 archivos (2 nuevos).

### Lenguaje visual aplicado a las 3 vistas (consistencia)
- **Contenedor:** ya tenía `rounded-2xl` + borde sutil (`border-nauka-card-border`) + `shadow-nauka-card` +
  separadores de fila muy tenues (`border-nauka-subtle`). Se conservan; se sube el aire de las filas a
  **~48px** (`px-4 py-3` + `h-12` en filas de datos; secciones/subtotales `px-4 py-2.5`).
- **Header gris muy claro** (antes oscuro `bg-nauka-dark`): `HEAD_ROW` = `bg-nauka-bg` + texto chico
  uppercase atenuado (`text-muted-foreground`) + `border-b border-nauka-subtle`, y **un icono por columna**
  (lucide, `text-nauka-neutral`). El **pie TOTAL se mantiene oscuro** (`bg-nauka-dark`) como ancla focal.
- **Montos SIN decimales:** nuevo `formatMXN0`/`formatUSD0` (es-MX, `maximumFractionDigits: 0`) **propio del
  módulo** — NO toca el `formatMXN` global (Pagos sigue con 2 decimales). Solo cambia el **despliegue**; el
  dato en BD sigue `numeric(14,2)` (en las celdas editables `BaseCell`/`MonthCell` se muestra redondeado pero
  el input edita el valor real). Aplica a montos, $/m² y USD/m². Los **%** (DIF, % Contratado) conservan su
  decimal (no son montos); el área en m² conserva sus 2 decimales (no es monto).
- **DIF como pill con flecha** (`DifBadge`, nuevo en `dif-text.tsx`): sobre-presupuesto (positivo) = **rojo**
  con flecha **ascendente** (`ArrowUpRight`); debajo (negativo) = **verde** con flecha **descendente**
  (`ArrowDownRight`); ~0% o sin dato = **gris** (`Minus`/"—"). Mantiene la semántica (over budget = rojo) y
  los colores semánticos NAUKA. Variante `onDark` para el TOTAL. El `DifText` (texto, sin pill) **se conserva**
  para el comparativo de versiones de la pantalla Subcategoría (fuera de alcance).
- **Estado en puntos de color + texto** (Vigente): los dos ejes apilados (madurez arriba: Paramétrico/Ppto/
  Parcial; contratación abajo: Contratado/No contratado/Parcial) pasan de **pill** a **punto** (`size-2`
  redondo) + etiqueta. Colores NAUKA: Ppto/Contratado = `nauka-success`, Paramétrico = `nauka-warning`,
  No contratado = `nauka-neutral`, Parcial = `nauka-accent`, sin dato = punto con borde neutro + "—".

### Modo Contratación (req. 5)
- Header **AGRUPADO** "Madurez ‖ Contratación" (2 filas) ya existía; se pasó a gris claro con iconos y el
  **divisor vertical** entre pares (`AXIS_DIV`) ahora usa el borde claro `border-nauka-card-border` (en el
  TOTAL oscuro sigue `AXIS_DIV_DARK`). Cada cubeta muestra **monto + %** (sin decimales en el monto, vía
  `MontoPct` → `formatMXN0`); la columna **% Contratado** conserva su **barra de avance + número**.
  Subtotales por capítulo y TOTAL con el mismo estilo. (NO se agregó checkbox ni sparkline — fuera de
  alcance, req. 6.)

### Archivos
- **`src/lib/buyout/format.ts` (nuevo)** — `formatMXN0` / `formatUSD0` (montos sin decimales del módulo).
- **`buyout/table-ui.tsx` (nuevo)** — `HEAD_ROW` (clase del header claro) + `Th` (celda de header con icono),
  compartidos por las 3 tablas para garantizar el mismo lenguaje visual.
- **`buyout/dif-text.tsx`** — `+ DifBadge` (pill con flecha); `DifText` intacto.
- **`buyout/page.tsx`** (Vigente) — header con `Th`+iconos, filas ~48px, `formatMXN0`, `DifBadge`, Estado en
  puntos. Lógica/colSpans/links/rollup **sin tocar**.
- **`buyout/evolucion-table.tsx`** — mismo lenguaje (header claro+iconos, ~48px, `formatMXN0`, `DifBadge`);
  `BaseCell`/`MonthCell`/Reabrir y la rejilla **sin tocar** en lógica.
- **`buyout/contratacion-table.tsx`** — header agrupado claro+iconos+divisor, `formatMXN0`, barra conservada.
- **`buyout/base-cell.tsx` · `buyout/month-cell.tsx`** — el **despliegue** del valor usa `formatMXN0` (el
  input de edición sigue con el valor crudo `numeric(14,2)`).

### Verificación
- **Gate verde:** `pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` (buyout + lib/buyout) ✓ · `pnpm build`
  ✓ (las 3 rutas buyout dinámicas; **las 6 de Pagos idénticas** en el manifest). Sin migración, sin commits
  en `main`, **sin push**. Render tras login/RLS → prueba visual de Alfonso: las 3 vistas con el nuevo estilo
  (header claro con iconos, montos sin decimales, DIF en pills, estado en puntos) y **toda la funcionalidad
  igual** (editar Ppto Base/meses, modos, "▸ Meses", rollup, %, marcar vigente, puente a Pagos).

## % por eje en la celda Estado del Vigente (hecho 2026-06-25, sesión 12)

Pedido de Alfonso: en **Vigente**, la columna **Estado** mostraba solo el estado dominante (o "Parcial") con
puntos; ahora muestra el **porcentaje de cada eje** por partida. **100% de presentación** (cero datos/
cálculos/queries nuevos); **sin migración**; **Evolución/Contratación/Pagos intactos**. **1 archivo tocado**
(`buyout/page.tsx`).

### Qué muestra
- Por partida, la celda Estado rinde **2 mini-barras apiladas** (mismo orden de ejes que antes):
  - **Madurez** (arriba): barra verde = **% en Ppto** (resto = Paramétrico). Etiqueta **"Ppto X%"** y, si hay
    mezcla, **"· Param. Y%"**.
  - **Contratación** (abajo): barra verde = **% Contratado** (resto = No contratado). Etiqueta
    **"Contratado X%"** y, si hay mezcla, **"· No Y%"**.
- **100% en un estado** → muestra **solo ese** (sin el "·" del resto): "Ppto 100%" / "Paramétrico 100%" /
  "Contratado 100%" / "No contratado 100%".
- **Sin datos** (`total ≤ 0`) → **placeholder neutro "—"** (sin barras), como antes.
- Colores **NAUKA**: relleno **verde** `bg-nauka-success` (Ppto/Contratado), track **gris** `bg-nauka-subtle`
  (Paramétrico/No contratado); texto `text-[11px]` atenuado. Sin hexes ni paleta nueva.
- **Leyenda** del Vigente actualizada (ejemplo "Ppto 60% · Param. 40%" / "Contratado 70% · No 30%" + nota de
  que los % cuadran con Contratación).

### Cómo cuadra (sin lógica nueva)
- El % reusa las **cubetas que ya trae `p.agg`** del rollup (`ppto`, `contratado`, `total`) — `% = cubeta ÷
  total` — con la **fórmula IDÉNTICA** al modo Contratación (`estadoPcts` en `contratacion-table.tsx`):
  `pptoPct = Math.round(ppto/total*100)`, `contratadoPct = Math.round(contratado/total*100)`, y el resto se
  deriva como `100 − pct`. Por construcción, los enteros mostrados en Vigente **coinciden** con los del modo
  Contratación para cada partida. (Ej. mármol: Madurez "Ppto 71% · Param. 29%", Contratación "Contratado
  67% · No 33%" — los mismos números que Contratación.)
- **Subtotal/TOTAL** de Vigente: la celda Estado sigue **vacía** (sin barras), como estaba. La columna no
  cambió de ancho fijo; `whitespace-nowrap` evita el wrap y el contenedor ya hace scroll horizontal si hace
  falta.

### Archivos / limpieza
- **`buyout/page.tsx`** — nuevos `EjeBar` (mini-barra verde/gris) + `EjeRow` (barra + etiqueta) + `EstadoCell`
  reescrito (recibe `ppto`/`contratado`/`total`). Se **eliminaron** los ya-muertos `MaturityBadge`/
  `ContratacionBadge` y las constantes de punto, y los imports de tipo `Maturity`/`Contratacion` que quedaban
  sin uso. La llamada en la fila de partida pasa `p.agg.ppto/contratado/total`; la leyenda pasa un ejemplo.
- **Evolución/Contratación NO se tocaron** (su `estadoPcts` local sigue igual; se replicó la fórmula en
  Vigente para no modificar Contratación — decisión de aislamiento, mínima superficie).

### Verificación
- **Gate verde:** `pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` (buyout + lib/buyout) ✓ · `pnpm build`
  ✓ (las 3 rutas buyout dinámicas; **las 6 de Pagos idénticas** en el manifest). **Review adversarial
  multiagente** (paridad con Contratación · aislamiento/regresión · cobertura de requisitos, cada hallazgo
  verificado por un escéptico): **0 defectos confirmados**; 2 observaciones nivel *nit* spec-compliant
  (colapso a 100% por redondeo —exigido por el requisito 4, y ambos modos redondean igual— y ancho de la
  columna sin tope pero con `nowrap`+scroll). Sin migración, sin commits en `main`, **sin push**. Render tras
  login/RLS → prueba de Alfonso: en Vigente, una partida **mixta** muestra los % por eje (cuadran con
  Contratación), una **100%** muestra solo su estado, y una **vacía** muestra "—".

## Pulido visual del Resumen — pie en tarjetas + layout de meses + tabla full-width (hecho 2026-06-25, sesión 13)

4 ajustes **100% de presentación** sobre el Resumen, **1 solo archivo** (`buyout/page.tsx`). **Cero cambios de
datos/cálculos/queries**; **Evolución/Contratación/Pagos intactos**; **sin migración**. El Entregable #1
(Estado con %) ya venía de la sesión 12 y **quedó intacto**.

### #2 — Pie como tarjetas de métrica + sin leyenda del Estado
- La línea de texto del pie ("$/m² interior … área … USD/m² … TC …") se reemplazó por una **rejilla de 4
  tarjetas** (`grid grid-cols-2 sm:grid-cols-4`), una por número, con el nuevo componente **`MetricCard`**
  (label chico uppercase atenuado arriba + número `text-2xl` abajo, fondo **`bg-nauka-subtle`**, `rounded-2xl`).
  - **$/m² interior** → `formatMXN0(costoM2)` (sin decimales)
  - **USD/m²** → `formatUSD0(usdM2)` (sin decimales)
  - **Área interior** → `areaFormatter.format(areaInt) + " m²"` (**con** decimales)
  - **Tipo de cambio** → `areaFormatter.format(usdRate) + " MXN/USD"` (**con** decimales; sufijo de unidad
    explícito para no confundir con un monto en pesos — corrección del review).
  - Cualquier valor nulo (sin área/TC) → **"—"**.
- Se **eliminó por completo** la leyenda explicativa del Estado ("Estado · 2 ejes … "). El subtítulo de la
  columna Estado en el header de la tabla ("(madurez · contratación)") se conserva.

### #3 — Botón de cierre de mes solo en Evolución
- `CerrarMesButton` ("Cerrar/Actualizar `<mes>`") se **quitó de Vigente**: ahora se renderiza **solo** cuando
  `modo === "evolucion"` (y `admin`). El cierre/actualización de mes vive en la **vista de gestión** (Evolución);
  la acción (`cerrarMesActual`) no se tocó. En Vigente/Contratación el botón ya no aparece.

### #4 — "▸ Meses (n)" en la barra superior
- El toggle `MesesToggle` se **subió a la toolbar** (misma fila que las pestañas Vigente·Evolución·Contratación,
  alineado a la derecha), reemplazando el bloque vertical aparte (`flex justify-end`) que dejaba un hueco. La
  toolbar ahora muestra un **control contextual** a la derecha: en **Vigente** el toggle "▸ Meses (n)" (si hay
  ≥1 mes cerrado), en **Evolución** el botón Cerrar/Actualizar (admin). Su función (expandir/colapsar las
  columnas de meses vía `?meses=open` → `mesesCols`) **no cambió**.

### #5 — Tabla full-width / más prominente
- El contenedor de la tabla del Vigente quedó **`w-full`** y un poco más alto (`max-h-[78vh]`); la tabla subió a
  **`text-[15px]`** (más legible) y las filas de partida a **`h-14`** (más cómodas). El header sigue compacto
  (usa el `HEAD_ROW` compartido `text-[11px]`, **no modificado** → Evolución/Contratación sin cambios) y el
  overflow lo sigue manejando el contenedor con scroll.

### Verificación
- **Gate verde:** `pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` (buyout + lib/buyout) ✓ · `pnpm build`
  ✓ (las 3 rutas buyout dinámicas; **las 6 de Pagos idénticas** en el manifest). **Review adversarial
  multiagente** (cobertura de requisitos · aislamiento/regresión · diseño/tokens NAUKA, cada hallazgo verificado
  por un escéptico): los 5 entregables correctos, #1 intacto, aislamiento OK; **1 hallazgo menor confirmado**
  (símbolo "$" ambiguo en la tarjeta de Tipo de cambio → **corregido** a sufijo "MXN/USD") y 1 nit no
  reproducible con datos reales (overflow de valor largo — descartado por disciplina quirúrgica). Sin migración,
  sin commits en `main`, **sin push**. Render tras login/RLS → prueba de Alfonso: en **Vigente** el pie son 4
  tarjetas sin leyenda, no hay botón de mes (sí en **Evolución**), "▸ Meses" está arriba junto a las pestañas, y
  la tabla se ve full-width; el Estado muestra los % por eje (cuadran con Contratación). **Evolución/Contratación
  y Pagos intactos.**

## Sidebar reorganizado en 3 secciones — Pagos / Buy-Out / General (hecho 2026-06-25, sesión 14)

El sidebar es un **componente compartido** con Pagos. Este cambio **solo reordena/agrupa/oculta links de
navegación**: NO toca ninguna página, ruta, lógica ni dato de Pagos ni de Buy-Out (las rutas siguen existiendo;
solo cambia el menú). **1 archivo** (`src/components/sidebar.tsx`); **sin migración**; **Pagos intacto**.

### Estructura nueva del menú
- **Home** — link suelto, arriba de todo (como antes).
- **PAGOS** — Resumen · Presupuesto · Flujo de Pagos · Carátula · **Aprobaciones** (Aprobaciones se movió a esta
  sección).
- **BUY-OUT** — Buy-Out (solo dentro de un proyecto; mantiene el guard `projectId`).
- **GENERAL** — **Configuración** (se movió aquí desde las tabs de Pagos) · Usuarios (admin) · ¿Cómo funciona?.
- **Cerrar sesión** — abajo (como antes). Saludo + campana de notificaciones intactos.

### Cómo se hizo (solo presentación)
- La constante `TABS` se renombró a **`PAGOS_TABS`** y se le quitó `configuracion` (ahora va en GENERAL).
- **Resumen Mensual oculto** con un flag **`hidden: true`** en su entrada de `PAGOS_TABS` + un
  `.filter((t) => !t.hidden)` al render. La **ruta `/proyectos/[id]/resumen-mensual` sigue viva** (el archivo
  `src/app/proyectos/[id]/resumen-mensual/page.tsx` no se tocó; aparece en el manifest del build y es accesible
  por URL). **Reactivar = quitar el flag.**
- Nuevo componente **`SectionHeader`**: encabezado sutil (`text-[11px]` mayúsculas `tracking-wider`
  `text-white/40`) precedido por el divisor existente (`border-t border-white/10`). Tokens NAUKA, sin hexes.
- Los hrefs y la lógica de estado activo (`pathname === href` / `startsWith`) se conservan idénticos; los 3
  call sites del sidebar (layout del proyecto, `/guia`, `/aprobaciones`) compilan con los **mismos props**.

### Verificación
- **Gate verde:** `pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` ✓ · `pnpm build` ✓. El manifest del build
  **sigue listando** `/proyectos/[id]/resumen-mensual`, `/aprobaciones`, `/usuarios`, `/guia`,
  `/proyectos/[id]/buyout` y todas las rutas de Pagos. **Review adversarial multiagente** (aislamiento/regresión ·
  requisitos/UX, cada hallazgo verificado por un escéptico): **isolation PASS** (solo `sidebar.tsx`, sin tocar
  rutas/páginas/lógica, sin imports muertos, props sin cambio); requisitos cumplidos. **0 regresiones.**
- **Notas (hallazgos pre-existentes, NO regresiones — diferidos a propósito):** (1) en el caso degenerado de
  **cero proyectos** (`projectId=""`, prácticamente inalcanzable: la app tiene 3 proyectos sembrados y el layout
  de proyecto hace `notFound()`), los links por-proyecto de PAGOS y Configuración rinden hrefs `/proyectos//slug`
  — **comportamiento idéntico al de `main`** (las tabs ya eran incondicionales); el reorg lo conserva tal cual,
  no lo introduce. (2) Los `SectionHeader` son `<li>` no interactivos dentro del `<ul>` (nit de a11y, patrón
  común). Se dejan **sin cambio** para respetar el mandato "solo reordenar/agrupar/ocultar" y la regla quirúrgica
  de CLAUDE.md; se documentan por si más adelante se quieren endurecer.
- **Sin push**, `main` intacto. Render tras login/RLS → prueba de Alfonso: el menú muestra las 3 secciones en el
  orden pedido; Resumen Mensual ya no está en el menú pero su URL responde; todos los demás links funcionan;
  Pagos intacto.

## Robustez PRE-MERGE del puente a Pagos — BO-01/02/08 (hecho 2026-06-29)

Tres arreglos **quirúrgicos** de la auditoría (`docs/audit-buyout-2026-06-29.md`), sobre la **única ruta que
escribe dinero en Pagos** (el puente §8). **Solo estos 3**, sin tocar otra cosa. **2 archivos**, **sin migración**,
**Pagos intacto** (cero esquema/RLS/componentes/lógica de Pagos modificados; el puente sigue solo INSERT/UPDATE de
datos reusando la estructura existente).

### BO-01 🔴 — TC de divisa sin fallback a 1
- **Escritura** (`subcategoria/contrato-actions.ts`, `loadVigenteContrato`): al resolver el TC, **MXN = 1** sigue
  siendo legítimo, pero una **divisa (USD/EUR) sin fila en `buyout_fx`** (o con rate nulo/≤0/no finito) ya **NO**
  cae a `1` — **aborta** con mensaje claro ("Falta (o es inválido) el tipo de cambio de {moneda}…"). Antes,
  `tc: Number(rate ?? 1)` escribía a `partidas.presupuesto_sin_iva` un monto **~17-20× subestimado en silencio**.
  Reachability real: `buyout_fx` solo está sembrado para L3 → cualquier línea en divisa de L44/Beachfront/proyecto
  nuevo caía aquí.
- **Display** (`lib/buyout/rollup.ts`, `rateOf`): mismo criterio — `cur === "MXN" ? 1 : (rate ?? NaN)`. Una divisa
  sin TC ya no finge `1` en el tablero (devuelve `NaN`, no un monto plausible-pero-falso). El rollup es solo
  lectura; no escribe a Pagos.

### BO-02 🟠 — reuso de partida: no adoptar/pisar una partida MANUAL de Pagos
- Nuevo helper `partidaLigadaAlPuente(sb, partidaId)` (solo **lee** `buyout_quote`, tabla propia del Buy-Out): ¿hay
  alguna cotización del puente ligada a esa partida (`pagos_partida_id`)?
- **Crear** (`crearContratoPagos`): cuando ya existe una partida **viva** con el mismo nombre bajo el contratista
  (`prior`), solo se **reutiliza si está ligada al puente**. Si es una partida **capturada manualmente** que solo
  coincide en nombre → **aborta y avisa** (el índice único `partidas (contratista_id, nombre) WHERE deleted_at IS
  NULL` impide crear otra homónima; "crea una nueva" no es posible, así que se avisa para que el admin la renombre
  o la ligue a mano). **Nunca la pisa.**
- **Re-sincronizar** (`resincronizarContratoPagos`): antes de sobrescribir `presupuesto_sin_iva`/`iva_pct`/
  `fecha_firma`, verifica que la partida ligada esté **creada/ligada por el puente**; si no, aborta. (Tras el fix de
  creación, el enlace solo puede apuntar a partidas del puente; esta verificación lo refuerza.)
- **Caveat honesto:** la protección sustantiva vive en **crear** (la adopción por nombre ya no ocurre). En re-sync,
  como `pagos_partida_id` proviene de la propia cotización vigente, la verificación se cumple por construcción para
  enlaces creados con el código nuevo; un enlace **heredado** de una adopción previa (solo posible en datos de
  prueba de L3, la rama nunca se pusheó) no se distingue retroactivamente — Alfonso puede revisar/limpiar esos
  enlaces de prueba si los hubiera.

### BO-08 🟠 — errores de select que alimentan el dinero
- En `loadVigenteContrato`, cada uno de los **4 selects** (`buyout_item`, `buyout_quote`, `buyout_line`,
  `buyout_fx`) ahora revisa su `.error`. Un error de Supabase (red/timeout/RLS) **no** es "no encontrado":
  se aborta con un mensaje **distinto** del "no existe", **antes** de llegar al cálculo/escritura. Alimenta también
  el BO-01 (el error de `buyout_fx` ya no se traga).

### Verificación
- **Gate verde:** `pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` (los 2 archivos tocados) ✓ ·
  `pnpm build` ✓ (11 rutas; **las 6 de Pagos idénticas** en el manifest, las 3 buyout dinámicas).
- **Casos (node, réplica de las ramas de aborto):** línea **USD sin TC → aborta** (no escribe 1×) · USD con TC
  17.5 → usa 17.5 · MXN sin fila → 1 (legítimo) · EUR rate 0 → aborta · **select con error → aborta** (no MXN=1) ·
  **partida manual homónima → NO la sobrescribe** (avisa) · partida del puente → reutiliza · sin homónima → crea
  nueva. **8/8 OK.**
- **Diff:** solo `subcategoria/contrato-actions.ts` (+helper, +error checks, +guards) y `lib/buyout/rollup.ts`
  (`rateOf`). `git diff --name-only` no toca ningún archivo de Pagos.
- Render real tras login/RLS → prueba de Alfonso (ver "Qué sigue").

## Atomicidad PRE-MERGE — marcar-vigente + captura sin perder línea — BO-09/10 (hecho 2026-06-29)

Dos arreglos **quirúrgicos** de la auditoría (`docs/audit-buyout-2026-06-29.md`), ambos de **atomicidad de
escrituras multi-paso**. **Solo estos 2**, sin tocar otra cosa. **1 migración aditiva** (una función `buyout_*`)
+ **3 archivos**; **Pagos intacto** (cero esquema/RLS/componentes/lógica de Pagos modificados).

### BO-09 🟠 — `marcarVigente` atómico (no dejar un concepto sin vigente)
- **Antes** (`subcategoria/actions.ts`): el swap eran **3 escrituras secuenciales sin transacción** (baja la
  vigente anterior → sube la elegida → apunta `selected_quote_id`). Si la 1ª tenía éxito y la 2ª/3ª fallaba, el
  concepto quedaba con **todas** sus cotizaciones en `is_selected=false` → **sin vigente** → `loadVigenteLines`
  (filtra `is_selected=true`) **dejaba de devolverlo** y **desaparecía del rollup** (Resumen y Partida),
  descuadrando el tablero sin aviso.
- **Ahora:** el swap completo corre dentro de la RPC **`public.buyout_mark_vigente(p_project_id, p_item_id,
  p_quote_id)`** — una función `plpgsql` = **una sola transacción**. Si cualquier paso falla, Postgres revierte
  TODO y el concepto **conserva intacta su vigente anterior**. Nunca queda sin vigente.
- **Migración** `20260629120000_buyout_mark_vigente_rpc.sql` (**aditiva**, aplicada a prod con `supabase db push`
  — opción B): crea **una** función + su `GRANT EXECUTE … TO authenticated` (+ `REVOKE … FROM public`). No toca
  ninguna tabla/RLS/grant existente.
- **Seguridad:** `SECURITY DEFINER` (mismo patrón que `is_admin()`/`fn_notify_admins`) con `SET search_path =
  public`. Como ignora RLS, **re-valida `public.is_admin()` dentro** y aborta si no es admin; valida también que
  el item ∈ proyecto y la cotización ∈ item (misma defensa que el server action, que además mantiene su guard
  `getMyProfile()`). El orden baja→sube respeta el índice único parcial "1 vigente por item".
- **Server action:** `marcarVigente` conserva su validación y su short-circuit "ya es la vigente"; solo cambió
  las 3 escrituras por **`sb.rpc("buyout_mark_vigente", …)`** (un round-trip, atómico). Su firma y tipo de
  retorno **no cambian** → `marcar-vigente-button.tsx` sin tocar.

### BO-10 🟠 — captura: un fallo de PDF no debe perder la línea
- **Antes** (`partida/actions.ts`, `insertVigenteQuoteAndLine`): el orden era quote → item → **subir PDF (si
  falla, `return {error}`)** → insertar `buyout_line`. Un fallo de PDF **abortaba antes** de crear el renglón →
  quedaba una cotización **vigente sin línea** y la anterior ya degradada → `loadVigenteLines` (join por
  `quote_id`) no devolvía nada y el concepto **desaparecía del tablero**.
- **Ahora:** se inserta la **`buyout_line` PRIMERO** (el dato crítico) y el **PDF al final**. Un fallo de PDF
  **ya no aborta**: devuelve `{ ok: true, warning }` con la línea **ya guardada**, y el aviso pide reintentar el
  PDF **editando la línea** (el PDF es opcional/progresivo, §5). El happy-path (con PDF OK) es idéntico.
- **Tipo `ActionResult`** ampliado a `{ ok: true; warning?: string }` (aditivo: quien solo checa `"error" in
  res` / `ok` sigue igual). `createLinea`/`addBudgetVersion` **propagan** el `warning` (antes lo descartaban con
  `return { ok: true }`).
- **UI** (`linea-dialog.tsx`): si vuelve `warning`, el diálogo **no cierra**, muestra el aviso en ámbar
  (`role="status"`) y **deshabilita reenviar** (evita duplicar la línea ya creada); el usuario cierra con
  "Cancelar" y ve la fila en la tabla revalidada. `updateLinea` **no se tocó** (fuera del alcance de BO-10).

### Verificación
- **Gate verde:** `pnpm exec tsc --noEmit` ✓ · `pnpm exec biome check` (los 3 archivos tocados) ✓ ·
  `pnpm build` ✓ (11 rutas; **las 6 de Pagos idénticas**, las 3 buyout dinámicas).
- **Migración a prod:** `supabase db push` aplicó **solo** `20260629120000` (dry-run + `migration list`
  confirman que era la única pendiente; Local y Remote ya la listan). Función aditiva y exclusiva de `buyout_*`.
- **BO-09 (atómico por construcción):** una RPC `plpgsql` corre en una transacción; una excepción no atrapada en
  cualquier UPDATE revierte los anteriores → es **imposible** terminar con 0 vigentes. El concepto **sigue en el
  rollup** con su vigente previa.
- **BO-10 (línea antes que PDF):** el `insert` de `buyout_line` ocurre y se confirma **antes** del upload; el
  fallo de PDF es una rama posterior que **no** revierte la línea → la fila **queda guardada** y se **avisa**.
- **Pagos intacto:** `git diff --name-only` toca solo `buyout/*` + la migración nueva; las 6 rutas de Pagos
  idénticas en el build. Render real tras login/RLS → prueba de Alfonso.

## Qué sigue

- **Probar el puente (Alfonso):** en un concepto **contratado**, abrir su **historial** → "Crear/ligar
  contrato en Pagos"; verificar que aparece la partida en **Presupuesto** bajo el contratista correcto con
  su monto/IVA/PDF **y la fecha del ppto** (col "Fecha presupuesto" = `quote_date` de la vigente), que el
  panel queda **"Ligado a Pagos"** mostrando esa fecha, y que **Re-sincronizar** actualiza monto **y fecha**
  (si la partida estaba sin fecha, la completa). ⚠️ La partida es **real**: borrarla en Pagos si era prueba
  (el panel volverá a ofrecer "crear").
- **Resumen (resto):** modo **Qué falta** (nota libre por partida no contratada). (El modo
  **Contratado vs No** ya está → "Contratación".)
- Luego: **Fase 5 (resto):** **marcar contratado** como acción dedicada (hoy se marca al editar la línea
  en la Partida) · **vista de cuadre** Presupuestado→Contratado→Pagado (§8) · Fase 6 carga real de L3.
- **Import de Excel = diferido** (futuro opcional, §5); la captura es manual en V1.
- **Taxonomía ya reconciliada** a las 24 partidas + 92 conceptos del doc oficial (Slice 2c).
  Pendiente: áreas Villa/Casita finas si se necesitan para $/m² por unidad.

## Catálogo per-proyecto + Seed CIMIENTO de Beachfront (2026-06-29, sesión cimiento BF)

Migrar **Beachfront** POR ETAPAS. Esta sesión = **CIMIENTO** (catálogo + bases + deptos + TC + área a
nivel proyecto, **sin desglose por depto**). El volcado de conceptos/cotizaciones reales = **etapa 2**.
Decisiones de aislamiento respetadas: rama `feat/buyout`, **sin push**, migraciones **aditivas** a prod
(`db push`, opción B), **cero** toques a `main`/Pagos.

### Parte 1 — Catálogo de partidas POR-PROYECTO (prerequisito)

`buyout_partida_catalog` era **global** (sin `project_id`, índice único en `nombre`). Cada proyecto tiene
su propio set → no podían coexistir "OBRA CIVIL" de L3 y de BF. Solución **aditiva sin romper L3**:

- **Migración `20260629130000_buyout_partida_catalog_per_project.sql`:**
  - `ADD COLUMN project_id uuid REFERENCES projects ON DELETE CASCADE` (nullable de entrada).
  - **Backfill**: TODAS las filas existentes (47 = 24 activas + 23 soft-deleted del glosario viejo) →
    `project_id` de **NAUKA Lote 3** (el catálogo vigente se sembró solo para L3).
  - `ALTER COLUMN project_id SET NOT NULL` (ya sin NULLs → auto-guarda: si L3 no existiera, aborta todo).
  - **Índice único** `(project_id, nombre) WHERE deleted_at IS NULL` (reemplaza el global `nombre`) +
    índice `(project_id)`. Esto **permite nombres repetidos entre proyectos**.
  - DO-block: reportó `backfilleadas a Lote 3: 47 filas`.
- **`buyout_concepto_catalog` NO recibe `project_id`**: cuelga de `partida_catalog_id` (FK ON DELETE
  CASCADE), que ya es por-proyecto → conceptos **aislados transitivamente**. El único SELECT de conceptos
  ya filtraba por `partida_catalog_id` (no por nombre global). Una columna menos que mantener.
- **Código (4 archivos, quirúrgico):** se agregó `.eq("project_id", id)` a las 3 lecturas del catálogo que
  cargaban TODAS las partidas — `buyout/page.tsx` (Resumen), `buyout/partida/page.tsx` (tarjetas),
  `buyout/subcategoria/page.tsx` (índice de conceptos) — y a `buyout/actions.ts` (`cerrarMesActual`, que
  arma el mapa `partidaNombreById` del rollup). Las demás lecturas son **por `id`** (una partida:
  `resolvePartidaMeta`, `history.ts`) o ya estaban por-proyecto → sin cambio.
- **L3 idéntico**: Parte 1 solo AGREGA `project_id` (no toca nombre/capítulo/orden ni conceptos/bases). Las
  pantallas de L3 filtran por L3 y devuelven exactamente las mismas 24 partidas activas que antes.

### Parte 2 — Seed CIMIENTO de Beachfront

Fuente: `reference/NAUKA - BUY OUT BF 290626.xlsx` (68 hojas), leída con **openpyxl `data_only`** (VALORES,
no fórmulas). La extracción la hizo un script (`scratchpad/extract_bf.py`) que **lee la jerarquía del
tablero por color de relleno** de la col B: navy `FF002060` = capítulo, azul `FFD9E2F3` = partida, verde
`FFE2EFDA`/"SUBTOTAL …" = subtotal, sin relleno = concepto. El SQL lo generó otro script para garantizar
**nombres EXACTOS** (acentos, guiones bajos, paréntesis) y escape correcto.

- **Migración `20260629140000_buyout_seed_beachfront.sql`** (idempotente, `WHERE NOT EXISTS`, todo cuelga
  del `project_id` de **NAUKA Beachfront**):
  - **12 capítulos** (orden EXACTO del prompt): DISEÑO · OBRA CIVIL · MEP · ACABADOS · COLOCACIONES ·
    ALBERCAS · JARDINERIA Y RIEGO · ELEVADOR · EXTERIORES · GARDEN AND PRIVACY WALLS · INFRAESTRUCTURA · OTROS.
  - **32 partidas** (30 bandas del tablero, nombres display limpios, + Closets + FFE del Glosario).
  - **63 conceptos** (filas de concepto bajo cada banda, nombres exactos).
  - **32 bases** = col **E "PRESUPUESTO IZ MXN BASE"** (fila SUBTOTAL de cada partida). **Σ = 427,161,130 =
    TOTAL PRESUPUESTO** (col E) del tablero → **cuadre exacto**, confirma que E es la columna base.
  - **TC**: MXN 1 · USD 17.5 · EUR 22.
  - **Meta**: `area_int = 2927.60` (Torre1 AIA 1463.8 + Torre2 AIA 1463.8, hoja UNITARIO) +
    `area_ext_techada = 1042.52` (521.26 ×2).
  - **8 deptos** (`buyout_unit`, `tipo='depto'`): `T1 · 101/201 (PB)`, `T1 · 102/103, 202/203 (Dúplex)`,
    `T2 · 301/401 (PB)`, `T2 · 302/303, 402/403 (Dúplex)`. Solo referencia (no entran al rollup aún).
  - **DO-block de auto-verificación transaccional** al final: si algún conteo BF no cuadra, RAISE EXCEPTION
    → rollback de TODO. Reportó `BF seed OK: 12 cap / 32 part / 63 con / 32 bases (Σ=427161130.03) / 3 fx /
    8 deptos / 1 meta`.

### ⚠️ Reportes para revisión de Alfonso (¿qué columna usé y qué reconcilié?)

1. **Columna BASE = E "PRESUPUESTO IZ MXN BASE"** (NO un mes). El header del tablero tiene E=base y
   F/G/H/I = PPTO MARZO/ABRIL/MAYO/JUNIO MXN (meses). Validado porque **Σ de las 32 bases = TOTAL
   PRESUPUESTO** del tablero (col E). La base por partida la tomé de su fila **SUBTOTAL** (la banda-partida
   trae E vacío; el subtotal es la suma de sus conceptos).
2. **PILAS**: en el Excel es banda-CAPÍTULO propio; el prompt lo mete **dentro de OBRA CIVIL** → lo sembré
   como **partida bajo OBRA CIVIL** (no capítulo).
3. **GARDEN AND PRIVACY WALLS** e **INFRAESTRUCTURA**: en el Excel son bandas-partida bajo EXTERIORES; el
   prompt los pide como **capítulos** → los **promoví a capítulos** (cada uno con su partida homónima).
4. **EXCAVACION**: la banda dice "EXCAVACION - INCLUIDA EN OBRA CIVIL"; usé el nombre limpio **EXCAVACION**
   (el capítulo ya codifica que va en OBRA CIVIL).
5. **CLOSETS y FFE**: el prompt las pide como BF-propias, pero **NO son bandas del tablero** (Closets es un
   concepto bajo CARPINTERIAS; FFE no aparece en el tablero). Vienen del **Glosario Partidas**. Las sembré
   con **base 0 y sin conceptos**: Closets → COLOCACIONES, FFE → OTROS. **Mover de capítulo / agregar
   conceptos es admin-editable.** (Resultado: 32 partidas, no ~28 — incluyo las 30 del tablero + estas 2.)
6. **Nombres de partida** = display limpio en MAYÚSCULAS (como L3), no los underscore del Glosario.
   **Conceptos** = nombres EXACTOS del tablero (mezcla mayús/minús, acentos, guiones bajos).
7. **Deptos**: `tipo='depto'` (el CHECK admite villa/casita/torre/depto; no hay 'torre+depto' combinado).
   La **Torre** vive en el prefijo del nombre (`T1·`/`T2·`). La 5ta recámara (401, 402/403 de Torre 2) **no**
   se modeló como flag aún (es etapa 2 / por-depto).

### Verificación

- **DB (autoritativa, exacta, transaccional):** los 2 DO-blocks pasaron en el `db push` → Parte 1 stampó 47
  filas a L3; Parte 2 creó **exactamente** 12/32/63/32/3/8/1 con Σbase ≈ 427.16M. Un conteo errado habría
  hecho rollback de todo. `supabase migration list` → 130000 y 140000 **local y remoto en sync**.
- **Aislamiento por diseño:** `project_id` + índice único `(project_id, nombre)` → BF y L3 no colisionan ni
  en nombres compartidos. L3 conserva sus 47 filas de catálogo (24 activas) + 92 conceptos + 24 bases + 8
  capítulos + 3 TC + 3 unidades + 1 meta, **sin cambios** (Parte 2 solo INSERTA filas de BF).
- **Gate local verde:** `pnpm exec tsc --noEmit` ✓ (0) · `pnpm exec biome check src/` ✓ (158 archivos, 0
  errores; los 2 errores de biome viven en `scripts/backup-storage.mjs`, fuera de alcance / sin trackear) ·
  `pnpm build` ✓ ("Compiled successfully", 18 rutas; las 6 de Pagos y las 3 de buyout intactas).
- **Pagos intacto:** cero archivos/tablas/RLS de Pagos tocados; la única referencia hacia Pagos sigue siendo
  el FK nullable preexistente `buyout_quote.pagos_partida_id`.
- **Lectura row-level por REST bloqueada** para `service_role` (config endurecida, igual que slices previos)
  → la confirmación visual de L3-idéntico / BF-aparece queda tras login/RLS = **prueba de Alfonso**.

### Commits (feat/buyout, sin push)

1. `feat(buyout): catálogo de partidas por-proyecto` — migración 130000 + 4 archivos `src/`.
2. `feat(buyout): sembrar cimiento de Beachfront` — migración 140000 + `buyout-BF-estructura.md` +
   `reference/NAUKA - BUY OUT BF 290626.xlsx` (fuente) + este STATE.

## Catálogo de BF EXACTO al doc oficial (2026-06-29, sesión BF exacto)

Fuente de verdad: `docs/future-modules/buyout-catalogo-BF.md` (estructura oficial confirmada por Alfonso).
El seed del cimiento (`20260629140000`) había **re-interpretado el tablero**; esta sesión deja el catálogo
de BF **idéntico al doc** y nada más (solo el proyecto Beachfront).

### Qué cambió vs el cimiento previo
- **Capítulos 12 → 11.** Se quitan GARDEN AND PRIVACY WALLS e INFRAESTRUCTURA como capítulos; **PILAS pasa
  a ser capítulo propio** (antes estaba dentro de OBRA CIVIL). Orden: DISEÑO · PILAS · OBRA CIVIL · MEP ·
  ACABADOS · COLOCACIONES · ALBERCAS · JARDINERIA Y RIEGO · ELEVADOR · EXTERIORES · OTROS.
- **Partidas 32 → 30.** Se **eliminan Closets y FFE** como partidas (eran del glosario, no del tablero).
  **GARDEN AND PRIVACY WALLS** e **INFRAESTRUCTURA** pasan a ser **partidas dentro de EXTERIORES**.
- **Conceptos 63 → 64.** OTROS ahora = **Otros · Fire Pit · Acustica** (el doc agrega "Otros"). "Closets"
  permanece como **concepto** dentro de CARPINTERIAS (no como partida).
- **Bases re-mapeadas** a las 30 partidas correctas; **Σ = 427,161,130** (= TOTAL PRESUPUESTO del tablero;
  Closets/FFE eran 0, así que la suma no cambia). **TC (USD 17.5 / EUR 22), área (2927.6) y 8 deptos
  se conservaron** (no se tocaron).

### Migración (1 archivo, aplicada a prod con `db push` — opción B)
`supabase/migrations/20260629150000_buyout_bf_catalog_exact.sql`, **sin DDL** (solo datos), aislada por
`project_id` de Beachfront:
1. **Guard**: aborta si BF no existe o si tiene ≥1 `buyout_item` (no es seguro re-sembrar con datos).
2. **Limpieza** (hard delete): `DELETE buyout_partida_catalog WHERE project_id=BF` → **CASCADE** borra sus
   conceptos y bases; `DELETE buyout_chapter WHERE project_id=BF`. (Seguro: BF no tiene transaccionales —
   etapa 2 pendiente.)
3. **Re-siembra desde el doc**: 11 capítulos, 30 partidas (cada una a su capítulo), 64 conceptos, 30 bases.
4. **DO-block de auto-verificación transaccional**: exige 11/30/64/30 + fx 3 + deptos 8 + meta 1 + **sin
   Closets/FFE** + toda partida bajo uno de los 11 capítulos + **L3 intacto (24 partidas / 8 capítulos)**.
   Cualquier desviación → `RAISE EXCEPTION` → rollback de TODO. Aplicó con NOTICE:
   `BF catálogo EXACTO OK: 11 cap / 30 part / 64 con / 30 bases (Σ=427161130.03) / fx 3 / deptos 8 / meta 1 ·
   L3 intacto (24 part / 8 cap)`.

### Jerarquía final de BF (11 → 30 → 64)
- **DISEÑO**: ARQUITECTURA (5) · INGENIERIAS Y TOPOGRAFIA (9)
- **PILAS**: PILAS (1)
- **OBRA CIVIL**: CONDICIONES GENERALES (1) · PRELIMINARES (2) · EXCAVACION (1) · OBRA CIVIL (1) ·
  ALBAÑILERIA (1) · IMPERMEABILIZACION (1)
- **MEP**: INSTALACIONES ELECTRICAS (1) · INSTALACIONES HIDRAULICAS (1) · INSTALACIONES GAS (1) ·
  AUTOMATIZACION Y CONTROL ILUMINACION (1) · AIRE ACONDICIONADO Y EXTRACCION (1) · ILUMINACION (1)
- **ACABADOS**: ACABADOS (1)
- **COLOCACIONES**: HERRERIA (2) · SUMINISTRO Y COLOCACION DE MARMOL (2) · MADERA DE INGENIERIA (2) ·
  VIDRIOS Y CANCELES (4) · COCINAS (3) · GRIFERIA Y ACCESORIOS DE BAÑO (1) · CARPINTERIAS (6, incl. "Closets")
- **ALBERCAS**: ALBERCAS (1)
- **JARDINERIA Y RIEGO**: JARDINERIA Y RIEGO (2)
- **ELEVADOR**: ELEVADOR (1)
- **EXTERIORES**: EXTERIORES (6) · GARDEN AND PRIVACY WALLS (1) · INFRAESTRUCTURA (1)
- **OTROS**: OTROS (3: Otros · Fire Pit · Acustica)

### Verificación
- **DB (autoritativa):** DO-block transaccional pasó (arriba). `supabase migration list` → 150000 local y
  remoto en sync.
- **Aislamiento:** todo filtra por `project_id` de BF; L3 verificado intacto (24/8) dentro de la propia
  migración; Pagos sin tocar (cero DDL, cero tablas/RLS/lógica de Pagos).
- **Gate local verde:** `tsc --noEmit` ✓ (0) · `biome check src/` ✓ (158 archivos, 0 errores; los 2 de
  biome viven en `scripts/backup-storage.mjs`, fuera de alcance / sin trackear) · `pnpm build` ✓
  ("Compiled successfully"). Sin cambios de código esta sesión (solo la migración de datos).
- Render visual de L3-idéntico / BF-exacto queda tras login/RLS = **prueba de Alfonso**.

### Commit (feat/buyout, sin push)
`fix(buyout): catálogo de BF exacto al tablero (11 capítulos, desde doc)` — migración 150000 +
`buyout-catalogo-BF.md` (doc fuente) + este STATE.

## Etapa 2b — VOLCADO de conceptos/cotizaciones de BF (2026-06-29)

**Migración `supabase/migrations/20260629160000_buyout_bf_volcado.sql`** (aplicada a prod con `db push`,
opción B). Carga los datos transaccionales reales de Beachfront. Cero cambios de código (la app ya es
por-proyecto). `tsc`/`biome`/`build` verdes; `migration list` → 160000 local y remoto en sync.

### Modelo de carga (clave para entender el cuadre)
- **El rollup (`src/lib/buyout/rollup.ts`) suma SOLO las líneas de la cotización VIGENTE de cada item**, y el
  índice único `buyout_quote_one_selected_uidx` permite **una sola vigente por item**. Por eso cada **concepto
  = un `buyout_item` con UNA `buyout_quote` vigente** que agrupa **todas** sus líneas; el **proveedor va por
  línea** (`buyout_line.proveedor`, fiel), no por cotización. Por eso #cotizaciones (144) = #items (144) y no
  los 148 "concepto×proveedor" del preview (4 conceptos multi-proveedor cuelgan de una sola vigente).
- **El total NO se almacena:** la app lo recomputa `cantidad*unitario*(1+sobrecosto)*(1+iva)*tc`, con
  `tc=fx[moneda]` (BF: MXN 1 · USD 17.5 · EUR 22). Verifiqué que la col S (T.C.) del Excel == fx[moneda] en
  TODAS las líneas, así que el recompute reproduce la col T del Excel.
- **kind/contratado son por concepto** (toda la vigente comparte un valor): resueltos por **dominancia de
  dinero** entre las líneas del concepto (4 conceptos con madurez mixta, 10 con contratación mixta → se toma
  el eje con mayor Σ). `supplier_id` de la cotización = el proveedor dominante (los demás quedan por línea);
  **proveedor NA/sin proveedor → `kind=parametrico`, supplier NULL**.
- **TORRE/PISO/DEPTO/DETALLE** se guardan como texto en la línea (`torre→villa_casita`, `piso`, `depto`,
  `detalle`); grano = total del proyecto (sin desglose por depto). **Cocinas y Carpinterias** (col extra
  CATEGORÍA 2) se mapearon **por nombre de encabezado**, no por letra.
- **NOTAS:** el relleno `###########` de la hoja se trató como vacío (NULL); se **conservaron las 22 notas
  reales** (folios de cotización, fechas, descripciones). **"REJILLAS?"** (HERRERIA) se cargó tal cual y se
  marcó en notas. `quote_date = 2026-06-29` (fecha del archivo) en todas.

### Cuadre AL CENTAVO (verificación transaccional)
- El DO-block final recomputa, por partida, `round(Σ cantidad*unitario*(1+sobrecosto)*(1+iva)*fx.rate, 2)`
  sobre las **filas insertadas** y lo compara contra el **total del Excel** (= los del preview). **Si alguna
  partida no cuadra al centavo → `RAISE EXCEPTION` → rollback de TODO el push.** Pasó: las **31 partidas
  cuadran**. También valida conteos (144/144/1732), "1 vigente por item", **L3 intacto (24/8)** y `projects ≥ 3`.
- **Residual de precisión (6 partidas):** `unitario` es `numeric(14,2)` pero el Excel trae unitarios USD/
  computados con 6–11 decimales → redondearlos driftaba centavos (Imperm +$1.67, Griferia −$0.40, Cond.Gen
  +$0.24, Carpinterias +$0.04, Ingenierias +$0.01, Pilas −$0.01). **Solución:** en esas 6 partidas, la **línea
  de mayor monto** se almacena en MXN (cant=1, sobrecosto=0, iva=0, `unitario = su total + residual`),
  absorbiendo el residual y **preservando su total**; las demás líneas quedan fieles. Marcado en notas de esa
  línea. Resultado: cuadre exacto sin perder ninguna línea ni cambiar conteos.
- **Carpinterias** redondea a `46,223,299.09` (half-up, como SQL/app) vs `…08` del preview (banker's de Python) —
  diferencia de 1 centavo por el `.085`, dentro del centavo.

### Conteos cargados (BF)
- **144 items · 144 cotizaciones vigentes · 1,732 líneas** · **26 proveedores** asegurados globalmente
  (creados si faltaban) · `buyout_concepto_catalog` de BF extendido con los conceptos finos (idempotente,
  WHERE NOT EXISTS) · **CONTINGENCIAS**: capítulo (orden 12) + partida (orden 31) + base 0 + concepto
  "Adicionales" + 2 líneas ($12M). Σ de las 30 partidas del tablero = **$420,204,639.35**; Contingencias
  aparte = **$12,000,000.00**.

### Idempotencia / aislamiento
- La migración **borra primero** el transaccional de BF (`DELETE buyout_item` → CASCADE a quote/line; +falta
  +import_batch), así que re-correrla es seguro y limpio. Suppliers son globales (no se borran). Todo filtra
  por el `project_id` de 'NAUKA Beachfront'. **No toca L3, ni Pagos, ni el catálogo de L3.** Triggers de
  `audit_log` se dispararon (esperado).

### Pendiente / para Alfonso
- Revisar **Resumen + Partida de Beachfront** en el navegador (cuadre por partida = el del preview).
- Si quiere, decidir **desglose por depto** (hoy texto en la línea). La línea colapsada (1 por las 6 partidas
  con drift) muestra cant=1/MXN con el total correcto — es el único punto de menor fidelidad de captura.

## Fix de escala — paginar el fetch de líneas del rollup (2026-06-29)

**Bug:** en BF, partidas en **$0** pese a tener datos cargados. **Causa raíz:** `loadVigenteLines`
(`src/lib/buyout/rollup.ts`) cargaba ítems/cotizaciones/líneas vigentes en **3 consultas sin paginar**, y el
API PostgREST trunca a **`max_rows = 1000`** (`supabase/config.toml:18`, default de Supabase). BF tiene
**1,732** líneas vigentes > 1000 → ~732 se descartaban en silencio; las partidas cuyas líneas caían tras la
fila 1000 (Carpinterias, Albercas, Jardinería, Elevador, Exteriores, Garden, Infraestructura, Otros,
Contingencias; Griferia parcial) salían en $0 con estado vacío (`aggs.get(p.id) ?? emptyAgg` en
`buyout/page.tsx`). Es un problema de **escala** que L3 (pocas líneas) nunca tocó. La validación del volcado
sumó las líneas **en SQL** (sin cap) → por eso cuadró y no detectó el truncado del fetch.

### Fix (1 archivo, solo código — `src/lib/buyout/rollup.ts`)
- Helper **`fetchAllRows(page)`**: itera `page(from, from+999)` acumulando bloques de hasta 1000 filas hasta
  recibir una página incompleta → trae TODAS las filas sin depender de `max_rows`. 8 líneas, sin `any`.
- Aplicado a las **3 consultas** de `loadVigenteLines` (items · cotizaciones · líneas), cada una con
  `.range(from, to)` por página.
- **Orden estable obligatorio** para paginar sin saltos/duplicados: se agregó `.order("id")` a items y
  cotizaciones, y `.order("created_at").order("id")` a líneas (las 1,732 líneas comparten `created_at` por
  venir de un solo INSERT del volcado → `created_at` solo no desempata). El `id` (uuid, único) garantiza el
  orden total.
- **Lógica del rollup intacta:** `aggregateLines`/`difPct`/el `.map` no se tocaron; la agregación es
  independiente del orden (suma, fecha máx, set de proveedores). Solo cambió *cuántas* filas llegan.

### Verificación
- **Gate verde:** `tsc --noEmit` ✓ · `biome check src` ✓ (158 archivos) · `pnpm build` ✓ (11 rutas).
- **Test del mecanismo** (forma real de BF: conteos de línea por partida del volcado, PostgREST simulado con
  cap 1000): `fetchAllRows` → **1,732 filas, sin duplicados ni saltos, las 31 partidas completas**; el fetch
  viejo (1 query) → 1,000 filas, perdiendo exactamente **10 partidas** (Griferia parcial 122/514 + Carpinterias,
  Albercas, Jardinería, Elevador, Exteriores, Garden, Infraestructura, Otros, Contingencias en 0) = el bug
  reportado. Con todas las líneas cargadas y el rollup sin cambios, BF suma su total real (~$420M; cuadre por
  partida = el verificado en SQL por la migración del volcado).
- **No hubo read-back en vivo:** service_role REST sigue bloqueado para las tablas `buyout_*` (como en sesiones
  previas); la verificación es el test del mecanismo + el cuadre SQL ya probado por la migración 2b.
- **Aislamiento:** un solo archivo de Buy-Out; **L3 idéntico** (mismo loader, <1000 líneas → una página, orden
  `created_at` preservado) · **Pagos intacto** (no usa código de Buy-Out) · sin migración / sin tocar datos.

## Re-volcado de BF AGRUPADO por partida × torre (2026-06-29)

**Migración `supabase/migrations/20260629170000_buyout_bf_revolcado_agrupado.sql`** (db push, opción B).
Reemplaza el detalle del 2b (1,732 líneas) por el **grano agrupado** que pidió Alfonso (su tablero: pocas
líneas por partida).

### Grano
- **Grupo = (PARTIDA × TORRE × madurez(V) × contratación(W))**; cada grupo = **1 línea** con Σ TOTAL MXN.
- **TORRE:** de la col TORRE (1,703/1,732 filas la traen); si falta/GLOBAL → inferida del depto (1xx/2xx = Torre 1,
  3xx/4xx = Torre 2); ROOF/AZOTEAS/S-D sin número → **"Compartido"**.
- **Estado por grupo:** `kind` = col V (ppto/parametrico); `contratado` = col W. Agrupar por estado hace que el
  rollup muestre **"parcial"** cuando una partida mezcla (cada eje parte el total). W nulo → No contratado.
- **Proveedor:** dominante (por dinero) no-NA del grupo; NULL si todas NA. **Nota** (folio/fecha) conservada
  (deduplicada, ≤480 chars). **PDF no se carga** (manual después).
- **concepto del item** = etiqueta de torre ("Torre 1"/"Torre 2"/"Compartido"); si una torre tiene split de
  estado (>1 grupo) se le añade sufijo " · {Ppto/Paramétrico} · {Contratado/No contratado}" para unicidad.
- **Grupos en $0 descartados** (no aportan monto; evitarían un "parcial" 0% espurio). Partidas 100% $0
  (EXCAVACION, MADERA) quedan **sin líneas** → se muestran en $0 vía el catálogo (correcto).

### Modelo / cuadre
- Cada grupo: `buyout_item` + 1 `buyout_quote` **vigente** (is_selected, kind, contratado, supplier, currency
  MXN, iva_pct 0, monto_sin_iva = unitario) + 1 `buyout_line` (cant=1, MXN, unitario = Σ TOTAL MXN del grupo,
  sobrecosto/iva 0). El rollup recompone total = unitario (tc MXN=1).
- **Cuadre AL CENTAVO por partida:** los mismos targets del 2b/preview (el monto no cambia, solo se particiona).
  Como sumar grupos redondeados puede dejar ±$0.01, el **residual se absorbe en el grupo mayor** de la partida
  (3 casos: PILAS, COCINAS, GRIFERIA) → Σ por partida = target exacto. Verificado transaccionalmente (DO-block
  recompone por partida y compara; rollback si falla). **Pasó: 31/31 al centavo, 72 líneas, L3 intacto.**

### Conteo / estado resultante
- **72 líneas** (vs 1,732): casi todas 2 por partida (T1+T2); CARPINTERIAS 6, ILUMINACION/COCINAS/VIDRIOS/
  CONDICIONES/GARDEN 4, etc.; EXCAVACION/MADERA 0. **18 proveedores** (subconjunto de los 26 del 2b; ya existían).
- **Estado correcto** (confirmado desde la data, mismo cómputo que `aggregateLines`): **PILAS = ppto ·
  contratación PARCIAL (50%)** (Torre 1 contratado / Torre 2 no) — el bug que reportó Alfonso queda resuelto al
  agrupar por estado. **11 partidas** con eje parcial (ARQUITECTURA, PILAS, CONDICIONES GENERALES, OBRA CIVIL,
  ALBAÑILERIA, ILUMINACION, VIDRIOS, COCINAS, CARPINTERIAS, ELEVADOR, GARDEN), con % exacto por dinero.

### Aislamiento / idempotencia
- **Cleanup primero** (hard delete de `buyout_item`→CASCADE quotes/lines, + falta + import_batch de BF), luego
  re-inserta → re-correr es seguro. **NO toca el catálogo** (capítulos/partidas/conceptos/bases siguen del 2b;
  la creación de CONTINGENCIAS es no-op `WHERE NOT EXISTS`). Todo filtra por `project_id` de BF. **L3 intacto**
  (24/8 verificado en la migración) · **Pagos intacto** (cero tablas/lógica de Pagos).

### Verificación
- **Gate verde:** `tsc` ✓ · `biome` ✓ (158) · `pnpm build` ✓. (Esta sesión no tocó código, solo la migración.)
- **DB (autoritativa):** DO-block transaccional pasó. Sin read-back en vivo (service_role REST bloqueado para
  `buyout_*`); render visual queda tras login = **prueba de Alfonso**.
- **Nota:** el `buyout_concepto_catalog` conserva los conceptos finos del 2b (no se tocó el catálogo); los items
  agrupados usan concepto libre ("Torre 1", etc.). Si se quiere limpiar el dropdown, es aparte.

### Commit (feat/buyout, sin push)
`fix(buyout): re-volcado BF agrupado por partida×torre` — migración `20260629170000` + este STATE.

## Re-volcado FINAL de BF según spec de líneas por partida (2026-06-29)

**Migración `supabase/migrations/20260629180000_buyout_bf_revolcado_spec.sql`** (db push, opción B). Sigue
EXACTAMENTE `docs/future-modules/buyout-BF-lineas-spec.md`. Reemplaza el transaccional del re-volcado agrupado.

### Conteo por partida (= la spec, verificado)
**109 líneas.** Arquitectura 2 · Ingenierías 14 · Pilas 6 · Cond. Generales 4 · Preliminares 3 · Excavación 0 ·
Obra Civil 2 · Albañilería 2 · Impermeabilización 2 · Inst. Eléctricas 2 · Inst. Hidráulicas 2 · Inst. Gas 2 ·
Automatización 2 · Aire 2 · Iluminación 2 · Acabados 2 · Herreria 2 · Mármol 4 · Madera 0 · Vidrios 8 · Cocinas 6 ·
Carpinterías 4 · Albercas 2 · Griferías 2 · Jardinería 4 · Elevador 2 · Exteriores 12 · Garden 6 · Infraestructura 2 ·
Otros 4 · Contingencias 2.

### Patrones (cómo se reparten las líneas)
- **0.5-espejo** (Imper, Inst. Eléctricas/Hidráulicas/Gas, Automat, Aire, Iluminación, Acabados, **Herreria**):
  1 ppto cubre ambas torres → 2 líneas, **cantidad 0.5 c/u, unitario = ppto total** (importe = mitad). Σ exacto
  (0.5+0.5), sin residual.
- **Por torre real** (Obra Civil, Albañilería) y **1 ppto × 2 torres** (Albercas, Griferías, Elevador,
  Infraestructura, Contingencias): 2 líneas (Torre 1 / Torre 2), `cantidad 1`, unitario = monto real de la torre.
- **N pptos × 2 torres**: Ingenierías (7 conceptos×2=14), Vidrios (4×2=8), Cocinas (3×2=6), Jardinería (2×2=4),
  Exteriores (6×2=12), Otros (2×2=4) — por **CONCEPTO** × torre; **Mármol** (Suministro/Colocación×torre=4) por
  **CATEGORÍA**; **Pilas** (Mano de Obra/Concreto/Varilla×torre=6) y **Garden** (Suministro/Instalación/Dalas×torre=6)
  por **DETALLE**. Concepto del item = `"{ppto} · Torre N"`.
- **Por madurez × torre**: Carpinterías 4 (Ppto T1/T2 + Paramétrico T1/T2).
- **Por concepto sin torre**: Arquitectura 2 (Diseño Arquitectónico = Diseño Arq + Cuantificación + Supervisión;
  Diseño Jardinería = Diseño Jard + su supervisión). Preliminares 3 (Despalme/Malla/Plataformas, suma ambas torres).
- **Condiciones Generales**: las 4 líneas **idénticas** al re-volcado agrupado (no se cambió, como pidió la spec).
- **Excavación / Madera**: 0 líneas (target $0). Grupos en $0 descartados en general.

### Estado / cuadre
- `kind`/`contratado` por línea = **dato real, dominante por dinero** del grupo → **Pilas parcial** (Torre 1
  contratado / Torre 2 no); Obra Civil, Arquitectura, etc. también parciales donde el dato lo indica.
- Línea en **MXN** (`cantidad × unitario` = importe; sobrecosto/iva 0; tc MXN=1). **Cuadre AL CENTAVO por
  partida** = mismos targets del preview/2b (el monto total no cambia, solo cómo se reparte). Residual de
  redondeo (≤$0.01 en algunas) absorbido en el grupo de mayor monto. **DO-block transaccional** recompone por
  partida y compara; **pasó 31/31, 109 líneas, L3 intacto** (rollback si fallaba).

### Decisiones / huecos de la spec (CONFIRMAR con Alfonso)
- La spec **no listaba Herreria ni Excavación**. **Excavación → 0 líneas** (target $0, como Madera). **Herreria
  → 0.5-espejo, 2 líneas paramétrico, $4.64M** (por consistencia con las otras "1 ppto"). **Revisar si Alfonso
  quiere otro grano para Herreria.**
- **Arquitectura:** Cuantificación ($67K) y las supervisiones ($0) se **doblaron en "Diseño Arquitectónico"**
  (la spec solo nombra 2 conceptos) para cuadrar; Diseño Jardinería = Diseño Jard + su supervisión.

### Aislamiento / verificación
- **Cleanup primero** (hard delete `buyout_item`→CASCADE quotes/lines + falta + import_batch de BF), idempotente.
  **NO toca el catálogo** (la creación de CONTINGENCIAS es no-op `WHERE NOT EXISTS`) · **L3 intacto** (24/8
  verificado) · **Pagos intacto**. Gate verde (`tsc`/`biome`/`build`). Sin read-back en vivo (service_role REST
  bloqueado para `buyout_*`); render queda tras login = **prueba de Alfonso**.

### Commit (feat/buyout, sin push)
`fix(buyout): re-volcado BF según spec de líneas por partida` — migración `20260629180000` +
`docs/future-modules/buyout-BF-lineas-spec.md` (spec fuente) + este STATE.

## 3 ajustes del Resumen BF (2026-06-29)

**Migración `20260629190000_buyout_bf_conceptos_descriptivos.sql`** (db push) + `src/lib/buyout/rollup.ts` +
`src/app/proyectos/[id]/buyout/page.tsx`. Tres pedidos de Alfonso sobre el Resumen / datos de BF.

### 1 · Contingencias FUERA del TOTAL (display, `page.tsx`)
- El gran **TOTAL** (y `$/m²`, `USD/m²`, `DIF`, el desglose y los totales de columnas de mes) ahora **excluye**
  la partida `CONTINGENCIAS`. Se separa en `mainPartidaViews` vs `adicionalViews` (predicado `esAdicional` por
  nombre; sin tocar datos) y el capítulo `CONTINGENCIAS` se quita de `mainChapters`.
- Se muestra en un bloque **aparte, debajo del total**: "Contingencias / Adicional · fuera del TOTAL" con su
  monto ($12,000,000) — como en el Excel (va bajo el TOTAL PRESUPUESTO). **Aplica a las 3 vistas** (se renderiza
  tras el bloque condicional de modo).

### 2 · Desglose del TOTAL por los 2 ejes (display, `page.tsx`)
- Dos tarjetas bajo el total (componentes `TotalEjesDesglose`/`DesgloseCard`), reusando las **cubetas YA
  calculadas por el rollup** (`agg.ppto/parametrico/contratado/noContratado`; suman al total → no se recalcula
  ni cambia ningún monto): **Madurez** (Ppto $233.5M · 56% / Paramétrico $186.7M · 44%) y **Contratación**
  (Contratado $96.8M · 23% / No contratado $323.4M · 77%). % del resto = complemento (sin descuadre). En modo
  **Contratación** se omiten (esa tabla ya lo desglosa por capítulo).

### 3 · Conceptos descriptivos sin torre + ESTADO POR LÍNEA (datos + rollup)
- Los `buyout_item` de BF pasaron a **nombres descriptivos del origen** (concepto/detalle: "Mano de Obra",
  "Suministro de Marmol", "Diseño Arquitectónico", "Despalme"…) **sin** el sufijo "· Torre X" ni estado. Los
  monolíticos (espejo/torre/madurez/Cond. Generales) usan un nombre limpio de partida ("Impermeabilización",
  "Carpinterías", …). La **torre vive en la columna** de la línea (`villa_casita`), no en el nombre.
- **Consolidación:** los duplicados por (partida, concepto) se fusionan en **1 item con sus líneas por torre**
  → **55 items / 109 líneas** (las mismas 109 líneas; antes 109 items 1:1). Cuadre por partida **idéntico**.
- **Estado POR LÍNEA (para no perder "parcial" al consolidar):** se agregaron columnas **nullable**
  `buyout_line.kind` (CHECK parametrico/ppto) y `buyout_line.contratado` (aditivas, idempotentes). El re-volcado
  setea el estado real por torre en cada línea. **`rollup.ts`** (`loadVigenteLines`) ahora lee
  `l.kind ?? q.kind` y `l.contratado ?? q.contratado` → con líneas sin estado (L3, captura manual) cae al de la
  cotización (**L3 idéntico**); con BF muestra el estado por torre. Así **PILAS sigue PARCIAL** (Torre 1
  contratada / Torre 2 no) pese a consolidar "Mano de Obra/Concreto/Varilla" en 1 item c/u. 10 partidas con eje
  parcial.
- **Aislamiento:** columnas aditivas/nullable (Pagos no usa `buyout_line`; L3 cae al fallback). Re-volcado
  filtra por `project_id` de BF, cleanup primero (idempotente). **NO toca catálogo · L3 idéntico · Pagos intacto.**

### Verificación
- **DB (autoritativa):** DO-block transaccional → `BF conceptos descriptivos OK: 55 items / 109 lineas; cuadre
  31 partidas; L3 intacto` (rollback si fallaba). Cuadre por partida = mismos targets del spec/preview.
- **Gate verde:** `tsc` ✓ · `biome` ✓ (158) · `pnpm build` ✓. Sin read-back en vivo (service_role REST
  bloqueado); render queda tras login = **prueba de Alfonso**.
- **Nota:** al editar manualmente una línea de BF en la UI, el form actual no toca `buyout_line.kind/contratado`
  (quedan con el valor cargado) — irrelevante para la revisión read-only; si se quiere editar el estado por línea
  desde la UI, es un paso aparte.

### Commit (feat/buyout, sin push)
`feat(buyout): contingencias fuera del total + desglose por ejes en total + conceptos descriptivos` —
migración `20260629190000` + `rollup.ts` + `buyout/page.tsx` + este STATE.
