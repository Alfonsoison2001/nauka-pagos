# Auditoría de calidad — Módulo Buy-Out (`feat/buyout`)

> **Fecha:** 2026-06-29 · **Rama:** `feat/buyout` (27 commits sobre `main`, **sin push**) ·
> **Alcance:** auditoría READ-ONLY de todo el módulo Buy-Out antes de mergear a `main`.
> **Naturaleza:** no se modificó ni "arregló" nada; las recomendaciones se anotan, no se implementan.
> **Método:** lectura directa de cada archivo del diff `main..feat/buyout` (46 archivos) + verificación
> adversarial de cada afirmación contra el archivo real (se cita `archivo:línea`). Las decisiones
> conscientes documentadas en `SPEC-buyout.md`/`STATE-buyout.md` **no** se reportan como bug.

---

## 1. Resumen ejecutivo

El módulo está **bien diseñado y, sobre todo, bien aislado de Pagos**: el diff toca 46 archivos pero
los **únicos** archivos compartidos modificados son de navegación (`sidebar.tsx` reorg, `project-topbar.tsx`
+1 línea, `package.json` script `dev`); **cero** páginas/acciones/libs/migraciones de Pagos cambian. Las
migraciones son 100% aditivas, las 16 tablas `buyout_*` tienen RLS correcta (lectura `authenticated`,
escritura `is_admin()`), el puente respeta las columnas generadas de Pagos y la idempotencia, y el rollup
tiene una sola fuente de verdad. La salud base es **buena**; el riesgo concentrado no está en el diseño
sino en la **robustez operativa** de las escrituras.

**Los 3 riesgos más importantes:**

1. 🔴 **Corrupción silenciosa de dinero hacia Pagos por TC=1.** Si falta el tipo de cambio de la moneda de
   una línea (USD/EUR), el código cae a `tc = 1` sin avisar y escribe un contrato ~17–20× subestimado en
   `partidas.presupuesto_sin_iva`. Es la **única ruta que escribe dinero en Pagos** y el `buyout_fx` solo
   está sembrado para Lote 3 → cualquier línea USD/EUR en Lote 44 / Beachfront / proyecto nuevo se corrompe.
2. 🟠 **Escrituras multi-paso sin transacción.** Varias acciones hacen 2–4 escrituras sin atomicidad; ante
   un fallo parcial pueden dejar un concepto **sin cotización vigente** (desaparece del tablero sin aviso),
   perder la foto de un mes o dejar un contratista huérfano en Pagos.
3. 🟠 **El puente puede "adoptar" una partida MANUAL de Pagos por coincidencia de nombre** y luego
   sobrescribir su monto/IVA/fecha al re-sincronizar — ruta de pérdida de datos en Pagos.

Ninguno de los 26 hallazgos rompe el esquema de Pagos ni evade la RLS; el peor (TC=1) es **latente** para el
proyecto activo (L3 sí tiene sus 3 monedas sembradas) pero **vivo** para el resto. Recomendación global:
resolver los _silent fallbacks_ y la atomicidad antes del merge; el resto puede ir como deuda post-merge.

**Conteo:** 🔴 1 · 🟠 4 · 🟡 7 · ⚪ 14 (26 hallazgos confirmados; 3 candidatos descartados, ver §7).

---

## 2. Veredicto de aislamiento (FOCO #5) — ✅ PASA

Verificado en el diff, en las migraciones y en el código runtime:

- **Archivos de Pagos modificados:** ninguno con lógica. Solo `src/components/sidebar.tsx` (reagrupar nav en
  Pagos/Buy-Out/General + ocultar "Resumen Mensual" con flag, ruta viva), `src/components/project-topbar.tsx`
  (+1 entrada `buyout: "Buy-Out"` en `TITLES`) y `package.json` (script `dev` con `open`/`nc`, macOS).
- **Migraciones:** 100% aditivas. Los `UPDATE` de las migraciones 2c/3a tocan **solo** tablas `buyout_*`
  (reconciliación de taxonomía/limpieza), nunca `projects/partidas/contratistas/estimaciones`. La única
  referencia a Pagos es el FK nullable `buyout_quote.pagos_partida_id → public.partidas ON DELETE SET NULL`
  (`20260618183133_buyout_schema_and_seeds.sql:188`), que no altera `partidas`.
- **El puente SÍ escribe en `contratistas`/`partidas` de Pagos** (es su propósito, §8 del spec) pero reusa su
  estructura: no inserta columnas generadas, respeta el índice único parcial y el soft-delete. Los hallazgos
  BO-01/02/12 son sobre la **robustez** de esa escritura, no sobre tocar el esquema de Pagos.

---

## 3. Hallazgos por dimensión

> Formato: **ID · severidad** · `archivo:línea` — qué está mal · por qué importa · recomendación (no implementada).

### 3.1 Correctitud e integridad de datos (multimoneda · cuadre)

**BO-01 · 🔴 Crítico** · `src/app/proyectos/[id]/buyout/subcategoria/contrato-actions.ts:75-89` (escritura a
Pagos) · espejo en `src/lib/buyout/rollup.ts:216-217` (display) · seed en
`supabase/migrations/20260618183133_buyout_schema_and_seeds.sql:432-445`.
**Qué:** al resolver el tipo de cambio, `const rate = (fxRows ?? []).find(r => r.currency === moneda)?.rate`
queda `undefined` si la moneda no tiene fila en `buyout_fx`, y luego `tc: Number(rate ?? 1)` cae a **1**. El
monto que se escribe en `partidas.presupuesto_sin_iva` se calcula entonces como `(M+O)×1` en vez de `(M+O)×TC`.
Además el `error` de la consulta `buyout_fx` nunca se inspecciona.
**Por qué:** es la **única ruta que escribe dinero en Pagos**. Una línea de US$10,000 se registra como
$10,000 MXN (≈1/17 del valor real) **sin ningún aviso**, y el `presupuesto_con_iva` generado de Pagos deja de
cuadrar con el Total MXN del Buy-Out. La _reachability_ es concreta: el seed de `buyout_fx` está acotado con
`WHERE p.nombre = 'NAUKA Lote 3'` (línea 441) → **Lote 44, Beachfront y cualquier proyecto nuevo no tienen
ninguna fila de FX**, mientras el enum de moneda de la línea permite USD/EUR (`partida/actions.ts:63`). En L3
(activo, con MXN/USD/EUR sembrados) solo se dispara ante un error transitorio de la lectura de FX; fuera de L3,
ante cualquier línea en divisa.
**Recomendación:** no usar `1` como fallback para una divisa. Distinguir "MXN = 1" (correcto) de "divisa sin
TC configurado" y, en este último caso, abortar con error legible ("Falta tipo de cambio para {moneda}").
Inspeccionar `.error` de la consulta `buyout_fx`. Sembrar `buyout_fx` por proyecto (no solo L3).

**BO-02 · 🟠 Alto** · `contrato-actions.ts:218-252` (adopción) + `:294-303` (clobber por re-sync).
**Qué:** al crear el contrato, si ya existe una partida **viva** con el mismo `nombre` bajo ese contratista
(`prior`), el puente se **liga a ella** (guarda su `id` en `buyout_quote.pagos_partida_id`) sin verificar que
esa partida la haya creado el puente. Si esa partida fue capturada **manualmente** en Pagos y solo coincide en
nombre, queda adoptada; un `resincronizarContratoPagos` posterior **sobrescribe** su `presupuesto_sin_iva`,
`iva_pct` y `fecha_firma`.
**Por qué:** la decisión documentada "re-sync sobrescribe" está pensada para la partida que el puente creó, no
para pisar una partida manual preexistente. Es una ruta de **pérdida de datos en Pagos** que no requiere mala
intención, solo un nombre repetido.
**Recomendación:** distinguir partidas creadas por el puente de las manuales (p. ej. marcar el origen, o solo
reusar `prior` cuando provenga de una cotización buyout ya ligada). Como mínimo, no adoptar por nombre una
partida que no esté ya enlazada.

**BO-03 · 🟡 Medio** · `src/app/proyectos/[id]/buyout/actions.ts:123-154`.
**Qué:** al **recerrar** un mes, `cerrarMesActual` primero soft-deletea todas las filas vigentes del snapshot
y **después** inserta las nuevas, en dos statements sin transacción. Si el insert falla, la foto anterior ya
quedó dada de baja y el mes queda sin snapshots vigentes.
**Por qué:** pérdida (recuperable vía `deleted_at`) de la foto de un mes cerrado ante un fallo parcial; la UI
queda inconsistente hasta volver a cerrar.
**Recomendación:** hacer la sobreescritura atómica (RPC/transacción Postgres), o insertar las nuevas filas
antes de bajar las viejas cuidando el índice único parcial.

**BO-04 · ⚪ Bajo** · `src/lib/buyout/calc.ts:40-42` + `src/lib/buyout/pagos-link.ts:77`.
**Qué:** el puente guarda `presupuesto_sin_iva = round((M+O)×TC, 2)` y Pagos genera
`presupuesto_con_iva = round(presupuesto_sin_iva × (1+iva), 2)`; el Buy-Out muestra Total MXN como
`(M+O)(1+iva)×TC` **sin** redondeo intermedio de la base. El distinto orden de redondeo puede diferir 1 centavo.
**Por qué:** el spec promete cuadre "al centavo"; la diferencia es de 1 centavo y baja frecuencia, pero existe
(y en Buy-Out queda enmascarada porque la tabla muestra montos sin decimales).
**Recomendación:** unificar la convención de redondeo del cuadre o documentar la tolerancia de 1 centavo.

**BO-05 · ⚪ Bajo** · `supabase/migrations/20260624150000_buyout_partida_base_and_cleanup.sql:55-78`.
**Qué:** varios valores de base sembrados traen >2 decimales (p. ej. `1086537.0838`, `3607205.38123506`) y la
columna es `numeric(14,2)` → Postgres los redondea en silencio al insertar.
**Por qué:** el dato sembrado no es exactamente el del documento fuente; es base editable, así que el impacto es
mínimo, pero es una pérdida de precisión silenciosa en el seed.
**Recomendación:** sembrar ya redondeado a 2 decimales (o confirmar que la base debe ser el valor redondeado).

**BO-06 · ⚪ Bajo** · `src/app/proyectos/[id]/buyout/partida/actions.ts:235` (quote) + `:269` (line).
**Qué:** `buyout_quote.monto_sin_iva` se guarda como `cantidad × unitario` (sin sobrecosto); el sobrecosto solo
vive en `buyout_line.sobrecosto_pct`. El rollup y el puente calculan el total desde `buyout_line` (correcto),
pero `quote.monto_sin_iva` queda como una base parcial.
**Por qué:** hoy nadie lee `quote.monto_sin_iva` como base para dinero, así que no hay bug visible; sería una
trampa si una feature futura lo usara directo (no incluiría el sobrecosto).
**Recomendación:** documentar que la base de dinero se deriva de `buyout_line`, o persistir el sobrecosto en la
quote para que `monto_sin_iva` sea autoconsistente.

**BO-07 · ⚪ Bajo** · `src/lib/buyout/format.ts:18-19`.
**Qué:** `formatMXN0` hace `mxn0.format(value || 0)`; el `|| 0` (pensado para evitar `-$0`) también colapsa
`NaN`/`Infinity` a `$0`.
**Por qué:** un `NaN` propagado por un bug de cálculo aguas arriba se mostraría como un cero contable normal,
dificultando detectarlo.
**Recomendación:** tratar `!Number.isFinite(value)` como placeholder explícito (`—`), conservando `|| 0` solo
para `-0`.

### 3.2 Manejo de errores · atomicidad (ausencia de transacciones)

**BO-08 · 🟠 Alto** · `contrato-actions.ts:47-89` (mismo patrón en `src/lib/buyout/history.ts:82-91` y
`src/app/proyectos/[id]/buyout/page.tsx:50`).
**Qué:** `loadVigenteContrato` desestructura solo `{ data }` en sus 4 selects (`buyout_item`, `buyout_quote`,
`buyout_line`, `buyout_fx`) y nunca revisa `{ error }`. Un error real de Supabase (red/timeout/RLS) hace `data
= null` y el código lo confunde con "no encontrado"; en el caso de `buyout_fx` el error se traga y deriva en el
TC=1 de BO-01.
**Por qué:** diagnóstico engañoso y, peor, decisiones de negocio (abortar vs continuar con TC=1) tomadas sobre
un `null` que no distingue "no existe" de "falló la lectura" — en una ruta que escribe dinero.
**Recomendación:** comprobar `error` en cada select; ante error de lectura, devolver un mensaje distinto del
"no encontrado" y **no** continuar al cálculo/escritura.

**BO-09 · 🟠 Alto** · `src/app/proyectos/[id]/buyout/subcategoria/actions.ts:47-66`.
**Qué:** `marcarVigente` baja la vigente anterior (UPDATE, con check de error) y **después** sube la elegida
(2º UPDATE) y actualiza el item (3º), sin transacción. Si el 1º tiene éxito y el 2º falla, el concepto queda
con **todas** las cotizaciones en `is_selected=false`.
**Por qué:** `loadVigenteLines` filtra `is_selected=true`; un concepto sin vigente **desaparece del rollup** —
su total MXN deja de sumar en Resumen y Partida, descuadrando el tablero sin que nadie lo note.
**Recomendación:** envolver el swap (down + up + update item) en una sola transacción atómica (RPC/función
Postgres `SECURITY DEFINER` con check `is_admin()`).

**BO-10 · 🟠 Alto** · `src/app/proyectos/[id]/buyout/partida/actions.ts:217-256`.
**Qué:** en `insertVigenteQuoteAndLine` el orden es: (1) baja la vigente anterior; (2) inserta la nueva
cotización con `is_selected=true`; (3) actualiza `item.selected_quote_id`; (4) **sube el PDF**, y si el upload
falla hace `return { error }` (línea 252) **antes** de insertar `buyout_line` (línea 256).
**Por qué:** queda una cotización **vigente sin renglón** y la anterior ya fue degradada → `loadVigenteLines`
(join por `quote_id`) no devuelve nada para ese concepto, que **desaparece del tablero**. El PDF es opcional,
pero su fallo no debería tumbar la captura ni dejar estado parcial.
**Recomendación:** insertar `buyout_line` antes de subir el PDF (o no abortar ante fallo de upload, ya que el
PDF es opcional/progresivo); idealmente atomizar quote+line.

**BO-11 · 🟡 Medio** · `partida/actions.ts:217-243`.
**Qué:** la baja de la vigente previa (`UPDATE is_selected=false`) no captura `error`; si falló, el INSERT
siguiente choca contra el índice único parcial "1 vigente por item".
**Por qué:** no corrompe datos (el índice protege la invariante), pero el usuario ve un error crudo de
violación de índice, poco accionable, con la operación a medias.
**Recomendación:** capturar el error de la baja y abortar con mensaje claro; idealmente atomizar baja+alta.

**BO-12 · 🟡 Medio** · `contrato-actions.ts:212-244`.
**Qué:** `crearContratoPagos` resuelve/crea el contratista (INSERT si no existe) y **luego** inserta la
partida. Si el insert de partida falla (carrera del índice único, constraint, RLS, red), el contratista recién
creado queda en Pagos **sin partida** y sin rollback.
**Por qué:** deja basura en una tabla de Pagos (contratista fantasma) que ensucia los selectores de contratista
y la captura de Presupuesto.
**Recomendación:** agrupar contratista+partida+enlace en una transacción (RPC), o crear el contratista solo tras
validar que la partida se insertará.

**BO-13 · ⚪ Bajo** · `partida/actions.ts:475-508`.
**Qué:** tras el soft-delete de `buyout_line` (con check), las sub-operaciones (baja de la quote, query de la
versión previa, promoción/baja del item) se ejecutan sin capturar error.
**Por qué:** un fallo intermedio deja estado parcial (línea borrada pero quote aún vigente, o item sin vigente
promovida) reportando éxito.
**Recomendación:** capturar/propagar errores de cada sub-operación; idealmente atomizar.

**BO-14 · ⚪ Bajo** · `contrato-actions.ts:113-131`.
**Qué:** `resolveContratista` hace SELECT-luego-INSERT sin proteger contra la carrera del índice único parcial
`(project_id, nombre)`.
**Por qué:** caso poco frecuente (doble click / dos pestañas), mitigado por `disabled={pending}`, pero el error
resultante es un mensaje técnico de unique-violation.
**Recomendación:** usar `upsert` con `onConflict`, o capturar el código de unique-violation y reintentar el
SELECT.

**BO-15 · ⚪ Bajo** · `src/app/proyectos/[id]/buyout/subcategoria/contrato-pagos-panel.tsx:78-94`.
**Qué:** el árbol de render evalúa `link` → `!contratado` → `staleLink`. Cuando la cotización vigente tiene
`pagos_partida_id` pero la partida fue borrada en Pagos **y** el concepto ya no está contratado, cae en la rama
"Marca como Contratada" y nunca se muestra el aviso de enlace colgado.
**Por qué:** el usuario no recibe pista de que el enlace quedó stale; se le pide algo que ya hizo.
**Recomendación:** evaluar `staleLink` con independencia del estado de contratación.

### 3.3 Seguridad / RLS

**BO-16 · 🟡 Medio** · `partida/actions.ts:515-523` (RLS de storage:
`supabase/migrations/20260609201429_harden_storage_rls.sql:53-56`).
**Qué:** `getSignedBuyoutPdfUrl(pdfPath)` firma **cualquier** ruta del bucket privado `proyectos` (5 min) sin
validar rol, pertenencia al proyecto ni prefijo `buyout/`.
**Por qué (calibrado):** **no es una brecha nueva de confidencialidad**: la RLS de storage concede `SELECT` del
bucket `proyectos` a **todo** `authenticated` por decisión documentada ("lectura abierta", security-audit
2026-06-08), así que cualquier usuario ya puede firmar cualquier objeto. Es un hueco de **defensa en
profundidad / menor privilegio**: la acción no añade ninguna validación y se volvería un bypass real el día que
se endurezca la lectura de storage por proyecto.
**Recomendación:** validar que `pdfPath` corresponde a una cotización buyout visible para el usuario (o al menos
exigir el prefijo `{projectId}/buyout/`), para no depender solo de la lectura abierta.

**BO-17 · 🟡 Medio** · `partida/actions.ts` (`createLinea` :281, `addBudgetVersion` :338, `updateLinea` :390,
`deleteLinea` :459) + `buyout/actions.ts:22-60` (`setPartidaBase`).
**Qué:** estas 5 Server Actions de escritura **no** llaman `getMyProfile()`/`role==='admin'` en el servidor,
a diferencia de todas sus hermanas del módulo (`cerrarMesActual`, `reabrirMes`, `setMonthSnapshot`,
`marcarVigente`, `crearContratoPagos`…).
**Por qué:** la RLS `is_admin()` sobre las tablas `buyout_*` es el backstop real y **bloquea** la escritura de
un no-admin, así que no hay escalación de privilegios; pero rompe el patrón de defensa en profundidad de
CLAUDE.md y un no-admin recibiría un error **crudo** de Postgres (RLS) en vez de un mensaje legible.
**Recomendación:** añadir el mismo guard de admin al inicio de las 5 acciones.

**BO-18 · 🟡 Medio** · `partida/actions.ts:407-449`.
**Qué:** `updateLinea`/`addBudgetVersion` actualizan `buyout_quote`/`buyout_line` filtrando solo por `id`, sin
verificar que la cotización pertenezca al `projectId` recibido, mientras la ruta del PDF se construye **con** ese
`projectId`.
**Por qué:** la RLS gobierna por rol pero no por proyecto; un `projectId` equivocado/manipulado podría guardar el
PDF bajo el prefijo de **otro** proyecto, desalineando objeto y registro.
**Recomendación:** resolver el item/proyecto de la cotización y validar que coincide con `projectId` antes de
escribir (como sí hace `addBudgetVersion` con el item).

**BO-19 · ⚪ Bajo** · `contrato-actions.ts:175-178` y `:269-272` (documentación en `STATE-buyout.md`).
**Qué:** la doc afirma que el admin-only de las escrituras a Pagos "lo refuerza la RLS de
`contratistas`/`partidas`". En realidad esas tablas de Pagos tienen RLS de **todo `authenticated`** (sin
distinción de rol), por lo que el **único** control admin de esas escrituras es el `getMyProfile()` del servidor.
**Por qué:** aceptable hoy (ambos usuarios son admin), pero la defensa en profundidad documentada es más débil de
lo que sugiere el texto; si entrara un rol no-admin, la RLS de Pagos **no** lo frenaría en esas tablas.
**Recomendación:** corregir la nota; si se quiere defensa real, restringir por rol también en las escrituras a
Pagos (o aceptarlo explícitamente).

**BO-20 · ⚪ Bajo** · `buyout/actions.ts:37-55`.
**Qué:** `setPartidaBase` inserta `buyout_partida_base (project_id, partida_catalog_id)` sin verificar que el
`partida_catalog_id` esté vigente (catálogo global, sin `project_id`).
**Por qué:** un admin podría sembrar base para una partida que el proyecto no muestra; no corrompe Pagos ni el
rollup vivo, pero es una fila sin sentido.
**Recomendación:** validar `partida_catalog_id` vigente (`deleted_at IS NULL`) antes del upsert.

### 3.4 Fronteras server/client

**BO-21 · ⚪ Bajo** · `src/app/proyectos/[id]/buyout/month-cell.tsx:37-44` + `base-cell.tsx:23-31`.
**Qué:** `MonthCell`/`BaseCell` siembran `value` con `useState(monto)` y solo se actualizan al guardar; el prop
`monto` re-validado por `revalidatePath` no re-sincroniza el estado local (estado derivado de props sin sync).
**Por qué:** en la práctica el valor tecleado y el persistido coinciden, pero ante ediciones concurrentes o
redondeo el display local podría divergir del servidor.
**Recomendación:** derivar el display del prop (ya re-validado) o sincronizar con `key`/`useEffect`.
**Nota:** el resto de fronteras server/client del módulo están **limpias** (los `"use client"` solo importan las
Server Actions; ningún componente cliente importa el cliente SSR ni expone secretos) — ver §5.

### 3.5 Type-safety

**BO-22 · ⚪ Bajo** · `src/lib/buyout/rollup.ts:219-250` + `src/lib/buyout/history.ts:149-152`.
**Qué:** las filas de Supabase llegan sin tipar y se castean campo a campo (`l.id as string`,
`q?.kind as "parametrico"|"ppto"`, `Map<string, Record<string, unknown>>`). Un cambio de columna no rompería la
compilación.
**Por qué:** justo en el camino que debe "cuadrar con Partida y Resumen", el contrato esquema↔tipo se sostiene
por convención, no por el compilador.
**Recomendación:** tipar las filas (tipos generados de supabase-js o `Row` explícito) y validar `kind` contra el
set permitido.

**BO-23 · ⚪ Bajo** · `src/app/proyectos/[id]/buyout/partida/linea-form.tsx:373-381` (step) y `:44-74` (Zod).
**Qué:** el input de IVA usa `step="1"` mientras el esquema persiste `numeric(5,4)` y acepta decimales; además
el `formSchema` (cliente) y `baseSchema` (servidor) son dos esquemas Zod mantenidos a mano con pequeñas
asimetrías (`concepto_otro`, defaults).
**Por qué:** un IVA fraccionario válido requeriría sortear el `step`; los esquemas duplicados pueden derivar.
**Recomendación:** alinear el `step` (0.01) si se desea IVA fraccionario; derivar ambos esquemas de una fuente
común o documentar la correspondencia.

### 3.6 Performance

**BO-24 · 🟡 Medio** · `src/app/proyectos/[id]/buyout/page.tsx:104` (+ cascada `:104-202`).
**Qué:** el Resumen encadena round-trips evitables: `await isAdmin()` corre **antes** del `Promise.all` y abre un
**segundo** `createClient` con sus 2 queries (`auth.getUser` + `profiles`); `loadClosedMonths` también queda
fuera del batch.
**Por qué:** latencias en serie en el render del tablero; `isAdmin()` y `loadClosedMonths` no dependen de la
salida del batch y podrían paralelizarse.
**Recomendación:** plegar `isAdmin()` y `loadClosedMonths(sb, id)` dentro del `Promise.all` existente (dejar
`loadPartidaAggs`/`loadSnapshots` por sus dependencias).

### 3.7 Estructura / mantenibilidad

**BO-25 · ⚪ Bajo** · `page.tsx:77-462` (`BuyoutResumenPage` ~385 líneas) y `:499-617` (`ChapterGroup` ~118
líneas).
**Qué:** dos componentes exceden con mucho el límite de **80 líneas** de CLAUDE.md; mezclan fetch, derivación de
los modelos de vista y todo el render del modo Vigente inline.
**Por qué:** mantenibilidad; es el archivo más difícil de tocar sin regresión del módulo.
**Recomendación:** extraer la tabla del modo Vigente a su propio componente y mover el armado de
`evoChapters`/`contraChapters` a helpers puros.

### 3.8 UX / robustez

**BO-26 · ⚪ Bajo** · `page.tsx:85-93`.
**Qué:** `modo`/`meses` se leen de `searchParams` sin normalizar; un valor arbitrario degrada al default por la
cascada de ternarios (seguro, pero implícito).
**Por qué:** robustez/legibilidad; no hay validación formal del set permitido.
**Recomendación:** normalizar (lowercase/trim) o validar contra un set permitido.

---

## 4. FOCO ESPECIAL — veredicto por área

| # | Área de foco | Veredicto | Hallazgos |
|---|---|---|---|
| 1 | **Puente a Pagos** (no corromper Pagos) | ⚠️ **Riesgo real** | Estructura/idempotencia/columnas-generadas/soft-delete: **correctos**. Pero TC=1 (BO-01) puede escribir monto corrupto, el reuso por nombre puede pisar una partida manual (BO-02) y faltan transacciones (BO-08/12). El **cuadre al centavo** se cumple salvo el redondeo de BO-04. |
| 2 | **Rollup y cálculos** | ✅ **Sólido** (1 caveat) | partida→capítulo→TOTAL, $/m², USD, DIF, cubetas y % **cuadran por construcción** (misma `aggregateLines`, complemento derivado). "Sin decimales" es **solo display** (`calc.ts` no redondea). Caveat: TC=1 (BO-01) y redondeo (BO-04). |
| 3 | **RLS / grants / esquema** | ✅ **Sólido** | 16/16 tablas `buyout_*` con RLS + escritura `is_admin()` + grants solo a `authenticated` (incl. las 2 tablas de migraciones posteriores). Migraciones aditivas, dinero `numeric(14,2)`, FKs indexadas, índices únicos parciales correctos. Hueco de menor privilegio: BO-16/17/18. |
| 4 | **Corte mensual / snapshots** | ✅ **Sólido** (1 caveat) | Congelado correcto (misma fuente que el rollup), conceptos nuevos en $0 en meses previos, reabrir/recerrar aislados y reversibles, edición inline admin valida pertenencia. Caveat: recerrado no atómico (BO-03), `setPartidaBase` sin guard server (BO-17). |
| 5 | **Aislamiento de Pagos** | ✅ **Pasa** | Ver §2. Cero lógica de Pagos modificada; migraciones no tocan tablas de Pagos. |

---

## 5. Lo que está sólido (verificado, no es exhaustivo)

- **Aislamiento de Pagos** a nivel diff, migración y runtime (§2).
- **RLS completa y consistente** en las 16 tablas `buyout_*`; `is_admin()` es `SECURITY DEFINER STABLE` sin
  recursión; grants solo a `authenticated`; ningún grant a `anon`/`service_role`.
- **Columnas generadas de Pagos respetadas**: el puente solo escribe `presupuesto_sin_iva`, `iva_pct`,
  `fecha_firma`; nunca `iva_monto`/`presupuesto_con_iva`.
- **Idempotencia del puente** y del cierre de mes; **validación de pertenencia al proyecto** en `marcarVigente`,
  `loadVigenteContrato`, `setMonthSnapshot`.
- **Una sola fuente de rollup** (`loadVigenteLines`/`aggregateLines`) compartida por Partida, Resumen, cierre e
  historial → no pueden divergir; cubetas y % **cuadran exactamente** (complemento derivado, sin descuadre por
  redondeo).
- **Invariante "1 vigente por item"** garantizada por índice único parcial en DB.
- **`difPct` protege contra división por base 0/negativa**; `$/m²` y `USD/m²` con checks de área/TC.
- **Fronteras server/client limpias**: los `"use client"` solo importan Server Actions; el cliente Supabase
  siempre vía helper SSR.
- **Sin `console.log`** de depuración en el código de producción del módulo; PDFs con ruta determinista
  `{projectId}/buyout/{quoteId}.pdf` y validación de tipo/tamaño en servidor.

---

## 6. Tabla final priorizada

| # | Sev | Hallazgo | Archivo:línea | Acción recomendada |
|---|-----|----------|---------------|--------------------|
| BO-01 | 🔴 | TC ausente cae a 1 → contrato USD/EUR ~17–20× subestimado en Pagos (silencioso) | `contrato-actions.ts:75-89` · `rollup.ts:216-217` | No usar 1 como fallback de divisa; abortar si falta TC; revisar `.error`; sembrar FX por proyecto |
| BO-02 | 🟠 | Reuso por nombre adopta partida MANUAL de Pagos; re-sync la sobrescribe | `contrato-actions.ts:218-252,294-303` | Solo reusar partidas creadas por el puente / ya ligadas |
| BO-08 | 🟠 | Selects que alimentan dinero ignoran `.error` (error = "no encontrado") | `contrato-actions.ts:47-89` | Revisar `error` en cada select; no continuar al cálculo |
| BO-09 | 🟠 | `marcarVigente` no atómica → concepto sin vigente desaparece del rollup | `subcategoria/actions.ts:47-66` | Atomizar el swap (RPC/transacción) |
| BO-10 | 🟠 | Captura: fallo de PDF aborta antes de insertar la línea → concepto sin renglón | `partida/actions.ts:217-256` | Insertar línea antes del PDF / no abortar por PDF |
| BO-03 | 🟡 | Recerrar mes no atómico → foto perdida si falla el insert | `buyout/actions.ts:123-154` | Atomizar baja+insert del snapshot |
| BO-11 | 🟡 | Baja de vigente sin check de error → choque con índice único | `partida/actions.ts:217-243` | Capturar error y abortar con mensaje claro |
| BO-12 | 🟡 | Contratista huérfano en Pagos si falla el insert de partida | `contrato-actions.ts:212-244` | Transacción contratista+partida+enlace |
| BO-16 | 🟡 | URL firmada de cualquier objeto de `proyectos` sin validar (defensa en profundidad) | `partida/actions.ts:515-523` | Validar prefijo/pertenencia del path |
| BO-17 | 🟡 | 5 Server Actions de escritura sin guard admin server-side | `partida/actions.ts:281,338,390,459` · `buyout/actions.ts:22` | Añadir `getMyProfile` admin guard |
| BO-18 | 🟡 | `updateLinea`/`addBudgetVersion` no validan quote∈projectId (ruta de PDF cruzada) | `partida/actions.ts:407-449` | Validar proyecto de la cotización |
| BO-24 | 🟡 | Cascada de queries secuenciales en el Resumen (isAdmin + closedMonths) | `page.tsx:104,104-202` | Plegar en el `Promise.all` |
| BO-04 | ⚪ | Posible descuadre de 1 centavo por orden de redondeo | `calc.ts:40-42` · `pagos-link.ts:77` | Unificar redondeo o documentar tolerancia |
| BO-05 | ⚪ | Seeds de base con >2 decimales se redondean en silencio | `…partida_base_and_cleanup.sql:55-78` | Sembrar redondeado a 2 decimales |
| BO-06 | ⚪ | `quote.monto_sin_iva` no incluye sobrecosto | `partida/actions.ts:235,269` | Documentar/persistir sobrecosto en quote |
| BO-07 | ⚪ | `format.ts` colapsa NaN/Infinity a $0 | `format.ts:18-19` | Placeholder `—` para no-finitos |
| BO-13 | ⚪ | `deleteLinea` no captura errores de sub-operaciones | `partida/actions.ts:475-508` | Capturar/propagar errores; atomizar |
| BO-14 | ⚪ | `resolveContratista` no maneja carrera del índice único | `contrato-actions.ts:113-131` | upsert onConflict / retry |
| BO-15 | ⚪ | `staleLink` no se muestra si la partida borrada y concepto no contratado | `contrato-pagos-panel.tsx:78-94` | Evaluar `staleLink` antes de `!contratado` |
| BO-19 | ⚪ | Doc: la RLS de Pagos no "refuerza" admin (es all-authenticated) | `contrato-actions.ts:175-178,269-272` | Corregir nota / restringir por rol |
| BO-20 | ⚪ | `setPartidaBase` no valida `partida_catalog_id` vigente | `buyout/actions.ts:37-55` | Validar catálogo vigente |
| BO-21 | ⚪ | `MonthCell`/`BaseCell`: useState espejo sin re-sync con prop | `month-cell.tsx:37-44` · `base-cell.tsx:23-31` | Derivar display del prop revalidado |
| BO-22 | ⚪ | Casts `as` sobre filas Supabase sin tipar | `rollup.ts:219-250` · `history.ts:149-152` | Tipar filas / validar `kind` |
| BO-23 | ⚪ | IVA `step=1` vs `numeric(5,4)`; Zod cliente/servidor duplicados | `linea-form.tsx:373-381,44-74` | Alinear step / fuente común de Zod |
| BO-25 | ⚪ | `page.tsx`: componentes >80 líneas (CLAUDE.md) | `page.tsx:77-462,499-617` | Extraer tabla Vigente y helpers |
| BO-26 | ⚪ | `searchParams` modo/meses sin sanitizar | `page.tsx:85-93` | Normalizar/validar set permitido |

---

## 7. Candidatos descartados (transparencia)

Verificados contra el archivo real y **descartados** (no se reportan como bug):

- **`loadConceptoIndex` cuenta versiones por `item_id` sin re-validar proyecto** (`history.ts:185-195`) —
  verificado: los `itemIds` provienen de `loadVigenteLines` del mismo proyecto; el propio hallazgo admitía que
  "no es un bug de pertenencia". **No es bug.**
- **Re-ejecución de la migración de taxonomía deja 0 partidas** (`20260624130000_…sql:70-72`) — el `UPDATE` de
  soft-delete es incondicional, pero Supabase no re-aplica migraciones ya registradas y el INSERT de las 24
  reactiva por nombre; el desenlace "catálogo vacío" no se materializa en el flujo real. **Descartado.**
- **`CASITA`/`PISO HIDRONICO` con `chapter_default='OTROS'`** (`20260624130000_…sql:102-103`) — el capítulo
  `OTROS` **sí** se siembra para L3; es además una decisión de catálogo documentada. **Descartado.**

---

*Auditoría READ-ONLY. No se modificó código. Único entregable: este reporte.*
