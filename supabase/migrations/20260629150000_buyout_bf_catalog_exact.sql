-- =========================================================================
-- NAUKA Pagos — Módulo BUY-OUT · Catálogo de Beachfront EXACTO al doc oficial
-- =========================================================================
-- El seed previo de BF (20260629140000) tenía desviaciones vs el tablero real:
-- 12 capítulos (promovió GARDEN AND PRIVACY WALLS e INFRAESTRUCTURA a capítulo,
-- y metió PILAS dentro de OBRA CIVIL) + 2 partidas del glosario (Closets, FFE)
-- que NO están en el tablero. Esta migración deja el catálogo de BF EXACTAMENTE
-- como docs/future-modules/buyout-catalogo-BF.md (confirmado por Alfonso):
--   • 11 capítulos: DISEÑO · PILAS · OBRA CIVIL · MEP · ACABADOS · COLOCACIONES ·
--     ALBERCAS · JARDINERIA Y RIEGO · ELEVADOR · EXTERIORES · OTROS.
--   • PILAS = capítulo propio. GARDEN AND PRIVACY WALLS e INFRAESTRUCTURA =
--     partidas dentro de EXTERIORES. Sin Closets/FFE como partidas.
--   • "Closets" sigue como CONCEPTO dentro de CARPINTERIAS. OTROS gana el
--     concepto "Otros" (Otros · Fire Pit · Acustica). → 30 partidas, 64 conceptos.
--
-- Estrategia: LIMPIAR el catálogo de BF (hard delete; seguro porque aún NO hay
-- buyout_item de BF — etapa 2 pendiente) y RE-SEMBRAR desde el doc. El borrado
-- de partidas hace CASCADE sobre buyout_concepto_catalog y buyout_partida_base
-- de BF. Se CONSERVAN TC, área (project_meta) y los 8 deptos (no se tocan).
--
-- Aislamiento: TODO filtra por el project_id de 'NAUKA Beachfront'. NO toca L3,
-- ni Pagos, ni la migración de catálogo por-proyecto (20260629130000). Aditiva
-- en estructura (cero DDL); auto-verificada con DO-blocks transaccionales →
-- cualquier conteo errado (o tocar L3) hace rollback de TODO el push.
-- =========================================================================

-- 0. Guard: BF debe existir y NO tener buyout_item (si los tuviera, limpiar el
--    catálogo no sería seguro → abortar antes de borrar nada).
DO $$
DECLARE bf uuid; n int;
BEGIN
  SELECT id INTO bf FROM public.projects
   WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL;
  IF bf IS NULL THEN RAISE EXCEPTION 'NAUKA Beachfront no encontrado'; END IF;
  SELECT count(*) INTO n FROM public.buyout_item WHERE project_id = bf;
  IF n > 0 THEN
    RAISE EXCEPTION 'BF tiene % buyout_item: abortado (no es seguro re-sembrar el catálogo)', n;
  END IF;
END $$;

-- 0b. Limpieza del catálogo BF previo (hard delete). El CASCADE de las FKs
--     (partida_catalog_id ON DELETE CASCADE en concepto_catalog y partida_base)
--     borra los conceptos y las bases de BF automáticamente.
DELETE FROM public.buyout_partida_catalog
WHERE project_id = (SELECT id FROM public.projects
                    WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL);

DELETE FROM public.buyout_chapter
WHERE project_id = (SELECT id FROM public.projects
                    WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL);

-- (generado: 11 capítulos / 30 partidas / 64 conceptos / Σbase=427161130.02)

-- 1. Capítulos BF = los 11 del doc, en orden.
WITH bf AS (
  SELECT id FROM public.projects
  WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL
)
INSERT INTO public.buyout_chapter (project_id, nombre, orden)
SELECT bf.id, v.nombre, v.orden
FROM bf JOIN (VALUES
  ('DISEÑO', 1),
  ('PILAS', 2),
  ('OBRA CIVIL', 3),
  ('MEP', 4),
  ('ACABADOS', 5),
  ('COLOCACIONES', 6),
  ('ALBERCAS', 7),
  ('JARDINERIA Y RIEGO', 8),
  ('ELEVADOR', 9),
  ('EXTERIORES', 10),
  ('OTROS', 11)
) AS v(nombre, orden) ON TRUE;

-- 2. Partidas BF (30), cada una a su capítulo del doc.
WITH bf AS (
  SELECT id FROM public.projects
  WHERE nombre = 'NAUKA Beachfront' AND deleted_at IS NULL
)
INSERT INTO public.buyout_partida_catalog (project_id, nombre, chapter_default, orden)
SELECT bf.id, v.nombre, v.cap, v.orden
FROM bf JOIN (VALUES
  ('ARQUITECTURA', 'DISEÑO', 1),
  ('INGENIERIAS Y TOPOGRAFIA', 'DISEÑO', 2),
  ('PILAS', 'PILAS', 3),
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
  ('GARDEN AND PRIVACY WALLS', 'EXTERIORES', 28),
  ('INFRAESTRUCTURA', 'EXTERIORES', 29),
  ('OTROS', 'OTROS', 30)
) AS v(nombre, cap, orden) ON TRUE;

-- 3. Conceptos BF por partida (nombres EXACTOS del doc; 64 en total).
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
  ('OTROS', 'Otros', 1),
  ('OTROS', 'Fire Pit', 2),
  ('OTROS', 'Acustica', 3)
) AS v(partida, nombre, orden) ON p.nombre = v.partida;

-- 4. Bases por partida = col E 'PRESUPUESTO IZ MXN BASE' (fila SUBTOTAL).
--    Σ = 427,161,130 = TOTAL PRESUPUESTO del tablero (Closets/FFE eran 0).
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
  ('OTROS', 0.00)
) AS v(partida, monto_base) ON p.nombre = v.partida;

-- -------------------------------------------------------------------------
-- 5. Auto-verificación transaccional: conteos EXACTOS del doc + conservación
--    (TC/área/deptos) + L3 intacto. Cualquier desviación → rollback de TODO.
-- -------------------------------------------------------------------------
DO $$
DECLARE
  bf uuid; l3 uuid;
  n_ch int; n_pa int; n_co int; n_ba int; n_fx int; n_un int; n_me int;
  sum_ba numeric; n_l3p int; n_l3c int; bad int;
BEGIN
  SELECT id INTO bf FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL;
  SELECT id INTO l3 FROM public.projects WHERE nombre='NAUKA Lote 3'    AND deleted_at IS NULL;

  SELECT count(*) INTO n_ch FROM public.buyout_chapter
   WHERE project_id=bf AND deleted_at IS NULL;
  SELECT count(*) INTO n_pa FROM public.buyout_partida_catalog
   WHERE project_id=bf AND deleted_at IS NULL;
  SELECT count(*) INTO n_co FROM public.buyout_concepto_catalog cc
   JOIN public.buyout_partida_catalog p ON p.id=cc.partida_catalog_id
   WHERE p.project_id=bf AND cc.deleted_at IS NULL AND p.deleted_at IS NULL;
  SELECT count(*), coalesce(sum(monto_base),0) INTO n_ba, sum_ba
   FROM public.buyout_partida_base WHERE project_id=bf AND deleted_at IS NULL;
  SELECT count(*) INTO n_fx FROM public.buyout_fx WHERE project_id=bf AND deleted_at IS NULL;
  SELECT count(*) INTO n_un FROM public.buyout_unit WHERE project_id=bf AND deleted_at IS NULL;
  SELECT count(*) INTO n_me FROM public.buyout_project_meta WHERE project_id=bf;

  IF n_ch <> 11 THEN RAISE EXCEPTION 'BF capítulos = % (esperado 11)', n_ch; END IF;
  IF n_pa <> 30 THEN RAISE EXCEPTION 'BF partidas = % (esperado 30)', n_pa; END IF;
  IF n_co <> 64 THEN RAISE EXCEPTION 'BF conceptos = % (esperado 64)', n_co; END IF;
  IF n_ba <> 30 THEN RAISE EXCEPTION 'BF bases = % (esperado 30)', n_ba; END IF;
  IF n_fx <> 3  THEN RAISE EXCEPTION 'BF fx = % (esperado 3, debe conservarse)', n_fx; END IF;
  IF n_un <> 8  THEN RAISE EXCEPTION 'BF deptos = % (esperado 8, debe conservarse)', n_un; END IF;
  IF n_me <> 1  THEN RAISE EXCEPTION 'BF meta = % (esperado 1, debe conservarse)', n_me; END IF;

  -- Sin Closets/FFE como partidas; toda partida BF cuelga de uno de los 11 capítulos.
  SELECT count(*) INTO bad FROM public.buyout_partida_catalog p
   WHERE p.project_id=bf AND p.deleted_at IS NULL
     AND (p.nombre IN ('CLOSETS','FFE')
          OR p.chapter_default NOT IN (
            SELECT nombre FROM public.buyout_chapter WHERE project_id=bf AND deleted_at IS NULL));
  IF bad > 0 THEN RAISE EXCEPTION 'BF: % partida(s) inválida(s) (Closets/FFE o capítulo fuera de los 11)', bad; END IF;

  -- L3 intacto (esta migración nunca toca L3; red de seguridad).
  SELECT count(*) INTO n_l3p FROM public.buyout_partida_catalog WHERE project_id=l3 AND deleted_at IS NULL;
  SELECT count(*) INTO n_l3c FROM public.buyout_chapter WHERE project_id=l3 AND deleted_at IS NULL;
  IF n_l3p <> 24 THEN RAISE EXCEPTION 'L3 partidas activas = % (esperado 24) — L3 fue afectado!', n_l3p; END IF;
  IF n_l3c <> 8  THEN RAISE EXCEPTION 'L3 capítulos = % (esperado 8) — L3 fue afectado!', n_l3c; END IF;

  RAISE NOTICE 'BF catálogo EXACTO OK: 11 cap / 30 part / 64 con / 30 bases (Sigma=%) / fx 3 / deptos 8 / meta 1 · L3 intacto (24 part / 8 cap)', sum_ba;
END $$;
