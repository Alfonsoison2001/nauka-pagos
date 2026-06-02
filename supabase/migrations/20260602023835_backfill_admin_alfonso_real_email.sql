-- =========================================================================
-- NAUKA Pagos — 8a fix: backfill admin con el email REAL de Alfonso
-- =========================================================================
-- La cuenta de Supabase Auth de Alfonso es `aison@izarquitectos.mx` (su correo
-- de IZ Arquitectos), NO `alfonsoison@gmail.com` (ese gmail no tiene cuenta
-- auth). El backfill original (add_profiles_and_roles) solo matcheó a Jess, así
-- que sin esta corrección Alfonso quedaría SIN perfil → is_admin()=false →
-- perdería escritura tras endurecer RLS.
--
-- No es escalación de privilegios: aison@ ya tenía CRUD completo hoy (todos los
-- authenticated lo tenían). Esto solo preserva ese acceso bajo el nuevo modelo.
-- Se incluye también el gmail por si en el futuro se crea esa cuenta.
-- =========================================================================

INSERT INTO public.profiles (auth_user_id, email, nombre, role)
SELECT
  u.id,
  u.email,
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
  'admin'
FROM auth.users u
WHERE lower(u.email) IN ('aison@izarquitectos.mx', 'alfonsoison@gmail.com')
ON CONFLICT (auth_user_id) DO UPDATE
  SET role = 'admin',
      deleted_at = NULL;
