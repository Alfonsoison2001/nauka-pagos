-- =========================================================================
-- NAUKA Pagos — Día 5.1: status manual + simplificación de columnas
-- =========================================================================
-- Decisión deliberada (diverge del Excel original): status pasa a ser MANUAL
-- (dropdown de 3 opciones), no derivado. Se elimina fecha_pago (la fecha ya no
-- se modela; el pago se refleja sólo en el status), y fecha_solicitud se
-- renombra a fecha_estimacion (un único campo de fecha por estimación).
-- =========================================================================

-- 1) Quitar el trigger + función que derivaba el status (ahora es manual)
DROP TRIGGER IF EXISTS estimaciones_sync_status ON public.estimaciones;
DROP FUNCTION IF EXISTS public.fn_sync_estimacion_status();

-- 2) Quitar el CHECK que ataba 'pagada' a fecha_pago (referencia la columna)
ALTER TABLE public.estimaciones
  DROP CONSTRAINT IF EXISTS estimaciones_pagada_requires_fecha;

-- 3) Eliminar fecha_pago (su índice parcial se elimina en cascada).
--    Las filas 'pagada' conservan su status; pierden la fecha (queda en audit_log).
ALTER TABLE public.estimaciones
  DROP COLUMN IF EXISTS fecha_pago;

-- 4) Renombrar fecha_solicitud → fecha_estimacion (+ su índice)
ALTER TABLE public.estimaciones
  RENAME COLUMN fecha_solicitud TO fecha_estimacion;
ALTER INDEX IF EXISTS estimaciones_fecha_solicitud_idx
  RENAME TO estimaciones_fecha_estimacion_idx;

-- El CHECK estimaciones_status_check (pendiente|enviada|pagada) se mantiene.
COMMENT ON COLUMN public.estimaciones.status IS
  'Manual (no derivado): pendiente | enviada | pagada.';
COMMENT ON COLUMN public.estimaciones.fecha_estimacion IS
  'Fecha de la estimación (antes fecha_solicitud).';
