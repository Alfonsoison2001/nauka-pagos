-- =========================================================================
-- NAUKA Pagos — Fase 1 post-MVP (8b): núcleo de aprobaciones
-- =========================================================================
-- Modelo GENÉRICO de aprobación (hoy carátulas; mañana presupuestos/cotizaciones
-- sin re-migración estructural):
--   approval_requests → una solicitud por documento por RONDA (estado a nivel doc)
--   approvals         → un voto/firma por firmante por solicitud
--
-- RLS (decisiones #6, #11):
--   • SELECT abierto a todo autenticado (timeline visible a todos).
--   • requests: escribe solo admin (envía, resuelve, adjunta constancia).
--   • approvals: INSERT solo admin (se crean al enviar); UPDATE admin o el
--     propio firmante (su voto). El control de campos lo hace el server action.
-- =========================================================================

-- =========================================================================
-- approval_requests
-- =========================================================================

CREATE TABLE public.approval_requests (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type        text        NOT NULL CHECK (document_type IN ('caratula')),
  document_id          uuid        NOT NULL,  -- polimórfico: = estimaciones.id (carátula)
  project_id           uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  round                int         NOT NULL DEFAULT 1 CHECK (round >= 1),
  status               text        NOT NULL DEFAULT 'en_aprobacion'
                         CHECK (status IN ('en_aprobacion', 'aprobada', 'rechazada', 'cancelada')),
  requested_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at          timestamptz,
  constancia_pdf_path  text,       -- PDF con constancia anexa (se llena en 8c al aprobar)
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX approval_requests_doc_round_uidx
  ON public.approval_requests (document_type, document_id, round);
CREATE INDEX approval_requests_doc_idx
  ON public.approval_requests (document_type, document_id);
CREATE INDEX approval_requests_open_idx
  ON public.approval_requests (project_id, status);

CREATE TRIGGER approval_requests_set_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER approval_requests_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_change();

COMMENT ON TABLE public.approval_requests IS
  'Una solicitud de aprobación por documento por ronda. status a nivel documento.';
COMMENT ON COLUMN public.approval_requests.document_id IS
  'Referencia polimórfica (sin FK): para caratula = estimaciones.id.';

-- =========================================================================
-- approvals (votos/firmas por firmante)
-- =========================================================================

CREATE TABLE public.approvals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid        NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  firmante_id  uuid        NOT NULL REFERENCES public.firmantes(id),
  status       text        NOT NULL DEFAULT 'pendiente'
                 CHECK (status IN ('pendiente', 'aprobada', 'rechazada')),
  decided_at   timestamptz,
  decided_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,  -- quién hizo clic
  on_behalf    boolean     NOT NULL DEFAULT false,  -- admin en representación del firmante
  motivo       text,       -- requerido al rechazar (lo valida el server action)
  firma_path   text,       -- canvas opcional (bucket 'firmas'); se usa en 8e
  ip           text,       -- IP al decidir (para la constancia)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX approvals_request_firmante_uidx
  ON public.approvals (request_id, firmante_id);
CREATE INDEX approvals_firmante_status_idx
  ON public.approvals (firmante_id, status);

CREATE TRIGGER approvals_set_updated_at
  BEFORE UPDATE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER approvals_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_change();

COMMENT ON TABLE public.approvals IS
  'Voto/firma de un firmante sobre una solicitud. on_behalf = admin en representación.';

-- =========================================================================
-- Grants
-- =========================================================================

GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.approvals         TO authenticated;

-- =========================================================================
-- RLS
-- =========================================================================

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals         ENABLE ROW LEVEL SECURITY;

-- approval_requests: todos leen; escribe solo admin.
CREATE POLICY approval_requests_select
  ON public.approval_requests FOR SELECT
  TO authenticated USING (true);
CREATE POLICY approval_requests_insert
  ON public.approval_requests FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY approval_requests_update
  ON public.approval_requests FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- approvals: todos leen; INSERT solo admin; UPDATE admin o el propio firmante.
CREATE POLICY approvals_select
  ON public.approvals FOR SELECT
  TO authenticated USING (true);
CREATE POLICY approvals_insert
  ON public.approvals FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY approvals_update
  ON public.approvals FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR firmante_id = public.my_firmante_id())
  WITH CHECK (public.is_admin() OR firmante_id = public.my_firmante_id());
