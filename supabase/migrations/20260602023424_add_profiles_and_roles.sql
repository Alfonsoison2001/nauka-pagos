-- =========================================================================
-- NAUKA Pagos — Fase 1 post-MVP (8a): perfiles de usuario + roles
-- =========================================================================
-- Convierte la app en multi-usuario. Dos roles:
--   admin     → Alfonso, Jess. Operadores: CRUD completo + override de aprobación.
--   aprobador → José, Marcos, Edy. Ven todo, aprueban/rechazan lo asignado.
--
-- Esta migración crea `profiles`, los helpers de rol (SECURITY DEFINER, sin
-- recursión de RLS), su RLS, sus grants, y hace backfill de los 2 admins.
-- El ENDURECIMIENTO de las tablas operativas va en la migración siguiente
-- (20260602023425_tighten_rls_for_roles) — ambas en el mismo `db push`.
-- =========================================================================

-- =========================================================================
-- profiles  (1:1 con auth.users)
-- =========================================================================

CREATE TABLE public.profiles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text        NOT NULL,
  nombre        text        NOT NULL,
  role          text        NOT NULL DEFAULT 'aprobador' CHECK (role IN ('admin', 'aprobador')),
  firmante_id   uuid        REFERENCES public.firmantes(id),  -- aprobador ↔ su firmante; admin = null
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_role_idx     ON public.profiles (role)        WHERE deleted_at IS NULL;
CREATE INDEX profiles_firmante_idx ON public.profiles (firmante_id) WHERE firmante_id IS NOT NULL;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER profiles_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_change();

COMMENT ON TABLE  public.profiles             IS 'Usuario de la plataforma (1:1 con auth.users). role = admin | aprobador.';
COMMENT ON COLUMN public.profiles.firmante_id IS 'Para aprobadores: su fila en firmantes (matchea sus votos de aprobación). Admin = null.';

-- =========================================================================
-- Helpers de rol — SECURITY DEFINER para leer profiles SIN recursión de RLS
-- =========================================================================
-- Las políticas de RLS llaman a estas funciones. Si leyeran profiles bajo RLS
-- se produciría recursión infinita; SECURITY DEFINER las ejecuta como owner
-- (bypassa RLS). STABLE: el resultado no cambia dentro de una misma query.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid()
      AND role = 'admin'
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.my_firmante_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT firmante_id FROM public.profiles
  WHERE auth_user_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_admin()       FROM public;
REVOKE ALL ON FUNCTION public.my_firmante_id() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_firmante_id() TO authenticated;

-- =========================================================================
-- Grants + RLS de profiles
-- =========================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Lectura: cada quien ve su propio perfil; los admin ven todos.
CREATE POLICY profiles_select
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin());

-- Escritura: solo admin (gestión de usuarios desde /usuarios).
CREATE POLICY profiles_insert
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY profiles_update
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY profiles_delete
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =========================================================================
-- Backfill de admins (idempotente, por email)
-- =========================================================================
-- Alfonso + Jess pasan a role='admin'. Si su auth.users aún no existe, la fila
-- simplemente no se inserta (0 filas) y se les invita luego desde /usuarios.

INSERT INTO public.profiles (auth_user_id, email, nombre, role)
SELECT
  u.id,
  u.email,
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
  'admin'
FROM auth.users u
WHERE lower(u.email) IN ('alfonsoison@gmail.com', 'jochoa@izarquitectos.mx')
ON CONFLICT (auth_user_id) DO UPDATE
  SET role = 'admin',
      deleted_at = NULL;
