# Catálogo canónico Buy-Out — Beachfront (estructura oficial del tablero, 29-jun-2026)

> Estructura de 3 niveles **Capítulo → Partida → Concepto**, fiel al tablero "BUY OUT" del
> Excel de BF (confirmada por Alfonso). Fuente de verdad para sembrar `buyout_chapter`,
> `buyout_partida_catalog` (project_id = Beachfront) y `buyout_concepto_catalog`.
> Respetar nombres EXACTOS. NO agregar partidas del glosario que no estén aquí (sin Closets/FFE).

## DISEÑO
- **ARQUITECTURA**: Supervision Diseño Iluminacion · Diseño Arquitectonico · Diseño Jardineria · Cuantificacion M2 · Supervision Diseño Jardineria
- **INGENIERIAS Y TOPOGRAFIA**: Topografia Gestoria · Topografia Obra · Mecanica De Suelos · Calculo Estructural · Diseño HVAC · Diseño Alberca · Diseño Instalaciones HS-E-G · Diseño Iluminacion · Diseño Acustica

## PILAS
- **PILAS**: Pilas

## OBRA CIVIL
- **CONDICIONES GENERALES**: Condiciones Generales  *(rótulo SUBTOTAL: "INDIRECTOS DE OBRA")*
- **PRELIMINARES**: Trabajos Preliminares · Plataformas
- **EXCAVACION** *(rótulo: "EXCAVACION - INCLUIDA EN OBRA CIVIL")*: Excavacion
- **OBRA CIVIL**: Obra_Civil
- **ALBAÑILERIA** *(SUBTOTAL "ALBAÑILERIA Y BARDAS")*: Aplanados
- **IMPERMEABILIZACION**: Impermeabilizacion

## MEP
- **INSTALACIONES ELECTRICAS**: Instalaciones Electricas
- **INSTALACIONES HIDRAULICAS**: Instalaciones Hidrosanitarias
- **INSTALACIONES GAS**: Instalaciones De Gas
- **AUTOMATIZACION Y CONTROL ILUMINACION**: Automatizacion_Control_Iluminacion
- **AIRE ACONDICIONADO Y EXTRACCION**: Aire_Acondicionado_Y_Extraccion
- **ILUMINACION**: Iluminacion

## ACABADOS
- **ACABADOS**: Acabados

## COLOCACIONES
- **HERRERIA**: Herreria ( Rejillas,  Anclajes, Exclusas, Tapajuntas, Soportes, Ductos ) · Pintura Herreria. Primario / Acabado
- **SUMINISTRO Y COLOCACION DE MARMOL**: Suministro de Marmol · Colocacion de Marmol
- **MADERA DE INGENIERIA***: Pisos_Madera · Madera_Puertas
- **VIDRIOS Y CANCELES**: Canceles Y Vidrios · Barandal de Vidrio · Canceles de Baño · Celosia Fachada Principal
- **COCINAS**: Cocina Principal · Grill · Laundry
- **GRIFERIA Y ACCESORIOS DE BAÑO**: Griferia_Y_Accesorios_De_Baño
- **CARPINTERIAS**: Vanityes · Puertas · Closets · Envios e Instalacion · Vigas Madera · Mobiliario

## ALBERCAS
- **ALBERCAS**: Alberca Completa

## JARDINERIA Y RIEGO
- **JARDINERIA Y RIEGO**: Jardineria · Sistema De Riego

## ELEVADOR
- **ELEVADOR**: Elevador

## EXTERIORES
- **EXTERIORES**: Piedra · Firme de Concreto · Portones Estacionamiento · Porton General · Señalizacion · Garage
- **GARDEN AND PRIVACY WALLS** *(SUBTOTAL "MUROS DE PIEDRA")*: Garden and Privacy Walls
- **INFRAESTRUCTURA**: Infraestructura

## OTROS
- **OTROS** *(SUBTOTAL "FIRE PIT")*: Otros · Fire Pit · Acustica

---

### Notas
- **11 capítulos** (confirmados por Alfonso): DISEÑO · PILAS · OBRA CIVIL · MEP · ACABADOS ·
  COLOCACIONES · ALBERCAS · JARDINERIA Y RIEGO · ELEVADOR · EXTERIORES · OTROS. Luego las
  partidas (categorías), luego los conceptos. Sin Closets ni FFE (eran del glosario, NO del tablero).
- PILAS = capítulo propio (no bajo Obra Civil).
- GARDEN AND PRIVACY WALLS e INFRAESTRUCTURA = **partidas dentro del capítulo EXTERIORES** (no capítulos propios).
- "Closets" sí existe como **concepto** dentro de la partida CARPINTERIAS (distinto de la partida Closets del glosario que NO va).
- Conservar bases (col E PRESUPUESTO IZ MXN BASE por SUBTOTAL), TC (USD 17.5 / EUR 22), área y los 8 deptos del seed previo.
