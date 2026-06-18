-- =========================================================================
-- NAUKA Pagos — Módulo BUY-OUT · Slice 1: esquema + catálogos
-- =========================================================================
-- Capa de seguimiento sobre el Excel BUY OUT (ver docs/SPEC-buyout.md §4 y
-- docs/future-modules/buyout-L3-estructura.md). 100% ADITIVO:
--
--   • Todas las tablas llevan prefijo `buyout_`.
--   • NO toca ninguna tabla, RLS, grant ni trigger del módulo Pagos.
--   • La ÚNICA referencia hacia Pagos es buyout_quote.pagos_partida_id, un FK
--     NULLABLE a public.partidas con ON DELETE SET NULL (el "hilo" del §8).
--     No altera partidas: solo agrega una RI nullable que se anula sola si una
--     partida de Pagos se borrara en duro (Pagos usa soft-delete, así que en la
--     práctica nunca dispara).
--
-- Convenciones reutilizadas de Pagos (idénticas, sin redefinir nada):
--   • id uuid pk default gen_random_uuid(), created_at, deleted_at (soft-delete).
--   • Dinero numeric(14,2). Triggers public.fn_audit_change() en cada tabla.
--   • RLS por rol: SELECT a authenticated; INSERT/UPDATE/DELETE solo public.is_admin().
--   • Grants base a authenticated (Postgres exige el GRANT antes que la policy).
--
-- Catálogos sembrados para Lote 3 (proyecto 'NAUKA Lote 3'). Editables por admin.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid() (idempotente)

-- =========================================================================
-- 1. CATÁLOGOS GLOBALES (sin project_id — compartidos entre proyectos)
-- =========================================================================

-- Unidad de medida (M2, ML, PZA, Lote, Servicio, Mes, Semana).
-- No está en la lista literal del §4 (que carece de tabla de UoM) pero el §7
-- pide sembrar estas unidades y han de ser "editables por admin" → requieren
-- una tabla donde vivir. Es aditiva y vetable en la revisión de Alfonso.
CREATE TABLE public.buyout_uom (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text        NOT NULL,
  nombre      text        NOT NULL,
  orden       int         NOT NULL DEFAULT 0,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX buyout_uom_codigo_uidx
  ON public.buyout_uom (lower(codigo)) WHERE deleted_at IS NULL;

-- Proveedores GLOBALES (compartidos entre proyectos; el importador empata por
-- nombre normalizado, crea si es nuevo, fusiona después — §5).
CREATE TABLE public.buyout_supplier (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  rfc         text,
  notas       text,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX buyout_supplier_nombre_uidx
  ON public.buyout_supplier (lower(nombre)) WHERE deleted_at IS NULL;

-- Catálogo GLOBAL de partidas (~26 canónicas del glosario L3).
-- chapter_default / unidad_driver son HINTS de texto, no FKs: los capítulos son
-- por-proyecto (no hay fila global a la que apuntar) y la unidad es un default
-- editable. La app valida unidad_driver contra buyout_uom.codigo.
CREATE TABLE public.buyout_partida_catalog (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text        NOT NULL,
  chapter_default  text,
  unidad_driver    text,
  orden            int         NOT NULL DEFAULT 0,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX buyout_partida_catalog_nombre_uidx
  ON public.buyout_partida_catalog (nombre) WHERE deleted_at IS NULL;

-- =========================================================================
-- 2. CATÁLOGOS / META POR PROYECTO
-- =========================================================================

-- Meta 1:1 con projects: áreas para $/m² + programa (texto/fechas).
CREATE TABLE public.buyout_project_meta (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid          NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  area_int          numeric(12,2),
  area_ext_techada  numeric(12,2),
  area_ext_pav      numeric(12,2),
  programa          text,
  deleted_at        timestamptz,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

-- Tipo de cambio por (proyecto, moneda).
CREATE TABLE public.buyout_fx (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  currency    text          NOT NULL CHECK (currency IN ('MXN', 'USD', 'EUR')),
  rate        numeric(12,6) NOT NULL CHECK (rate > 0),
  deleted_at  timestamptz,
  created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX buyout_fx_project_currency_uidx
  ON public.buyout_fx (project_id, currency) WHERE deleted_at IS NULL;

-- Capítulos del tablero (por proyecto; orden de despliegue).
CREATE TABLE public.buyout_chapter (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  nombre      text        NOT NULL,
  orden       int         NOT NULL DEFAULT 0,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX buyout_chapter_project_nombre_uidx
  ON public.buyout_chapter (project_id, nombre) WHERE deleted_at IS NULL;
CREATE INDEX buyout_chapter_project_idx ON public.buyout_chapter (project_id);

-- Dimensión unidad (Villa/Casita · Torre · Depto). L3/L44 = villa(+casita);
-- BF añade torres/deptos. area_int opcional (el $/m² es a nivel proyecto).
CREATE TABLE public.buyout_unit (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tipo        text          NOT NULL CHECK (tipo IN ('villa', 'casita', 'torre', 'depto')),
  nombre      text          NOT NULL,
  area_int    numeric(12,2),
  deleted_at  timestamptz,
  created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX buyout_unit_project_nombre_uidx
  ON public.buyout_unit (project_id, nombre) WHERE deleted_at IS NULL;
CREATE INDEX buyout_unit_project_idx ON public.buyout_unit (project_id);

-- =========================================================================
-- 3. TRAZABILIDAD DE IMPORTACIÓN
-- =========================================================================

-- Un import = un tab/partida. De aquí salen histórico y evolución (§5).
CREATE TABLE public.buyout_import_batch (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  partida_catalog_id  uuid        NOT NULL REFERENCES public.buyout_partida_catalog(id) ON DELETE RESTRICT,
  filename            text        NOT NULL,
  imported_at         timestamptz NOT NULL DEFAULT now(),
  imported_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyout_import_batch_project_idx ON public.buyout_import_batch (project_id);
CREATE INDEX buyout_import_batch_partida_idx ON public.buyout_import_batch (partida_catalog_id);

-- =========================================================================
-- 4. NÚCLEO: item (subcategoría) → quote (cotización fechada) → line (renglón)
-- =========================================================================

-- Subcategoría / concepto dentro de una partida. selected_quote_id (la vigente)
-- se enlaza por ALTER al final (FK circular con buyout_quote).
CREATE TABLE public.buyout_item (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  partida_catalog_id  uuid        NOT NULL REFERENCES public.buyout_partida_catalog(id) ON DELETE RESTRICT,
  chapter_id          uuid        REFERENCES public.buyout_chapter(id) ON DELETE SET NULL,
  concepto            text        NOT NULL,
  unit_id             uuid        REFERENCES public.buyout_unit(id) ON DELETE SET NULL,
  selected_quote_id   uuid,       -- FK → buyout_quote(id) agregado más abajo
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyout_item_project_idx        ON public.buyout_item (project_id);
CREATE INDEX buyout_item_partida_idx        ON public.buyout_item (partida_catalog_id);
CREATE INDEX buyout_item_chapter_idx        ON public.buyout_item (chapter_id);
CREATE INDEX buyout_item_unit_idx           ON public.buyout_item (unit_id);
CREATE INDEX buyout_item_selected_quote_idx ON public.buyout_item (selected_quote_id);

-- La cotización fechada = unidad mínima. Estado de 2 ejes: kind (madurez) +
-- contratado (contratación). pagos_partida_id = el hilo a Pagos (§8).
CREATE TABLE public.buyout_quote (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           uuid          NOT NULL REFERENCES public.buyout_item(id) ON DELETE CASCADE,
  supplier_id       uuid          REFERENCES public.buyout_supplier(id) ON DELETE SET NULL,
  quote_date        date          NOT NULL DEFAULT current_date,
  currency          text          NOT NULL DEFAULT 'MXN' CHECK (currency IN ('MXN', 'USD', 'EUR')),
  kind              text          NOT NULL DEFAULT 'ppto' CHECK (kind IN ('parametrico', 'ppto')),
  is_selected       boolean       NOT NULL DEFAULT false,
  contratado        boolean       NOT NULL DEFAULT false,
  contract_number   text,
  pdf_url           text,
  notas             text,
  import_batch_id   uuid          REFERENCES public.buyout_import_batch(id) ON DELETE SET NULL,
  monto_sin_iva     numeric(14,2) NOT NULL DEFAULT 0 CHECK (monto_sin_iva >= 0),
  iva_pct           numeric(5,4)  NOT NULL DEFAULT 0.16 CHECK (iva_pct >= 0 AND iva_pct <= 1),
  pagos_partida_id  uuid          REFERENCES public.partidas(id) ON DELETE SET NULL,
  deleted_at        timestamptz,
  created_at        timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX buyout_quote_item_idx          ON public.buyout_quote (item_id);
CREATE INDEX buyout_quote_supplier_idx      ON public.buyout_quote (supplier_id);
CREATE INDEX buyout_quote_import_batch_idx  ON public.buyout_quote (import_batch_id);
CREATE INDEX buyout_quote_pagos_partida_idx ON public.buyout_quote (pagos_partida_id);
-- A lo sumo UNA cotización vigente por item.
CREATE UNIQUE INDEX buyout_quote_one_selected_uidx
  ON public.buyout_quote (item_id) WHERE is_selected AND deleted_at IS NULL;

-- Ahora sí, el FK circular: la vigente del item apunta a una cotización suya.
ALTER TABLE public.buyout_item
  ADD CONSTRAINT buyout_item_selected_quote_fk
  FOREIGN KEY (selected_quote_id) REFERENCES public.buyout_quote(id) ON DELETE SET NULL;

-- Renglón (las 22 col de la verde) — opcional/progresivo. Solo se guardan los
-- INPUTS/DROPDOWNS; los calculados (importe, IVA, total, TC, total MXN) se
-- derivan, no se duplican (§4 / L3 doc §2).
CREATE TABLE public.buyout_line (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        uuid          NOT NULL REFERENCES public.buyout_quote(id) ON DELETE CASCADE,
  orden           int           NOT NULL DEFAULT 0,
  categoria       text,                              -- col B  CATEGORÍA  (= partida)
  concepto        text,                              -- col C  CONCEPTO   (= subcategoría)
  detalle         text,                              -- col D  DETALLE
  villa_casita    text,                              -- col E  Villa/Casita
  piso            text,                              -- col F  PISO
  depto           text,                              -- col G  DEPTO
  proveedor       text,                              -- col H  PROVEEDOR  (clave de agrupación al importar)
  unidad          text,                              -- col I  UNIDAD     (espeja buyout_uom.codigo)
  cantidad        numeric(14,3),                     -- col J  CANTIDAD
  moneda          text          DEFAULT 'MXN' CHECK (moneda IS NULL OR moneda IN ('MXN', 'USD', 'EUR')), -- col K
  unitario        numeric(14,2),                     -- col L  $ UNITARIO
  sobrecosto_pct  numeric(5,4)  DEFAULT 0,           -- col N  SOBRECOSTO %
  iva_pct         numeric(5,4)  DEFAULT 0.16,        -- col P  % IVA
  notas           text,                              -- col U  NOTAS
  deleted_at      timestamptz,
  created_at      timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX buyout_line_quote_idx ON public.buyout_line (quote_id);

-- =========================================================================
-- 5. "QUÉ FALTA", CIERRES MENSUALES Y SNAPSHOTS
-- =========================================================================

-- Nota de texto libre por partida (o item) no contratada (§6).
CREATE TABLE public.buyout_falta (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  partida_catalog_id  uuid        REFERENCES public.buyout_partida_catalog(id) ON DELETE RESTRICT,
  item_id             uuid        REFERENCES public.buyout_item(id) ON DELETE CASCADE,
  texto               text        NOT NULL,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyout_falta_target_chk CHECK (partida_catalog_id IS NOT NULL OR item_id IS NOT NULL)
);
CREATE INDEX buyout_falta_project_idx ON public.buyout_falta (project_id);
CREATE INDEX buyout_falta_partida_idx ON public.buyout_falta (partida_catalog_id);
CREATE INDEX buyout_falta_item_idx    ON public.buyout_falta (item_id);
-- Un renglón por partida (cuando no es item-específico).
CREATE UNIQUE INDEX buyout_falta_project_partida_uidx
  ON public.buyout_falta (project_id, partida_catalog_id)
  WHERE item_id IS NULL AND deleted_at IS NULL;

-- Cierre manual de mes ("toma la foto"). Reabrible por admin.
CREATE TABLE public.buyout_month_close (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  periodo      text        NOT NULL CHECK (periodo ~ '^\d{4}-\d{2}$'),  -- yyyy-mm
  closed_at    timestamptz NOT NULL DEFAULT now(),
  closed_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reopened_at  timestamptz,
  deleted_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX buyout_month_close_project_periodo_uidx
  ON public.buyout_month_close (project_id, periodo) WHERE deleted_at IS NULL;
CREATE INDEX buyout_month_close_project_idx ON public.buyout_month_close (project_id);

-- Foto congelada del total vigente por partida en ese cierre (alimenta Evolución).
CREATE TABLE public.buyout_month_snapshot (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  month_close_id      uuid          NOT NULL REFERENCES public.buyout_month_close(id) ON DELETE CASCADE,
  partida_catalog_id  uuid          NOT NULL REFERENCES public.buyout_partida_catalog(id) ON DELETE RESTRICT,
  total_mxn           numeric(14,2) NOT NULL DEFAULT 0,
  deleted_at          timestamptz,
  created_at          timestamptz   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX buyout_month_snapshot_close_partida_uidx
  ON public.buyout_month_snapshot (month_close_id, partida_catalog_id) WHERE deleted_at IS NULL;
CREATE INDEX buyout_month_snapshot_close_idx   ON public.buyout_month_snapshot (month_close_id);
CREATE INDEX buyout_month_snapshot_partida_idx ON public.buyout_month_snapshot (partida_catalog_id);

-- =========================================================================
-- 6. AUDIT TRIGGERS — reusa public.fn_audit_change() de Pagos (no se redefine)
-- =========================================================================

DO $$
DECLARE
  t      text;
  tables text[] := ARRAY[
    'buyout_uom', 'buyout_supplier', 'buyout_partida_catalog',
    'buyout_project_meta', 'buyout_fx', 'buyout_chapter', 'buyout_unit',
    'buyout_import_batch', 'buyout_item', 'buyout_quote', 'buyout_line',
    'buyout_falta', 'buyout_month_close', 'buyout_month_snapshot'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.fn_audit_change()',
      t || '_audit', t);
  END LOOP;
END $$;

-- =========================================================================
-- 7. RLS POR ROL — idéntico a Pagos (SELECT todos; escritura solo is_admin())
-- =========================================================================

DO $$
DECLARE
  t      text;
  tables text[] := ARRAY[
    'buyout_uom', 'buyout_supplier', 'buyout_partida_catalog',
    'buyout_project_meta', 'buyout_fx', 'buyout_chapter', 'buyout_unit',
    'buyout_import_batch', 'buyout_item', 'buyout_quote', 'buyout_line',
    'buyout_falta', 'buyout_month_close', 'buyout_month_snapshot'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())',
      t || '_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin())',
      t || '_delete', t);
  END LOOP;
END $$;

-- =========================================================================
-- 8. GRANTS base a authenticated (Postgres exige el GRANT antes que la policy)
-- =========================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.buyout_uom,
  public.buyout_supplier,
  public.buyout_partida_catalog,
  public.buyout_project_meta,
  public.buyout_fx,
  public.buyout_chapter,
  public.buyout_unit,
  public.buyout_import_batch,
  public.buyout_item,
  public.buyout_quote,
  public.buyout_line,
  public.buyout_falta,
  public.buyout_month_close,
  public.buyout_month_snapshot
TO authenticated;

-- =========================================================================
-- 9. SEED — catálogos de Lote 3 ('NAUKA Lote 3'). Idempotente (WHERE NOT EXISTS).
-- =========================================================================

-- ---- 9.1 Unidades de medida (global) ------------------------------------
INSERT INTO public.buyout_uom (codigo, nombre, orden)
SELECT v.codigo, v.nombre, v.orden
FROM (VALUES
  ('M2',       'Metro cuadrado', 1),
  ('ML',       'Metro lineal',   2),
  ('PZA',      'Pieza',          3),
  ('Lote',     'Lote',           4),
  ('Servicio', 'Servicio',       5),
  ('Mes',      'Mes',            6),
  ('Semana',   'Semana',         7)
) AS v(codigo, nombre, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyout_uom u WHERE lower(u.codigo) = lower(v.codigo)
);

-- ---- 9.2 Catálogo global de partidas (canónicas del glosario L3) --------
-- ~26 según el glosario; aquí van las 23 nombradas sin ambigüedad en el
-- análisis del Excel. Las restantes (~3) se reconcilian contra el archivo real
-- en el Slice 6 (el importador empata por nombre y crea las faltantes).
INSERT INTO public.buyout_partida_catalog (nombre, chapter_default, unidad_driver, orden)
SELECT v.nombre, v.chapter_default, v.unidad_driver, v.orden
FROM (VALUES
  ('Arquitectura',                       'DISEÑO',       'Lote', 1),
  ('Tramites_Locales',                   'DISEÑO',       'Lote', 2),
  ('Ingenierias_Y_Topografia',           'DISEÑO',       'Lote', 3),
  ('Indirectos_De_Obra',                 'OTROS',        'Lote', 4),
  ('Obra_Civil',                         'OBRA CIVIL',   'M2',   5),
  ('Albañileria_Y_Bardas',               'OBRA CIVIL',   'M2',   6),
  ('Impermeabilizacion',                 'OBRA CIVIL',   'M2',   7),
  ('Piso_Hidronico',                     'MEP',          'M2',   8),
  ('Acabados',                           'ACABADOS',     'M2',   9),
  ('Herreria',                           'ACABADOS',     'M2',   10),
  ('Instalaciones_Electricas',           'MEP',          'M2',   11),
  ('Instalaciones_Hidraulicas',          'MEP',          'M2',   12),
  ('Albercas',                           'ALBERCAS',     'Lote', 13),
  ('Automatizacion_Control_Iluminacion', 'MEP',          'Lote', 14),
  ('Instalaciones_Gas',                  'MEP',          'Lote', 15),
  ('Aire_Acondicionado_Y_Extraccion',    'MEP',          'M2',   16),
  ('Iluminacion',                        'ACABADOS',     'PZA',  17),
  ('Suministro_Y_Colocacion_De_Marmol',  'COLOCACIONES', 'M2',   18),
  ('Madera_De_Ingenieria',               'COLOCACIONES', 'M2',   19),
  ('Vidrios_Y_Canceles',                 'COLOCACIONES', 'M2',   20),
  ('Cocinas',                            'COLOCACIONES', 'Lote', 21),
  ('Carpinterias',                       'COLOCACIONES', 'M2',   22),
  ('Griferia_Y_Accesorios_De_Baño',      'COLOCACIONES', 'PZA',  23)
) AS v(nombre, chapter_default, unidad_driver, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyout_partida_catalog c WHERE c.nombre = v.nombre
);

-- ---- 9.3 Capítulos del tablero (por proyecto: NAUKA Lote 3) -------------
INSERT INTO public.buyout_chapter (project_id, nombre, orden)
SELECT p.id, v.nombre, v.orden
FROM public.projects p
CROSS JOIN (VALUES
  ('DISEÑO',       1),
  ('OBRA CIVIL',   2),
  ('MEP',          3),
  ('ACABADOS',     4),
  ('COLOCACIONES', 5),
  ('ALBERCAS',     6),
  ('JARDINERÍA',   7),
  ('OTROS',        8)
) AS v(nombre, orden)
WHERE p.nombre = 'NAUKA Lote 3'
  AND NOT EXISTS (
    SELECT 1 FROM public.buyout_chapter c
    WHERE c.project_id = p.id AND c.nombre = v.nombre
  );

-- ---- 9.4 Tipo de cambio (NAUKA Lote 3): MXN 1 · USD 17.5 · EUR 20.5 -----
INSERT INTO public.buyout_fx (project_id, currency, rate)
SELECT p.id, v.currency, v.rate
FROM public.projects p
CROSS JOIN (VALUES
  ('MXN', 1.0),
  ('USD', 17.5),
  ('EUR', 20.5)
) AS v(currency, rate)
WHERE p.nombre = 'NAUKA Lote 3'
  AND NOT EXISTS (
    SELECT 1 FROM public.buyout_fx f
    WHERE f.project_id = p.id AND f.currency = v.currency
  );

-- ---- 9.5 Meta del proyecto (NAUKA Lote 3): áreas de la hoja UNITARIO -----
INSERT INTO public.buyout_project_meta (project_id, area_int, area_ext_techada, area_ext_pav)
SELECT p.id, 992.61, 665.39, 383.75
FROM public.projects p
WHERE p.nombre = 'NAUKA Lote 3'
  AND NOT EXISTS (
    SELECT 1 FROM public.buyout_project_meta m WHERE m.project_id = p.id
  );

-- ---- 9.6 Dimensión unidad (NAUKA Lote 3 tiene Villa + Casita) ------------
-- Más allá de la lista literal del §3 del prompt, pero L3 demostrablemente
-- tiene ambas y el importador (col E) las necesitará. Aditivo y vetable.
INSERT INTO public.buyout_unit (project_id, tipo, nombre)
SELECT p.id, v.tipo, v.nombre
FROM public.projects p
CROSS JOIN (VALUES
  ('villa',  'Villa'),
  ('casita', 'Casita')
) AS v(tipo, nombre)
WHERE p.nombre = 'NAUKA Lote 3'
  AND NOT EXISTS (
    SELECT 1 FROM public.buyout_unit u
    WHERE u.project_id = p.id AND u.nombre = v.nombre
  );

-- =========================================================================
-- 10. COMMENTS (documentación para \d+ y tooling)
-- =========================================================================

COMMENT ON TABLE public.buyout_uom             IS 'Catálogo global de unidades de medida (M2, ML, PZA, Lote, Servicio, Mes, Semana). Editable por admin.';
COMMENT ON TABLE public.buyout_supplier        IS 'Proveedores GLOBALES (compartidos entre proyectos). El importador empata por nombre normalizado.';
COMMENT ON TABLE public.buyout_partida_catalog IS 'Catálogo global de las ~26 partidas canónicas (glosario L3). Editable por admin.';
COMMENT ON TABLE public.buyout_project_meta    IS '1:1 con projects: áreas (m²) para $/m² + programa.';
COMMENT ON TABLE public.buyout_fx              IS 'Tipo de cambio por (proyecto, moneda). L3: USD 17.5, EUR 20.5.';
COMMENT ON TABLE public.buyout_chapter         IS 'Capítulos del tablero BUY OUT por proyecto (DISEÑO, OBRA CIVIL, MEP, …).';
COMMENT ON TABLE public.buyout_unit            IS 'Dimensión unidad por proyecto (villa/casita/torre/depto). L3/L44 villa(+casita); BF añade torres/deptos.';
COMMENT ON TABLE public.buyout_import_batch    IS 'Un import = un tab/partida. Trazabilidad y rollback; base de histórico/evolución.';
COMMENT ON TABLE public.buyout_item            IS 'Subcategoría/concepto dentro de una partida. Estado = derivado de la cotización vigente.';
COMMENT ON TABLE public.buyout_quote           IS 'Cotización fechada (unidad mínima). Estado 2 ejes: kind (parametrico/ppto) + contratado. Una es la vigente (is_selected).';
COMMENT ON TABLE public.buyout_line            IS 'Renglón opcional (22 col de la verde). Solo inputs/dropdowns; los calculados se derivan.';
COMMENT ON TABLE public.buyout_falta           IS 'Qué falta: nota de texto libre por partida (o item) no contratada. Sin categorías ni gates.';
COMMENT ON TABLE public.buyout_month_close     IS 'Cierre manual de mes ("toma la foto"). Reabrible por admin.';
COMMENT ON TABLE public.buyout_month_snapshot  IS 'Foto congelada del total vigente por partida en un cierre (alimenta Evolución).';

COMMENT ON COLUMN public.buyout_quote.pagos_partida_id IS 'HILO A PAGOS (§8): FK nullable a public.partidas. Al marcar contratado se liga (botón manual en V1). ON DELETE SET NULL: no altera Pagos.';
COMMENT ON COLUMN public.buyout_quote.kind             IS 'Eje madurez: parametrico (estimado tecleado) | ppto (respaldado por cotización real).';
COMMENT ON COLUMN public.buyout_quote.is_selected      IS 'La cotización vigente del item. Garantizado único por buyout_quote_one_selected_uidx.';
COMMENT ON COLUMN public.buyout_partida_catalog.chapter_default IS 'Capítulo por defecto (texto, no FK): los capítulos son por-proyecto. La app lo mapea a buyout_chapter.nombre.';
COMMENT ON COLUMN public.buyout_partida_catalog.unidad_driver  IS 'Unidad por defecto para $/m² (texto que espeja buyout_uom.codigo). Editable por admin.';
