-- =========================================================================
-- NAUKA Pagos — 8d: notificar a admins (cross-role) + devolver sus correos
-- =========================================================================
-- Problema de RLS: los eventos de rechazo (C), aprobación completa (D) y
-- progreso (B) los dispara EL VOTO de un aprobador. Un aprobador NO puede leer
-- los perfiles de los admin (RLS de profiles = propio o is_admin()), así que el
-- server action no puede resolver a quién notificar / a qué correo escribir.
--
-- Esta función SECURITY DEFINER corre como owner (ignora RLS): inserta una
-- notificación in-app para CADA admin activo y DEVUELVE sus correos+nombres para
-- que el server action mande los emails con Resend. Para eventos sin email
-- (progreso) se ignora el resultado. fn_create_notification (8d) sigue sirviendo
-- para notificar a un usuario puntual (los aprobadores, que sí resuelve el admin).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fn_notify_admins(
  p_type       text,
  p_title      text,
  p_body       text DEFAULT NULL,
  p_link       text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
) RETURNS TABLE (email text, nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, request_id)
  SELECT p.auth_user_id, p_type, p_title, p_body, p_link, p_request_id
  FROM public.profiles p
  WHERE p.role = 'admin' AND p.deleted_at IS NULL;

  RETURN QUERY
  SELECT p.email, p.nombre
  FROM public.profiles p
  WHERE p.role = 'admin' AND p.deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_notify_admins(text, text, text, text, uuid) TO authenticated;
