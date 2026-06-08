-- =========================================================================
-- NAUKA Pagos — Habilita hard-delete (solo admin) en aprobaciones
-- =========================================================================
-- Hasta hoy approval_requests / approvals solo tenían policies SELECT/INSERT/
-- UPDATE: sin policy de DELETE, RLS bloquea el borrado físico (la app solo hace
-- soft-delete). Se agrega DELETE acotado a admin para habilitar:
--   (1) Limpieza de approvals de prueba huérfanos tras la migración de Lote 44.
--   (2) Feature "Borrar carátula" (admin): al borrar una carátula se elimina su
--       solicitud de aprobación + votos.
--
-- approvals.request_id es ON DELETE CASCADE, así que borrar un approval_request
-- ya elimina sus approvals (el cascade corre como owner, sin pasar por RLS). Se
-- agrega también la policy en approvals para permitir borrados directos.
-- El trigger de audit registra cada DELETE (before-image) en audit_log.
-- =========================================================================

-- Postgres exige el privilegio base DE TABLA además de la policy RLS: sin el
-- GRANT, el DELETE falla con SQLSTATE 42501 (permission denied for table) ANTES
-- de evaluar la policy. La migración original de approvals (20260602040155) solo
-- otorgó SELECT/INSERT/UPDATE a authenticated.
GRANT DELETE ON public.approval_requests TO authenticated;
GRANT DELETE ON public.approvals         TO authenticated;

CREATE POLICY approval_requests_delete
  ON public.approval_requests FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY approvals_delete
  ON public.approvals FOR DELETE
  TO authenticated
  USING (public.is_admin());
