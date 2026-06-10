-- =========================================================================
-- NAUKA Pagos — Metadata de cancelación en approval_requests
-- =========================================================================
-- Feature "Cancelar solicitud de aprobación en curso" (admin): al cancelar una
-- ronda (status='en_aprobacion' → 'cancelada') queremos mostrar en el timeline
-- QUIÉN canceló y POR QUÉ. Las columnas son aditivas y nullable:
--   • canceled_by    → admin que canceló (auth.users).
--   • cancel_motivo  → motivo opcional capturado en el diálogo de confirmación.
--
-- Los votos (approvals) NO se tocan al cancelar — quedan en el historial. La
-- policy UPDATE existente de approval_requests (solo admin) ya cubre estas
-- columnas; el GRANT UPDATE a authenticated también. El trigger de audit
-- registra el cambio (before/after) como con cualquier otro UPDATE.
-- =========================================================================

ALTER TABLE public.approval_requests
  ADD COLUMN canceled_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN cancel_motivo text;

COMMENT ON COLUMN public.approval_requests.canceled_by IS
  'Admin que canceló la ronda (status=cancelada). NULL si no fue cancelada.';
COMMENT ON COLUMN public.approval_requests.cancel_motivo IS
  'Motivo opcional de la cancelación (capturado en el diálogo de confirmación).';
