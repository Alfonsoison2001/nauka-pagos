-- =========================================================================
-- NAUKA Pagos — Initial Schema
-- =========================================================================
-- Mirrors the 3-tier mental model from the Excel:
--   projects → contratistas → partidas → estimaciones
-- Plus globals: firmantes (cross-project), pagadores (per-project or global)
-- Plus governance: audit_log (auto via trigger)
--
-- Designed to be migration-friendly with reference/NAUKA_Flujo_Pagos.xlsx
-- See docs/SPEC.md section 9 for column-by-column mapping.
-- =========================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- =========================================================================
-- Audit log table + trigger functions (defined first; tables attach to them)
-- =========================================================================

CREATE TABLE public.audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  entity_table  text        NOT NULL,
  entity_id     uuid        NOT NULL,
  before        jsonb,
  after         jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_entity_idx     ON public.audit_log (entity_table, entity_id);
CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX audit_log_user_idx       ON public.audit_log (user_id, created_at DESC);

-- Generic audit trigger (works for any table with an `id uuid` column)
CREATE OR REPLACE FUNCTION public.fn_audit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action, entity_table, entity_id, before, after)
    VALUES (v_user_id, 'INSERT', TG_TABLE_NAME, NEW.id, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action, entity_table, entity_id, before, after)
    VALUES (v_user_id, 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action, entity_table, entity_id, before, after)
    VALUES (v_user_id, 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================================
-- projects
-- =========================================================================

CREATE TABLE public.projects (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             text        NOT NULL,
  lote               text,
  cliente            text        NOT NULL DEFAULT 'NAUKA',
  ubicacion          text,
  logo_url           text,
  caratula_iva_mode  text        NOT NULL DEFAULT 'con_iva' CHECK (caratula_iva_mode IN ('con_iva', 'sin_iva')),
  default_emails     text[]      NOT NULL DEFAULT ARRAY[]::text[],
  status             text        NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'cerrado', 'archivado')),
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX projects_nombre_active_uidx
  ON public.projects (nombre)
  WHERE deleted_at IS NULL;

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER projects_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_change();

-- =========================================================================
-- firmantes (global library — same person can sign across projects)
-- =========================================================================

CREATE TABLE public.firmantes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  cargo       text        NOT NULL,
  empresa     text        NOT NULL,
  email       text        NOT NULL,
  firma_url   text,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX firmantes_email_active_uidx
  ON public.firmantes (lower(email))
  WHERE deleted_at IS NULL;

CREATE TRIGGER firmantes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.firmantes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_change();

-- =========================================================================
-- project_firmantes (which firmantes can sign which project + order on PDF)
-- =========================================================================

CREATE TABLE public.project_firmantes (
  project_id     uuid        NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,
  firmante_id    uuid        NOT NULL REFERENCES public.firmantes(id) ON DELETE CASCADE,
  orden          int         NOT NULL CHECK (orden IN (1, 2, 3)),
  default_signs  boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, firmante_id)
);

CREATE UNIQUE INDEX project_firmantes_orden_uidx
  ON public.project_firmantes (project_id, orden);

-- =========================================================================
-- pagadores (Salomon Ison, Fasja, NAUKA, Otros)
-- project_id = null  →  global pagador, available across projects
-- project_id = X     →  pagador only for project X
-- =========================================================================

CREATE TABLE public.pagadores (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  project_id  uuid        REFERENCES public.projects(id) ON DELETE CASCADE,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Global pagadores: unique by name across all global rows
CREATE UNIQUE INDEX pagadores_global_nombre_uidx
  ON public.pagadores (nombre)
  WHERE project_id IS NULL AND deleted_at IS NULL;

-- Per-project pagadores: unique by (project, name)
CREATE UNIQUE INDEX pagadores_project_nombre_uidx
  ON public.pagadores (project_id, nombre)
  WHERE project_id IS NOT NULL AND deleted_at IS NULL;

-- =========================================================================
-- contratistas (one row per contractor per project)
-- =========================================================================

CREATE TABLE public.contratistas (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  nombre            text        NOT NULL,
  rfc               text,
  contacto_nombre   text,
  contacto_email    text,
  contacto_telefono text,
  notas             text,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contratistas_project_nombre_uidx
  ON public.contratistas (project_id, nombre)
  WHERE deleted_at IS NULL;

CREATE INDEX contratistas_project_idx ON public.contratistas (project_id);

CREATE TRIGGER contratistas_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.contratistas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_change();

-- =========================================================================
-- partidas (signed contract = one row per (contratista, scope))
-- =========================================================================

CREATE TABLE public.partidas (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  contratista_id        uuid          NOT NULL REFERENCES public.contratistas(id) ON DELETE CASCADE,
  nombre                text          NOT NULL,
  presupuesto_sin_iva   numeric(14,2) NOT NULL CHECK (presupuesto_sin_iva >= 0),
  iva_pct               numeric(5,4)  NOT NULL DEFAULT 0.16 CHECK (iva_pct >= 0 AND iva_pct <= 1),
  iva_monto             numeric(14,2) GENERATED ALWAYS AS (round(presupuesto_sin_iva * iva_pct, 2))       STORED,
  presupuesto_con_iva   numeric(14,2) GENERATED ALWAYS AS (round(presupuesto_sin_iva * (1 + iva_pct), 2)) STORED,
  notas                 text,
  fecha_firma           date,
  presupuesto_pdf_url   text,
  deleted_at            timestamptz,
  created_at            timestamptz   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX partidas_contratista_nombre_uidx
  ON public.partidas (contratista_id, nombre)
  WHERE deleted_at IS NULL;

CREATE INDEX partidas_contratista_idx ON public.partidas (contratista_id);

CREATE TRIGGER partidas_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.partidas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_change();

-- =========================================================================
-- estimaciones (a payment request = one carátula = one pago)
-- =========================================================================

CREATE TABLE public.estimaciones (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id               uuid          NOT NULL REFERENCES public.partidas(id) ON DELETE RESTRICT,
  numero                   text          NOT NULL,
  concepto                 text,
  monto_sin_iva            numeric(14,2) NOT NULL CHECK (monto_sin_iva >= 0),
  iva_pct                  numeric(5,4)  NOT NULL DEFAULT 0.16 CHECK (iva_pct >= 0 AND iva_pct <= 1),
  iva_monto                numeric(14,2) GENERATED ALWAYS AS (round(monto_sin_iva * iva_pct, 2))       STORED,
  monto_con_iva            numeric(14,2) GENERATED ALWAYS AS (round(monto_sin_iva * (1 + iva_pct), 2)) STORED,
  pagador_id               uuid          REFERENCES public.pagadores(id) ON DELETE SET NULL,
  fecha_solicitud          date          NOT NULL DEFAULT current_date,
  fecha_pago               date,
  status                   text          NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagada')),
  caratula_generada_url    text,
  caratula_firmada_url     text,
  comprobante_pago_url     text,
  caratula_enviada_at      timestamptz,
  destinatarios_email      text[],
  firmantes_seleccionados  uuid[],
  notas                    text,
  deleted_at               timestamptz,
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now(),
  -- if status='pagada' then fecha_pago is mandatory
  CONSTRAINT estimaciones_pagada_requires_fecha
    CHECK (status = 'pendiente' OR fecha_pago IS NOT NULL)
);

CREATE UNIQUE INDEX estimaciones_partida_numero_uidx
  ON public.estimaciones (partida_id, numero)
  WHERE deleted_at IS NULL;

CREATE INDEX estimaciones_partida_idx         ON public.estimaciones (partida_id);
CREATE INDEX estimaciones_status_idx          ON public.estimaciones (status)                  WHERE deleted_at IS NULL;
CREATE INDEX estimaciones_fecha_solicitud_idx ON public.estimaciones (fecha_solicitud DESC)    WHERE deleted_at IS NULL;
CREATE INDEX estimaciones_fecha_pago_idx      ON public.estimaciones (fecha_pago DESC)         WHERE deleted_at IS NULL AND fecha_pago IS NOT NULL;

CREATE TRIGGER estimaciones_set_updated_at
  BEFORE UPDATE ON public.estimaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER estimaciones_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.estimaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_change();

-- =========================================================================
-- Row Level Security
-- =========================================================================
-- All main tables: full CRUD for authenticated users (Alfonso + Jessica).
-- Soft-delete via deleted_at is application convention; the policy itself
-- does NOT restrict reads of deleted rows — the app must filter.
-- audit_log: SELECT only for authenticated; writes happen via trigger
-- (which runs as SECURITY DEFINER, bypassing RLS).
-- =========================================================================

ALTER TABLE public.projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firmantes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_firmantes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagadores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratistas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partidas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_full_projects
  ON public.projects FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_full_firmantes
  ON public.firmantes FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_full_project_firmantes
  ON public.project_firmantes FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_full_pagadores
  ON public.pagadores FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_full_contratistas
  ON public.contratistas FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_full_partidas
  ON public.partidas FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_full_estimaciones
  ON public.estimaciones FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_read_audit_log
  ON public.audit_log FOR SELECT
  TO authenticated USING (true);

-- =========================================================================
-- Storage buckets + RLS policies
-- =========================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('proyectos', 'proyectos', false),
  ('firmas',    'firmas',    false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_auth_full_proyectos
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'proyectos')
  WITH CHECK (bucket_id = 'proyectos');

CREATE POLICY storage_auth_full_firmas
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'firmas')
  WITH CHECK (bucket_id = 'firmas');

-- =========================================================================
-- Comments (helpful for psql \d+ and tooling)
-- =========================================================================

COMMENT ON TABLE  public.projects             IS 'A NAUKA project (Lote 3, Lote 44, Beachfront). One row per Excel file.';
COMMENT ON TABLE  public.firmantes            IS 'Global library of people who sign carátulas. Same person can sign across projects.';
COMMENT ON TABLE  public.project_firmantes    IS 'Junction: which firmantes appear on each project carátula + order (1-3) on the PDF.';
COMMENT ON TABLE  public.pagadores            IS 'Who executes the deposit (Salomon, Fasja, NAUKA, Otros). null project_id = global.';
COMMENT ON TABLE  public.contratistas         IS 'Contractor companies per project.';
COMMENT ON TABLE  public.partidas             IS 'Signed contract scope between IZ and a contratista. One per signed presupuesto.';
COMMENT ON TABLE  public.estimaciones         IS 'Payment request = one carátula. status: pendiente or pagada.';
COMMENT ON TABLE  public.audit_log            IS 'Auto-populated trigger log of all INSERT/UPDATE/DELETE on main tables.';

COMMENT ON COLUMN public.projects.caratula_iva_mode IS 'Whether carátula PDFs for this project display numbers as con_iva or sin_iva.';
COMMENT ON COLUMN public.projects.default_emails    IS 'Emails CCd by default when sending carátulas for this project (Alfonso, Jose, etc.).';
COMMENT ON COLUMN public.partidas.iva_pct           IS 'IVA percentage as decimal (0.16 = 16%).';
COMMENT ON COLUMN public.estimaciones.numero        IS 'Free-text label: "Anticipo", "Estimación 1", "Finiquito", etc. Unique per partida.';
COMMENT ON COLUMN public.estimaciones.status        IS 'pendiente = solicitada or autorizada but undeposited. pagada = deposit completed + comprobante uploaded.';
COMMENT ON COLUMN public.estimaciones.iva_pct       IS 'IVA snapshot at time of creation. Should match partidas.iva_pct unless project policy changes mid-flight.';
