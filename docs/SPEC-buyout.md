# SPEC — Módulo Buy-Out (control de compras de obra)

> **Estado:** V1 en diseño · Owner: Alfonso + Jessica · Basado en el archivo real
> `NAUKA - BUY OUT L3 150626.xlsx` (ver `docs/future-modules/buyout-L3-estructura.md`).
> Reconcilia el pivote del 18-jun con el draft `cotizaciones-spec-draft.md`.

## 0. Regla de trabajo de esta fase (IMPORTANTE)

- **Rama propia, sin push.** Todo el desarrollo va en `feat/buyout`, commits locales,
  **NUNCA push a `main`**. Así Vercel/prod (la web) nunca se enteran hasta que Alfonso apruebe.
- **DB: opción B — tablas en la base real, pero invisibles.** Las migraciones `buyout_*` se
  aplican a la base de prod (son **aditivas y nullable**, no tocan ninguna tabla/RLS de
  Pagos), pero como la pantalla NO se sube (sin push), nadie las ve. Si no gusta → down
  migration que las borra, limpio. (Se descartó Supabase local por la fricción de Docker.)
- **Cero impacto en Pagos.** Tablas nuevas con prefijo `buyout_`, aditivas. No se toca
  ninguna tabla, RLS, ni componente de Pagos.
- **Arrancar con Lote 3** (el proyecto más avanzado, con archivo real para validar).

## 1. Qué es

Capa de seguimiento sobre el Excel BUY OUT, **no un reemplazo**. El Excel sigue siendo la
verdad de los números; el sistema agrega lo que el Excel hace mal: historial fechado,
estado/contratado, "qué falta", multi-proyecto, $/m², comparación de proveedores, y el
**cuadre con lo contratado/pagado de Pagos**.

## 2. Modelo mental (3 capas + cruce con Pagos)

```
Cotización de proveedor (fecha + PDF + renglones)   → la "cotización fechada"
        ↓ (vigente)
Concepto/subcategoría dentro de una partida          → toma el número de la cotización vigente
        ↓ (rollup)
Tablero BUY OUT (capítulos → partidas → total, $/m²) → el resumen
        ↓ (al marcar CONTRATADO)
Contrato en PAGOS (contratista + presupuesto + estim.) → el cruce
```

La distinción Excel "tab verde vs tab PU" **se colapsa**: todo es **una cotización con sus
renglones**. Que el detalle se teclee en la verde o viva en un PU es solo presentación.

## 3. Conceptos centrales

- **Unidad mínima = la cotización fechada** (`buyout_quote`): proveedor + fecha + moneda +
  tipo + estado + PDF + sus renglones. Una subcategoría tiene muchas cotizaciones en el
  tiempo y entre proveedores; **una es la vigente**.
- **El detalle (renglón) es opcional/progresivo.** Tres niveles:
  1. solo **total** (+PDF) — para paramétrico o partidas simples;
  2. **renglones tecleados** (como Carpinterías/Griferías);
  3. **desglose importado** del tab.
- **Estado = 2 ejes independientes** (como las columnas V y W del Excel):
  - `madurez`: `parametrico` (estimado tecleado, sin cotización real) → `ppto` (respaldado
    por cotización);
  - `contratacion`: `no_contratado` → `contratado`.
  - El estado de la **partida** es agregado: `parcial` cuando hay mezcla (ej. mármol:
    suministro contratado + colocación en ppto).
- **Jerarquía:** Proyecto → Capítulo → Partida (catálogo) → Subcategoría (concepto) →
  Renglón (las 22 columnas).
- **Dimensión unidad** (Villa/Casita · Piso · Depto): existe en el Excel (cols E/F/G).
  El esquema la soporta siempre; la UI la muestra solo donde aplica (BF/L3 con Casita).
- **Multimoneda:** MXN / USD / EUR con tabla de TC (del glosario). El renglón guarda moneda
  e importe; el total MXN sale del TC.

## 4. Modelo de datos (tablas `buyout_*`)

> Todas con `id uuid pk default gen_random_uuid()`, `created_at`, `deleted_at` (soft-delete),
> y triggers de `audit_log` como el resto del proyecto. Dinero en `numeric(14,2)`.

- **`buyout_project_meta`** (1:1 con `projects`): `area_int`, `area_ext_techada`,
  `area_ext_pav`, `programa` (texto/fechas). Áreas para $/m².
- **`buyout_fx`**: `project_id`, `currency` (MXN/USD/EUR), `rate`. (L3: USD 17.5, EUR 20.5.)
- **`buyout_chapter`**: `project_id`, `nombre`, `orden`. Los capítulos del tablero (DISEÑO,
  OBRA CIVIL, MEP, ACABADOS, COLOCACIONES, ALBERCAS, JARDINERÍA, OTROS…).
- **`buyout_partida_catalog`** (catálogo global, las ~26): `nombre`, `chapter_default`,
  `unidad_driver`, `orden`. Alimenta los dropdowns.
- **`buyout_supplier`** (GLOBAL, compartido entre proyectos): `nombre`, `rfc?`, `notas`.
- **`buyout_unit`**: `project_id`, `tipo` (villa/casita/torre/depto), `nombre`, `area_int?`.
  La dimensión unidad. L3/L44 usan villa(+casita); BF añade torres/deptos.
- **`buyout_item`** (la subcategoría): `project_id`, `partida_catalog_id`, `chapter_id`,
  `concepto` (texto), `unit_id?`, `selected_quote_id?`. Estado = derivado de la cotización
  vigente.
- **`buyout_quote`** (la cotización fechada — unidad mínima): `item_id`, `supplier_id?`,
  `quote_date`, `currency`, `kind` (`parametrico`/`ppto`), `is_selected` (vigente),
  `contratado` (bool) + `contract_number?`, `pdf_url?`, `notas`, `import_batch_id?`,
  `monto_sin_iva` (suma de renglones o tecleado), `iva_pct`. **`pagos_partida_id?`** ← el
  hilo a Pagos (ver §8).
- **`buyout_line`** (renglón, opcional): `quote_id`, y las 22 col: `categoria`, `concepto`,
  `detalle`, `villa_casita`, `piso`, `depto`, `proveedor`, `unidad`, `cantidad`, `moneda`,
  `unitario`, `sobrecosto_pct`, `iva_pct`, `notas`. Calculados (importe, iva, total, total
  mxn) se derivan, no se guardan duplicados.
- **`buyout_import_batch`**: `project_id`, `partida_catalog_id`, `filename`, `imported_at`,
  `imported_by`. Trazabilidad/rollback del import.
- **`buyout_falta`** ("qué falta"): `partida` (o item), `texto` (libre). Sin categorías ni
  gates. Un renglón por partida no contratada.
- **`buyout_month_close`**: `project_id`, `periodo` (yyyy-mm), `closed_at`, `closed_by`,
  `reopened_at?`. Marca el cierre manual del mes.
- **`buyout_month_snapshot`**: `month_close_id`, `partida_catalog_id`, `total_mxn`. La "foto"
  congelada del total vigente por partida en ese mes (alimenta la vista Evolución).

### Estado derivado
- Item `madurez` = de su `selected_quote.kind` (sin cotización real → `parametrico`).
- Item `contratacion` = `selected_quote.contratado`.
- Partida = agregado de sus items: `parcial` si hay mezcla.

### Rollup (lo que hoy hacen los SUMIFS)
renglón → cotización (Σ renglones) → item (cotización vigente, a MXN vía TC) → partida →
capítulo → total. `$/m² = total ÷ area_int`. `USD = total ÷ TC`. Mes = filtro por
`quote_date`.

## 5. Captura de datos (V1 = MANUAL, no import de Excel)

> **Cambio de enfoque (23-jun):** V1 NO parsea el Excel. El Excel sigue siendo el master del
> detalle fino; el sistema captura el **resumen** a mano. Esto quita el mayor riesgo (parsear
> las 22 col, sobre todo las que jalan de tabs PU) y acelera V1. El parseo del Excel queda
> como capa **opcional/futura**; la tabla `buyout_line` ya existe, solo no se llena en bloque.

- **Grano = una línea por concepto** (subcategoría), capturada a mano. No se mete el detalle
  itemizado (cada ventana/placa); para eso está el PDF.
- **Formato de las 22 columnas (se mantienen).** Al agregar una línea, el usuario llena los
  campos de entrada del formato verde: concepto (del glosario) · detalle · villa/casita · piso
  · depto · proveedor · unidad · cantidad · moneda · $ unitario · sobrecosto% · iva% · notas ·
  estado madurez (paramétrico/ppto) · estado contratación (contratado/no). El sistema
  **calcula** importe, $IVA, importe total, TC y total MXN (igual que las fórmulas del Excel).
- **PDF a nivel cotización (proveedor).** El PDF del ppto se adjunta a la cotización; varias
  líneas del mismo proveedor comparten su PDF. PDF **opcional/progresivo**.
- **Paramétrico:** si no hay proveedor/cotización real, la línea se marca `paramétrico`
  (estimado tecleado). Cuando llega la cotización real, se agrega una versión `ppto` nueva
  fechada y se marca vigente → el concepto pasa de paramétrico a ppto sin perder historial.
- **Proveedores:** se eligen del catálogo global; si es nuevo, se crea al vuelo.
- **Presupuesto base:** se captura/edita por partida como referencia fija (de la columna
  `PRESUPUESTO IZ MXN BASE` del tablero) contra la que compara el DIF.
- **Re-captura de un concepto = versión nueva fechada** (conserva la anterior; la nueva entra
  como vigente sujeta a confirmación) → de ahí salen historial y evolución.

> Import de Excel (parseo del tab con preview + "cuadra al centavo") = **diferido a una fase
> futura** si la captura manual se vuelve pesada. No es V1.

## 6. Pantallas (3 espacios + agregar)

> **Énfasis del módulo: es principalmente INFORMATIVO** (un tablero para *ver*, no tanto para
> capturar). Las señales que deben saltar a la vista: **última actualización / fecha** de cada
> ppto, **contratado vs no contratado**, **ppto vs paramétrico**, e **historial de pptos**.

1. **Resumen** (formato BUY OUT): capítulos → partidas con Concepto · Proveedor · Ppto Base ·
   Ppto [mes] · Dif · $/m² · **Última actualización (fecha de la cotización vigente)** ·
   **Estado** (muestra los 2 ejes: ppto/paramétrico + contratado/no), subtotales, TOTAL, y
   $/m² + USD/m² al pie.
   Modos: **Vigente** / **Evolución** / **Contratado vs No** / **Qué falta**.
   - **Evolución** = columnas por mes + Dif, donde cada mes es un **cierre manual** ("toma la
     foto" del total vigente por partida). El admin puede **reabrir/corregir** un mes cerrado.
     - **Conceptos/partidas nuevos:** si un concepto se agrega después, en los meses
       **anteriores a su creación aparece en 0** (la rejilla alinea todas las filas en todos
       los meses y rellena 0 donde aún no existía). Así la comparación mes a mes nunca se
       descuadra ni deja huecos.
   - **Contratado vs No** = % avance **por dinero** (Σ contratado ÷ Σ total).
   - **Qué falta** = nota de **texto libre** por partida no contratada (sin categorías ni
     gates).
2. **Página de Partida** (formato verde): las 22 columnas; "Agregar renglón" (concepto del
   glosario); fila Total.
3. **Subcategoría (historial):** versiones de la cotización por fecha (cada una con su PDF),
   la vigente resaltada, comparativo de proveedores, botón **marcar contratado**.

## 7. Catálogos a sembrar (seed)

- ~26 **partidas** canónicas (del glosario L3).
- **Capítulos** del tablero.
- **Unidades** (M2, ML, PZA, Lote, Servicio, Mes, Semana).
- **Monedas + TC** (MXN 1, USD 17.5, EUR 20.5).
- Extensibles por admin.

## 8. Cruce con Pagos (el cuadre)

La vida de una partida: **Estimado → Cotizado → Contratado → Pagado.** Los 2 primeros viven
en Buy-Out; el 4º en Pagos; el **3º es el cruce**.

- Al marcar una cotización **contratado**: proveedor → contratista de Pagos · monto → presupuesto
  de la partida de Pagos · PDF/IVA heredados. Se ligan por `buyout_quote.pagos_partida_id`.
  **Cero recaptura.**
- El hilo es **por cotización/subcategoría**, no por partida entera → una partida de Buy-Out
  puede alimentar **varios contratos** (caso `parcial`).
- **Cuadre:** vista que compara, por partida, **Presupuestado (Buy-Out) → Contratado
  (Buy-Out) → Pagado (Pagos)** y avisa si no empatan.

### Fasificación del cruce
- **V1:** se deja el campo `pagos_partida_id` listo + **botón "ligar a contrato" manual** al
  marcar contratado.
- **V2:** **automático** (crea/liga el contrato de Pagos solo) + vistas de cuadre en vivo.

## 9. Plan de construcción de V1 (slices, rama `feat/buyout`, sin push)

1. **Esquema + seeds** (local): tablas `buyout_*`, RLS por rol (igual que Pagos), triggers
   audit, seed de catálogos. Verde local.
2. **Captura manual** (en la pantalla Partida): agregar cotización (proveedor + fecha + estado
   + PDF) y línea(s) en el formato de 22 columnas, una por concepto; el sistema calcula las
   columnas de fórmula. Escribe a `buyout_quote` + `buyout_line`. (Import de Excel = futuro.)
3. **Resumen** (formato BUY OUT) con rollup, $/m², modos.
4. **Estados** (madurez/contratado) + **"qué falta"**.
5. **Subcategoría/historial** + comparativo + marcar contratado (+ botón manual a Pagos).
6. **Carga real de Lote 3** desde el archivo + verificación de cuadre.

Cada slice: `pnpm build` + lint + tsc verde **en local**, commit en `feat/buyout`, **sin push**.
Regla de regresión de CLAUDE.md aplica. Cuando Alfonso apruebe → push + migración a prod.

## 10. Decisiones tomadas (grill-me 18-jun · no re-grilear)

- **Aislamiento:** rama `feat/buyout` **sin push** + tablas en **base real pero invisibles**
  (opción B). Arrancar por **Lote 3**.
- **Captura:** el **Excel sigue siendo el master** del detalle fino. V1 = **captura MANUAL**
  de una línea-resumen por concepto (en formato de 22 col, fórmulas calculadas) + **PDF** del
  ppto a nivel cotización. **NO se parsea el Excel en V1** (eso quita el mayor riesgo); el
  import del tab queda diferido a futuro. La app guarda la referencia de pptos/contratos y
  **registra pagos**.
- **Proveedores globales** · **BF multi-depto en V1** (esquema unidad + UI condicional).
- **Estado de 2 ejes** (madurez + contratación) · paramétrico = cotización `kind=parametrico`.
- **Cruce a Pagos: MANUAL en V1** (botón "ligar/crear contrato" al marcar contratado; ahí se
  registran pagos). Automático = V2.
- **Importar: un tab/partida a la vez.** Re-subir = **versión nueva fechada** (conserva
  historial). **Proveedor**: empata por nombre, crea si nuevo, fusiona después.
- **Vigente:** la **eliges tú**, default la más reciente.
- **Presupuesto base:** de la columna `PRESUPUESTO IZ MXN BASE` del tablero, fijo por partida.
- **Meses = cierre manual** ("foto" del mes), **reabrible por admin**.
- **Villa/Casita:** bandera por línea (filtrable), pero **un solo tablero y un solo $/m²**
  a nivel proyecto.
- **% avance** (contratado vs no) = **por dinero**.
- **"Qué falta" = texto libre** (sin categorías ni compuertas).
- **PDF = opcional/progresivo.**
- **Catálogos** (capítulos + ~26 partidas) **sembrados pero editables** por admin.
- **Roles:** **admin edita** (Alfonso + Jess), los demás **leen** (reusa roles de Pagos).
