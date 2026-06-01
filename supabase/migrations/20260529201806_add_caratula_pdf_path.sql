-- =========================================================================
-- NAUKA Pagos — Día 5: add estimaciones.caratula_pdf_path
-- =========================================================================
-- Path en Storage de la COPIA ENVIADA del PDF de la carátula, con timestamp:
--   proyectos/{project_id}/caratulas/{estimacion_id}_{timestamp}.pdf
-- Distinto de caratula_generada_url (preview mutable, sobrescrito en cada
-- "Generar"). Este se escribe/sobrescribe en cada envío exitoso.
-- =========================================================================

ALTER TABLE public.estimaciones
  ADD COLUMN IF NOT EXISTS caratula_pdf_path text;

COMMENT ON COLUMN public.estimaciones.caratula_pdf_path IS
  'Path en Storage de la copia enviada del PDF (timestamped). Se sobrescribe en cada reenvío exitoso. Ver caratula_generada_url para el preview.';
