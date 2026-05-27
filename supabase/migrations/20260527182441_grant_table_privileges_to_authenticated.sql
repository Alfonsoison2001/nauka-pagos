-- =========================================================================
-- Grant base table privileges to the `authenticated` role
-- =========================================================================
-- Why this migration exists:
-- Recent Supabase versions no longer auto-GRANT SELECT/INSERT/UPDATE/DELETE
-- on tables created in `public` to the `authenticated` and `anon` roles
-- when the table is created. RLS policies alone are NOT sufficient:
-- Postgres checks the base GRANT first and rejects the query with
-- "permission denied for table" (SQLSTATE 42501) before any policy is
-- evaluated.
--
-- The initial_schema migration created RLS policies (USING (true) for
-- authenticated) but missed the base grants. This migration adds them.
--
-- `anon` is deliberately NOT granted anything — the app's middleware
-- redirects unauthenticated requests to /login before any DB query runs.
-- =========================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.projects,
  public.firmantes,
  public.project_firmantes,
  public.pagadores,
  public.contratistas,
  public.partidas,
  public.estimaciones
TO authenticated;

-- audit_log is append-only via triggers (which run with elevated rights);
-- end users only need to read it.
GRANT SELECT ON public.audit_log TO authenticated;
