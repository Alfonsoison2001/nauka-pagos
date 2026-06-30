-- =========================================================================
-- NAUKA Pagos — Módulo BUY-OUT · Catálogo de partidas POR-PROYECTO
-- =========================================================================
-- Hoy buyout_partida_catalog es GLOBAL (sin project_id), pero cada proyecto
-- tiene su propio set de partidas (L3 ≠ Beachfront). Esta migración lo vuelve
-- por-proyecto SIN romper Lote 3:
--   1. Agrega project_id (FK projects) a buyout_partida_catalog.
--   2. Backfillea TODAS las filas existentes (24 activas + 23 soft-deleted del
--      glosario viejo) con el project_id de 'NAUKA Lote 3' — el catálogo
--      vigente se sembró exclusivamente para L3 (ver migraciones de slice 1/2c).
--   3. project_id NOT NULL (ya no quedan NULLs).
--   4. Reemplaza el índice único global (nombre) por uno por-proyecto
--      (project_id, nombre) WHERE deleted_at IS NULL → permite que Beachfront
--      tenga partidas con el MISMO nombre que L3 (OBRA CIVIL, ACABADOS, MEP…).
--
-- buyout_concepto_catalog NO necesita project_id: cuelga de partida_catalog_id
-- (FK ON DELETE CASCADE), que ahora es por-proyecto → los conceptos quedan
-- transitivamente aislados por proyecto. El único SELECT de conceptos ya filtra
-- por partida_catalog_id (no por nombre global).
--
-- 100% aditiva. Cero impacto en Pagos. Cero filas borradas. Si el lookup de
-- 'NAUKA Lote 3' fallara, el SET NOT NULL aborta toda la migración (rollback).
-- =========================================================================

-- 1. Columna project_id (nullable de entrada, para poder backfillear).
ALTER TABLE public.buyout_partida_catalog
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- 2. Backfill: TODAS las filas existentes son de Lote 3 (activas + soft-deleted).
UPDATE public.buyout_partida_catalog
SET project_id = (
  SELECT id FROM public.projects
  WHERE nombre = 'NAUKA Lote 3' AND deleted_at IS NULL
)
WHERE project_id IS NULL;

-- 3. Ya sin NULLs → exigir project_id en adelante (catálogo siempre por-proyecto).
ALTER TABLE public.buyout_partida_catalog
  ALTER COLUMN project_id SET NOT NULL;

-- 4. Índice único: de global (nombre) → por-proyecto (project_id, nombre).
DROP INDEX IF EXISTS public.buyout_partida_catalog_nombre_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS buyout_partida_catalog_project_nombre_uidx
  ON public.buyout_partida_catalog (project_id, nombre) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS buyout_partida_catalog_project_idx
  ON public.buyout_partida_catalog (project_id);

COMMENT ON TABLE public.buyout_partida_catalog IS
  'Catálogo de partidas POR-PROYECTO. Cada proyecto ve solo sus partidas (índice único por project_id, nombre). Editable por admin.';
COMMENT ON COLUMN public.buyout_partida_catalog.project_id IS
  'Proyecto dueño de la partida. Las filas históricas (taxonomía L3) quedaron backfilleadas a NAUKA Lote 3.';

-- Auto-verificación (transaccional): exige que Lote 3 exista y reporta cuántas
-- filas quedaron stampadas a L3. Si L3 no existe → aborta todo (rollback).
DO $$
DECLARE l3 uuid; n int;
BEGIN
  SELECT id INTO l3 FROM public.projects
   WHERE nombre = 'NAUKA Lote 3' AND deleted_at IS NULL;
  IF l3 IS NULL THEN
    RAISE EXCEPTION 'Backfill abortado: proyecto NAUKA Lote 3 no encontrado';
  END IF;
  SELECT count(*) INTO n FROM public.buyout_partida_catalog WHERE project_id = l3;
  RAISE NOTICE 'buyout_partida_catalog backfilleadas a Lote 3: % filas (activas + soft-deleted)', n;
END $$;
