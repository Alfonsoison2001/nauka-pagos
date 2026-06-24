# Catálogo canónico Buy-Out — Lote 3 (taxonomía oficial de Alfonso, 23-jun-2026)

> Estructura de 3 niveles: **Capítulo → Partida → Concepto**. Esta es la fuente de verdad
> para sembrar `buyout_chapter`, `buyout_partida_catalog` y los conceptos por partida.
> El **concepto** debe ser un dropdown de esta lista (por partida), no texto libre.
> Respetar los nombres EXACTOS (incluidos guiones bajos y acentos).

## DISEÑO
- **ARQUITECTURA**: Diseño Iluminacion · Supervision Diseño Iluminacion · Diseño Jardineria · Supervision Diseño Jardineria
- **TRAMITES LOCALES**: Sindicatos Y Patrullas · Tramites Y Gestorias · Acometida Cfe. Gestor
- **INGENIERIAS Y TOPOGRAFIA**: Topografia Gestoria · Topografia Obra · Mecanica De Suelos · Calculo Estructural · Diseño Instalaciones. Electricas, Ihs, Alberca, Gas, Etc.

## OBRA CIVIL
- **INDIRECTOS DE OBRA**: Trabajos_Preliminares · Auxiliar De Residente ( + 2 Meses ) · Honorarios Residente ( + 2 Meses ) · Mantenimiento Y Limpieza · Caja Chica De Obra · IMSS
- **OBRA CIVIL**: Obra Civil · Extraordinarios
- **ALBAÑILERIA Y BARDAS** *(rótulo: "ALBAÑILERIA - INCLUIDA EN OBRA CIVIL")*: Pisos · Muros · Acarreos
- **IMPERMEABILIZACION**: Villa · Casita

## MEP
- **INSTALACIONES ELECTRICAS**: Villa · Casita
- **INSTALACIONES HIDRAULICAS Y GAS**: Villa + Casita
- **AUTOMATIZACION Y CONTROL ILUMINACION**: Sistema de Detección y Alarma Contra Incendio · Cortinas · Sistema de Audio · Sistema de Voz y Datos · Sistema de Control de Accesos · Sistema de CCTV · Sistema de Intrusión · Sistema de Distribución de Señal de TV · Sistema de PBX · Sistema de WI-FI · Sistema de Iluminación · Revestimiento electrico · Descuento
- **AIRE ACONDICIONADO Y EXTRACCION**: Equipos · Mano de Obra y materiales
- **ILUMINACION**: Luminarias Interiores · Luminarias Exteriores · Andadores · Decorativas

## ACABADOS
- **ACABADOS**: Acabado Lisso Muros · Yeso Según Especificacion · Muro Durock · Acabado Lisso Plafon · Plafon Durock · Suministro_Y_Colocacion_De_Ceramica · Plafon_Acustico

## COLOCACIONES
- **HERRERIA**: Herreria ( Rejillas,  Anclajes, Exclusas, Tapajuntas, Soportes, Ductos ) · Pintura Herreria. Primario / Acabado
- **SUMINISTRO Y COLOCACION DE MARMOL**: Suministro de Marmol · Colocacion de Marmol · Suministro de Ceramica · Colocacion de Ceramica
- **MADERA DE INGENIERIA**: Pisos_Madera · Sujecion · Plafon_Madera
- **VIDRIOS Y CANCELES**: Canceles y Vidrios · Celosías · Shutters · Espejos En Baños
- **COCINAS**: Cocinas · Lavanderia · Equipos de Cocina
- **GRIFERIA Y ACCESORIOS DE BAÑO**: Griferia y Accesorios Baños · Griferia y Accesorios Servicio · Colocación Griferías
- **CARPINTERIAS**: Puertas De Madera Principales · Puerta Acceso Calle · Puertas Servicio · Vanityes · Closets · Mobiliario · Instalacion · Porton Cochera · Puertas Louvers Metalicas · Chapas Para Puertas Principales · Chapas Secundarias · Topes Principales · Topes Secundarios · Lavanderia

## ALBERCAS
- **ALBERCAS**: Alberca Completa

## JARDINERIA Y RIEGO
- **JARDINERIA Y RIEGO**: Jardineria · Sistema De Riego

## OTROS
- **PISO HIDRONICO**: Piso Hidronico
- **CASITA**: Casita y Acabados

---

### Notas de reconciliación (vs lo sembrado en Slice 1)
- 8 capítulos: **coinciden**.
- Partidas: reconciliar a estas 24 exactas. Diferencias vs el seed del glosario:
  `Instalaciones_Gas` se fusiona en **INSTALACIONES HIDRAULICAS Y GAS**; `Griferia_Servicio`
  NO es partida (es el concepto "Griferia y Accesorios Servicio"); **CASITA** sí es partida
  (en OTROS); `Albañileria` lleva el rótulo "INCLUIDA EN OBRA CIVIL".
- El **concepto** pasa a ser dropdown de esta lista por partida (antes era texto libre).
