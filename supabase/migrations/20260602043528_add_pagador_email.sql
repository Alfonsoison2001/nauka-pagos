-- =========================================================================
-- NAUKA Pagos — 8b ajuste: email del pagador
-- =========================================================================
-- La carátula NO se envía al contratista, se envía al PAGADOR (quien mueve el
-- dinero: Salomon Ison, Fasja, NAUKA, etc.). Se agrega el correo del pagador
-- (nullable). Si está vacío, el default de destinatarios solo trae los
-- default_emails del proyecto.
-- =========================================================================

ALTER TABLE public.pagadores ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.pagadores.email IS
  'Correo del pagador (destinatario de la solicitud de pago / carátula). Nullable.';
