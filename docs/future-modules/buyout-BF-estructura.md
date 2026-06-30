# BUY OUT — Estructura real del Excel (Beachfront, archivo 29-jun-26)

> Disección de `NAUKA - BUY OUT BF 290626.xlsx` para la migración. **68 hojas** (vs 46 en L3).
> BF es **multi-depto** y más complejo que L3/L44. Mismo patrón base (tablero + verdes + PU +
> glosario) pero con diferencias importantes.

## 1. Dimensión de UNIDAD — la gran diferencia (hoja "Glosario Deptos")

BF = **2 Torres × 4 deptos = 8 deptos únicos**:
- Por torre: 2 PB + 2 Dúplex (N1+N1R).
- Torre 1: 101 (PB), 201 (PB), 102/103 (Dúplex), 202/203 (Dúplex).
- Torre 2: 301 (PB), 401 (PB), 302/303 (Dúplex), 402/403 (Dúplex).
- Atributos por depto: **TIPO** (PB / Dúplex N1+N1R), **PISO(S)**, **DEPTO id**, **DEPTO ID Acabados**, **5TA RECÁMARA** (sí/no — 401 y 402/403 en Torre 2 la tienen).
- Los dúplex: N1 y N1R = planta baja y alta del mismo depto.

## 2. Pestañas verdes = 29 columnas (vs 22/23 en L3)

A(link) · B CATEGORÍA · C CONCEPTO · D DETALLE · **E TORRE · F PISO · G DEPTO** · H PROVEEDOR ·
I UNIDAD · J CANTIDAD · K MONEDA · L $UNITARIO · M IMPORTE SIN IVA · N SOBRECOSTO · O TOTAL
SOBRECOSTO · P %IVA · Q $IVA · R IMPORTE TOTAL · S T.C · T TOTAL MXN · U NOTAS · V PARAMETRICO/PPTO
· W Contratado/No · **X "5 Recamara" · AB CONTRATADO · AC NO CONTRATADO** (columnas auxiliares).

→ La dimensión unidad aquí es **TORRE · PISO · DEPTO** (en L3 era Villa/Casita · Piso · Depto).
→ **Una línea puede abarcar varios deptos** (ej. DEPTO = "101, 103" = pareja de villas; PISO = "PB+N1R").

## 3. Convenciones de dinero distintas a L3

- **Sobrecosto 35%** (col N = 0.35) en muchas líneas — nota "PPTO CON AUMENTO HIPOTÉTICO DE +35%".
- **% IVA = 0** en varias líneas (el IVA se maneja distinto / aparte).
- TC: MXN 1 · USD 17.5 · EUR 22.

## 4. Catálogo de partidas (~28) — difiere de L3

Mismas base + extras de BF: **Excavacion**, **Elevador**, **Closets** (partida aparte),
**Exteriores**, **FFE**, **Garden and Privacy Walls**, **Infraestructura**. (L3 no las tenía;
L3 tenía Casita, que BF no.)

## 5. Capítulos del tablero (~12, más que los 8 de L3)

DISEÑO · OBRA CIVIL · MEP · ACABADOS · COLOCACIONES · ALBERCAS · JARDINERIA Y RIEGO · **ELEVADOR**
· **EXTERIORES** · **GARDEN AND PRIVACY WALLS** · **INFRAESTRUCTURA** · OTROS. Hay también PILAS y
CONDICIONES GENERALES / PRELIMINARES / EXCAVACION dentro de Obra Civil.

## 6. Áreas (hoja UNITARIO) — por depto

Área Int. Acon. + Área Ext. Techada por depto (PB1, PB2, N1+Roof1, N1+Roof2) por torre.
$/m² y USD/m² calculados por depto y por torre. TC USD = 17.5.

## 7. Volumen

Tabs grandes: Griferia 516 filas · Carpinterias 432 · Cocinas 274 · Iluminacion 208 · Acabados 86
· Mármol 116. Mucho más detalle que L3.

## 8. Implicaciones para la migración (decisiones pendientes)

1. **Modelo de unidad:** BF necesita **Torre + Depto** (8 deptos). El esquema actual modela
   `villa_casita/piso/depto` en la línea + `buyout_unit`. Hay que decidir: sembrar los 8 deptos
   como `buyout_unit` y/o cómo guardar Torre (¿campo nuevo, o en los campos de texto existentes?).
   Líneas que abarcan varios deptos = guardar el texto tal cual vs modelar 1:N.
2. **Catálogo propio de BF** (partidas/capítulos/conceptos distintos a L3) → sembrar aparte.
3. **Convenciones:** sobrecosto 35% e IVA 0 por línea — el cálculo debe respetarlas (ya es
   per-línea en el modelo).
4. **Grano de migración:** ¿solo catálogo+bases+deptos+TC (y capturar conceptos), o también
   backfill de conceptos por script? Dado el volumen y la complejidad multi-depto, conviene
   por etapas.
