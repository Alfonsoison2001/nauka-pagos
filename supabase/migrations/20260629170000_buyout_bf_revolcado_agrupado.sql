-- =========================================================================
-- NAUKA Pagos — BUY-OUT · Re-volcado de BF AGRUPADO por partida × torre
-- =========================================================================
-- Alfonso quiere BF como su tablero: POCAS líneas por partida (1-2 por torre),
-- no el detalle de 1,732 renglones del volcado 2b. Re-agrupa las filas de cada
-- pestaña verde por (PARTIDA × TORRE × madurez × contratación); cada grupo = UNA
-- línea con la SUMA de su TOTAL MXN. Resultado: 72 líneas (vs 1,732).
--
-- GRANO: TORRE de la col TORRE (o inferida del depto: 1xx/2xx=T1, 3xx/4xx=T2;
-- sin torre clara = 'Compartido'). madurez=col V, contratación=col W → cada línea
-- tiene estado claro; un concepto medio contratado (ej. PILAS: T1 contratado /
-- T2 no) queda en 2 líneas → la partida sale 'parcial'. Proveedor = dominante no-NA
-- del grupo (NULL si todas NA). PDF NO se carga; se conserva la NOTA (folio/fecha).
--
-- MODELO: cada grupo = buyout_item + 1 cotización VIGENTE (kind=madurez,
-- contratado=contratación) + 1 buyout_line en MXN (cant=1, sobrecosto=0, iva=0,
-- unitario = Σ TOTAL MXN del grupo). El rollup recompone total = unitario (tc MXN=1).
-- El MONTO no cambia: Σ por partida = el del preview/Total de la verde (al centavo).
--
-- AISLAMIENTO: filtra por project_id de 'NAUKA Beachfront'. Idempotente: BORRA el
-- transaccional de BF (items→CASCADE quotes→lines; falta; import_batch) y re-crea.
-- NO toca el CATÁLOGO (capítulos/partidas/conceptos/bases) ni L3 ni Pagos.
-- Verificado transaccionalmente (rollback si una partida no cuadra al centavo).
-- =========================================================================

DO $$ DECLARE bf uuid; BEGIN
  SELECT id INTO bf FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL;
  IF bf IS NULL THEN RAISE EXCEPTION 'NAUKA Beachfront no encontrado'; END IF;
END $$;

-- 1. Limpieza idempotente del transaccional de BF (hard delete; CASCADE quote->line).
DELETE FROM public.buyout_item  WHERE project_id=(SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL);
DELETE FROM public.buyout_falta WHERE project_id=(SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL);
DELETE FROM public.buyout_import_batch WHERE project_id=(SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL);

-- 2. Red de seguridad (no-op si ya existe del 2b): capítulo+partida+base de CONTINGENCIAS.
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

-- 3. Proveedores GLOBALES usados (idempotente; ya existen del 2b, no-op).
WITH v(nombre) AS (VALUES
  ('427 ARCHITECTURE'),
  ('ADC'),
  ('AOR'),
  ('AQUA CONCEPTS'),
  ('ARTEC'),
  ('AX FERRO'),
  ('BOA'),
  ('CYVSA'),
  ('DIECI'),
  ('GERMAN C'),
  ('Grupo Aliglass'),
  ('HAMUI'),
  ('M2'),
  ('MAM'),
  ('R&R Impermeabilizante S.A. de C.V.'),
  ('SRD'),
  ('Tracsa'),
  ('URARQ')
)
INSERT INTO public.buyout_supplier (nombre) SELECT v.nombre FROM v
WHERE NOT EXISTS (SELECT 1 FROM public.buyout_supplier s WHERE lower(s.nombre)=lower(v.nombre) AND s.deleted_at IS NULL);

-- 4. Staging de los grupos (1 fila = 1 línea agrupada).
CREATE TEMP TABLE _bf_g (
  partida text, concepto text, torre text, detalle text, proveedor text,
  q_kind text, q_contratado boolean, q_supplier text, unitario numeric, notas text) ON COMMIT DROP;
INSERT INTO _bf_g (partida,concepto,torre,detalle,proveedor,q_kind,q_contratado,q_supplier,unitario,notas) VALUES
('ARQUITECTURA','Compartido · Ppto · Contratado','Compartido','Agrupado: 1 renglón(es) del tab · Compartido','AOR','ppto',true,'AOR',2700000.00,NULL),
('ARQUITECTURA','Compartido · Ppto · No contratado','Compartido','Agrupado: 2 renglón(es) del tab · Compartido','M2','ppto',false,'M2',229400.00,NULL),
('INGENIERIAS Y TOPOGRAFIA','Torre 1','Torre 1','Agrupado: 7 renglón(es) del tab · Torre 1','ARTEC','ppto',true,'ARTEC',1114578.05,NULL),
('INGENIERIAS Y TOPOGRAFIA','Torre 2','Torre 2','Agrupado: 7 renglón(es) del tab · Torre 2','ARTEC','ppto',true,'ARTEC',1114578.05,NULL),
('PILAS','Torre 1','Torre 1','Agrupado: 3 renglón(es) del tab · Torre 1','MAM','ppto',true,'MAM',4182839.34,NULL),
('PILAS','Torre 2','Torre 2','Agrupado: 3 renglón(es) del tab · Torre 2','MAM','ppto',false,'MAM',4182839.33,NULL),
('CONDICIONES GENERALES','Torre 1 · Ppto · Contratado','Torre 1','Agrupado: 5 renglón(es) del tab · Torre 1','Tracsa','ppto',true,'Tracsa',2512208.68,NULL),
('CONDICIONES GENERALES','Torre 1 · Paramétrico · No contratado','Torre 1','Agrupado: 16 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,7344888.00,NULL),
('CONDICIONES GENERALES','Torre 2 · Ppto · No contratado','Torre 2','Agrupado: 5 renglón(es) del tab · Torre 2','Tracsa','ppto',false,'Tracsa',2512208.68,NULL),
('CONDICIONES GENERALES','Torre 2 · Paramétrico · No contratado','Torre 2','Agrupado: 14 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,6231288.00,NULL),
('PRELIMINARES','Torre 1','Torre 1','Agrupado: 3 renglón(es) del tab · Torre 1','URARQ','ppto',true,'URARQ',844308.22,NULL),
('PRELIMINARES','Torre 2','Torre 2','Agrupado: 3 renglón(es) del tab · Torre 2','URARQ','ppto',true,'URARQ',844308.22,NULL),
('OBRA CIVIL','Torre 1','Torre 1','Agrupado: 1 renglón(es) del tab · Torre 1','ADC','ppto',true,'ADC',32999999.95,NULL),
('OBRA CIVIL','Torre 2','Torre 2','Agrupado: 1 renglón(es) del tab · Torre 2','ADC','parametrico',false,'ADC',32999999.95,NULL),
('ALBAÑILERIA','Torre 1','Torre 1','Agrupado: 1 renglón(es) del tab · Torre 1','ADC','ppto',true,'ADC',3247500.91,NULL),
('ALBAÑILERIA','Torre 2','Torre 2','Agrupado: 1 renglón(es) del tab · Torre 2','ADC','parametrico',false,'ADC',3247500.91,NULL),
('IMPERMEABILIZACION','Torre 1','Torre 1','Agrupado: 16 renglón(es) del tab · Torre 1','R&R Impermeabilizante S.A. de C.V.','parametrico',false,'R&R Impermeabilizante S.A. de C.V.',1854059.87,'Pareja de villas Torre 1 (depto 101 PB + depto 103 N1R) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 1 (depto 102 N1 + 104 — verificar con proveedor, 104 no existe en NAUKA) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 2 (depto 201 PB + depto 203 N1R) (R&R folio 26036 B v2 22/04/26) | Pareja de villas Torre 2 (depto 202 N1 + 204 — verificar con proveedor, 204 no existe en NAUKA) (R&R folio 26036 B v2 22/04/26)'),
('IMPERMEABILIZACION','Compartido','Compartido','Agrupado: 5 renglón(es) del tab · Compartido','R&R Impermeabilizante S.A. de C.V.','parametrico',false,'R&R Impermeabilizante S.A. de C.V.',934155.70,'Roof Garden general (todas las villas) (R&R folio 26036 B v2 22/04/26) | Azoteas (todas las villas) (R&R folio 26036 B v2 22/04/26)'),
('INSTALACIONES ELECTRICAS','Torre 1','Torre 1','Agrupado: 4 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,14866931.20,NULL),
('INSTALACIONES ELECTRICAS','Torre 2','Torre 2','Agrupado: 4 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,14866931.20,NULL),
('INSTALACIONES HIDRAULICAS','Torre 1','Torre 1','Agrupado: 4 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,8362648.80,NULL),
('INSTALACIONES HIDRAULICAS','Torre 2','Torre 2','Agrupado: 4 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,8362648.80,NULL),
('INSTALACIONES GAS','Torre 1','Torre 1','Agrupado: 1 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,928000.00,NULL),
('INSTALACIONES GAS','Torre 2','Torre 2','Agrupado: 1 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,928000.00,NULL),
('AUTOMATIZACION Y CONTROL ILUMINACION','Torre 1','Torre 1','Agrupado: 4 renglón(es) del tab · Torre 1','SRD','ppto',false,'SRD',9669089.35,'SRD cot. 1238 draft4 (17-jun-2026); TODAS las secciones incl. Alarma e Intrusion; sin IVA, IVA 16%'),
('AUTOMATIZACION Y CONTROL ILUMINACION','Torre 2','Torre 2','Agrupado: 4 renglón(es) del tab · Torre 2','SRD','ppto',false,'SRD',9991758.25,'SRD cot. 1238 draft4 (17-jun-2026); TODAS las secciones incl. Alarma e Intrusion; sin IVA, IVA 16%'),
('AIRE ACONDICIONADO Y EXTRACCION','Torre 1','Torre 1','Agrupado: 8 renglón(es) del tab · Torre 1','CYVSA','ppto',false,'CYVSA',7619776.73,NULL),
('AIRE ACONDICIONADO Y EXTRACCION','Torre 2','Torre 2','Agrupado: 8 renglón(es) del tab · Torre 2','CYVSA','ppto',false,'CYVSA',7977975.59,NULL),
('AIRE ACONDICIONADO Y EXTRACCION','Compartido','Compartido','Agrupado: 2 renglón(es) del tab · Compartido','CYVSA','ppto',false,'CYVSA',161936.00,NULL),
('ILUMINACION','Torre 1 · Ppto · No contratado','Torre 1','Agrupado: 102 renglón(es) del tab · Torre 1','427 ARCHITECTURE','ppto',false,'427 ARCHITECTURE',3105368.14,'TIPO-1 | TIPO-2 N1 | TIPO-2 N1R'),
('ILUMINACION','Torre 1 · Paramétrico · No contratado','Torre 1','Agrupado: 1 renglón(es) del tab · Torre 1','427 ARCHITECTURE','parametrico',false,'427 ARCHITECTURE',609000.00,NULL),
('ILUMINACION','Torre 2 · Ppto · No contratado','Torre 2','Agrupado: 102 renglón(es) del tab · Torre 2','427 ARCHITECTURE','ppto',false,'427 ARCHITECTURE',3105368.14,'TIPO-1 | TIPO-2 N1 | TIPO-2 N1R'),
('ILUMINACION','Torre 2 · Paramétrico · No contratado','Torre 2','Agrupado: 1 renglón(es) del tab · Torre 2','427 ARCHITECTURE','parametrico',false,'427 ARCHITECTURE',609000.00,NULL),
('ACABADOS','Torre 1','Torre 1','Agrupado: 36 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,8193878.08,NULL),
('ACABADOS','Torre 2','Torre 2','Agrupado: 48 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,8686251.68,NULL),
('HERRERIA','Torre 1','Torre 1','Agrupado: 6 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,4640000.00,NULL),
('SUMINISTRO Y COLOCACION DE MARMOL','Torre 1','Torre 1','Agrupado: 48 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,10798743.34,NULL),
('SUMINISTRO Y COLOCACION DE MARMOL','Torre 2','Torre 2','Agrupado: 64 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,10574935.84,NULL),
('VIDRIOS Y CANCELES','Torre 1 · Ppto · No contratado','Torre 1','Agrupado: 3 renglón(es) del tab · Torre 1','AX FERRO','ppto',false,'AX FERRO',15635303.59,NULL),
('VIDRIOS Y CANCELES','Torre 2 · Ppto · No contratado','Torre 2','Agrupado: 3 renglón(es) del tab · Torre 2','AX FERRO','ppto',false,'AX FERRO',15635303.59,NULL),
('VIDRIOS Y CANCELES','Torre 1 · Paramétrico · No contratado','Torre 1','Agrupado: 1 renglón(es) del tab · Torre 1','Grupo Aliglass','parametrico',false,'Grupo Aliglass',3522653.20,NULL),
('VIDRIOS Y CANCELES','Torre 2 · Paramétrico · No contratado','Torre 2','Agrupado: 1 renglón(es) del tab · Torre 2','Grupo Aliglass','parametrico',false,'Grupo Aliglass',3522653.20,NULL),
('COCINAS','Torre 1 · Ppto · No contratado','Torre 1','Agrupado: 108 renglón(es) del tab · Torre 1','DIECI','ppto',false,'DIECI',12096495.69,NULL),
('COCINAS','Torre 1 · Paramétrico · No contratado','Torre 1','Agrupado: 20 renglón(es) del tab · Torre 1','BOA','parametrico',false,'BOA',843419.76,'PARAMETRICO - asador OG42, se solicita al ponerse a la venta (no en cot. BOA 25-jun) | PARAMETRICO - cubrevinil, junto con asador | Paquete lavadora+secadora Samsung $45,000 MXN (junta 22-06-26)'),
('COCINAS','Torre 2 · Ppto · No contratado','Torre 2','Agrupado: 108 renglón(es) del tab · Torre 2','DIECI','ppto',false,'DIECI',12096495.68,NULL),
('COCINAS','Torre 2 · Paramétrico · No contratado','Torre 2','Agrupado: 20 renglón(es) del tab · Torre 2','BOA','parametrico',false,'BOA',843419.76,'PARAMETRICO - asador OG42, se solicita al ponerse a la venta (no en cot. BOA 25-jun) | PARAMETRICO - cubrevinil, junto con asador | Paquete lavadora+secadora Samsung $45,000 MXN (junta 22-06-26)'),
('GRIFERIA Y ACCESORIOS DE BAÑO','Torre 1','Torre 1','Agrupado: 246 renglón(es) del tab · Torre 1','GERMAN C','ppto',false,'GERMAN C',3894400.54,'1 por monomando de lavabo | 1 por regadera | Incluida en bañera 700330 — no se cotiza por separado (GC)'),
('GRIFERIA Y ACCESORIOS DE BAÑO','Torre 2','Torre 2','Agrupado: 268 renglón(es) del tab · Torre 2','GERMAN C','ppto',false,'GERMAN C',4166693.73,'1 por monomando de lavabo | 1 por regadera | Incluida en bañera 700330 — no se cotiza por separado (GC)'),
('CARPINTERIAS','Torre 1 · Ppto · Contratado','Torre 1','Agrupado: 138 renglón(es) del tab · Torre 1','HAMUI','ppto',true,'HAMUI',20051760.00,'SIHASI v2 mayo 2026 (folio 2511 S004 D) | ENVÍOS: $200K/torre / 4 villas/torre = $50K/villa'),
('CARPINTERIAS','Torre 1 · Paramétrico · No contratado','Torre 1','Agrupado: 2 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,371200.00,'CON INSTALACION E IMPORTACION'),
('CARPINTERIAS','Torre 1 · Ppto · No contratado','Torre 1','Agrupado: 4 renglón(es) del tab · Torre 1','ADC','ppto',false,'ADC',2389946.26,'Revisar'),
('CARPINTERIAS','Torre 2 · Ppto · Contratado','Torre 2','Agrupado: 148 renglón(es) del tab · Torre 2','HAMUI','ppto',true,'HAMUI',20051760.00,'SIHASI v2 mayo 2026 (folio 2511 S004 D) | ENVÍOS: $200K/torre / 4 villas/torre = $50K/villa'),
('CARPINTERIAS','Torre 2 · Paramétrico · No contratado','Torre 2','Agrupado: 2 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,371200.00,'CON INSTALACION E IMPORTACION'),
('CARPINTERIAS','Torre 2 · Ppto · No contratado','Torre 2','Agrupado: 4 renglón(es) del tab · Torre 2','ADC','ppto',false,'ADC',2987432.83,'Revisar'),
('ALBERCAS','Torre 1','Torre 1','Agrupado: 4 renglón(es) del tab · Torre 1','AQUA CONCEPTS','ppto',false,'AQUA CONCEPTS',11570130.00,'Incluye desde impermiabilizacion, hasta acabados y funcionamiento'),
('ALBERCAS','Torre 2','Torre 2','Agrupado: 4 renglón(es) del tab · Torre 2','AQUA CONCEPTS','ppto',false,'AQUA CONCEPTS',11570130.00,'Incluye desde impermiabilizacion, hasta acabados y funcionamiento'),
('JARDINERIA Y RIEGO','Torre 1','Torre 1','Agrupado: 2 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,3700400.00,NULL),
('JARDINERIA Y RIEGO','Torre 2','Torre 2','Agrupado: 2 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,3700400.00,NULL),
('ELEVADOR','Torre 1','Torre 1','Agrupado: 2 renglón(es) del tab · Torre 1',NULL,'parametrico',true,NULL,1697499.34,NULL),
('ELEVADOR','Torre 2','Torre 2','Agrupado: 2 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,1697499.34,NULL),
('EXTERIORES','Torre 1','Torre 1','Agrupado: 6 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,9994564.93,'REVISAR'),
('EXTERIORES','Torre 2','Torre 2','Agrupado: 6 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,9994564.93,'REVISAR'),
('GARDEN AND PRIVACY WALLS','Torre 1 · Ppto · No contratado','Torre 1','Agrupado: 2 renglón(es) del tab · Torre 1',NULL,'ppto',false,NULL,480204.99,NULL),
('GARDEN AND PRIVACY WALLS','Torre 2 · Ppto · No contratado','Torre 2','Agrupado: 2 renglón(es) del tab · Torre 2',NULL,'ppto',false,NULL,480204.99,NULL),
('GARDEN AND PRIVACY WALLS','Torre 1 · Paramétrico · No contratado','Torre 1','Agrupado: 1 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,116000.00,NULL),
('GARDEN AND PRIVACY WALLS','Torre 2 · Paramétrico · No contratado','Torre 2','Agrupado: 1 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,116000.00,NULL),
('INFRAESTRUCTURA','Torre 1','Torre 1','Agrupado: 1 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,406000.00,NULL),
('INFRAESTRUCTURA','Torre 2','Torre 2','Agrupado: 1 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,406000.00,NULL),
('OTROS','Torre 1','Torre 1','Agrupado: 2 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,1320000.00,NULL),
('OTROS','Torre 2','Torre 2','Agrupado: 2 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,1320000.00,NULL),
('CONTINGENCIAS','Torre 1','Torre 1','Agrupado: 1 renglón(es) del tab · Torre 1',NULL,'parametrico',false,NULL,6000000.00,NULL),
('CONTINGENCIAS','Torre 2','Torre 2','Agrupado: 1 renglón(es) del tab · Torre 2',NULL,'parametrico',false,NULL,6000000.00,NULL);

-- 5. Items (uno por (partida, concepto)).
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_item (project_id, partida_catalog_id, chapter_id, concepto)
SELECT bf.id, p.id, ch.id, d.concepto FROM (SELECT DISTINCT partida,concepto FROM _bf_g) d
JOIN bf ON true
JOIN public.buyout_partida_catalog p ON p.project_id=bf.id AND p.deleted_at IS NULL AND p.nombre=d.partida
LEFT JOIN public.buyout_chapter ch ON ch.project_id=bf.id AND ch.deleted_at IS NULL AND ch.nombre=p.chapter_default;

-- 6. Una cotización VIGENTE por item.
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_quote (item_id, supplier_id, quote_date, currency, kind, is_selected, contratado, monto_sin_iva, iva_pct)
SELECT i.id, s.id, DATE '2026-06-29', 'MXN', d.q_kind, true, d.q_contratado, d.unitario, 0
FROM (SELECT DISTINCT partida,concepto,q_kind,q_contratado,q_supplier,unitario FROM _bf_g) d
JOIN bf ON true
JOIN public.buyout_partida_catalog p ON p.project_id=bf.id AND p.deleted_at IS NULL AND p.nombre=d.partida
JOIN public.buyout_item i ON i.project_id=bf.id AND i.partida_catalog_id=p.id AND i.concepto=d.concepto AND i.deleted_at IS NULL
LEFT JOIN public.buyout_supplier s ON lower(s.nombre)=lower(d.q_supplier) AND s.deleted_at IS NULL;

-- 7. Una línea por cotización (MXN, cant=1, unitario = Σ TOTAL MXN del grupo).
WITH bf AS (SELECT id FROM public.projects WHERE nombre='NAUKA Beachfront' AND deleted_at IS NULL)
INSERT INTO public.buyout_line (quote_id, orden, categoria, concepto, detalle, villa_casita, piso, depto, proveedor, unidad, cantidad, moneda, unitario, sobrecosto_pct, iva_pct, notas)
SELECT q.id, 1, b.partida, b.concepto, b.detalle, b.torre, NULL, NULL, b.proveedor, 'Lote', 1, 'MXN', b.unitario, 0, 0, b.notas
FROM _bf_g b JOIN bf ON true
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
      ('GRIFERIA Y ACCESORIOS DE BAÑO', 8061094.27::numeric),
      ('CARPINTERIAS', 46223299.09::numeric),
      ('ALBERCAS', 23140260.00::numeric),
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
  IF n_li <> 72 THEN RAISE EXCEPTION 'BF lineas=% (esperado 72)', n_li; END IF;
  IF EXISTS (SELECT 1 FROM public.buyout_item i WHERE i.project_id=bf AND i.deleted_at IS NULL AND (SELECT count(*) FROM public.buyout_quote q WHERE q.item_id=i.id AND q.is_selected AND q.deleted_at IS NULL)<>1)
  THEN RAISE EXCEPTION 'Item BF sin exactamente 1 vigente'; END IF;
  SELECT count(*) INTO n_l3p FROM public.buyout_partida_catalog WHERE project_id=l3 AND deleted_at IS NULL;
  SELECT count(*) INTO n_l3c FROM public.buyout_chapter WHERE project_id=l3 AND deleted_at IS NULL;
  IF n_l3p<>24 THEN RAISE EXCEPTION 'L3 partidas=% (esperado 24)!', n_l3p; END IF;
  IF n_l3c<>8 THEN RAISE EXCEPTION 'L3 capitulos=% (esperado 8)!', n_l3c; END IF;
  SELECT count(*) INTO n_proj FROM public.projects WHERE deleted_at IS NULL;
  IF n_proj<3 THEN RAISE EXCEPTION 'projects=%', n_proj; END IF;
  RAISE NOTICE 'BF re-volcado agrupado OK: % lineas (esperado 72); cuadre al centavo 31 partidas; L3 intacto', n_li;
END $$;
