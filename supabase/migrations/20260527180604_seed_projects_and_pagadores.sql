-- =========================================================================
-- NAUKA Pagos — Seed: 3 projects + 4 global pagadores
-- =========================================================================
-- Día 2 seed. Idempotent via WHERE NOT EXISTS, so re-applying this against
-- an env where any of these rows already exist is a no-op.
--
-- Projects: the 3 NAUKA real-estate developments. Ubicación is left NULL
-- for Lote 3 and Lote 44 (Alfonso fills them in via the Config tab).
-- Beachfront's ubicación comes from SPEC §3.
--
-- Pagadores: 4 globals (project_id = NULL) from reference/NAUKA_Flujo_Pagos
-- → Glosario. They appear in every project's Config tab as read-only;
-- Alfonso can add per-project overrides on top.
-- =========================================================================

-- ---- Projects -----------------------------------------------------------
INSERT INTO public.projects (nombre, lote, cliente, ubicacion, caratula_iva_mode)
SELECT v.nombre, v.lote, 'NAUKA', v.ubicacion, 'con_iva'
FROM (VALUES
  ('NAUKA Lote 3',     'Lote 3',     NULL::text),
  ('NAUKA Lote 44',    'Lote 44',    NULL::text),
  ('NAUKA Beachfront', 'Beachfront', 'Beach Front Residences')
) AS v(nombre, lote, ubicacion)
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects p WHERE p.nombre = v.nombre
);

-- ---- Pagadores globales -------------------------------------------------
INSERT INTO public.pagadores (nombre, project_id)
SELECT v.nombre, NULL::uuid
FROM (VALUES
  ('Salomon Ison'),
  ('Fasja'),
  ('NAUKA'),
  ('Otros')
) AS v(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pagadores p
  WHERE p.nombre = v.nombre AND p.project_id IS NULL
);
