-- =========================================================================
-- NAUKA Pagos — Sub-fase 8d: notificaciones in-app (feed + badge)
-- =========================================================================
-- Modelo del change.md day-8 §3.4 / §4.3. Feed por usuario para el badge del
-- sidebar y el dropdown. La inserción es CROSS-USER (un admin notifica a los
-- aprobadores; un aprobador notifica al admin), así que NO se abre un INSERT
-- permisivo en RLS: se inserta vía la función SECURITY DEFINER
-- public.fn_create_notification(...). Cada usuario solo LEE y MARCA-LEÍDAS las
-- suyas.
-- =========================================================================

CREATE TABLE public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- destinatario
  type        text        NOT NULL,   -- nueva_aprobacion | progreso | aprobada | rechazada | recordatorio
  title       text        NOT NULL,
  body        text,
  link        text,                    -- deep-link, p.ej. /aprobaciones?proyecto=...#est-...
  request_id  uuid        REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id, read_at);
CREATE INDEX notifications_user_recent_idx ON public.notifications (user_id, created_at DESC);

COMMENT ON TABLE public.notifications IS
  'Feed in-app por usuario (badge + dropdown). INSERT vía fn_create_notification (SECURITY DEFINER).';

-- =========================================================================
-- fn_create_notification — inserción cross-user controlada
-- =========================================================================
-- SECURITY DEFINER: corre como owner y puede insertar para cualquier user_id
-- sin abrir un INSERT permisivo en RLS. La llaman SOLO los server actions del
-- flujo de aprobación (con args controlados). Devuelve el id creado.

CREATE OR REPLACE FUNCTION public.fn_create_notification(
  p_user_id    uuid,
  p_type       text,
  p_title      text,
  p_body       text DEFAULT NULL,
  p_link       text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, request_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, p_request_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- =========================================================================
-- Grants + RLS
-- =========================================================================

-- authenticated lee y marca-leídas sus propias notificaciones; NO inserta
-- directo (eso es exclusivo de la función). DELETE solo por cascade.
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_notification(uuid, text, text, text, text, uuid) TO authenticated;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
