-- =========================================================================
-- NAUKA Pagos — Día 5: seed de firmantes + vínculos a los 3 proyectos
-- =========================================================================
-- 3 firmantes globales (biblioteca compartida) vinculados a los 3 proyectos
-- NAUKA vía project_firmantes con orden 1-3 (bloque AUTORIZACIONES del Excel).
--
-- ⚠️ Los emails son PLACEHOLDERS. email es NOT NULL + único, pero NO se usa
-- para enviar correos (los destinatarios salen del dialog) ni aparece en el
-- PDF (solo nombre/cargo/empresa). Alfonso los corrige por la UI.
--
-- Idempotente: NOT EXISTS por lower(email) y por (project_id, firmante_id),
-- más ON CONFLICT DO NOTHING por si ya hay un orden ocupado manualmente.
-- =========================================================================

-- ---- Firmantes (biblioteca global) -------------------------------------
INSERT INTO public.firmantes (nombre, cargo, empresa, email)
SELECT v.nombre, v.cargo, v.empresa, v.email
FROM (VALUES
  ('Ing. Edy C. Rodríguez', 'Director De Construcción', 'IZ Arquitectos', 'edy.rodriguez@izarquitectos.mx'),
  ('Arq. José Ison',        'Director General',         'IZ Arquitectos', 'jose.ison@izarquitectos.mx'),
  ('Ing. Marcos Fasja',     'Director General',         'GFA',            'marcos.fasja@gfa.mx')
) AS v(nombre, cargo, empresa, email)
WHERE NOT EXISTS (
  SELECT 1 FROM public.firmantes f
  WHERE lower(f.email) = lower(v.email) AND f.deleted_at IS NULL
);

-- ---- Vínculos a los 3 proyectos NAUKA (orden 1-3) ----------------------
INSERT INTO public.project_firmantes (project_id, firmante_id, orden, default_signs)
SELECT p.id, f.id, e.orden, true
FROM (VALUES
  ('edy.rodriguez@izarquitectos.mx', 1),
  ('jose.ison@izarquitectos.mx',     2),
  ('marcos.fasja@gfa.mx',            3)
) AS e(email, orden)
JOIN public.firmantes f
  ON lower(f.email) = lower(e.email) AND f.deleted_at IS NULL
JOIN public.projects p
  ON p.deleted_at IS NULL AND p.cliente = 'NAUKA'
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_firmantes pf
  WHERE pf.project_id = p.id AND pf.firmante_id = f.id
)
ON CONFLICT DO NOTHING;
