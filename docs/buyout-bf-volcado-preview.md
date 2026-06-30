# Buy-Out BF — Preview de volcado (etapa 2a) — SOLO LECTURA

> Generado **2026-06-29** desde `reference/NAUKA - BUY OUT BF 290626.xlsx` (openpyxl, `data_only=True`
> → valores calculados, no fórmulas). Rama `feat/buyout`. **Preview read-only:** no se escribió a la
> base, no se creó migración, no se tocó código. Reporta qué se cargaría en 2b y el cuadre por partida.

## Resumen ejecutivo

- **31 pestañas verdes** detectadas (tabColor `FF00B050`). **30 mapean** a una partida del catálogo de BF; **1 no** (`Contingencias`).
- **Cuadre interno: las 30 partidas cuadran ✓ al centavo** contra la fila *Total* de su propia pestaña verde. (Σ líneas parseadas == Total declarado en la tab → no se pierde ninguna fila con dinero.)
- **Σ líneas a cargar (30 partidas) = $420,204,639.34**.
- **Items (conceptos distintos):** 143 · **Cotizaciones (concepto × proveedor):** 148 · **Líneas (renglones):** 1730. (No todos los 143 conceptos son nuevos; ~86 ya existen en el seed del catálogo — ver sección de grano.)
- **vs Tablero `BUY OUT` (col I = PPTO JUNIO):** TOTAL PRESUPUESTO Junio = $420,137,639.33. Σ vivo de las tabs = $420,204,639.34 → diferencia **$67,000.01** = **$67,000 de drift en Arquitectura** (celda *Cuantificacion* del board en 0 vs $67,000 vivo) **+ $0.01 de redondeo** del board. El tablero es una foto manual por mes; las tabs verdes son el dato vivo.
- **Sin fecha por línea:** las tabs verdes NO tienen columna de fecha. Default propuesto para 2b: **2026-06-29** (fecha del archivo `…290626`).

## Mapeo pestaña verde → partida del catálogo

| # | Pestaña verde | Partida (catálogo BF) | Layout |
|---|---|---|---|
| 1 | `Arquitectura` | ARQUITECTURA | estándar |
| 2 | `Ingenierias_Y_Topografia` | INGENIERIAS Y TOPOGRAFIA | estándar |
| 3 | `Condiciones Generales` | CONDICIONES GENERALES | estándar |
| 4 | `Preliminares` | PRELIMINARES | estándar |
| 5 | `Excavacion` | EXCAVACION | estándar |
| 6 | `Obra_Civil` | OBRA CIVIL | estándar |
| 7 | `Albañilerias` | ALBAÑILERIA | estándar |
| 8 | `Pilas` | PILAS | estándar |
| 9 | `Impermeabilizacion` | IMPERMEABILIZACION | estándar |
| 10 | `Herreria` | HERRERIA | estándar |
| 11 | `Instalaciones_Electricas` | INSTALACIONES ELECTRICAS | estándar |
| 12 | `Instalaciones_Hidraulicas` | INSTALACIONES HIDRAULICAS | estándar |
| 13 | `Instalaciones_Gas` | INSTALACIONES GAS | estándar |
| 14 | `Automat_Control_Ilum` | AUTOMATIZACION Y CONTROL ILUMINACION | estándar |
| 15 | `Aire_Acond_Y_Extraccion` | AIRE ACONDICIONADO Y EXTRACCION | estándar |
| 16 | `Iluminacion` | ILUMINACION | estándar |
| 17 | `Acabados` | ACABADOS | estándar |
| 18 | `Sumin_Coloc_Marmol` | SUMINISTRO Y COLOCACION DE MARMOL | estándar |
| 19 | `Madera_De_Ingenieria` | MADERA DE INGENIERIA | estándar |
| 20 | `Vidrios_Y_Canceles` | VIDRIOS Y CANCELES | estándar |
| 21 | `Cocinas` | COCINAS | 23-col (CATEGORÍA 2) |
| 22 | `Carpinterias` | CARPINTERIAS | 23-col (CATEGORÍA 2) |
| 23 | `Albercas` | ALBERCAS | estándar |
| 24 | `Griferia_Y_Acces_Baño` | GRIFERIA Y ACCESORIOS DE BAÑO | estándar |
| 25 | `Jardineria_Y_Riego` | JARDINERIA Y RIEGO | estándar |
| 26 | `Elevador` | ELEVADOR | estándar |
| 27 | `Exteriores` | EXTERIORES | estándar |
| 28 | `Garden and Privacy Walls` | GARDEN AND PRIVACY WALLS | estándar |
| 29 | `Infraestructura` | INFRAESTRUCTURA | estándar |
| 30 | `Otros` | OTROS | estándar |
| 31 | `Contingencias` | ❌ (sin partida) | estándar |

> 29 tabs usan el layout estándar (CONCEPTO=col C … TOTAL MXN=col T). **`Cocinas` y `Carpinterias`** insertan una columna **CATEGORÍA 2** (col C) que recorre todo +1 (TOTAL MXN=col U). El parser mapea columnas por **nombre de encabezado**, no por letra fija.

## Cuadre por partida

| Partida | # con | # cot | # lín | Σ TOTAL MXN | Cuadre vs Total tab | vs Tablero (Junio) |
|---|--:|--:|--:|--:|:--:|:--:|
| ARQUITECTURA | 5 | 5 | 5 | $2,929,400.00 | ✓ | ⚠ +67,000.00 |
| INGENIERIAS Y TOPOGRAFIA | 9 | 9 | 18 | $2,229,156.10 | ✓ | ✓ |
| CONDICIONES GENERALES | 16 | 17 | 40 | $18,600,593.36 | ✓ | ✓ |
| PRELIMINARES | 2 | 3 | 6 | $1,688,616.44 | ✓ | ✓ |
| EXCAVACION | 1 | 1 | 1 | $0.00 | ✓ | ✓ |
| OBRA CIVIL | 1 | 1 | 2 | $65,999,999.90 | ✓ | ✓ |
| ALBAÑILERIA | 1 | 1 | 2 | $6,495,001.82 | ✓ | ✓ |
| PILAS | 1 | 2 | 6 | $8,365,678.67 | ✓ | ✓ |
| IMPERMEABILIZACION | 6 | 6 | 21 | $2,788,215.57 | ✓ | ✓ |
| HERRERIA | 3 | 3 | 7 | $4,640,000.00 | ✓ | ✓ |
| INSTALACIONES ELECTRICAS | 1 | 1 | 8 | $29,733,862.40 | ✓ | ✓ |
| INSTALACIONES HIDRAULICAS | 1 | 1 | 8 | $16,725,297.60 | ✓ | ✓ |
| INSTALACIONES GAS | 1 | 1 | 2 | $1,856,000.00 | ✓ | ✓ |
| AUTOMATIZACION Y CONTROL ILUMINACION | 1 | 1 | 8 | $19,660,847.60 | ✓ | ✓ |
| AIRE ACONDICIONADO Y EXTRACCION | 10 | 10 | 18 | $15,759,688.32 | ✓ | ✓ |
| ILUMINACION | 30 | 30 | 206 | $7,428,736.28 | ✓ | ✓ |
| ACABADOS | 3 | 3 | 84 | $16,880,129.76 | ✓ | ✓ |
| SUMINISTRO Y COLOCACION DE MARMOL | 1 | 1 | 112 | $21,373,679.18 | ✓ | ✓ |
| MADERA DE INGENIERIA | 2 | 2 | 60 | $0.00 | ✓ | ✓ |
| VIDRIOS Y CANCELES | 4 | 4 | 8 | $38,315,913.58 | ✓ | ✓ |
| COCINAS | 3 | 5 | 256 | $25,879,830.89 | ✓ | ✓ |
| CARPINTERIAS | 17 | 17 | 298 | $46,223,299.08 | ✓ | ⚠ -0.01 |
| ALBERCAS | 1 | 1 | 8 | $23,140,260.00 | ✓ | ✓ |
| GRIFERIA Y ACCESORIOS DE BAÑO | 9 | 9 | 514 | $8,061,094.27 | ✓ | ✓ |
| JARDINERIA Y RIEGO | 2 | 2 | 4 | $7,400,800.00 | ✓ | ✓ |
| ELEVADOR | 1 | 1 | 4 | $3,394,998.68 | ✓ | ✓ |
| EXTERIORES | 6 | 6 | 12 | $19,989,129.86 | ✓ | ✓ |
| GARDEN AND PRIVACY WALLS | 2 | 2 | 6 | $1,192,409.98 | ✓ | ✓ |
| INFRAESTRUCTURA | 1 | 1 | 2 | $812,000.00 | ✓ | ✓ |
| OTROS | 2 | 2 | 4 | $2,640,000.00 | ✓ | ✓ |
| **TOTAL (30 partidas)** | **143** | **148** | **1730** | **$420,204,639.34** | **30/30 ✓** | — |

`# con` = conceptos distintos (col CONCEPTO) → *items* · `# cot` = pares (concepto × proveedor) → *cotizaciones* · `# lín` = renglones de datos → *líneas*.

### `Contingencias` (verde, fuera del catálogo)
- Pestaña verde con **2 línea(s)**, Σ = **$12,000,000.00**, cuadra ✓ contra su Total interno.
- **No existe** como partida en `docs/future-modules/buyout-catalogo-BF.md` ni como `SUBTOTAL` en el tablero → **excluida** del TOTAL PRESUPUESTO del board. Decisión para 2b: crear la partida `CONTINGENCIAS` (¿capítulo OTROS?) o dejarla fuera. **Por default NO se cargaría** hasta que confirmes.

## Hallazgo de grano: CONCEPTO de la tab vs catálogo (la decisión de 2b)

El grano de la columna **CONCEPTO** varía por pestaña:

- En unas partidas, CONCEPTO == el concepto del catálogo (1:1). El detalle fino vive en DETALLE / CATEGORÍA 2.
- En otras, **CONCEPTO es más fino que el catálogo**: el catálogo tiene 1 concepto genérico (= la partida) y la tab lo desglosa en muchos (cuartos, áreas, partidas de gasto). Si en 2b se hace *fila CONCEPTO → item*, se crearían conceptos **no presentes** en el seed del catálogo.

| Partida | Conceptos catálogo | Conceptos en la tab | Conceptos NO en catálogo |
|---|--:|--:|--:|
| ARQUITECTURA | 5 | 5 | 0 |
| INGENIERIAS Y TOPOGRAFIA | 9 | 9 | 0 |
| CONDICIONES GENERALES | 1 | 16 | **16** |
| PRELIMINARES | 2 | 2 | 0 |
| EXCAVACION | 1 | 1 | 0 |
| OBRA CIVIL | 1 | 1 | 0 |
| ALBAÑILERIA | 1 | 1 | 0 |
| PILAS | 1 | 1 | 0 |
| IMPERMEABILIZACION | 1 | 6 | **6** |
| HERRERIA | 2 | 3 | **1** |
| INSTALACIONES ELECTRICAS | 1 | 1 | 0 |
| INSTALACIONES HIDRAULICAS | 1 | 1 | 0 |
| INSTALACIONES GAS | 1 | 1 | 0 |
| AUTOMATIZACION Y CONTROL ILUMINACION | 1 | 1 | **1** |
| AIRE ACONDICIONADO Y EXTRACCION | 1 | 10 | **10** |
| ILUMINACION | 1 | 30 | **30** |
| ACABADOS | 1 | 3 | **3** |
| SUMINISTRO Y COLOCACION DE MARMOL | 2 | 1 | 0 |
| MADERA DE INGENIERIA | 2 | 2 | 0 |
| VIDRIOS Y CANCELES | 4 | 4 | 0 |
| COCINAS | 3 | 3 | 0 |
| CARPINTERIAS | 6 | 17 | **7** |
| ALBERCAS | 1 | 1 | 0 |
| GRIFERIA Y ACCESORIOS DE BAÑO | 1 | 9 | **9** |
| JARDINERIA Y RIEGO | 2 | 2 | 0 |
| ELEVADOR | 1 | 1 | 0 |
| EXTERIORES | 6 | 6 | 0 |
| GARDEN AND PRIVACY WALLS | 1 | 2 | **2** |
| INFRAESTRUCTURA | 1 | 1 | **1** |
| OTROS | 3 | 2 | 0 |

### Conceptos de la tab que NO existen en el catálogo (por partida)

- **CONDICIONES GENERALES** (16): `Papeleria` · `Renta Generadores de Luz` · `Renta Camper` · `Seguro de Obra` · `Tinaco` · `Renta Baños` · `Fosa Septica` · `Consumibles` · `Auxiliar De Residente ( + 2 Meses )` · `Honorarios Residente ( + 2 Meses )` · `Coordinador MEPS` · `Segurista` · `Vehiculos` · `Radios` · `Mantenimiento Y Limpieza` · `Caja Chica De Obra`
- **IMPERMEABILIZACION** (6): `Areas Humedas` · `Terrazas` · `Charolas y Bocas Tormenta` · `Jardineras` · `Cuartos de Maquinas` · `Azotea`
- **HERRERIA** (1): `REJILLAS?`
- **AUTOMATIZACION Y CONTROL ILUMINACION** (1): `Sistemas Low Voltage / Automatizacion`
- **AIRE ACONDICIONADO Y EXTRACCION** (10): `Aire Acondicionado VRV. Usd` · `Aire Acondicionado VRV. MXN` · `Extraccion De Sanitarios. Usd` · `Extraccion De Sanitarios. MXN` · `Sistema De Aire Acondicionado Site Nivel 5. Usd` · `Sistema De Aire Acondicionado Site Nivel 5. MXN` · `Extraccion De Secadoras. Usd` · `Extraccion De Secadoras. MXN` · `Complemento. Usd` · `Complemento. MXN`
- **ILUMINACION** (30): `CIRCULACIÓN VERTICAL` · `VESTÍBULO/PASILLO` · `CLOSET` · `BAÑO DE VISITAS` · `SITE` · `LAVANDERÍA` · `COCINA/DESPENSA` · `SALA/COMEDOR` · `RECAMARA PRINCIPAL 1` · `BAÑO PRINCIPAL 1` · `VESTIDOR PRINCIPAL 1` · `RECAMARA PRINCIPAL 2` · `BAÑO PRINCIPAL 2` · `VESTIDOR PRINCIPAL 2` · `RECAMARA PRINCIPAL 3` · `BAÑO/VESTIDOR PRINCIPAL 3` · `RECAMARA PRINCIPAL 4` · `BAÑO/VESTIDOR PRINCIPAL 4` · `CUARTO DE MÁQUINAS` · `PATIO DE ACCESO/JARDÍN` · `TERRAZAS TECHADAS` · `ASOLEADERO` · `ALBERCA` · `BAÑO` · `LAVANDERIA` · `BODEGAS` · `TERRAZA TECHADA` · `AZOTEA` · `JARDINERA` · `Exterior`
- **ACABADOS** (3): `Pasta` · `Tablaroca` · `Durock`
- **CARPINTERIAS** (7): `Espejos` · `Puerta Acceso Principal` · `Chapas` · `Closet Cerrado` · `Vestidor en U` · `Vestidor en L` · `Closet en L`
- **GRIFERIA Y ACCESORIOS DE BAÑO** (9): `Baño Principal 1` · `Baño Principal 2` · `Baño 3` · `Baño 4` · `Baño Alberca` · `Toilet` · `Cocina Principal` · `Grill` · `Baño 5`
- **GARDEN AND PRIVACY WALLS** (2): `General` · `Dalas`
- **INFRAESTRUCTURA** (1): `General`

> Lectura: en `ILUMINACION`, `GRIFERIA…`, `CONDICIONES GENERALES`, `IMPERMEABILIZACION`, `ACABADOS`, `AIRE ACONDICIONADO…`, `AUTOMATIZACION…`, `INFRAESTRUCTURA`, `GARDEN AND PRIVACY WALLS` el catálogo tiene **1 concepto** y la tab trae el desglose real (cuartos/áreas/conceptos de gasto). En `CARPINTERIAS` el catálogo tiene 6 y la tab agrega variantes (Espejos, Chapas, Vestidor en U/L…). **Decisión 2b:** (a) crear estos conceptos nuevos al vuelo, o (b) mapearlos al concepto genérico del catálogo y mandar el detalle a DETALLE. No se resuelve en este preview.

## FLAGS

1. **Tab verde sin partida:** `Contingencias` (no está en el catálogo ni en el tablero). Ver arriba.
2. **Conceptos fuera de catálogo:** ver sección de grano (11 partidas con CONCEPTO más fino que el seed).
3. **Cotizaciones sin fecha:** ninguna tab verde tiene columna de fecha. **Default 2b = 2026-06-29** (fecha del nombre de archivo `BF 290626`). El tablero tiene columnas por mes (Marzo–Junio) pero son fotos del board, no fechas por renglón.
4. **Filas que no parsean: 0.** Cada partida cuadra al centavo contra su Total → no quedó ningún renglón con dinero sin capturar. Solo se omiten encabezados, filas *Total* y filas vacías (correcto).
5. **Drift del tablero (no es error del volcado):**
   - **ARQUITECTURA**: Σ tab $2,929,400.00 vs tablero Junio $2,862,400.00 → $67,000.00. La celda *Cuantificacion* del tablero Junio quedó en 0 mientras la tab viva trae $67,000.
   - **CARPINTERIAS**: Σ tab $46,223,299.08 vs tablero Junio $46,223,299.09 → $-0.01. Redondeo de 1 centavo en la foto manual del tablero.
6. **Proveedor `NA` / vacío = paramétrico sin cotización real:** varias líneas (Herreria, Acabados, Tinaco, etc.) tienen proveedor `NA` y madurez `PARAMETRICO`. En 2b entrarían como línea **paramétrica** (sin proveedor, fecha = default), no como cotización contratada.
7. **Concepto suelto en `HERRERIA`:** existe un CONCEPTO `REJILLAS?` (con `?`) además de los 2 del catálogo — parece placeholder/typo. Revisar en 2b.
8. **Convenciones de dinero BF (ya soportadas por el cálculo per-línea):** sobrecosto hasta 35% e IVA 0% en muchas líneas; el `TOTAL MXN` (col calculada) ya las incorpora — el volcado toma ese valor, no recalcula.

## Totales del proyecto (referencia)

- **Σ líneas vivas (30 partidas, lo que se cargaría):** $420,204,639.34
- **Tablero `BUY OUT` — TOTAL PRESUPUESTO, col E (BASE):** $427,161,130.02
- **Tablero `BUY OUT` — TOTAL PRESUPUESTO, col I (PPTO JUNIO):** $420,137,639.33
- **Contingencias (tab verde, excluida del board):** $12,000,000.00

## Madurez / contratación (lo que se vería en el módulo)

| Partida | Líneas PPTO | Líneas PARAMÉTRICO | Líneas Contratadas |
|---|--:|--:|--:|
| ARQUITECTURA | 3 | 2 | 1 |
| INGENIERIAS Y TOPOGRAFIA | 14 | 4 | 16 |
| CONDICIONES GENERALES | 10 | 30 | 5 |
| PRELIMINARES | 6 | 0 | 6 |
| EXCAVACION | 0 | 1 | 0 |
| OBRA CIVIL | 1 | 1 | 1 |
| ALBAÑILERIA | 1 | 1 | 1 |
| PILAS | 6 | 0 | 3 |
| IMPERMEABILIZACION | 0 | 21 | 0 |
| HERRERIA | 0 | 6 | 0 |
| INSTALACIONES ELECTRICAS | 0 | 8 | 0 |
| INSTALACIONES HIDRAULICAS | 0 | 8 | 0 |
| INSTALACIONES GAS | 0 | 2 | 0 |
| AUTOMATIZACION Y CONTROL ILUMINACION | 8 | 0 | 0 |
| AIRE ACONDICIONADO Y EXTRACCION | 18 | 0 | 0 |
| ILUMINACION | 204 | 2 | 0 |
| ACABADOS | 0 | 84 | 0 |
| SUMINISTRO Y COLOCACION DE MARMOL | 0 | 112 | 0 |
| MADERA DE INGENIERIA | 0 | 60 | 0 |
| VIDRIOS Y CANCELES | 6 | 2 | 0 |
| COCINAS | 216 | 40 | 0 |
| CARPINTERIAS | 294 | 4 | 286 |
| ALBERCAS | 8 | 0 | 0 |
| GRIFERIA Y ACCESORIOS DE BAÑO | 514 | 0 | 0 |
| JARDINERIA Y RIEGO | 0 | 4 | 0 |
| ELEVADOR | 0 | 4 | 2 |
| EXTERIORES | 0 | 12 | 0 |
| GARDEN AND PRIVACY WALLS | 4 | 2 | 0 |
| INFRAESTRUCTURA | 0 | 2 | 0 |
| OTROS | 0 | 4 | 0 |

---
*Preview generado en modo lectura. Próximo paso (2b, separado): decidir grano de CONCEPTO, fecha default y trato de Contingencias antes de escribir a la base.*
