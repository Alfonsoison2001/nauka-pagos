-- =========================================================================
-- NAUKA Pagos — Día 5.1: status intermedio 'enviada' en estimaciones
-- =========================================================================
-- status pasa de {pendiente, pagada} a {pendiente, enviada, pagada}, DERIVADO
-- (no manual) de columnas existentes vía trigger:
--   pagada   ← fecha_pago IS NOT NULL
--   enviada  ← caratula_enviada_at IS NOT NULL AND fecha_pago IS NULL
--   pendiente← caratula_enviada_at IS NULL AND fecha_pago IS NULL
-- =========================================================================

-- 1) Permitir 'enviada' en el CHECK de valores de status
ALTER TABLE public.estimaciones
  DROP CONSTRAINT IF EXISTS estimaciones_status_check;
ALTER TABLE public.estimaciones
  ADD CONSTRAINT estimaciones_status_check
  CHECK (status IN ('pendiente', 'enviada', 'pagada'));

-- 2) 'enviada' (como 'pendiente') no requiere fecha_pago; 'pagada' sí
ALTER TABLE public.estimaciones
  DROP CONSTRAINT IF EXISTS estimaciones_pagada_requires_fecha;
ALTER TABLE public.estimaciones
  ADD CONSTRAINT estimaciones_pagada_requires_fecha
  CHECK (status IN ('pendiente', 'enviada') OR fecha_pago IS NOT NULL);

-- 3) Trigger que deriva status de caratula_enviada_at + fecha_pago
CREATE OR REPLACE FUNCTION public.fn_sync_estimacion_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.fecha_pago IS NOT NULL THEN
    NEW.status := 'pagada';
  ELSIF NEW.caratula_enviada_at IS NOT NULL THEN
    NEW.status := 'enviada';
  ELSE
    NEW.status := 'pendiente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estimaciones_sync_status ON public.estimaciones;
CREATE TRIGGER estimaciones_sync_status
  BEFORE INSERT OR UPDATE ON public.estimaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_estimacion_status();

-- 4) Backfill de filas existentes (el trigger recomputa de forma idéntica)
UPDATE public.estimaciones
SET status = CASE
  WHEN fecha_pago IS NOT NULL THEN 'pagada'
  WHEN caratula_enviada_at IS NOT NULL THEN 'enviada'
  ELSE 'pendiente'
END;

COMMENT ON COLUMN public.estimaciones.status IS
  'Derivado por trigger fn_sync_estimacion_status: pagada (fecha_pago), enviada (caratula_enviada_at sin pago), pendiente (ninguno). No editar manualmente.';
