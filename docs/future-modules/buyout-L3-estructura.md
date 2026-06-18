# BUY OUT — Estructura real del Excel (Lote 3, archivo 15-jun-26)

> Disección del libro `NAUKA - BUY OUT L3 150626.xlsx` para anclar el spec del módulo.
> 46 hojas. Tres tipos: **tablero** (BUY OUT), **pestañas verdes** (1 por partida), y **soporte** (glosario, BD, áreas, portada).

## 1. Anatomía del libro

| Tipo | Hojas | Rol |
|---|---|---|
| Tablero | `BUY OUT` | Consolida todo. Capítulos → partidas → subtotales. Meses en columnas. |
| Verdes (detalle) | `Arquitectura`, `Impermeabilizacion`, `Instalaciones_Electricas`, `Acabados`, `Carpinterias`, `Cocinas`, `Griferia_Y_Acces_Baño`, … (~25) | Unitarios línea por línea, formato fijo de 22 columnas. |
| Soporte | `Glosario Partidas`, `BD`, `UNITARIO`, `Portada`, `Objetivo`, `Comparativo Objetivo` | Catálogos, áreas, tipo de cambio, captura. |

## 2. Pestaña verde = formato fijo de 22 columnas (B…W)

Columna A es solo un link "⬅ Resumen PU". Las 22 reales:

| Col | Encabezado | Tipo | Notas |
|---|---|---|---|
| B | CATEGORÍA | dropdown | = la partida (glosario). Ej. "Impermeabilizacion" |
| C | CONCEPTO | dropdown | la subcategoría. Ej. "Cisterna (WS-06)" |
| D | DETALLE | input | "S/D" si no aplica |
| E | Villa/Casita | dropdown | **dimensión unidad (1/3)** |
| F | PISO | dropdown | Sotano / PB / N1 / Azoteas… **(2/3)** |
| G | DEPTO | dropdown | **(3/3)** — para multi-depto |
| H | PROVEEDOR | dropdown | Ej. "R&R". **Por aquí se agrupa el PDF.** |
| I | UNIDAD | dropdown | m2, ML, PZA, Lote, Servicio… (glosario) |
| J | CANTIDAD | input | |
| K | MONEDA | dropdown | MXN / USD / EUR (glosario) |
| L | $ UNITARIO | input | |
| M | IMPORTE SIN IVA | fórmula | `=J*L` |
| N | SOBRECOSTO | input | % (normalmente 0) |
| O | TOTAL SOBRECOSTO | fórmula | `=M*N` |
| P | % IVA | input | 0.16 |
| Q | $ IVA | fórmula | `=(M+O)*P` |
| R | IMPORTE TOTAL | fórmula | `=M+O+Q` |
| S | T.C | fórmula | INDEX/MATCH de MONEDA → tabla del glosario |
| T | TOTAL MXN | fórmula | `=R*S` ← **esto es lo que consolida el tablero** |
| U | NOTAS | input | proveedor, folio, fecha, referencia del PDF (procedencia) |
| V | PARAMETRICO/PPTO | dropdown | **eje de estado 1**: `PARAMETRICO` ó `PPTO` |
| W | CONTRATADO/NO CONTRATADO | dropdown | **eje de estado 2**: `Contratado` ó `No Contratado` |

Fila final `Total` = `SUM` de M, R y T. **El estado vive en la línea**, en DOS columnas independientes (V y W), no en una sola.

## 3. El tablero (BUY OUT)

- **TC**: `C3 = 17.5` (MXN por USD), jalado de `Glosario Partidas!M9`.
- **Encabezados (fila 7)**: CONCEPTO · NO. BIDDING · POTENCIAL CONTRACTOR · DESIGN PRIORITY · DESIGN DEFINITION · % PROGRESS · REQUIRED DATE · QUANTIFICATIONS · CONTRACTOR SELECTION · COMPARISON · APPROVED SAMPLE · # CONTRACT/PO · PURCHASE DATE · DELIVERY TIME · **PRESUPUESTO IZ MXN BASE** · **PPTO MARZO/ABRIL/MAYO/JUNIO MXN** · **DIF BASE VS MAYO** · **COSTO M2 INTERIOR** · **PPTO USD BASE/JUNIO** · + cronograma/cashflow.
- **Jerarquía**: Capítulo (ej. OBRA CIVIL) → partidas (filas concepto) → `SUBTOTAL`. El total del capítulo suma subtotales (`=R40+R45+R51+R56`).
- **Meses = columnas snapshot**: BASE, Marzo, Abril, Mayo son valores fijos (históricos). **El mes vigente (Junio = col V) es la fórmula viva**:
  `=SUMIFS(Arquitectura!$T:$T, Arquitectura!$C:$C, $B12)` → suma el TOTAL MXN de la verde donde el CONCEPTO coincide con la partida del tablero.
- **DIF** `=IFERROR(V/R-1,0)` · **$/m²** `=V/UNITARIO!$E$3` · **USD** `=V/$C$3`.

→ **El tablero NO guarda números propios del detalle; los reconstruye por SUMIFS desde las verdes.** Exactamente lo que tú quieres que el sistema haga solo.

## 4. Catálogos (Glosario Partidas)

- **Partidas canónicas** (col C, numeradas): Arquitectura, Tramites_Locales, Ingenierias_Y_Topografia, Indirectos_De_Obra, Obra_Civil, Albañileria_Y_Bardas, Impermeabilizacion, Piso_Hidronico, Acabados, Herreria, Instalaciones_Electricas, Instalaciones_Hidraulicas, Albercas, Automatizacion_Control_Iluminacion, Instalaciones_Gas, Aire_Acondicionado_Y_Extraccion, Iluminacion, Suministro_Y_Colocacion_De_Marmol, Madera_De_Ingenieria, Vidrios_Y_Canceles, Cocinas, Griferia_Y_Accesorios_De_Baño, Griferia…_Servicios… (~26).
- **Unidades**: M2, Lote, Semana, Mes, PZA, Servicio, ML.
- **Tabla de tipo de cambio** (L8:M10): `MXN=1 · USD=17.5 · EUR=20.5`. (Las verdes hacen INDEX/MATCH aquí.)

## 5. Áreas (hoja UNITARIO) — base de $/m²

| Concepto | m² |
|---|---|
| Área interior acondicionada | **992.61** ← divisor de COSTO M2 |
| Área exterior techada | 665.39 |
| Área exterior pavimentada sin techar | 383.75 |
| Total cubierto | 1,658 |
| Total construido | 2,041.75 |

## 6. Hoja BD = el modelo de captura (clave para el formulario)

La hoja `BD` documenta, campo por campo, qué es **DROPDOWN** vs **INPUT**:

- **Dropdowns** (vienen de catálogo): CATEGORÍA, CONCEPTO, DETALLE, PROVEEDOR, UNIDAD, MONEDA, PARAMETRICO/PPTO.
- **Inputs** (teclea el usuario): CANTIDAD, $ UNITARIO, NOTAS.
- **Calculados** (NA): importe, IVA, total, TC, total MXN.

→ Es literalmente el contrato de qué se captura, qué se elige y qué se calcula. El importador y el formulario del sistema deben respetar esto.

## 7. Implicaciones directas para el modelo de datos

1. **Estado = 2 ejes, no 1.** `parametrico|ppto` (V) **y** `contratado|no` (W) son independientes. El modelo necesita ambos a nivel línea; el estado de la partida es agregado de los dos.
2. **Dimensión unidad confirmada en E/F/G** (Villa/Casita · Piso · Depto). El compromiso "esquema soporta unidad, UI la muestra solo donde aplica" calza perfecto.
3. **Multimoneda real** (MXN/USD/EUR) con tabla de TC → el modelo guarda moneda + importe; TC sale del catálogo por fecha/proyecto.
4. **Rollup reconstruible** (como el SUMIFS): líneas → subcategoría(concepto) → partida(categoría) → capítulo → total; $/m² = total ÷ área interior.
5. **PDF por proveedor** = agrupar líneas por col H (PROVEEDOR), como ya dijimos.
6. **Procedencia en NOTAS** (proveedor, folio, fecha, PDF) → es el embrión de la "cotización fechada".
7. **Catálogos a sembrar**: ~26 partidas, unidades, monedas+TC, y el set de capítulos del tablero.
