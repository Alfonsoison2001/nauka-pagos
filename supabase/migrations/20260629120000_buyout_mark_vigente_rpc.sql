-- =========================================================================
-- NAUKA Pagos — Módulo BUY-OUT · RPC atómico para "marcar vigente" (BO-09)
-- =========================================================================
-- Arreglo de atomicidad detectado en la auditoría 2026-06-29
-- (docs/audit-buyout-2026-06-29.md, hallazgo BO-09). 100% ADITIVO y EXCLUSIVO
-- de buyout_*: crea UNA función y su GRANT; no toca ninguna tabla, RLS, grant ni
-- trigger existente, y NO toca absolutamente nada del módulo Pagos.
--
-- Problema: marcar la cotización vigente de un concepto hacía 3 escrituras
-- secuenciales SIN transacción (baja la anterior → sube la elegida → apunta el
-- item). Si la 1ª tenía éxito y la 2ª fallaba, el concepto quedaba con TODAS sus
-- cotizaciones en is_selected=false → sin vigente → desaparecía del rollup
-- (Resumen y Partida) descuadrando el tablero sin aviso.
--
-- Solución: el swap completo corre DENTRO de esta función plpgsql, es decir en
-- UNA sola transacción. Si cualquier paso falla, Postgres revierte todo y el
-- concepto conserva intacta su vigente anterior. Nunca queda sin vigente.
--
-- Seguridad: SECURITY DEFINER (mismo patrón que is_admin() / fn_notify_admins).
-- Como ignora RLS, re-valida public.is_admin() aquí dentro y aborta si no es
-- admin. Valida también que el item pertenezca al proyecto y la cotización al
-- item (misma defensa que el server action). search_path fijo a public.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.buyout_mark_vigente(
  p_project_id uuid,
  p_item_id    uuid,
  p_quote_id   uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo admin (SECURITY DEFINER ignora RLS → re-checamos aquí).
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar la versión vigente.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- El item debe pertenecer al proyecto (defensa) y no estar borrado.
  IF NOT EXISTS (
    SELECT 1 FROM public.buyout_item
    WHERE id = p_item_id AND project_id = p_project_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Concepto no encontrado.';
  END IF;

  -- La cotización debe ser de ese item y no estar borrada.
  IF NOT EXISTS (
    SELECT 1 FROM public.buyout_quote
    WHERE id = p_quote_id AND item_id = p_item_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Esa versión no existe o fue eliminada.';
  END IF;

  -- Swap ATÓMICO (todo en la transacción de la función):
  --   1) baja la vigente anterior   2) sube la elegida   3) apunta el item.
  -- El orden respeta el índice único parcial "1 vigente por item": tras (1) no
  -- queda ninguna is_selected=true para el item, así que (2) nunca colisiona.
  UPDATE public.buyout_quote
  SET is_selected = false
  WHERE item_id = p_item_id AND is_selected AND deleted_at IS NULL;

  UPDATE public.buyout_quote
  SET is_selected = true
  WHERE id = p_quote_id;

  UPDATE public.buyout_item
  SET selected_quote_id = p_quote_id
  WHERE id = p_item_id;
END;
$$;

COMMENT ON FUNCTION public.buyout_mark_vigente(uuid, uuid, uuid) IS
  'Marca atómicamente la cotización vigente de un concepto (baja anterior + sube elegida + apunta item) en una sola transacción. Admin-only (re-valida is_admin). Arreglo BO-09.';

-- La RLS de buyout_quote/buyout_item ya exige is_admin() para escritura; esta
-- función la complementa con ATOMICIDAD. Grant idéntico al de is_admin()/fn_*.
REVOKE ALL ON FUNCTION public.buyout_mark_vigente(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.buyout_mark_vigente(uuid, uuid, uuid) TO authenticated;
