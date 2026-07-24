-- Migration 0004: Project Handover, Warranty, Closure & Documents
-- Run after 0003_project_execution.sql
-- These tables use raw pg.Client (not in Drizzle schema); migration is the source of truth.

-- ── Sequences ────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS project_handover_id_seq;
CREATE SEQUENCE IF NOT EXISTS project_warranty_id_seq;
CREATE SEQUENCE IF NOT EXISTS project_closure_id_seq;
CREATE SEQUENCE IF NOT EXISTS project_documents_id_seq;

-- ── project_handover ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_handover (
  id                    INTEGER      NOT NULL DEFAULT nextval('project_handover_id_seq'),
  project_id            INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  handover_date         DATE,
  handover_type         TEXT         NOT NULL DEFAULT 'Provisional',
  prepared_by           INTEGER,
  client_representative TEXT,
  client_designation    TEXT,
  system_description    TEXT,
  installed_capacity_kwp NUMERIC,
  panel_count           INTEGER,
  inverter_count        INTEGER,
  warranty_start_date   DATE,
  warranty_end_date     DATE,
  amc_start_date        DATE,
  amc_end_date          DATE,
  documents_provided    JSONB        NOT NULL DEFAULT '[]',
  training_provided     BOOLEAN      NOT NULL DEFAULT false,
  training_notes        TEXT,
  pending_punch_items   JSONB        NOT NULL DEFAULT '[]',
  client_signed_at      TIMESTAMPTZ,
  client_signed_by      TEXT,
  internal_signed_at    TIMESTAMPTZ,
  status                TEXT         NOT NULL DEFAULT 'Draft',
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_project_handover_project_id ON project_handover(project_id);

-- ── project_warranty ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_warranty (
  id                    INTEGER      NOT NULL DEFAULT nextval('project_warranty_id_seq'),
  project_id            INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  handover_id           INTEGER      REFERENCES project_handover(id),
  component_type        TEXT         NOT NULL,
  manufacturer          TEXT,
  model                 TEXT,
  serial_numbers        JSONB        NOT NULL DEFAULT '[]',
  warranty_years        INTEGER,
  warranty_start_date   DATE,
  warranty_end_date     DATE,
  warranty_terms        TEXT,
  amc_contract_id       INTEGER,
  status                TEXT         NOT NULL DEFAULT 'Active',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_project_warranty_project_id ON project_warranty(project_id);
CREATE INDEX IF NOT EXISTS idx_project_warranty_end_date   ON project_warranty(warranty_end_date);

-- ── project_closure ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_closure (
  id                      INTEGER      NOT NULL DEFAULT nextval('project_closure_id_seq'),
  project_id              INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  closure_type            TEXT         NOT NULL DEFAULT 'Completed',
  initiated_by            INTEGER,
  initiated_at            TIMESTAMPTZ,
  final_cost              NUMERIC,
  final_revenue           NUMERIC,
  margin                  NUMERIC,
  lessons_learned         TEXT,
  customer_satisfaction   INTEGER,
  customer_feedback       TEXT,
  internal_review_notes   TEXT,
  outstanding_payments    NUMERIC,
  retention_amount        NUMERIC,
  retention_release_date  DATE,
  closure_checklist       JSONB        NOT NULL DEFAULT '{}',
  status                  TEXT         NOT NULL DEFAULT 'Draft',
  approved_by             INTEGER,
  approved_at             TIMESTAMPTZ,
  closed_at               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_project_closure_project_id ON project_closure(project_id);

-- ── project_documents ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_documents (
  id                    INTEGER      NOT NULL DEFAULT nextval('project_documents_id_seq'),
  project_id            INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_type         TEXT         NOT NULL DEFAULT 'Other',
  title                 TEXT         NOT NULL,
  version               TEXT         NOT NULL DEFAULT 'v1',
  file_url              TEXT         NOT NULL,
  file_size_bytes       INTEGER,
  mime_type             TEXT,
  uploaded_by           INTEGER,
  uploaded_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  phase                 TEXT,
  is_current_version    BOOLEAN      NOT NULL DEFAULT true,
  previous_version_id   INTEGER,
  tags                  JSONB        NOT NULL DEFAULT '[]',
  description           TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);
