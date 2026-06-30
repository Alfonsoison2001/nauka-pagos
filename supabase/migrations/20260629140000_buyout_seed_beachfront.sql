-- =========================================================================
-- NAUKA Pagos — Módulo BUY-OUT · Seed CIMIENTO de Beachfront (NAUKA Beachfront)
-- =========================================================================
-- Fuente: reference/NAUKA - BUY OUT BF 290626.xlsx (hoja tablero "BUY OUT",
-- "Glosario Deptos", "Glosario Partidas", "UNITARIO"). Se leyeron VALORES
-- calculados (no fórmulas) con openpyxl. Esta migración siembra SOLO el
-- CIMIENTO a nivel proyecto (sin volcado de conceptos/cotizaciones reales):
--   4. 12 capítulos del tablero (orden del prompt de Alfonso).
--   5. 32 partidas (con project_id de BF) → cada una a su capítulo.
--   6. 63 conceptos por partida (nombres EXACTOS del tablero).
--   7. Presupuesto base por partida (col E "PRESUPUESTO IZ MXN BASE").
--   8. TC: MXN 1 · USD 17.5 · EUR 22.
--   9. Meta: área interior total = 2927.60 m² (Torre1 AIA + Torre2 AIA).
--  10. 8 deptos (Glosario Deptos), tipo=depto, solo referencia.
--
-- Requiere 20260629130000 (catálogo por-proyecto) ya aplicada. 100% aditiva,
-- idempotente (WHERE NOT EXISTS), aislada por project_id → NO mezcla con L3 ni
-- toca Pagos. Toda escritura cuelga del project_id de 'NAUKA Beachfront'.
--
-- RECONCILIACIONES (el tablero del Excel difiere de los 12 capítulos del prompt):
--   • PILAS: banda-capítulo en el Excel → partida bajo el capítulo OBRA CIVIL.
--   • GARDEN AND PRIVACY WALLS / INFRAESTRUCTURA: bandas-partida bajo EXTERIORES
--     en el Excel → promovidas a capítulos propios (como pidió el prompt).
--   • EXCAVACION: la banda dice "EXCAVACION - INCLUIDA EN OBRA CIVIL"; se limpió
--     el rótulo (el capítulo ya codifica que va en OBRA CIVIL).
--   • CLOSETS y FFE: partidas BF-propias del Glosario Partidas (no son bandas del
--     tablero) → sembradas con base 0 y sin conceptos (COLOCACIONES / OTROS).
--   • Base por partida = col E de su fila SUBTOTAL. Σ de las 32 bases =
--     427,161,130.02 = TOTAL PRESUPUESTO (col E) del tablero (cuadre exacto).
-- =========================================================================

-- 4. Capítulos del tablero BF (orden del prompt: 12 capítulos).
WITH bf AS (
  SELECT id FROM public.projects
  WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL
)
INSERT INTO public.buyout_chapter (project_id, nombre, orden)
SELECT bf.id, v.nombre, v.orden
FROM bf JOIN (VALUES
  ('DISEÑO', 1),
  ('OBRA CIVIL', 2),
  ('MEP', 3),
  ('ACABADOS', 4),
  ('COLOCACIONES', 5),
  ('ALBERCAS', 6),
  ('JARDINERIA Y RIEGO', 7),
  ('ELEVADOR', 8),
  ('EXTERIORES', 9),
  ('GARDEN AND PRIVACY WALLS', 10),
  ('INFRAESTRUCTURA', 11),
  ('OTROS', 12)
) AS v(nombre, orden) ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyout_chapter c
  WHERE c.project_id = bf.id AND c.nombre = v.nombre AND c.deleted_at IS NULL
);

-- 5. Partidas BF (con project_id de BF). Nombres de la banda del tablero
--    (limpios) + Closets/FFE del Glosario (BF-propias sin banda).
WITH bf AS (
  SELECT id FROM public.projects
  WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL
)
INSERT INTO public.buyout_partida_catalog (project_id, nombre, chapter_default, orden)
SELECT bf.id, v.nombre, v.cap, v.orden
FROM bf JOIN (VALUES
  ('ARQUITECTURA', 'DISEÑO', 1),
  ('INGENIERIAS Y TOPOGRAFIA', 'DISEÑO', 2),
  ('PILAS', 'OBRA CIVIL', 3),
  ('CONDICIONES GENERALES', 'OBRA CIVIL', 4),
  ('PRELIMINARES', 'OBRA CIVIL', 5),
  ('EXCAVACION', 'OBRA CIVIL', 6),
  ('OBRA CIVIL', 'OBRA CIVIL', 7),
  ('ALBAÑILERIA', 'OBRA CIVIL', 8),
  ('IMPERMEABILIZACION', 'OBRA CIVIL', 9),
  ('INSTALACIONES ELECTRICAS', 'MEP', 10),
  ('INSTALACIONES HIDRAULICAS', 'MEP', 11),
  ('INSTALACIONES GAS', 'MEP', 12),
  ('AUTOMATIZACION Y CONTROL ILUMINACION', 'MEP', 13),
  ('AIRE ACONDICIONADO Y EXTRACCION', 'MEP', 14),
  ('ILUMINACION', 'MEP', 15),
  ('ACABADOS', 'ACABADOS', 16),
  ('HERRERIA', 'COLOCACIONES', 17),
  ('SUMINISTRO Y COLOCACION DE MARMOL', 'COLOCACIONES', 18),
  ('MADERA DE INGENIERIA', 'COLOCACIONES', 19),
  ('VIDRIOS Y CANCELES', 'COLOCACIONES', 20),
  ('COCINAS', 'COLOCACIONES', 21),
  ('GRIFERIA Y ACCESORIOS DE BAÑO', 'COLOCACIONES', 22),
  ('CARPINTERIAS', 'COLOCACIONES', 23),
  ('ALBERCAS', 'ALBERCAS', 24),
  ('JARDINERIA Y RIEGO', 'JARDINERIA Y RIEGO', 25),
  ('ELEVADOR', 'ELEVADOR', 26),
  ('EXTERIORES', 'EXTERIORES', 27),
  ('GARDEN AND PRIVACY WALLS', 'GARDEN AND PRIVACY WALLS', 28),
  ('INFRAESTRUCTURA', 'INFRAESTRUCTURA', 29),
  ('OTROS', 'OTROS', 30),
  ('CLOSETS', 'COLOCACIONES', 31),
  ('FFE', 'OTROS', 32)
) AS v(nombre, cap, orden) ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyout_partida_catalog c
  WHERE c.project_id = bf.id AND c.nombre = v.nombre AND c.deleted_at IS NULL
);

-- 6. Conceptos BF por partida (nombres EXACTOS del tablero). Join por
--    (project_id de BF, nombre de partida) → no colisiona con L3.
WITH bf AS (
  SELECT id FROM public.projects
  WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL
)
INSERT INTO public.buyout_concepto_catalog (partida_catalog_id, nombre, orden)
SELECT p.id, v.nombre, v.orden
FROM public.buyout_partida_catalog p
JOIN bf ON p.project_id = bf.id AND p.deleted_at IS NULL
JOIN (VALUES
  ('ARQUITECTURA', 'Supervision Diseño Iluminacion', 1),
  ('ARQUITECTURA', 'Diseño Arquitectonico', 2),
  ('ARQUITECTURA', 'Diseño Jardineria', 3),
  ('ARQUITECTURA', 'Cuantificacion M2', 4),
  ('ARQUITECTURA', 'Supervision Diseño Jardineria', 5),
  ('INGENIERIAS Y TOPOGRAFIA', 'Topografia Gestoria', 1),
  ('INGENIERIAS Y TOPOGRAFIA', 'Topografia Obra', 2),
  ('INGENIERIAS Y TOPOGRAFIA', 'Mecanica De Suelos', 3),
  ('INGENIERIAS Y TOPOGRAFIA', 'Calculo Estructural', 4),
  ('INGENIERIAS Y TOPOGRAFIA', 'Diseño HVAC', 5),
  ('INGENIERIAS Y TOPOGRAFIA', 'Diseño Alberca', 6),
  ('INGENIERIAS Y TOPOGRAFIA', 'Diseño Instalaciones HS-E-G', 7),
  ('INGENIERIAS Y TOPOGRAFIA', 'Diseño Iluminacion', 8),
  ('INGENIERIAS Y TOPOGRAFIA', 'Diseño Acustica', 9),
  ('PILAS', 'Pilas', 1),
  ('CONDICIONES GENERALES', 'Condiciones Generales', 1),
  ('PRELIMINARES', 'Trabajos Preliminares', 1),
  ('PRELIMINARES', 'Plataformas', 2),
  ('EXCAVACION', 'Excavacion', 1),
  ('OBRA CIVIL', 'Obra_Civil', 1),
  ('ALBAÑILERIA', 'Aplanados', 1),
  ('IMPERMEABILIZACION', 'Impermeabilizacion', 1),
  ('INSTALACIONES ELECTRICAS', 'Instalaciones Electricas', 1),
  ('INSTALACIONES HIDRAULICAS', 'Instalaciones Hidrosanitarias', 1),
  ('INSTALACIONES GAS', 'Instalaciones De Gas', 1),
  ('AUTOMATIZACION Y CONTROL ILUMINACION', 'Automatizacion_Control_Iluminacion', 1),
  ('AIRE ACONDICIONADO Y EXTRACCION', 'Aire_Acondicionado_Y_Extraccion', 1),
  ('ILUMINACION', 'Iluminacion', 1),
  ('ACABADOS', 'Acabados', 1),
  ('HERRERIA', 'Herreria ( Rejillas,  Anclajes, Exclusas, Tapajuntas, Soportes, Ductos )', 1),
  ('HERRERIA', 'Pintura Herreria. Primario / Acabado', 2),
  ('SUMINISTRO Y COLOCACION DE MARMOL', 'Suministro de Marmol', 1),
  ('SUMINISTRO Y COLOCACION DE MARMOL', 'Colocacion de Marmol', 2),
  ('MADERA DE INGENIERIA', 'Pisos_Madera', 1),
  ('MADERA DE INGENIERIA', 'Madera_Puertas', 2),
  ('VIDRIOS Y CANCELES', 'Canceles Y Vidrios', 1),
  ('VIDRIOS Y CANCELES', 'Barandal de Vidrio', 2),
  ('VIDRIOS Y CANCELES', 'Canceles de Baño', 3),
  ('VIDRIOS Y CANCELES', 'Celosia Fachada Principal', 4),
  ('COCINAS', 'Cocina Principal', 1),
  ('COCINAS', 'Grill', 2),
  ('COCINAS', 'Laundry', 3),
  ('GRIFERIA Y ACCESORIOS DE BAÑO', 'Griferia_Y_Accesorios_De_Baño', 1),
  ('CARPINTERIAS', 'Vanityes', 1),
  ('CARPINTERIAS', 'Puertas', 2),
  ('CARPINTERIAS', 'Closets', 3),
  ('CARPINTERIAS', 'Envios e Instalacion', 4),
  ('CARPINTERIAS', 'Vigas Madera', 5),
  ('CARPINTERIAS', 'Mobiliario', 6),
  ('ALBERCAS', 'Alberca Completa', 1),
  ('JARDINERIA Y RIEGO', 'Jardineria', 1),
  ('JARDINERIA Y RIEGO', 'Sistema De Riego', 2),
  ('ELEVADOR', 'Elevador', 1),
  ('EXTERIORES', 'Piedra', 1),
  ('EXTERIORES', 'Firme de Concreto', 2),
  ('EXTERIORES', 'Portones Estacionamiento', 3),
  ('EXTERIORES', 'Porton General', 4),
  ('EXTERIORES', 'Señalizacion', 5),
  ('EXTERIORES', 'Garage', 6),
  ('GARDEN AND PRIVACY WALLS', 'Garden and Privacy Walls', 1),
  ('INFRAESTRUCTURA', 'Infraestructura', 1),
  ('OTROS', 'Fire Pit', 1),
  ('OTROS', 'Acustica', 2)
) AS v(partida, nombre, orden) ON p.nombre = v.partida
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyout_concepto_catalog cc
  WHERE cc.partida_catalog_id = p.id AND cc.nombre = v.nombre AND cc.deleted_at IS NULL
);

-- 7. Presupuesto base por partida = col E 'PRESUPUESTO IZ MXN BASE' del
--    tablero (fila SUBTOTAL de cada partida). Σ bases = TOTAL PRESUPUESTO.
WITH bf AS (
  SELECT id FROM public.projects
  WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL
)
INSERT INTO public.buyout_partida_base (project_id, partida_catalog_id, monto_base)
SELECT bf.id, p.id, v.monto_base
FROM bf
JOIN public.buyout_partida_catalog p ON p.project_id = bf.id AND p.deleted_at IS NULL
JOIN (VALUES
  ('ARQUITECTURA', 0.00),
  ('INGENIERIAS Y TOPOGRAFIA', 2229156.10),
  ('PILAS', 8935744.03),
  ('CONDICIONES GENERALES', 11717427.36),
  ('PRELIMINARES', 3163525.71),
  ('EXCAVACION', 0.00),
  ('OBRA CIVIL', 67871865.69),
  ('ALBAÑILERIA', 0.00),
  ('IMPERMEABILIZACION', 1848728.93),
  ('INSTALACIONES ELECTRICAS', 29733862.40),
  ('INSTALACIONES HIDRAULICAS', 16725297.60),
  ('INSTALACIONES GAS', 1856000.00),
  ('AUTOMATIZACION Y CONTROL ILUMINACION', 40600000.00),
  ('AIRE ACONDICIONADO Y EXTRACCION', 18583664.00),
  ('ILUMINACION', 5002959.36),
  ('ACABADOS', 11600000.00),
  ('HERRERIA', 4640000.00),
  ('SUMINISTRO Y COLOCACION DE MARMOL', 28841351.44),
  ('MADERA DE INGENIERIA', 0.00),
  ('VIDRIOS Y CANCELES', 31332728.96),
  ('COCINAS', 29469347.60),
  ('GRIFERIA Y ACCESORIOS DE BAÑO', 7272472.56),
  ('CARPINTERIAS', 44430878.00),
  ('ALBERCAS', 31240192.00),
  ('JARDINERIA Y RIEGO', 6130600.00),
  ('ELEVADOR', 3000000.00),
  ('EXTERIORES', 17521958.69),
  ('GARDEN AND PRIVACY WALLS', 2601369.60),
  ('INFRAESTRUCTURA', 812000.00),
  ('OTROS', 0.00),
  ('CLOSETS', 0.00),
  ('FFE', 0.00)
) AS v(partida, monto_base) ON p.nombre = v.partida
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyout_partida_base b
  WHERE b.project_id = bf.id AND b.partida_catalog_id = p.id AND b.deleted_at IS NULL
);

-- 8. Tipo de cambio BF: MXN 1 · USD 17.5 · EUR 22.
WITH bf AS (
  SELECT id FROM public.projects
  WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL
)
INSERT INTO public.buyout_fx (project_id, currency, rate)
SELECT bf.id, v.cur, v.rate
FROM bf JOIN (VALUES ('MXN', 1.0), ('USD', 17.5), ('EUR', 22.0)) AS v(cur, rate) ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyout_fx fx
  WHERE fx.project_id = bf.id AND fx.currency = v.cur AND fx.deleted_at IS NULL
);

-- 9. Meta: área interior total = Torre1 AIA (1463.8) + Torre2 AIA (1463.8)
--    = 2927.6 m² (hoja UNITARIO). Ext. techada = 521.26 ×2 = 1042.52.
WITH bf AS (
  SELECT id FROM public.projects
  WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL
)
INSERT INTO public.buyout_project_meta (project_id, area_int, area_ext_techada)
SELECT bf.id, 2927.60, 1042.52
FROM bf
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyout_project_meta m WHERE m.project_id = bf.id
);

-- 10. 8 deptos de 'Glosario Deptos' (tipo='depto'; solo referencia, no
--     entran al rollup aún). Nombre = 'T# · <id> (<tipo>)'.
WITH bf AS (
  SELECT id FROM public.projects
  WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL
)
INSERT INTO public.buyout_unit (project_id, tipo, nombre)
SELECT bf.id, 'depto', v.nombre
FROM bf JOIN (VALUES
  ('T1 · 101 (PB)'),
  ('T1 · 201 (PB)'),
  ('T1 · 102/103 (Dúplex)'),
  ('T1 · 202/203 (Dúplex)'),
  ('T2 · 301 (PB)'),
  ('T2 · 401 (PB)'),
  ('T2 · 302/303 (Dúplex)'),
  ('T2 · 402/403 (Dúplex)')
) AS v(nombre) ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyout_unit u
  WHERE u.project_id = bf.id AND u.nombre = v.nombre AND u.deleted_at IS NULL
);

-- -------------------------------------------------------------------------
-- 11. Auto-verificación (transaccional): si algún conteo de BF no cuadra,
--     RAISE EXCEPTION → rollback de TODO el push. El cimiento se prueba al
--     aplicarse. Aislamiento: todo se cuenta por project_id de Beachfront.
-- -------------------------------------------------------------------------
DO $$
DECLARE
  bf uuid;
  n_ch int; n_pa int; n_co int; n_ba int; n_fx int; n_un int; n_me int;
  sum_ba numeric;
BEGIN
  SELECT id INTO bf FROM public.projects
   WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL;
  IF bf IS NULL THEN
    RAISE EXCEPTION 'BF seed: proyecto NAUKA Beachfront no encontrado';
  END IF;

  SELECT count(*) INTO n_ch FROM public.buyout_chapter
   WHERE project_id = bf AND deleted_at IS NULL;
  SELECT count(*) INTO n_pa FROM public.buyout_partida_catalog
   WHERE project_id = bf AND deleted_at IS NULL;
  SELECT count(*) INTO n_co FROM public.buyout_concepto_catalog cc
   JOIN public.buyout_partida_catalog p ON p.id = cc.partida_catalog_id
   WHERE p.project_id = bf AND cc.deleted_at IS NULL AND p.deleted_at IS NULL;
  SELECT count(*), coalesce(sum(monto_base), 0) INTO n_ba, sum_ba
   FROM public.buyout_partida_base WHERE project_id = bf AND deleted_at IS NULL;
  SELECT count(*) INTO n_fx FROM public.buyout_fx
   WHERE project_id = bf AND deleted_at IS NULL;
  SELECT count(*) INTO n_un FROM public.buyout_unit
   WHERE project_id = bf AND deleted_at IS NULL;
  SELECT count(*) INTO n_me FROM public.buyout_project_meta WHERE project_id = bf;

  IF n_ch <> 12 THEN RAISE EXCEPTION 'BF capítulos = % (esperado 12)', n_ch; END IF;
  IF n_pa <> 32 THEN RAISE EXCEPTION 'BF partidas = % (esperado 32)', n_pa; END IF;
  IF n_co <> 63 THEN RAISE EXCEPTION 'BF conceptos = % (esperado 63)', n_co; END IF;
  IF n_ba <> 32 THEN RAISE EXCEPTION 'BF bases = % (esperado 32)', n_ba; END IF;
  IF n_fx <> 3  THEN RAISE EXCEPTION 'BF fx = % (esperado 3)', n_fx; END IF;
  IF n_un <> 8  THEN RAISE EXCEPTION 'BF deptos = % (esperado 8)', n_un; END IF;
  IF n_me <> 1  THEN RAISE EXCEPTION 'BF meta = % (esperado 1)', n_me; END IF;

  RAISE NOTICE 'BF seed OK: 12 cap / 32 part / 63 con / 32 bases (Sigma=%) / 3 fx / 8 deptos / 1 meta', sum_ba;
END $$;
