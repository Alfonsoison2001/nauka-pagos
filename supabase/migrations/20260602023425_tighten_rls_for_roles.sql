-- =========================================================================
-- NAUKA Pagos — Fase 1 post-MVP (8a): endurecer RLS por rol
-- =========================================================================
-- Hasta hoy cada tabla operativa tenía `auth_full_* FOR ALL USING(true)`:
-- cualquier usuario autenticado podía escribir. Con aprobadores entrando a la
-- plataforma, se reemplaza por:
--   • SELECT  → TODO autenticado (lectura abierta; los aprobadores ven todo).
--   • INSERT/UPDATE/DELETE → solo admin (public.is_admin()).
--
-- ⚠️ Depende de la migración previa (add_profiles_and_roles): is_admin() y el
-- backfill de admins DEBEN existir antes, o Alfonso/Jess perderían escritura.
-- Por eso ambas migraciones viajan en el mismo `db push`.
-- =========================================================================

DO $$
DECLARE
  t      text;
  tables text[] := ARRAY[
    'projects', 'firmantes', 'project_firmantes',
    'pagadores', 'contratistas', 'partidas', 'estimaciones'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Quitar la política permisiva anterior.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'auth_full_' || t, t);

    -- Lectura abierta a todo autenticado.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_select', t);

    -- Escritura solo admin.
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
-- audit_log: el crudo técnico pasa a SER SOLO ADMIN (decisión #11).
-- El timeline legible de aprobaciones NO usa audit_log (se deriva de la tabla
-- approvals en 8b), así que esto no afecta a los aprobadores.
-- =========================================================================

DROP POLICY IF EXISTS auth_read_audit_log ON public.audit_log;

CREATE POLICY audit_log_select_admin
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());
