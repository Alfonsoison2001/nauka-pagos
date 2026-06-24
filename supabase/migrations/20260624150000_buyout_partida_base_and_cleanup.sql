-- =========================================================================
-- NAUKA Pagos — Módulo BUY-OUT · Fase 3a: presupuesto base por partida + limpieza
-- =========================================================================
-- 100% aditivo:
--   1. Tabla nueva buyout_partida_base (project_id, partida_catalog_id,
--      monto_base) con RLS + audit + grants, idéntica al resto de buyout_*.
--   2. Seed de los 24 valores de "Presupuesto base por partida" del doc oficial
--      (docs/future-modules/buyout-catalogo-L3.md, Lote 3, 15-jun). Editable.
--   3. LIMPIEZA no destructiva: soft-delete de las líneas de prueba del Slice 2b
--      que quedaron sobre la taxonomía VIEJA (partidas soft-deleted en 2c). Solo
--      toca items cuyo partida_catalog_id apunta a una partida con
--      deleted_at IS NOT NULL → cualquier captura sobre la taxonomía NUEVA (24
--      activas) queda intacta. Idempotente (guardas deleted_at IS NULL).
-- Cero impacto en Pagos.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Tabla buyout_partida_base (referencia fija por partida — col PRESUPUESTO
--    IZ MXN BASE del tablero). Dinero numeric(14,2). Editable por admin.
-- -------------------------------------------------------------------------
CREATE TABLE public.buyout_partida_base (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  partida_catalog_id  uuid          NOT NULL REFERENCES public.buyout_partida_catalog(id) ON DELETE CASCADE,
  monto_base          numeric(14,2) NOT NULL DEFAULT 0 CHECK (monto_base >= 0),
  deleted_at          timestamptz,
  created_at          timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX buyout_partida_base_project_idx ON public.buyout_partida_base (project_id);
CREATE INDEX buyout_partida_base_partida_idx ON public.buyout_partida_base (partida_catalog_id);
-- Una base vigente por (proyecto, partida).
CREATE UNIQUE INDEX buyout_partida_base_proj_partida_uidx
  ON public.buyout_partida_base (project_id, partida_catalog_id) WHERE deleted_at IS NULL;

CREATE TRIGGER buyout_partida_base_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.buyout_partida_base
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_change();

ALTER TABLE public.buyout_partida_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY buyout_partida_base_select ON public.buyout_partida_base
  FOR SELECT TO authenticated USING (true);
CREATE POLICY buyout_partida_base_insert ON public.buyout_partida_base
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY buyout_partida_base_update ON public.buyout_partida_base
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY buyout_partida_base_delete ON public.buyout_partida_base
  FOR DELETE TO authenticated USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyout_partida_base TO authenticated;

COMMENT ON TABLE public.buyout_partida_base IS
  'Presupuesto base (referencia fija) por partida y proyecto — col PRESUPUESTO IZ MXN BASE. El DIF del Resumen compara el vigente contra esta base. Editable por admin.';

-- -------------------------------------------------------------------------
-- 2. Seed de las 24 bases (NAUKA Lote 3). Idempotente (WHERE NOT EXISTS).
--    Empata por nombre EXACTO contra las 24 partidas activas (taxonomía 2c).
-- -------------------------------------------------------------------------
INSERT INTO public.buyout_partida_base (project_id, partida_catalog_id, monto_base)
SELECT p.id, pc.id, v.base
FROM public.projects p
JOIN (VALUES
  ('ARQUITECTURA',                        343360),
  ('TRAMITES LOCALES',                    0),
  ('INGENIERIAS Y TOPOGRAFIA',            0),
  ('INDIRECTOS DE OBRA',                  3608000),
  ('OBRA CIVIL',                          38299999.97),
  ('ALBAÑILERIA Y BARDAS',                0),
  ('IMPERMEABILIZACION',                  1086537.0838),
  ('INSTALACIONES ELECTRICAS',            10480775),
  ('INSTALACIONES HIDRAULICAS Y GAS',     6874023.7812),
  ('AUTOMATIZACION Y CONTROL ILUMINACION',5752305.4284),
  ('AIRE ACONDICIONADO Y EXTRACCION',     5389000.3072),
  ('ILUMINACION',                         2630880),
  ('ACABADOS',                            1486674.21084),
  ('HERRERIA',                            2830243.2028),
  ('SUMINISTRO Y COLOCACION DE MARMOL',   3607205.38123506),
  ('MADERA DE INGENIERIA',                3803911.19394432),
  ('VIDRIOS Y CANCELES',                  9688739.92),
  ('COCINAS',                             7641545),
  ('GRIFERIA Y ACCESORIOS DE BAÑO',       1337425.2),
  ('CARPINTERIAS',                        17648030.7728),
  ('ALBERCAS',                            5125627.04),
  ('JARDINERIA Y RIEGO',                  1162900),
  ('PISO HIDRONICO',                      0),
  ('CASITA',                              0)
) AS v(partida, base)
  ON TRUE
JOIN public.buyout_partida_catalog pc
  ON pc.nombre = v.partida AND pc.deleted_at IS NULL
WHERE p.nombre = 'NAUKA Lote 3'
  AND NOT EXISTS (
    SELECT 1 FROM public.buyout_partida_base b
    WHERE b.project_id = p.id AND b.partida_catalog_id = pc.id AND b.deleted_at IS NULL
  );

-- -------------------------------------------------------------------------
-- 3. LIMPIEZA: soft-delete de las líneas de prueba del 2b sobre taxonomía vieja
--    (items cuyo partida_catalog_id apunta a una partida soft-deleted en 2c).
-- -------------------------------------------------------------------------
UPDATE public.buyout_line l
SET deleted_at = now()
WHERE l.deleted_at IS NULL
  AND l.quote_id IN (
    SELECT q.id
    FROM public.buyout_quote q
    JOIN public.buyout_item i ON i.id = q.item_id
    JOIN public.buyout_partida_catalog pc ON pc.id = i.partida_catalog_id
    WHERE pc.deleted_at IS NOT NULL
  );

UPDATE public.buyout_quote q
SET deleted_at = now(), is_selected = false
WHERE q.deleted_at IS NULL
  AND q.item_id IN (
    SELECT i.id
    FROM public.buyout_item i
    JOIN public.buyout_partida_catalog pc ON pc.id = i.partida_catalog_id
    WHERE pc.deleted_at IS NOT NULL
  );

UPDATE public.buyout_item i
SET deleted_at = now(), selected_quote_id = NULL
WHERE i.deleted_at IS NULL
  AND i.partida_catalog_id IN (
    SELECT pc.id FROM public.buyout_partida_catalog pc WHERE pc.deleted_at IS NOT NULL
  );
