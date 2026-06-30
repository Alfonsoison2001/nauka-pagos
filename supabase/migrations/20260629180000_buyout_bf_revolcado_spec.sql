-- =========================================================================
-- NAUKA Pagos — BUY-OUT · Re-volcado FINAL de BF según spec de líneas por partida
-- =========================================================================
-- Sigue EXACTAMENTE docs/future-modules/buyout-BF-lineas-spec.md (Alfonso definió
-- cuántas líneas y cómo por partida). Reemplaza el transaccional de BF.
-- Total: 109 líneas. Patrones:
--   • 0.5-espejo (Imper, Inst×3, Automat, Aire, Iluminación, Acabados, Herreria):
--     1 ppto cubre ambas torres -> 2 líneas, cantidad 0.5 c/u, unitario = ppto total.
--   • Por torre real (Obra Civil, Albañilería) y 1 ppto×2 torres (Albercas, Griferías,
--     Elevador, Infraestructura, Contingencias): 2 líneas (T1/T2) con monto por torre.
--   • N pptos × 2 torres: Ingenierías(14), Vidrios(8), Cocinas(6), Jardinería(4),
--     Exteriores(12), Otros(4) por concepto; Mármol(4) por categoría; Pilas(6) y
--     Garden(6) por detalle.
--   • Carpinterías(4) por madurez×torre. Arquitectura(2) por concepto. Preliminares(3)
--     por ppto. Condiciones Generales(4) = TAL CUAL el re-volcado anterior.
--   • Excavación/Madera = 0 (sin datos). Herreria NO está en la spec -> 0.5-espejo (2,
--     paramétrico) por defecto; revisar con Alfonso.
--
-- Estado (madurez/contratación) por línea = dato real (dominante por dinero) -> un
-- ppto medio contratado (Pilas: T1 contratado / T2 no) sale 'parcial'. PDF no se carga.
-- Línea en MXN (unitario × cantidad = importe). El MONTO por partida NO cambia: cuadra
-- AL CENTAVO con el preview/Total de la verde (verificado transaccional, rollback si falla).
--
-- AISLAMIENTO: filtra por project_id de 'NAUKA Beachfront'. Idempotente: BORRA el
-- transaccional de BF y re-crea. NO toca catálogo, L3 ni Pagos.
-- =========================================================================

DO $$ DECLARE bf uuid; BEGIN
  SELECT id INTO bf FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL;
  IF bf IS NULL THEN RAISE EXCEPTION 'NAUKA Beachfront no encontrado'; END IF;
END $$;

-- 1. Limpieza idempotente del transaccional de BF (CASCADE quote->line).
DELETE FROM public.buyout_item  WHERE project_id=(SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL);
DELETE FROM public.buyout_falta WHERE project_id=(SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL);
DELETE FROM public.buyout_import_batch WHERE project_id=(SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL);

-- 2. Red de seguridad (no-op si ya existe): capítulo+partida+base de CONTINGENCIAS.
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

-- 4. Staging de las líneas (1 fila = 1 línea de la spec).
CREATE TEMP TABLE _bf_s (
  partida text, concepto text, torre text, detalle text, kind text, contratado boolean,
  supplier text, cantidad numeric, unitario numeric, notas text) ON COMMIT DROP;
INSERT INTO _bf_s (partida,concepto,torre,detalle,kind,contratado,supplier,cantidad,unitario,notas) VALUES
('ARQUITECTURA','Diseño Arquitectónico','Compartido','por concepto','ppto',true,'AOR',1,2767000.00,NULL),
('ARQUITECTURA','Diseño Jardinería','Compartido','por concepto','ppto',false,NULL,1,162400.00,NULL),
('INGENIERIAS Y TOPOGRAFIA','Mecanica De Suelos · Torre 1','Torre 1','Mecanica De Suelos','ppto',true,'Samstordam',1,97692.30,NULL),
('INGENIERIAS Y TOPOGRAFIA','Calculo Estructural · Torre 1','Torre 1','Calculo Estructural','ppto',true,'MyT',1,214600.00,NULL),
('INGENIERIAS Y TOPOGRAFIA','Diseño HVAC · Torre 1','Torre 1','Diseño HVAC','ppto',true,'CYVS',1,75400.00,NULL),
('INGENIERIAS Y TOPOGRAFIA','Diseño Alberca · Torre 1','Torre 1','Diseño Alberca','ppto',true,'AQUACONCEPTS',1,69600.00,NULL),
('INGENIERIAS Y TOPOGRAFIA','Diseño Instalaciones HS-E-G · Torre 1','Torre 1','Diseño Instalaciones HS-E-G','ppto',true,'UNINAPS',1,220864.00,NULL),
('INGENIERIAS Y TOPOGRAFIA','Diseño Iluminacion · Torre 1','Torre 1','Diseño Iluminacion','ppto',true,'ARTEC',1,336421.75,NULL),
('INGENIERIAS Y TOPOGRAFIA','Diseño Acustica · Torre 1','Torre 1','Diseño Acustica','ppto',true,'SAAD',1,100000.00,NULL),
('INGENIERIAS Y TOPOGRAFIA','Mecanica De Suelos · Torre 2','Torre 2','Mecanica De Suelos','ppto',true,'Samstordam',1,97692.30,NULL),
('INGENIERIAS Y TOPOGRAFIA','Calculo Estructural · Torre 2','Torre 2','Calculo Estructural','ppto',true,'MyT',1,214600.00,NULL),
('INGENIERIAS Y TOPOGRAFIA','Diseño HVAC · Torre 2','Torre 2','Diseño HVAC','ppto',true,'CYVS',1,75400.00,NULL),
('INGENIERIAS Y TOPOGRAFIA','Diseño Alberca · Torre 2','Torre 2','Diseño Alberca','ppto',true,'AQUACONCEPTS',1,69600.00,NULL),
('INGENIERIAS Y TOPOGRAFIA','Diseño Instalaciones HS-E-G · Torre 2','Torre 2','Diseño Instalaciones HS-E-G','ppto',true,'UNINAPS',1,220864.00,NULL),
('INGENIERIAS Y TOPOGRAFIA','Diseño Iluminacion · Torre 2','Torre 2','Diseño Iluminacion','ppto',true,'ARTEC',1,336421.75,NULL),
('INGENIERIAS Y TOPOGRAFIA','Diseño Acustica · Torre 2','Torre 2','Diseño Acustica','ppto',true,'SAAD',1,100000.00,NULL),
('PILAS','Mano de Obra · Torre 1','Torre 1','Mano de Obra','ppto',true,'MAM',1,2534821.93,NULL),
('PILAS','Concreto · Torre 1','Torre 1','Concreto','ppto',true,'MAM',1,1005145.41,NULL),
('PILAS','Varilla · Torre 1','Torre 1','Varilla','ppto',true,'Tecnologias SHIN',1,642872.00,NULL),
('PILAS','Mano de Obra · Torre 2','Torre 2','Mano de Obra','ppto',false,'MAM',1,2534821.92,NULL),
('PILAS','Concreto · Torre 2','Torre 2','Concreto','ppto',false,'MAM',1,1005145.41,NULL),
('PILAS','Varilla · Torre 2','Torre 2','Varilla','ppto',false,'Tecnologias SHIN',1,642872.00,NULL),
('CONDICIONES GENERALES','Torre 1 · Ppto · Contratado','Torre 1','(igual que re-volcado agrupado)','ppto',true,'Tracsa',1,2512208.68,NULL),
('CONDICIONES GENERALES','Torre 1 · Paramétrico · No contratado','Torre 1','(igual que re-volcado agrupado)','parametrico',false,NULL,1,7344888.00,NULL),
('CONDICIONES GENERALES','Torre 2 · Ppto · No contratado','Torre 2','(igual que re-volcado agrupado)','ppto',false,'Tracsa',1,2512208.68,NULL),
('CONDICIONES GENERALES','Torre 2 · Paramétrico · No contratado','Torre 2','(igual que re-volcado agrupado)','parametrico',false,NULL,1,6231288.00,NULL),
('PRELIMINARES','Despalme','Compartido','ppto (ambas torres)','ppto',true,'URARQ',1,8574.72,NULL),
('PRELIMINARES','Malla','Compartido','ppto (ambas torres)','ppto',true,'ABIKAR PROYECTO Y CONSTRUCCION S.A DE C.V',1,479932.72,NULL),
('PRELIMINARES','Plataformas','Compartido','ppto (ambas torres)','ppto',true,'URARQ',1,1200109.00,NULL),
('OBRA CIVIL','Torre 1','Torre 1','Torre','ppto',true,'ADC',1,32999999.95,NULL),
('OBRA CIVIL','Torre 2','Torre 2','Torre','parametrico',false,'ADC',1,32999999.95,NULL),
('ALBAÑILERIA','Torre 1','Torre 1','Torre','ppto',true,'ADC',1,3247500.91,NULL),
('ALBAÑILERIA','Torre 2','Torre 2','Torre','parametrico',false,'ADC',1,3247500.91,NULL),
('IMPERMEABILIZACION','Torre 1','Torre 1','1 ppto ambas torres (50%)','parametrico',false,'R&R Impermeabilizante S.A. de C.V.',0.5,2788215.57,'Pareja de villas Torre 1 (depto 101 PB + depto 103 N1R) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 1 (depto 102 N1 + 104 — verificar con proveedor, 104 no existe en NAUKA) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 2 (depto 201 PB + depto 203 N1R) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 2 (depto 202 N1 + 204 — verificar con proveedor, 204 no existe en NAUKA) (R&R folio 26036 B v2 22/04/26) | Roof Garden general (todas las villas) ('),
('IMPERMEABILIZACION','Torre 2','Torre 2','1 ppto ambas torres (50%)','parametrico',false,'R&R Impermeabilizante S.A. de C.V.',0.5,2788215.57,'Pareja de villas Torre 1 (depto 101 PB + depto 103 N1R) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 1 (depto 102 N1 + 104 — verificar con proveedor, 104 no existe en NAUKA) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 2 (depto 201 PB + depto 203 N1R) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 2 (depto 202 N1 + 204 — verificar con proveedor, 204 no existe en NAUKA) (R&R folio 26036 B v2 22/04/26) | Roof Garden general (todas las villas) ('),
('INSTALACIONES ELECTRICAS','Torre 1','Torre 1','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,29733862.40,NULL),
('INSTALACIONES ELECTRICAS','Torre 2','Torre 2','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,29733862.40,NULL),
('INSTALACIONES HIDRAULICAS','Torre 1','Torre 1','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,16725297.60,NULL),
('INSTALACIONES HIDRAULICAS','Torre 2','Torre 2','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,16725297.60,NULL),
('INSTALACIONES GAS','Torre 1','Torre 1','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,1856000.00,NULL),
('INSTALACIONES GAS','Torre 2','Torre 2','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,1856000.00,NULL),
('AUTOMATIZACION Y CONTROL ILUMINACION','Torre 1','Torre 1','1 ppto ambas torres (50%)','ppto',false,'SRD',0.5,19660847.60,'SRD cot. 1238 draft4 (17-jun-2026); TODAS las secciones incl. Alarma e Intrusion; sin IVA, IVA 16%'),
('AUTOMATIZACION Y CONTROL ILUMINACION','Torre 2','Torre 2','1 ppto ambas torres (50%)','ppto',false,'SRD',0.5,19660847.60,'SRD cot. 1238 draft4 (17-jun-2026); TODAS las secciones incl. Alarma e Intrusion; sin IVA, IVA 16%'),
('AIRE ACONDICIONADO Y EXTRACCION','Torre 1','Torre 1','1 ppto ambas torres (50%)','ppto',false,'CYVSA',0.5,15759688.32,NULL),
('AIRE ACONDICIONADO Y EXTRACCION','Torre 2','Torre 2','1 ppto ambas torres (50%)','ppto',false,'CYVSA',0.5,15759688.32,NULL),
('ILUMINACION','Torre 1','Torre 1','1 ppto ambas torres (50%)','ppto',false,'427 ARCHITECTURE',0.5,7428736.28,'TIPO-1 | TIPO-2 N1 | TIPO-2 N1R'),
('ILUMINACION','Torre 2','Torre 2','1 ppto ambas torres (50%)','ppto',false,'427 ARCHITECTURE',0.5,7428736.28,'TIPO-1 | TIPO-2 N1 | TIPO-2 N1R'),
('ACABADOS','Torre 1','Torre 1','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,16880129.76,NULL),
('ACABADOS','Torre 2','Torre 2','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,16880129.76,NULL),
('HERRERIA','Torre 1','Torre 1','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,4640000.00,NULL),
('HERRERIA','Torre 2','Torre 2','1 ppto ambas torres (50%)','parametrico',false,NULL,0.5,4640000.00,NULL),
('SUMINISTRO Y COLOCACION DE MARMOL','Suministro de Marmol · Torre 1','Torre 1','Suministro de Marmol','parametrico',false,NULL,1,4481691.90,NULL),
('SUMINISTRO Y COLOCACION DE MARMOL','Suministro de Marmol · Torre 2','Torre 2','Suministro de Marmol','parametrico',false,NULL,1,4257884.40,NULL),
('SUMINISTRO Y COLOCACION DE MARMOL','Colocacion de Marmol · Torre 1','Torre 1','Colocacion de Marmol','parametrico',false,NULL,1,6317051.44,NULL),
('SUMINISTRO Y COLOCACION DE MARMOL','Colocacion de Marmol · Torre 2','Torre 2','Colocacion de Marmol','parametrico',false,NULL,1,6317051.44,NULL),
('VIDRIOS Y CANCELES','Canceles Y Vidrios · Torre 1','Torre 1','Canceles Y Vidrios','ppto',false,'AX FERRO',1,14076186.60,NULL),
('VIDRIOS Y CANCELES','Barandal de Vidrio · Torre 1','Torre 1','Barandal de Vidrio','ppto',false,'Grupo Aliglass',1,260736.68,NULL),
('VIDRIOS Y CANCELES','Canceles de Baño · Torre 1','Torre 1','Canceles de Baño','ppto',false,'Grupo Aliglass',1,1298380.31,NULL),
('VIDRIOS Y CANCELES','Canceles Y Vidrios · Torre 2','Torre 2','Canceles Y Vidrios','ppto',false,'AX FERRO',1,14076186.60,NULL),
('VIDRIOS Y CANCELES','Barandal de Vidrio · Torre 2','Torre 2','Barandal de Vidrio','ppto',false,'Grupo Aliglass',1,260736.68,NULL),
('VIDRIOS Y CANCELES','Canceles de Baño · Torre 2','Torre 2','Canceles de Baño','ppto',false,'Grupo Aliglass',1,1298380.31,NULL),
('VIDRIOS Y CANCELES','Celosia Fachada Principal · Torre 1','Torre 1','Celosia Fachada Principal','parametrico',false,'Grupo Aliglass',1,3522653.20,NULL),
('VIDRIOS Y CANCELES','Celosia Fachada Principal · Torre 2','Torre 2','Celosia Fachada Principal','parametrico',false,'Grupo Aliglass',1,3522653.20,NULL),
('COCINAS','Cocina Principal · Torre 1','Torre 1','Cocina Principal','ppto',false,'DIECI',1,7465343.81,NULL),
('COCINAS','Grill · Torre 1','Torre 1','Grill','ppto',false,'DIECI',1,5161371.64,'PARAMETRICO - asador OG42, se solicita al ponerse a la venta (no en cot. BOA 25-jun) | PARAMETRICO - cubrevinil, junto con asador'),
('COCINAS','Laundry · Torre 1','Torre 1','Laundry','parametrico',false,'Samsung',1,313200.00,'Paquete lavadora+secadora Samsung $45,000 MXN (junta 22-06-26)'),
('COCINAS','Cocina Principal · Torre 2','Torre 2','Cocina Principal','ppto',false,'DIECI',1,7465343.80,NULL),
('COCINAS','Grill · Torre 2','Torre 2','Grill','ppto',false,'DIECI',1,5161371.64,'PARAMETRICO - asador OG42, se solicita al ponerse a la venta (no en cot. BOA 25-jun) | PARAMETRICO - cubrevinil, junto con asador'),
('COCINAS','Laundry · Torre 2','Torre 2','Laundry','parametrico',false,'Samsung',1,313200.00,'Paquete lavadora+secadora Samsung $45,000 MXN (junta 22-06-26)'),
('CARPINTERIAS','Ppto · Torre 1','Torre 1','Ppto','ppto',true,'HAMUI',1,22441706.26,'SIHASI v2 mayo 2026 (folio 2511 S004 D) | ENVÍOS: $200K/torre / 4 villas/torre = $50K/villa | Revisar'),
('CARPINTERIAS','Paramétrico · Torre 1','Torre 1','Paramétrico','parametrico',false,NULL,1,371200.00,'CON INSTALACION E IMPORTACION'),
('CARPINTERIAS','Ppto · Torre 2','Torre 2','Ppto','ppto',true,'HAMUI',1,23039192.83,'SIHASI v2 mayo 2026 (folio 2511 S004 D) | ENVÍOS: $200K/torre / 4 villas/torre = $50K/villa | Revisar'),
('CARPINTERIAS','Paramétrico · Torre 2','Torre 2','Paramétrico','parametrico',false,NULL,1,371200.00,'CON INSTALACION E IMPORTACION'),
('ALBERCAS','Torre 1','Torre 1','Torre','ppto',false,'AQUA CONCEPTS',1,11570130.00,'Incluye desde impermiabilizacion, hasta acabados y funcionamiento'),
('ALBERCAS','Torre 2','Torre 2','Torre','ppto',false,'AQUA CONCEPTS',1,11570130.00,'Incluye desde impermiabilizacion, hasta acabados y funcionamiento'),
('GRIFERIA Y ACCESORIOS DE BAÑO','Torre 1','Torre 1','Torre','ppto',false,'GERMAN C',1,3894400.54,'1 por monomando de lavabo | 1 por regadera | Incluida en bañera 700330 — no se cotiza por separado (GC)'),
('GRIFERIA Y ACCESORIOS DE BAÑO','Torre 2','Torre 2','Torre','ppto',false,'GERMAN C',1,4166693.73,'1 por monomando de lavabo | 1 por regadera | Incluida en bañera 700330 — no se cotiza por separado (GC)'),
('JARDINERIA Y RIEGO','Jardineria · Torre 1','Torre 1','Jardineria','parametrico',false,NULL,1,2772400.00,NULL),
('JARDINERIA Y RIEGO','Sistema De Riego · Torre 1','Torre 1','Sistema De Riego','parametrico',false,NULL,1,928000.00,NULL),
('JARDINERIA Y RIEGO','Jardineria · Torre 2','Torre 2','Jardineria','parametrico',false,NULL,1,2772400.00,NULL),
('JARDINERIA Y RIEGO','Sistema De Riego · Torre 2','Torre 2','Sistema De Riego','parametrico',false,NULL,1,928000.00,NULL),
('ELEVADOR','Torre 1','Torre 1','Torre','parametrico',true,NULL,1,1697499.34,NULL),
('ELEVADOR','Torre 2','Torre 2','Torre','parametrico',false,NULL,1,1697499.34,NULL),
('EXTERIORES','Piedra · Torre 1','Torre 1','Piedra','parametrico',false,NULL,1,3746514.93,NULL),
('EXTERIORES','Firme de Concreto · Torre 1','Torre 1','Firme de Concreto','parametrico',false,NULL,1,581450.00,NULL),
('EXTERIORES','Portones Estacionamiento · Torre 1','Torre 1','Portones Estacionamiento','parametrico',false,NULL,1,1160000.00,'REVISAR'),
('EXTERIORES','Porton General · Torre 1','Torre 1','Porton General','parametrico',false,NULL,1,232000.00,'REVISAR'),
('EXTERIORES','Garage · Torre 1','Torre 1','Garage','parametrico',false,NULL,1,3984600.00,'REVISAR'),
('EXTERIORES','Señalizacion · Torre 1','Torre 1','Señalizacion','parametrico',false,NULL,1,290000.00,'REVISAR'),
('EXTERIORES','Piedra · Torre 2','Torre 2','Piedra','parametrico',false,NULL,1,3746514.93,NULL),
('EXTERIORES','Firme de Concreto · Torre 2','Torre 2','Firme de Concreto','parametrico',false,NULL,1,581450.00,NULL),
('EXTERIORES','Portones Estacionamiento · Torre 2','Torre 2','Portones Estacionamiento','parametrico',false,NULL,1,1160000.00,'REVISAR'),
('EXTERIORES','Porton General · Torre 2','Torre 2','Porton General','parametrico',false,NULL,1,232000.00,'REVISAR'),
('EXTERIORES','Garage · Torre 2','Torre 2','Garage','parametrico',false,NULL,1,3984600.00,'REVISAR'),
('EXTERIORES','Señalizacion · Torre 2','Torre 2','Señalizacion','parametrico',false,NULL,1,290000.00,'REVISAR'),
('GARDEN AND PRIVACY WALLS','Suministro · Torre 1','Torre 1','Suministro','ppto',false,NULL,1,415206.22,NULL),
('GARDEN AND PRIVACY WALLS','Instalacion · Torre 1','Torre 1','Instalacion','ppto',false,NULL,1,64998.77,NULL),
('GARDEN AND PRIVACY WALLS','Suministro · Torre 2','Torre 2','Suministro','ppto',false,NULL,1,415206.22,NULL),
('GARDEN AND PRIVACY WALLS','Instalacion · Torre 2','Torre 2','Instalacion','ppto',false,NULL,1,64998.77,NULL),
('GARDEN AND PRIVACY WALLS','Dalas · Torre 1','Torre 1','Dalas','parametrico',false,NULL,1,116000.00,NULL),
('GARDEN AND PRIVACY WALLS','Dalas · Torre 2','Torre 2','Dalas','parametrico',false,NULL,1,116000.00,NULL),
('INFRAESTRUCTURA','Torre 1','Torre 1','Torre','parametrico',false,NULL,1,406000.00,NULL),
('INFRAESTRUCTURA','Torre 2','Torre 2','Torre','parametrico',false,NULL,1,406000.00,NULL),
('OTROS','Fire Pit · Torre 1','Torre 1','Fire Pit','parametrico',false,NULL,1,320000.00,NULL),
('OTROS','Fire Pit · Torre 2','Torre 2','Fire Pit','parametrico',false,NULL,1,320000.00,NULL),
('OTROS','Acustica · Torre 1','Torre 1','Acustica','parametrico',false,NULL,1,1000000.00,NULL),
('OTROS','Acustica · Torre 2','Torre 2','Acustica','parametrico',false,NULL,1,1000000.00,NULL),
('CONTINGENCIAS','Torre 1','Torre 1','Torre','parametrico',false,NULL,1,6000000.00,NULL),
('CONTINGENCIAS','Torre 2','Torre 2','Torre','parametrico',false,NULL,1,6000000.00,NULL);

-- 5. Items (uno por (partida, concepto)).
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_item (project_id, partida_catalog_id, chapter_id, concepto)
SELECT bf.id, p.id, ch.id, d.concepto FROM (SELECT DISTINCT partida,concepto FROM _bf_s) d
JOIN bf ON true
JOIN public.buyout_partida_catalog p ON p.project_id=bf.id AND p.deleted_at IS NULL AND p.nombre=d.partida
LEFT JOIN public.buyout_chapter ch ON ch.project_id=bf.id AND ch.deleted_at IS NULL AND ch.nombre=p.chapter_default;

-- 6. Una cotización VIGENTE por item (monto_sin_iva = importe MXN = cantidad*unitario).
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_quote (item_id, supplier_id, quote_date, currency, kind, is_selected, contratado, monto_sin_iva, iva_pct)
SELECT i.id, s.id, DATE '2026-06-29', 'MXN', d.kind, true, d.contratado, round(d.cantidad*d.unitario,2), 0
FROM (SELECT DISTINCT partida,concepto,kind,contratado,supplier,cantidad,unitario FROM _bf_s) d
JOIN bf ON true
JOIN public.buyout_partida_catalog p ON p.project_id=bf.id AND p.deleted_at IS NULL AND p.nombre=d.partida
JOIN public.buyout_item i ON i.project_id=bf.id AND i.partida_catalog_id=p.id AND i.concepto=d.concepto AND i.deleted_at IS NULL
LEFT JOIN public.buyout_supplier s ON lower(s.nombre)=lower(d.supplier) AND s.deleted_at IS NULL;

-- 7. Una línea por cotización (MXN, sobrecosto/iva 0; torre en villa_casita).
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_line (quote_id, orden, categoria, concepto, detalle, villa_casita, piso, depto, proveedor, unidad, cantidad, moneda, unitario, sobrecosto_pct, iva_pct, notas)
SELECT q.id, 1, b.partida, b.concepto, b.detalle, b.torre, NULL, NULL, b.supplier, 'Lote', b.cantidad, 'MXN', b.unitario, 0, 0, b.notas
FROM _bf_s b JOIN bf ON true
JOIN public.buyout_partida_catalog p ON p.project_id=bf.id AND p.deleted_at IS NULL AND p.nombre=b.partida
JOIN public.buyout_item i ON i.project_id=bf.id AND i.partida_catalog_id=p.id AND i.concepto=b.concepto AND i.deleted_at IS NULL
JOIN public.buyout_quote q ON q.item_id=i.id AND q.is_selected AND q.deleted_at IS NULL;

-- 8. selected_quote_id.
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
UPDATE public.buyout_item i SET selected_quote_id=q.id FROM public.buyout_quote q, bf
WHERE q.item_id=i.id AND q.is_selected AND q.deleted_at IS NULL AND i.project_id=bf.id;

-- 9. VERIFICACIÓN TRANSACCIONAL: cuadre por partida + conteo + L3/Pagos.
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
  RAISE NOTICE 'BF re-volcado spec OK: % lineas (esperado 109); cuadre al centavo 31 partidas; L3 intacto', n_li;
END $$;
