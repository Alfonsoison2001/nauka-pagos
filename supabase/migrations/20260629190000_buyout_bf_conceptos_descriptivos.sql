-- =========================================================================
-- NAUKA Pagos — BUY-OUT · BF: conceptos descriptivos sin torre + estado por línea
-- =========================================================================
-- Ajuste 3 de Alfonso: los conceptos (buyout_item) de BF deben ser DESCRIPTIVOS
-- (nombre del origen: concepto/detalle) y SIN sufijo '· Torre X'/estado (la torre
-- ya está en la columna). Conceptos duplicados por (partida, concepto) se
-- CONSOLIDAN en 1 item con sus líneas por torre. Mismas 109 líneas y mismo cuadre;
-- solo cambia el NOMBRE del concepto y el agrupamiento item↔líneas.
--
-- Para no perder el 'parcial' al consolidar (una torre contratada y la otra no, ej.
-- PILAS), se agrega ESTADO POR LÍNEA: columnas nullable buyout_line.kind/contratado.
-- El rollup (lib/buyout/rollup.ts) lee el estado de la LÍNEA y cae al de la cotización
-- si es NULL → L3 (líneas sin estado) queda IDÉNTICO; BF usa el estado por torre.
--
-- AISLAMIENTO: las 2 columnas son ADITIVAS y nullable (no cambian L3 ni Pagos; Pagos
-- no usa buyout_line). El re-volcado filtra por project_id de BF. Idempotente (cleanup
-- primero). Verificado transaccional: cuadre por partida + 109 líneas + L3/Pagos intactos.
-- =========================================================================

-- 0. Columnas de estado por línea (aditivas, nullable, idempotentes).
ALTER TABLE public.buyout_line ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE public.buyout_line ADD COLUMN IF NOT EXISTS contratado boolean;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='buyout_line_kind_chk') THEN
    ALTER TABLE public.buyout_line ADD CONSTRAINT buyout_line_kind_chk CHECK (kind IS NULL OR kind IN ('parametrico','ppto'));
  END IF;
END $$;
COMMENT ON COLUMN public.buyout_line.kind IS 'Estado madurez POR LÍNEA (override del de la cotización; NULL = usar el de la cotización). Para BF agrupado por torre.';
COMMENT ON COLUMN public.buyout_line.contratado IS 'Estado contratación POR LÍNEA (override; NULL = usar el de la cotización).';

DO $$ DECLARE bf uuid; BEGIN
  SELECT id INTO bf FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL;
  IF bf IS NULL THEN RAISE EXCEPTION 'NAUKA Beachfront no encontrado'; END IF;
END $$;

-- 1. Limpieza idempotente del transaccional de BF (CASCADE quote->line).
DELETE FROM public.buyout_item  WHERE project_id=(SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL);
DELETE FROM public.buyout_falta WHERE project_id=(SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL);
DELETE FROM public.buyout_import_batch WHERE project_id=(SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL);

-- 2. Red de seguridad CONTINGENCIAS (no-op si ya existe).
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_chapter (project_id, nombre, orden) SELECT bf.id,'CONTINGENCIAS',12 FROM bf
WHERE NOT EXISTS (SELECT 1 FROM public.buyout_chapter c JOIN bf ON c.project_id=bf.id WHERE c.nombre='CONTINGENCIAS' AND c.deleted_at IS NULL);
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_partida_catalog (project_id, nombre, chapter_default, orden) SELECT bf.id,'CONTINGENCIAS','CONTINGENCIAS',31 FROM bf
WHERE NOT EXISTS (SELECT 1 FROM public.buyout_partida_catalog p JOIN bf ON p.project_id=bf.id WHERE p.nombre='CONTINGENCIAS' AND p.deleted_at IS NULL);
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_partida_base (project_id, partida_catalog_id, monto_base)
SELECT bf.id,p.id,0 FROM bf JOIN public.buyout_partida_catalog p ON p.project_id=bf.id AND p.nombre='CONTINGENCIAS' AND p.deleted_at IS NULL
WHERE NOT EXISTS (SELECT 1 FROM public.buyout_partida_base b WHERE b.partida_catalog_id=p.id AND b.deleted_at IS NULL);

-- 3. Proveedores GLOBALES usados (idempotente).
WITH v(nombre) AS (VALUES
  ('427 ARCHITECTURE'),
  ('ABIKAR PROYECTO Y CONSTRUCCION S.A DE C.V'),
  ('ADC'),
  ('AOR'),
  ('AQUA CONCEPTS'),
  ('AQUACONCEPTS'),
  ('ARTEC'),
  ('AX FERRO'),
  ('CYVS'),
  ('CYVSA'),
  ('DIECI'),
  ('GERMAN C'),
  ('Grupo Aliglass'),
  ('HAMUI'),
  ('MAM'),
  ('MyT'),
  ('R&R Impermeabilizante S.A. de C.V.'),
  ('SAAD'),
  ('Samstordam'),
  ('Samsung'),
  ('SRD'),
  ('Tecnologias SHIN'),
  ('Tracsa'),
  ('UNINAPS'),
  ('URARQ')
)
INSERT INTO public.buyout_supplier (nombre) SELECT v.nombre FROM v
WHERE NOT EXISTS (SELECT 1 FROM public.buyout_supplier s WHERE lower(s.nombre)=lower(v.nombre) AND s.deleted_at IS NULL);

-- 4. Staging: 1 fila = 1 línea (con su concepto descriptivo + estado por línea + estado dominante del item).
CREATE TEMP TABLE _bf_d (
  partida text, concepto text, torre text, detalle text,
  line_kind text, line_contratado boolean, supplier text, cantidad numeric, unitario numeric, notas text,
  q_kind text, q_contratado boolean, q_supplier text) ON COMMIT DROP;
INSERT INTO _bf_d VALUES
('ARQUITECTURA','Diseño Arquitectónico','Compartido','por concepto','ppto',true,'AOR',1,2767000.00,NULL,'ppto',true,'AOR'),
('ARQUITECTURA','Diseño Jardinería','Compartido','por concepto','ppto',false,NULL,1,162400.00,NULL,'ppto',false,NULL),
('INGENIERIAS Y TOPOGRAFIA','Mecanica De Suelos','Torre 1','Mecanica De Suelos','ppto',true,'Samstordam',1,97692.30,NULL,'ppto',true,'Samstordam'),
('INGENIERIAS Y TOPOGRAFIA','Mecanica De Suelos','Torre 2','Mecanica De Suelos','ppto',true,'Samstordam',1,97692.30,NULL,'ppto',true,'Samstordam'),
('INGENIERIAS Y TOPOGRAFIA','Calculo Estructural','Torre 1','Calculo Estructural','ppto',true,'MyT',1,214600.00,NULL,'ppto',true,'MyT'),
('INGENIERIAS Y TOPOGRAFIA','Calculo Estructural','Torre 2','Calculo Estructural','ppto',true,'MyT',1,214600.00,NULL,'ppto',true,'MyT'),
('INGENIERIAS Y TOPOGRAFIA','Diseño HVAC','Torre 1','Diseño HVAC','ppto',true,'CYVS',1,75400.00,NULL,'ppto',true,'CYVS'),
('INGENIERIAS Y TOPOGRAFIA','Diseño HVAC','Torre 2','Diseño HVAC','ppto',true,'CYVS',1,75400.00,NULL,'ppto',true,'CYVS'),
('INGENIERIAS Y TOPOGRAFIA','Diseño Alberca','Torre 1','Diseño Alberca','ppto',true,'AQUACONCEPTS',1,69600.00,NULL,'ppto',true,'AQUACONCEPTS'),
('INGENIERIAS Y TOPOGRAFIA','Diseño Alberca','Torre 2','Diseño Alberca','ppto',true,'AQUACONCEPTS',1,69600.00,NULL,'ppto',true,'AQUACONCEPTS'),
('INGENIERIAS Y TOPOGRAFIA','Diseño Instalaciones HS-E-G','Torre 1','Diseño Instalaciones HS-E-G','ppto',true,'UNINAPS',1,220864.00,NULL,'ppto',true,'UNINAPS'),
('INGENIERIAS Y TOPOGRAFIA','Diseño Instalaciones HS-E-G','Torre 2','Diseño Instalaciones HS-E-G','ppto',true,'UNINAPS',1,220864.00,NULL,'ppto',true,'UNINAPS'),
('INGENIERIAS Y TOPOGRAFIA','Diseño Iluminacion','Torre 1','Diseño Iluminacion','ppto',true,'ARTEC',1,336421.75,NULL,'ppto',true,'ARTEC'),
('INGENIERIAS Y TOPOGRAFIA','Diseño Iluminacion','Torre 2','Diseño Iluminacion','ppto',true,'ARTEC',1,336421.75,NULL,'ppto',true,'ARTEC'),
('INGENIERIAS Y TOPOGRAFIA','Diseño Acustica','Torre 1','Diseño Acustica','ppto',true,'SAAD',1,100000.00,NULL,'ppto',true,'SAAD'),
('INGENIERIAS Y TOPOGRAFIA','Diseño Acustica','Torre 2','Diseño Acustica','ppto',true,'SAAD',1,100000.00,NULL,'ppto',true,'SAAD'),
('PILAS','Mano de Obra','Torre 1','Mano de Obra','ppto',true,'MAM',1,2534821.93,NULL,'ppto',true,'MAM'),
('PILAS','Mano de Obra','Torre 2','Mano de Obra','ppto',false,'MAM',1,2534821.92,NULL,'ppto',true,'MAM'),
('PILAS','Concreto','Torre 1','Concreto','ppto',true,'MAM',1,1005145.41,NULL,'ppto',false,'MAM'),
('PILAS','Concreto','Torre 2','Concreto','ppto',false,'MAM',1,1005145.41,NULL,'ppto',false,'MAM'),
('PILAS','Varilla','Torre 1','Varilla','ppto',true,'Tecnologias SHIN',1,642872.00,NULL,'ppto',false,'Tecnologias SHIN'),
('PILAS','Varilla','Torre 2','Varilla','ppto',false,'Tecnologias SHIN',1,642872.00,NULL,'ppto',false,'Tecnologias SHIN'),
('CONDICIONES GENERALES','Condiciones Generales','Torre 1','(igual que re-volcado agrupado)','ppto',true,'Tracsa',1,2512208.68,NULL,'parametrico',false,'Tracsa'),
('CONDICIONES GENERALES','Condiciones Generales','Torre 1','(igual que re-volcado agrupado)','parametrico',false,NULL,1,7344888.00,NULL,'parametrico',false,'Tracsa'),
('CONDICIONES GENERALES','Condiciones Generales','Torre 2','(igual que re-volcado agrupado)','ppto',false,'Tracsa',1,2512208.68,NULL,'parametrico',false,'Tracsa'),
('CONDICIONES GENERALES','Condiciones Generales','Torre 2','(igual que re-volcado agrupado)','parametrico',false,NULL,1,6231288.00,NULL,'parametrico',false,'Tracsa'),
('PRELIMINARES','Despalme','Compartido','ppto (ambas torres)','ppto',true,'URARQ',1,8574.72,NULL,'ppto',true,'URARQ'),
('PRELIMINARES','Malla','Compartido','ppto (ambas torres)','ppto',true,'ABIKAR PROYECTO Y CONSTRUCCION S.A DE C.V',1,479932.72,NULL,'ppto',true,'ABIKAR PROYECTO Y CONSTRUCCION S.A DE C.V'),
('PRELIMINARES','Plataformas','Compartido','ppto (ambas torres)','ppto',true,'URARQ',1,1200109.00,NULL,'ppto',true,'URARQ'),
('OBRA CIVIL','Obra Civil','Torre 1','Torre','ppto',true,'ADC',1,32999999.95,NULL,'ppto',false,'ADC'),
('OBRA CIVIL','Obra Civil','Torre 2','Torre','parametrico',false,'ADC',1,32999999.95,NULL,'ppto',false,'ADC'),
('ALBAÑILERIA','Albañilería','Torre 1','Torre','ppto',true,'ADC',1,3247500.91,NULL,'ppto',false,'ADC'),
('ALBAÑILERIA','Albañilería','Torre 2','Torre','parametrico',false,'ADC',1,3247500.91,NULL,'ppto',false,'ADC'),
('IMPERMEABILIZACION','Impermeabilización','Torre 1','1 ppto ambas torres (50%)','parametrico',false,'R&R Impermeabilizante S.A. de C.V.',0.5,2788215.57,'Pareja de villas Torre 1 (depto 101 PB + depto 103 N1R) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 1 (depto 102 N1 + 104 — verificar con proveedor, 104 no existe en NAUKA) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 2 (depto 201 PB + depto 203 N1R) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 2 (depto 202 N1 + 204 — verificar con proveedor, 204 no existe en NAUKA) (R&R folio 26036 B v2 22/04/26) | Roof Garden general (todas las villas) (','parametrico',false,'R&R Impermeabilizante S.A. de C.V.'),
('IMPERMEABILIZACION','Impermeabilización','Torre 2','1 ppto ambas torres (50%)','parametrico',false,'R&R Impermeabilizante S.A. de C.V.',0.5,2788215.57,'Pareja de villas Torre 1 (depto 101 PB + depto 103 N1R) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 1 (depto 102 N1 + 104 — verificar con proveedor, 104 no existe en NAUKA) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 2 (depto 201 PB + depto 203 N1R) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 2 (depto 202 N1 + 204 — verificar con proveedor, 204 no existe en NAUKA) (R&R folio 26036 B v2 22/04/26) | Roof Garden general (todas las villas) (','parametrico',false,'R&R Impermeabilizante S.A. de C.V.'),
('INSTALACIONES ELECTRICAS','Instalaciones Eléctricas','Torre 1','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,29733862.40,NULL,'parametrico',false,NULL),
('INSTALACIONES ELECTRICAS','Instalaciones Eléctricas','Torre 2','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,29733862.40,NULL,'parametrico',false,NULL),
('INSTALACIONES HIDRAULICAS','Instalaciones Hidráulicas','Torre 1','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,16725297.60,NULL,'parametrico',false,NULL),
('INSTALACIONES HIDRAULICAS','Instalaciones Hidráulicas','Torre 2','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,16725297.60,NULL,'parametrico',false,NULL),
('INSTALACIONES GAS','Instalaciones de Gas','Torre 1','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,1856000.00,NULL,'parametrico',false,NULL),
('INSTALACIONES GAS','Instalaciones de Gas','Torre 2','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,1856000.00,NULL,'parametrico',false,NULL),
('AUTOMATIZACION Y CONTROL ILUMINACION','Automatización y Control de Iluminación','Torre 1','1 ppto ambas torres (50%)','ppto',false,'SRD',0.5,19660847.60,'SRD cot. 1238 draft4 (17-jun-2026); TODAS las secciones incl. Alarma e Intrusion; sin IVA, IVA 16%','ppto',false,'SRD'),
('AUTOMATIZACION Y CONTROL ILUMINACION','Automatización y Control de Iluminación','Torre 2','1 ppto ambas torres (50%)','ppto',false,'SRD',0.5,19660847.60,'SRD cot. 1238 draft4 (17-jun-2026); TODAS las secciones incl. Alarma e Intrusion; sin IVA, IVA 16%','ppto',false,'SRD'),
('AIRE ACONDICIONADO Y EXTRACCION','Aire Acondicionado y Extracción','Torre 1','1 ppto ambas torres (50%)','ppto',false,'CYVSA',0.5,15759688.32,NULL,'ppto',false,'CYVSA'),
('AIRE ACONDICIONADO Y EXTRACCION','Aire Acondicionado y Extracción','Torre 2','1 ppto ambas torres (50%)','ppto',false,'CYVSA',0.5,15759688.32,NULL,'ppto',false,'CYVSA'),
('ILUMINACION','Iluminación','Torre 1','1 ppto ambas torres (50%)','ppto',false,'427 ARCHITECTURE',0.5,7428736.28,'TIPO-1 | TIPO-2 N1 | TIPO-2 N1R','ppto',false,'427 ARCHITECTURE'),
('ILUMINACION','Iluminación','Torre 2','1 ppto ambas torres (50%)','ppto',false,'427 ARCHITECTURE',0.5,7428736.28,'TIPO-1 | TIPO-2 N1 | TIPO-2 N1R','ppto',false,'427 ARCHITECTURE'),
('ACABADOS','Acabados','Torre 1','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,16880129.76,NULL,'parametrico',false,NULL),
('ACABADOS','Acabados','Torre 2','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,16880129.76,NULL,'parametrico',false,NULL),
('HERRERIA','Herrería','Torre 1','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,4640000.00,NULL,'parametrico',false,NULL),
('HERRERIA','Herrería','Torre 2','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,4640000.00,NULL,'parametrico',false,NULL),
('SUMINISTRO Y COLOCACION DE MARMOL','Suministro de Marmol','Torre 1','Suministro de Marmol','parametrico',false,NULL,1,4481691.90,NULL,'parametrico',false,NULL),
('SUMINISTRO Y COLOCACION DE MARMOL','Suministro de Marmol','Torre 2','Suministro de Marmol','parametrico',false,NULL,1,4257884.40,NULL,'parametrico',false,NULL),
('SUMINISTRO Y COLOCACION DE MARMOL','Colocacion de Marmol','Torre 1','Colocacion de Marmol','parametrico',false,NULL,1,6317051.44,NULL,'parametrico',false,NULL),
('SUMINISTRO Y COLOCACION DE MARMOL','Colocacion de Marmol','Torre 2','Colocacion de Marmol','parametrico',false,NULL,1,6317051.44,NULL,'parametrico',false,NULL),
('VIDRIOS Y CANCELES','Canceles Y Vidrios','Torre 1','Canceles Y Vidrios','ppto',false,'AX FERRO',1,14076186.60,NULL,'ppto',false,'AX FERRO'),
('VIDRIOS Y CANCELES','Canceles Y Vidrios','Torre 2','Canceles Y Vidrios','ppto',false,'AX FERRO',1,14076186.60,NULL,'ppto',false,'AX FERRO'),
('VIDRIOS Y CANCELES','Barandal de Vidrio','Torre 1','Barandal de Vidrio','ppto',false,'Grupo Aliglass',1,260736.68,NULL,'ppto',false,'Grupo Aliglass'),
('VIDRIOS Y CANCELES','Barandal de Vidrio','Torre 2','Barandal de Vidrio','ppto',false,'Grupo Aliglass',1,260736.68,NULL,'ppto',false,'Grupo Aliglass'),
('VIDRIOS Y CANCELES','Canceles de Baño','Torre 1','Canceles de Baño','ppto',false,'Grupo Aliglass',1,1298380.31,NULL,'ppto',false,'Grupo Aliglass'),
('VIDRIOS Y CANCELES','Canceles de Baño','Torre 2','Canceles de Baño','ppto',false,'Grupo Aliglass',1,1298380.31,NULL,'ppto',false,'Grupo Aliglass'),
('VIDRIOS Y CANCELES','Celosia Fachada Principal','Torre 1','Celosia Fachada Principal','parametrico',false,'Grupo Aliglass',1,3522653.20,NULL,'parametrico',false,'Grupo Aliglass'),
('VIDRIOS Y CANCELES','Celosia Fachada Principal','Torre 2','Celosia Fachada Principal','parametrico',false,'Grupo Aliglass',1,3522653.20,NULL,'parametrico',false,'Grupo Aliglass'),
('COCINAS','Cocina Principal','Torre 1','Cocina Principal','ppto',false,'DIECI',1,7465343.81,NULL,'ppto',false,'DIECI'),
('COCINAS','Cocina Principal','Torre 2','Cocina Principal','ppto',false,'DIECI',1,7465343.80,NULL,'ppto',false,'DIECI'),
('COCINAS','Grill','Torre 1','Grill','ppto',false,'DIECI',1,5161371.64,'PARAMETRICO - asador OG42, se solicita al ponerse a la venta (no en cot. BOA 25-jun) | PARAMETRICO - cubrevinil, junto con asador','ppto',false,'DIECI'),
('COCINAS','Grill','Torre 2','Grill','ppto',false,'DIECI',1,5161371.64,'PARAMETRICO - asador OG42, se solicita al ponerse a la venta (no en cot. BOA 25-jun) | PARAMETRICO - cubrevinil, junto con asador','ppto',false,'DIECI'),
('COCINAS','Laundry','Torre 1','Laundry','parametrico',false,'Samsung',1,313200.00,'Paquete lavadora+secadora Samsung $45,000 MXN (junta 22-06-26)','parametrico',false,'Samsung'),
('COCINAS','Laundry','Torre 2','Laundry','parametrico',false,'Samsung',1,313200.00,'Paquete lavadora+secadora Samsung $45,000 MXN (junta 22-06-26)','parametrico',false,'Samsung'),
('CARPINTERIAS','Carpinterías','Torre 1','Ppto','ppto',true,'HAMUI',1,22441706.26,'SIHASI v2 mayo 2026 (folio 2511 S004 D) | ENVÍOS: $200K/torre / 4 villas/torre = $50K/villa | Revisar','ppto',true,'HAMUI'),
('CARPINTERIAS','Carpinterías','Torre 1','Paramétrico','parametrico',false,NULL,1,371200.00,'CON INSTALACION E IMPORTACION','ppto',true,'HAMUI'),
('CARPINTERIAS','Carpinterías','Torre 2','Ppto','ppto',true,'HAMUI',1,23039192.83,'SIHASI v2 mayo 2026 (folio 2511 S004 D) | ENVÍOS: $200K/torre / 4 villas/torre = $50K/villa | Revisar','ppto',true,'HAMUI'),
('CARPINTERIAS','Carpinterías','Torre 2','Paramétrico','parametrico',false,NULL,1,371200.00,'CON INSTALACION E IMPORTACION','ppto',true,'HAMUI'),
('ALBERCAS','Albercas','Torre 1','Torre','ppto',false,'AQUA CONCEPTS',1,11570130.00,'Incluye desde impermiabilizacion, hasta acabados y funcionamiento','ppto',false,'AQUA CONCEPTS'),
('ALBERCAS','Albercas','Torre 2','Torre','ppto',false,'AQUA CONCEPTS',1,11570130.00,'Incluye desde impermiabilizacion, hasta acabados y funcionamiento','ppto',false,'AQUA CONCEPTS'),
('GRIFERIA Y ACCESORIOS DE BAÑO','Griferías y Accesorios de Baño','Torre 1','Torre','ppto',false,'GERMAN C',1,3894400.54,'1 por monomando de lavabo | 1 por regadera | Incluida en bañera 700330 — no se cotiza por separado (GC)','ppto',false,'GERMAN C'),
('GRIFERIA Y ACCESORIOS DE BAÑO','Griferías y Accesorios de Baño','Torre 2','Torre','ppto',false,'GERMAN C',1,4166693.73,'1 por monomando de lavabo | 1 por regadera | Incluida en bañera 700330 — no se cotiza por separado (GC)','ppto',false,'GERMAN C'),
('JARDINERIA Y RIEGO','Jardineria','Torre 1','Jardineria','parametrico',false,NULL,1,2772400.00,NULL,'parametrico',false,NULL),
('JARDINERIA Y RIEGO','Jardineria','Torre 2','Jardineria','parametrico',false,NULL,1,2772400.00,NULL,'parametrico',false,NULL),
('JARDINERIA Y RIEGO','Sistema De Riego','Torre 1','Sistema De Riego','parametrico',false,NULL,1,928000.00,NULL,'parametrico',false,NULL),
('JARDINERIA Y RIEGO','Sistema De Riego','Torre 2','Sistema De Riego','parametrico',false,NULL,1,928000.00,NULL,'parametrico',false,NULL),
('ELEVADOR','Elevador','Torre 1','Torre','parametrico',true,NULL,1,1697499.34,NULL,'parametrico',false,NULL),
('ELEVADOR','Elevador','Torre 2','Torre','parametrico',false,NULL,1,1697499.34,NULL,'parametrico',false,NULL),
('EXTERIORES','Piedra','Torre 1','Piedra','parametrico',false,NULL,1,3746514.93,NULL,'parametrico',false,NULL),
('EXTERIORES','Piedra','Torre 2','Piedra','parametrico',false,NULL,1,3746514.93,NULL,'parametrico',false,NULL),
('EXTERIORES','Firme de Concreto','Torre 1','Firme de Concreto','parametrico',false,NULL,1,581450.00,NULL,'parametrico',false,NULL),
('EXTERIORES','Firme de Concreto','Torre 2','Firme de Concreto','parametrico',false,NULL,1,581450.00,NULL,'parametrico',false,NULL),
('EXTERIORES','Portones Estacionamiento','Torre 1','Portones Estacionamiento','parametrico',false,NULL,1,1160000.00,'REVISAR','parametrico',false,NULL),
('EXTERIORES','Portones Estacionamiento','Torre 2','Portones Estacionamiento','parametrico',false,NULL,1,1160000.00,'REVISAR','parametrico',false,NULL),
('EXTERIORES','Porton General','Torre 1','Porton General','parametrico',false,NULL,1,232000.00,'REVISAR','parametrico',false,NULL),
('EXTERIORES','Porton General','Torre 2','Porton General','parametrico',false,NULL,1,232000.00,'REVISAR','parametrico',false,NULL),
('EXTERIORES','Garage','Torre 1','Garage','parametrico',false,NULL,1,3984600.00,'REVISAR','parametrico',false,NULL),
('EXTERIORES','Garage','Torre 2','Garage','parametrico',false,NULL,1,3984600.00,'REVISAR','parametrico',false,NULL),
('EXTERIORES','Señalizacion','Torre 1','Señalizacion','parametrico',false,NULL,1,290000.00,'REVISAR','parametrico',false,NULL),
('EXTERIORES','Señalizacion','Torre 2','Señalizacion','parametrico',false,NULL,1,290000.00,'REVISAR','parametrico',false,NULL),
('GARDEN AND PRIVACY WALLS','Suministro','Torre 1','Suministro','ppto',false,NULL,1,415206.22,NULL,'ppto',false,NULL),
('GARDEN AND PRIVACY WALLS','Suministro','Torre 2','Suministro','ppto',false,NULL,1,415206.22,NULL,'ppto',false,NULL),
('GARDEN AND PRIVACY WALLS','Instalacion','Torre 1','Instalacion','ppto',false,NULL,1,64998.77,NULL,'ppto',false,NULL),
('GARDEN AND PRIVACY WALLS','Instalacion','Torre 2','Instalacion','ppto',false,NULL,1,64998.77,NULL,'ppto',false,NULL),
('GARDEN AND PRIVACY WALLS','Dalas','Torre 1','Dalas','parametrico',false,NULL,1,116000.00,NULL,'parametrico',false,NULL),
('GARDEN AND PRIVACY WALLS','Dalas','Torre 2','Dalas','parametrico',false,NULL,1,116000.00,NULL,'parametrico',false,NULL),
('INFRAESTRUCTURA','Infraestructura','Torre 1','Torre','parametrico',false,NULL,1,406000.00,NULL,'parametrico',false,NULL),
('INFRAESTRUCTURA','Infraestructura','Torre 2','Torre','parametrico',false,NULL,1,406000.00,NULL,'parametrico',false,NULL),
('OTROS','Fire Pit','Torre 1','Fire Pit','parametrico',false,NULL,1,320000.00,NULL,'parametrico',false,NULL),
('OTROS','Fire Pit','Torre 2','Fire Pit','parametrico',false,NULL,1,320000.00,NULL,'parametrico',false,NULL),
('OTROS','Acustica','Torre 1','Acustica','parametrico',false,NULL,1,1000000.00,NULL,'parametrico',false,NULL),
('OTROS','Acustica','Torre 2','Acustica','parametrico',false,NULL,1,1000000.00,NULL,'parametrico',false,NULL),
('CONTINGENCIAS','Adicionales','Torre 1','Torre','parametrico',false,NULL,1,6000000.00,NULL,'parametrico',false,NULL),
('CONTINGENCIAS','Adicionales','Torre 2','Torre','parametrico',false,NULL,1,6000000.00,NULL,'parametrico',false,NULL);

-- 5. Items (uno por (partida, concepto descriptivo)).
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_item (project_id, partida_catalog_id, chapter_id, concepto)
SELECT bf.id, p.id, ch.id, d.concepto FROM (SELECT DISTINCT partida,concepto FROM _bf_d) d
JOIN bf ON true
JOIN public.buyout_partida_catalog p ON p.project_id=bf.id AND p.deleted_at IS NULL AND p.nombre=d.partida
LEFT JOIN public.buyout_chapter ch ON ch.project_id=bf.id AND ch.deleted_at IS NULL AND ch.nombre=p.chapter_default;

-- 6. Una cotización VIGENTE por item (estado dominante = fallback; el rollup usa el de la línea).
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_quote (item_id, supplier_id, quote_date, currency, kind, is_selected, contratado, monto_sin_iva, iva_pct)
SELECT i.id, s.id, DATE '2026-06-29', 'MXN', d.q_kind, true, d.q_contratado, d.monto, 0
FROM (SELECT partida, concepto, q_kind, q_contratado, q_supplier, round(sum(cantidad*unitario),2) AS monto
      FROM _bf_d GROUP BY partida, concepto, q_kind, q_contratado, q_supplier) d
JOIN bf ON true
JOIN public.buyout_partida_catalog p ON p.project_id=bf.id AND p.deleted_at IS NULL AND p.nombre=d.partida
JOIN public.buyout_item i ON i.project_id=bf.id AND i.partida_catalog_id=p.id AND i.concepto=d.concepto AND i.deleted_at IS NULL
LEFT JOIN public.buyout_supplier s ON lower(s.nombre)=lower(d.q_supplier) AND s.deleted_at IS NULL;

-- 7. Líneas (por torre) con estado POR LÍNEA.
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_line (quote_id, orden, categoria, concepto, detalle, villa_casita, piso, depto, proveedor, unidad, cantidad, moneda, unitario, sobrecosto_pct, iva_pct, notas, kind, contratado)
SELECT q.id, 1, b.partida, b.concepto, b.detalle, b.torre, NULL, NULL, b.supplier, 'Lote', b.cantidad, 'MXN', b.unitario, 0, 0, b.notas, b.line_kind, b.line_contratado
FROM _bf_d b JOIN bf ON true
JOIN public.buyout_partida_catalog p ON p.project_id=bf.id AND p.deleted_at IS NULL AND p.nombre=b.partida
JOIN public.buyout_item i ON i.project_id=bf.id AND i.partida_catalog_id=p.id AND i.concepto=b.concepto AND i.deleted_at IS NULL
JOIN public.buyout_quote q ON q.item_id=i.id AND q.is_selected AND q.deleted_at IS NULL;

-- 8. selected_quote_id.
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
UPDATE public.buyout_item i SET selected_quote_id=q.id FROM public.buyout_quote q, bf
WHERE q.item_id=i.id AND q.is_selected AND q.deleted_at IS NULL AND i.project_id=bf.id;

-- 9. VERIFICACIÓN TRANSACCIONAL: cuadre por partida + conteo de líneas + L3/Pagos.
DO $$ DECLARE bf uuid; l3 uuid; n_li int; n_l3p int; n_l3c int; n_proj int; r record; expected numeric; nbad int:=0;
BEGIN
  SELECT id INTO bf FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL;
  SELECT id INTO l3 FROM public.projects WHERE nombre='NAUKA Lote 3' AND deleted_at IS NULL;
  FOR r IN
    SELECT p.nombre AS partida, round(coalesce(sum(l.cantidad*l.unitario*(1+coalesce(l.sobrecosto_pct,0))*(1+coalesce(l.iva_pct,0))*fx.rate),0),2) AS total
    FROM public.buyout_partida_catalog p
    LEFT JOIN public.buyout_item i ON i.partida_catalog_id=p.id AND i.project_id=bf AND i.deleted_at IS NULL
    LEFT JOIN public.buyout_quote q ON q.item_id=i.id AND q.is_selected AND q.deleted_at IS NULL
    LEFT JOIN public.buyout_line l ON l.quote_id=q.id AND l.deleted_at IS NULL
    LEFT JOIN public.buyout_fx fx ON fx.project_id=bf AND fx.currency=l.moneda AND fx.deleted_at IS NULL
    WHERE p.project_id=bf AND p.deleted_at IS NULL GROUP BY p.nombre
  LOOP
    expected := (SELECT t FROM (VALUES
      ('ARQUITECTURA', 2929400.00::numeric),
      ('INGENIERIAS Y TOPOGRAFIA', 2229156.10::numeric),
      ('PILAS', 8365678.67::numeric),
      ('CONDICIONES GENERALES', 18600593.36::numeric),
      ('PRELIMINARES', 1688616.44::numeric),
      ('EXCAVACION', 0.00::numeric),
      ('OBRA CIVIL', 65999999.90::numeric),
      ('ALBAÑILERIA', 6495001.82::numeric),
      ('IMPERMEABILIZACION', 2788215.57::numeric),
      ('INSTALACIONES ELECTRICAS', 29733862.40::numeric),
      ('INSTALACIONES HIDRAULICAS', 16725297.60::numeric),
      ('INSTALACIONES GAS', 1856000.00::numeric),
      ('AUTOMATIZACION Y CONTROL ILUMINACION', 19660847.60::numeric),
      ('AIRE ACONDICIONADO Y EXTRACCION', 15759688.32::numeric),
      ('ILUMINACION', 7428736.28::numeric),
      ('ACABADOS', 16880129.76::numeric),
      ('HERRERIA', 4640000.00::numeric),
      ('SUMINISTRO Y COLOCACION DE MARMOL', 21373679.18::numeric),
      ('MADERA DE INGENIERIA', 0.00::numeric),
      ('VIDRIOS Y CANCELES', 38315913.58::numeric),
      ('COCINAS', 25879830.89::numeric),
      ('CARPINTERIAS', 46223299.09::numeric),
      ('ALBERCAS', 23140260.00::numeric),
      ('GRIFERIA Y ACCESORIOS DE BAÑO', 8061094.27::numeric),
      ('JARDINERIA Y RIEGO', 7400800.00::numeric),
      ('ELEVADOR', 3394998.68::numeric),
      ('EXTERIORES', 19989129.86::numeric),
      ('GARDEN AND PRIVACY WALLS', 1192409.98::numeric),
      ('INFRAESTRUCTURA', 812000.00::numeric),
      ('OTROS', 2640000.00::numeric),
      ('CONTINGENCIAS', 12000000.00::numeric)
    ) AS e(p,t) WHERE e.p=r.partida);
    IF expected IS NULL THEN CONTINUE; END IF;
    IF abs(r.total-expected) > 0.005 THEN RAISE WARNING 'CUADRE FALLA %: got % exp %', r.partida, r.total, expected; nbad:=nbad+1; END IF;
  END LOOP;
  IF nbad>0 THEN RAISE EXCEPTION 'Cuadre fallo en % partida(s) -> rollback', nbad; END IF;
  SELECT count(*) INTO n_li FROM public.buyout_line l JOIN public.buyout_quote q ON q.id=l.quote_id JOIN public.buyout_item i ON i.id=q.item_id WHERE i.project_id=bf AND l.deleted_at IS NULL;
  IF n_li <> 109 THEN RAISE EXCEPTION 'BF lineas=% (esperado 109)', n_li; END IF;
  IF EXISTS (SELECT 1 FROM public.buyout_item i WHERE i.project_id=bf AND i.deleted_at IS NULL AND (SELECT count(*) FROM public.buyout_quote q WHERE q.item_id=i.id AND q.is_selected AND q.deleted_at IS NULL)<>1)
  THEN RAISE EXCEPTION 'Item BF sin exactamente 1 vigente'; END IF;
  SELECT count(*) INTO n_l3p FROM public.buyout_partida_catalog WHERE project_id=l3 AND deleted_at IS NULL;
  SELECT count(*) INTO n_l3c FROM public.buyout_chapter WHERE project_id=l3 AND deleted_at IS NULL;
  IF n_l3p<>24 THEN RAISE EXCEPTION 'L3 partidas=% (esperado 24)!', n_l3p; END IF;
  IF n_l3c<>8 THEN RAISE EXCEPTION 'L3 capitulos=% (esperado 8)!', n_l3c; END IF;
  SELECT count(*) INTO n_proj FROM public.projects WHERE deleted_at IS NULL;
  IF n_proj<3 THEN RAISE EXCEPTION 'projects=%', n_proj; END IF;
  RAISE NOTICE 'BF conceptos descriptivos OK: % items / % lineas; cuadre 31 partidas; L3 intacto', (SELECT count(*) FROM public.buyout_item WHERE project_id=bf AND deleted_at IS NULL), n_li;
END $$;
