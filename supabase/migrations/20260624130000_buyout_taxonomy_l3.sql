-- =========================================================================
-- NAUKA Pagos — Módulo BUY-OUT · Slice 2c: taxonomía oficial L3 + conceptos
-- =========================================================================
-- Fuente de verdad: docs/future-modules/buyout-catalogo-L3.md (taxonomía de
-- Alfonso, 23-jun). Estructura de 3 niveles Capítulo → Partida → Concepto.
--
-- 100% aditivo a nivel estructura (solo CREATE TABLE buyout_concepto_catalog);
-- el resto es reconciliación de DATOS de catálogo, NO destructiva:
--   • Las 23 partidas viejas (glosario, nombres con guiones bajos) se
--     SOFT-DELETEAN (deleted_at), no se borran. Así el FK de cualquier línea de
--     prueba (buyout_item.partida_catalog_id, ON DELETE RESTRICT) queda intacto
--     y la fila vieja sigue existiendo, solo invisible en la UI (que filtra
--     deleted_at IS NULL). Recuperable.
--   • Se insertan las 24 partidas EXACTAS del doc, cada una a su capítulo.
--   • Se renombra el capítulo L3 'JARDINERÍA' → 'JARDINERIA Y RIEGO' (el doc).
--   • Se siembran los 92 conceptos por partida (nombres EXACTOS).
--   • Se agrega la unidad 'Villa + Casita' a buyout_unit (L3).
-- Cero impacto en Pagos.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Tabla buyout_concepto_catalog (conceptos por partida) — ADITIVA
-- -------------------------------------------------------------------------
CREATE TABLE public.buyout_concepto_catalog (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_catalog_id  uuid        NOT NULL REFERENCES public.buyout_partida_catalog(id) ON DELETE CASCADE,
  nombre              text        NOT NULL,
  orden               int         NOT NULL DEFAULT 0,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyout_concepto_catalog_partida_idx
  ON public.buyout_concepto_catalog (partida_catalog_id);
CREATE UNIQUE INDEX buyout_concepto_catalog_partida_nombre_uidx
  ON public.buyout_concepto_catalog (partida_catalog_id, nombre) WHERE deleted_at IS NULL;

CREATE TRIGGER buyout_concepto_catalog_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.buyout_concepto_catalog
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_change();

ALTER TABLE public.buyout_concepto_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY buyout_concepto_catalog_select ON public.buyout_concepto_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY buyout_concepto_catalog_insert ON public.buyout_concepto_catalog
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY buyout_concepto_catalog_update ON public.buyout_concepto_catalog
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY buyout_concepto_catalog_delete ON public.buyout_concepto_catalog
  FOR DELETE TO authenticated USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyout_concepto_catalog TO authenticated;

COMMENT ON TABLE public.buyout_concepto_catalog IS
  'Conceptos (subcategorías) por partida — dropdown de captura. Taxonomía oficial L3. Editable por admin.';

-- -------------------------------------------------------------------------
-- 2. Reconciliación de capítulos (L3): JARDINERÍA → JARDINERIA Y RIEGO
-- -------------------------------------------------------------------------
UPDATE public.buyout_chapter c
SET nombre = 'JARDINERIA Y RIEGO'
FROM public.projects p
WHERE c.project_id = p.id
  AND p.nombre = 'NAUKA Lote 3'
  AND c.nombre = 'JARDINERÍA'
  AND c.deleted_at IS NULL;

-- -------------------------------------------------------------------------
-- 3. Soft-delete del catálogo de partidas viejo (no destructivo)
-- -------------------------------------------------------------------------
UPDATE public.buyout_partida_catalog
SET deleted_at = now()
WHERE deleted_at IS NULL;

-- -------------------------------------------------------------------------
-- 4. Las 24 partidas EXACTAS del doc (cada una a su capítulo)
-- -------------------------------------------------------------------------
INSERT INTO public.buyout_partida_catalog (nombre, chapter_default, orden)
SELECT v.nombre, v.cap, v.orden
FROM (VALUES
  ('ARQUITECTURA',                       'DISEÑO',             1),
  ('TRAMITES LOCALES',                   'DISEÑO',             2),
  ('INGENIERIAS Y TOPOGRAFIA',           'DISEÑO',             3),
  ('INDIRECTOS DE OBRA',                 'OBRA CIVIL',         4),
  ('OBRA CIVIL',                         'OBRA CIVIL',         5),
  ('ALBAÑILERIA Y BARDAS',               'OBRA CIVIL',         6),
  ('IMPERMEABILIZACION',                 'OBRA CIVIL',         7),
  ('INSTALACIONES ELECTRICAS',           'MEP',                8),
  ('INSTALACIONES HIDRAULICAS Y GAS',    'MEP',                9),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','MEP',              10),
  ('AIRE ACONDICIONADO Y EXTRACCION',    'MEP',               11),
  ('ILUMINACION',                        'MEP',               12),
  ('ACABADOS',                           'ACABADOS',          13),
  ('HERRERIA',                           'COLOCACIONES',      14),
  ('SUMINISTRO Y COLOCACION DE MARMOL',  'COLOCACIONES',      15),
  ('MADERA DE INGENIERIA',               'COLOCACIONES',      16),
  ('VIDRIOS Y CANCELES',                 'COLOCACIONES',      17),
  ('COCINAS',                            'COLOCACIONES',      18),
  ('GRIFERIA Y ACCESORIOS DE BAÑO',      'COLOCACIONES',      19),
  ('CARPINTERIAS',                       'COLOCACIONES',      20),
  ('ALBERCAS',                           'ALBERCAS',          21),
  ('JARDINERIA Y RIEGO',                 'JARDINERIA Y RIEGO',22),
  ('PISO HIDRONICO',                     'OTROS',             23),
  ('CASITA',                             'OTROS',             24)
) AS v(nombre, cap, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyout_partida_catalog c
  WHERE c.nombre = v.nombre AND c.deleted_at IS NULL
);

-- -------------------------------------------------------------------------
-- 5. Los 92 conceptos por partida (nombres EXACTOS del doc)
-- -------------------------------------------------------------------------
INSERT INTO public.buyout_concepto_catalog (partida_catalog_id, nombre, orden)
SELECT p.id, v.nombre, v.orden
FROM public.buyout_partida_catalog p
JOIN (VALUES
  ('ARQUITECTURA','Diseño Iluminacion',1),
  ('ARQUITECTURA','Supervision Diseño Iluminacion',2),
  ('ARQUITECTURA','Diseño Jardineria',3),
  ('ARQUITECTURA','Supervision Diseño Jardineria',4),
  ('TRAMITES LOCALES','Sindicatos Y Patrullas',1),
  ('TRAMITES LOCALES','Tramites Y Gestorias',2),
  ('TRAMITES LOCALES','Acometida Cfe. Gestor',3),
  ('INGENIERIAS Y TOPOGRAFIA','Topografia Gestoria',1),
  ('INGENIERIAS Y TOPOGRAFIA','Topografia Obra',2),
  ('INGENIERIAS Y TOPOGRAFIA','Mecanica De Suelos',3),
  ('INGENIERIAS Y TOPOGRAFIA','Calculo Estructural',4),
  ('INGENIERIAS Y TOPOGRAFIA','Diseño Instalaciones. Electricas, Ihs, Alberca, Gas, Etc.',5),
  ('INDIRECTOS DE OBRA','Trabajos_Preliminares',1),
  ('INDIRECTOS DE OBRA','Auxiliar De Residente ( + 2 Meses )',2),
  ('INDIRECTOS DE OBRA','Honorarios Residente ( + 2 Meses )',3),
  ('INDIRECTOS DE OBRA','Mantenimiento Y Limpieza',4),
  ('INDIRECTOS DE OBRA','Caja Chica De Obra',5),
  ('INDIRECTOS DE OBRA','IMSS',6),
  ('OBRA CIVIL','Obra Civil',1),
  ('OBRA CIVIL','Extraordinarios',2),
  ('ALBAÑILERIA Y BARDAS','Pisos',1),
  ('ALBAÑILERIA Y BARDAS','Muros',2),
  ('ALBAÑILERIA Y BARDAS','Acarreos',3),
  ('IMPERMEABILIZACION','Villa',1),
  ('IMPERMEABILIZACION','Casita',2),
  ('INSTALACIONES ELECTRICAS','Villa',1),
  ('INSTALACIONES ELECTRICAS','Casita',2),
  ('INSTALACIONES HIDRAULICAS Y GAS','Villa + Casita',1),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Sistema de Detección y Alarma Contra Incendio',1),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Cortinas',2),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Sistema de Audio',3),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Sistema de Voz y Datos',4),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Sistema de Control de Accesos',5),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Sistema de CCTV',6),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Sistema de Intrusión',7),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Sistema de Distribución de Señal de TV',8),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Sistema de PBX',9),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Sistema de WI-FI',10),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Sistema de Iluminación',11),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Revestimiento electrico',12),
  ('AUTOMATIZACION Y CONTROL ILUMINACION','Descuento',13),
  ('AIRE ACONDICIONADO Y EXTRACCION','Equipos',1),
  ('AIRE ACONDICIONADO Y EXTRACCION','Mano de Obra y materiales',2),
  ('ILUMINACION','Luminarias Interiores',1),
  ('ILUMINACION','Luminarias Exteriores',2),
  ('ILUMINACION','Andadores',3),
  ('ILUMINACION','Decorativas',4),
  ('ACABADOS','Acabado Lisso Muros',1),
  ('ACABADOS','Yeso Según Especificacion',2),
  ('ACABADOS','Muro Durock',3),
  ('ACABADOS','Acabado Lisso Plafon',4),
  ('ACABADOS','Plafon Durock',5),
  ('ACABADOS','Suministro_Y_Colocacion_De_Ceramica',6),
  ('ACABADOS','Plafon_Acustico',7),
  ('HERRERIA','Herreria ( Rejillas,  Anclajes, Exclusas, Tapajuntas, Soportes, Ductos )',1),
  ('HERRERIA','Pintura Herreria. Primario / Acabado',2),
  ('SUMINISTRO Y COLOCACION DE MARMOL','Suministro de Marmol',1),
  ('SUMINISTRO Y COLOCACION DE MARMOL','Colocacion de Marmol',2),
  ('SUMINISTRO Y COLOCACION DE MARMOL','Suministro de Ceramica',3),
  ('SUMINISTRO Y COLOCACION DE MARMOL','Colocacion de Ceramica',4),
  ('MADERA DE INGENIERIA','Pisos_Madera',1),
  ('MADERA DE INGENIERIA','Sujecion',2),
  ('MADERA DE INGENIERIA','Plafon_Madera',3),
  ('VIDRIOS Y CANCELES','Canceles y Vidrios',1),
  ('VIDRIOS Y CANCELES','Celosías',2),
  ('VIDRIOS Y CANCELES','Shutters',3),
  ('VIDRIOS Y CANCELES','Espejos En Baños',4),
  ('COCINAS','Cocinas',1),
  ('COCINAS','Lavanderia',2),
  ('COCINAS','Equipos de Cocina',3),
  ('GRIFERIA Y ACCESORIOS DE BAÑO','Griferia y Accesorios Baños',1),
  ('GRIFERIA Y ACCESORIOS DE BAÑO','Griferia y Accesorios Servicio',2),
  ('GRIFERIA Y ACCESORIOS DE BAÑO','Colocación Griferías',3),
  ('CARPINTERIAS','Puertas De Madera Principales',1),
  ('CARPINTERIAS','Puerta Acceso Calle',2),
  ('CARPINTERIAS','Puertas Servicio',3),
  ('CARPINTERIAS','Vanityes',4),
  ('CARPINTERIAS','Closets',5),
  ('CARPINTERIAS','Mobiliario',6),
  ('CARPINTERIAS','Instalacion',7),
  ('CARPINTERIAS','Porton Cochera',8),
  ('CARPINTERIAS','Puertas Louvers Metalicas',9),
  ('CARPINTERIAS','Chapas Para Puertas Principales',10),
  ('CARPINTERIAS','Chapas Secundarias',11),
  ('CARPINTERIAS','Topes Principales',12),
  ('CARPINTERIAS','Topes Secundarios',13),
  ('CARPINTERIAS','Lavanderia',14),
  ('ALBERCAS','Alberca Completa',1),
  ('JARDINERIA Y RIEGO','Jardineria',1),
  ('JARDINERIA Y RIEGO','Sistema De Riego',2),
  ('PISO HIDRONICO','Piso Hidronico',1),
  ('CASITA','Casita y Acabados',1)
) AS v(partida, nombre, orden)
  ON p.nombre = v.partida AND p.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyout_concepto_catalog cc
  WHERE cc.partida_catalog_id = p.id AND cc.nombre = v.nombre AND cc.deleted_at IS NULL
);

-- -------------------------------------------------------------------------
-- 6. Unidad 'Villa + Casita' (L3) — ya existe como valor en el Excel
-- -------------------------------------------------------------------------
-- tipo='villa' (el CHECK solo admite villa/casita/torre/depto; es villa-céntrica;
-- el nombre 'Villa + Casita' es lo que alimenta el dropdown).
INSERT INTO public.buyout_unit (project_id, tipo, nombre)
SELECT p.id, 'villa', 'Villa + Casita'
FROM public.projects p
WHERE p.nombre = 'NAUKA Lote 3'
  AND NOT EXISTS (
    SELECT 1 FROM public.buyout_unit u
    WHERE u.project_id = p.id AND u.nombre = 'Villa + Casita' AND u.deleted_at IS NULL
  );
