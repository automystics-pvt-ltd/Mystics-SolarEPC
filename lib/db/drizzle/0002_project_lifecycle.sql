-- Migration: Project Lifecycle Foundation
-- Tables: project_phases, project_site_surveys, project_boq_items,
--         change_requests, project_risk_register

-- ── 1. project_phases ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_phases (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase        VARCHAR(50) NOT NULL
    CHECK (phase IN ('SiteSurvey','Planning','BOQ','Budgeting','ResourceAllocation',
                     'Procurement','Installation','QualityInspection',
                     'TestingCommissioning','Handover','Warranty','Closure')),
  status       VARCHAR(20) NOT NULL DEFAULT 'NotStarted'
    CHECK (status IN ('NotStarted','InProgress','Completed','Blocked')),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by INTEGER,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, phase)
);

CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON project_phases(project_id);

-- Seed 12 phases for every existing project (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO project_phases (project_id, phase)
SELECT p.id, u.phase
FROM   projects p
CROSS JOIN UNNEST(ARRAY[
  'SiteSurvey','Planning','BOQ','Budgeting','ResourceAllocation',
  'Procurement','Installation','QualityInspection',
  'TestingCommissioning','Handover','Warranty','Closure'
]) AS u(phase)
ON CONFLICT (project_id, phase) DO NOTHING;

-- ── 2. project_site_surveys ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_site_surveys (
  id                    SERIAL PRIMARY KEY,
  project_id            INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  survey_date           DATE,
  surveyed_by           INTEGER,
  site_area_sqm         NUMERIC(10,2),
  roof_type             VARCHAR(50),
  roof_condition        VARCHAR(50),
  structural_status     VARCHAR(50),
  shading_analysis      TEXT,
  grid_connection_type  VARCHAR(50),
  grid_voltage          VARCHAR(20),
  meter_location        TEXT,
  access_road           BOOLEAN DEFAULT TRUE,
  latitude              NUMERIC(9,6),
  longitude             NUMERIC(9,6),
  proposed_capacity_kwp NUMERIC(10,3),
  panel_layout          TEXT,
  inverter_location     TEXT,
  cable_route           TEXT,
  earthing_status       TEXT,
  safety_hazards        TEXT,
  attachment_urls       JSONB NOT NULL DEFAULT '[]',
  status                VARCHAR(20) NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Submitted','Approved')),
  approved_by           INTEGER,
  approved_at           TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. project_boq_items ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_boq_items (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id   INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  item_code     VARCHAR(50),
  description   TEXT NOT NULL,
  category      VARCHAR(20) NOT NULL DEFAULT 'Material'
    CHECK (category IN ('Material','Labor','Equipment','Service')),
  unit          VARCHAR(20),
  quantity      NUMERIC(15,3) NOT NULL DEFAULT 0,
  unit_rate     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount  NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_rate) STORED,
  sourced_from  VARCHAR(20) NOT NULL DEFAULT 'Procurement'
    CHECK (sourced_from IN ('Inventory','Procurement','External')),
  material_id   INTEGER,
  allocated_qty NUMERIC(15,3) NOT NULL DEFAULT 0,
  consumed_qty  NUMERIC(15,3) NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Confirmed','PartiallyAllocated','FullyAllocated')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_boq_items_project_id ON project_boq_items(project_id);

-- ── 4. change_requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS change_requests (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cr_number       VARCHAR(30) UNIQUE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  type            VARCHAR(20) NOT NULL DEFAULT 'Scope'
    CHECK (type IN ('Scope','Budget','Timeline','Resource','Technical')),
  impact          VARCHAR(20) NOT NULL DEFAULT 'Low'
    CHECK (impact IN ('Low','Medium','High','Critical')),
  requested_by    INTEGER,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  budget_impact   NUMERIC(15,2) DEFAULT 0,
  timeline_impact_days INTEGER DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Submitted','UnderReview','Approved','Rejected','Withdrawn')),
  reviewed_by     INTEGER,
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  attachment_urls JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_requests_project_id ON change_requests(project_id);

-- ── 5. project_risk_register ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_risk_register (
  id               SERIAL PRIMARY KEY,
  project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title            VARCHAR(255) NOT NULL,
  category         VARCHAR(20) NOT NULL DEFAULT 'Technical'
    CHECK (category IN ('Technical','Financial','Regulatory','Weather','Supply','Resource','Safety')),
  probability      VARCHAR(10) NOT NULL DEFAULT 'Low'
    CHECK (probability IN ('Low','Medium','High')),
  impact           VARCHAR(10) NOT NULL DEFAULT 'Low'
    CHECK (impact IN ('Low','Medium','High','Critical')),
  risk_score       INTEGER NOT NULL DEFAULT 0,
  mitigation_plan  TEXT,
  owner            VARCHAR(100),
  status           VARCHAR(20) NOT NULL DEFAULT 'Open'
    CHECK (status IN ('Open','Mitigated','Accepted','Closed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_register_project_id ON project_risk_register(project_id);
