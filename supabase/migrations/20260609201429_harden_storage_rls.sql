-- =========================================================================
-- NAUKA Pagos — Fix de seguridad A1: endurecer RLS de Storage por rol
-- =========================================================================
-- Hallazgo A1 (security-audit-2026-06-08): las dos policies de storage.objects
-- eran `FOR ALL TO authenticated USING (bucket_id = …)` — es decir, CUALQUIER
-- usuario autenticado (incl. un aprobador externo) podía INSERT/UPDATE/DELETE
-- archivos vía la anon-key del browser, fuera de la UI. Las rutas son
-- deterministas y los IDs legibles por la lectura abierta, así que un externo
-- podía sobrescribir/borrar comprobantes de pago, carátulas, presupuestos y
-- firmas de cualquier proyecto.
--
-- El endurecimiento por rol de la sub-fase 8a (tighten_rls_for_roles) llegó a
-- las TABLAS pero nunca tocó storage.objects. Esta migración cierra esa
-- asimetría, con el MISMO patrón que las tablas:
--   • SELECT                → TODO autenticado (lectura abierta; ya leen todo).
--   • INSERT/UPDATE/DELETE   → solo admin (public.is_admin()).
--
-- NOTA (grants): Postgres exige el privilegio base de tabla además de la policy
-- (sin GRANT → 42501 antes de evaluar RLS). storage.objects ya tiene los grants
-- de Supabase para `authenticated` (los uploads de hoy funcionan), así que esta
-- migración SOLO reemplaza policies; no toca grants. El cambio de
-- comportamiento es exactamente: un NO-admin pierde escritura/borrado.
--
-- Bucket `firmas` (canvas de firma del aprobador — sub-fase 8e, aún no
-- construida): se deja PREVISTO el WITH CHECK acotado al prefijo del propio
-- firmante, para que un aprobador pueda subir SU PROPIA firma sin abrir el
-- bucket. Convención de ruta esperada por 8e: `{firmante_id}/<archivo>` (el
-- primer segmento de la ruta debe ser el firmante_id del que sube). Hoy ningún
-- código escribe en `firmas`, así que esta provisión no puede causar regresión.
-- Se usa split_part(name,'/',1) (independiente de la implementación de
-- storage.foldername) para extraer ese primer segmento. El DELETE en `firmas`
-- queda admin-only (integridad probatoria de las firmas ya usadas).
-- =========================================================================

-- Quitar las dos policies permisivas FOR ALL (originales de initial_schema).
DROP POLICY IF EXISTS storage_auth_full_proyectos ON storage.objects;
DROP POLICY IF EXISTS storage_auth_full_firmas    ON storage.objects;

-- Idempotencia: si se re-corre, limpiar las nuevas antes de recrearlas.
DROP POLICY IF EXISTS storage_proyectos_select ON storage.objects;
DROP POLICY IF EXISTS storage_proyectos_insert ON storage.objects;
DROP POLICY IF EXISTS storage_proyectos_update ON storage.objects;
DROP POLICY IF EXISTS storage_proyectos_delete ON storage.objects;
DROP POLICY IF EXISTS storage_firmas_select    ON storage.objects;
DROP POLICY IF EXISTS storage_firmas_insert    ON storage.objects;
DROP POLICY IF EXISTS storage_firmas_update    ON storage.objects;
DROP POLICY IF EXISTS storage_firmas_delete    ON storage.objects;

-- =========================================================================
-- Bucket `proyectos`: lectura abierta · escritura/borrado solo admin
-- =========================================================================

CREATE POLICY storage_proyectos_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'proyectos');

CREATE POLICY storage_proyectos_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'proyectos' AND public.is_admin());

CREATE POLICY storage_proyectos_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'proyectos' AND public.is_admin())
  WITH CHECK (bucket_id = 'proyectos' AND public.is_admin());

CREATE POLICY storage_proyectos_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'proyectos' AND public.is_admin());

-- =========================================================================
-- Bucket `firmas`: lectura abierta · admin escribe donde sea ·
-- aprobador escribe SOLO su propio prefijo `{firmante_id}/…` (provisión 8e)
-- =========================================================================

CREATE POLICY storage_firmas_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'firmas');

CREATE POLICY storage_firmas_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'firmas'
    AND (
      public.is_admin()
      OR split_part(name, '/', 1) = public.my_firmante_id()::text
    )
  );

CREATE POLICY storage_firmas_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'firmas'
    AND (
      public.is_admin()
      OR split_part(name, '/', 1) = public.my_firmante_id()::text
    )
  )
  WITH CHECK (
    bucket_id = 'firmas'
    AND (
      public.is_admin()
      OR split_part(name, '/', 1) = public.my_firmante_id()::text
    )
  );

CREATE POLICY storage_firmas_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'firmas' AND public.is_admin());
