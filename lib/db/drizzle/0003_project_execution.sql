-- Migration: Project Execution Layer
-- Tables: project_milestones, resource_allocations, inspection_checklists,
--         project_inspections, testing_commissioning

-- ── 1. project_milestones ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_milestones (
  id                SERIAL PRIMARY KEY,
  project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase             VARCHAR(50),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  milestone_type    VARCHAR(20) NOT NULL DEFAULT 'Manual'
    CHECK (milestone_type IN ('Auto','Manual')),
  baseline_date     DATE,
  forecast_date     DATE,
  actual_date       DATE,
  weight_pct        NUMERIC(5,2) NOT NULL DEFAULT 0,
  dependencies      JSONB NOT NULL DEFAULT '[]',
  is_critical_path  BOOLEAN NOT NULL DEFAULT FALSE,
  completion_pct    INTEGER NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  status            VARCHAR(20) NOT NULL DEFAULT 'NotStarted'
    CHECK (status IN ('NotStarted','InProgress','AtRisk','Delayed','Completed','Blocked')),
  blocker_reason    TEXT,
  approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status   VARCHAR(20),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones(project_id);

-- ── 2. resource_allocations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resource_allocations (
  id                 SERIAL PRIMARY KEY,
  project_id         INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id        INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  resource_type      VARCHAR(20) NOT NULL DEFAULT 'Employee'
    CHECK (resource_type IN ('Employee','Contractor','Equipment','Vehicle')),
  resource_id        INTEGER,
  resource_name      VARCHAR(255) NOT NULL,
  role               VARCHAR(100),
  allocation_pct     INTEGER NOT NULL DEFAULT 100 CHECK (allocation_pct BETWEEN 1 AND 100),
  planned_start_date DATE,
  planned_end_date   DATE,
  actual_start_date  DATE,
  actual_end_date    DATE,
  hourly_rate        NUMERIC(10,2),
  total_hours        NUMERIC(10,2),
  status             VARCHAR(20) NOT NULL DEFAULT 'Planned'
    CHECK (status IN ('Planned','Active','Completed','Released')),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_project_id ON resource_allocations(project_id);

-- ── 3. inspection_checklists ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection_checklists (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  inspection_type VARCHAR(50) NOT NULL
    CHECK (inspection_type IN ('PreInstallation','CivilWork','ModuleMounting','DCWiring',
                               'ACWiring','Earthing','InverterInstallation','Commissioning','FinalHandover')),
  items           JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. project_inspections ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_inspections (
  id                     SERIAL PRIMARY KEY,
  project_id             INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id            INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  checklist_id           INTEGER REFERENCES inspection_checklists(id),
  inspection_type        VARCHAR(50),
  scheduled_date         DATE,
  conducted_date         DATE,
  inspected_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status                 VARCHAR(30) NOT NULL DEFAULT 'Scheduled'
    CHECK (status IN ('Scheduled','InProgress','Passed','PassedWithObservations','Failed','Cancelled')),
  overall_result         VARCHAR(20),
  results                JSONB NOT NULL DEFAULT '[]',
  observations           TEXT,
  failure_reasons        TEXT,
  re_inspection_required BOOLEAN NOT NULL DEFAULT FALSE,
  re_inspection_date     DATE,
  attachment_urls        JSONB NOT NULL DEFAULT '[]',
  approved_by            INTEGER,
  approved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_inspections_project_id ON project_inspections(project_id);

-- ── 5. testing_commissioning ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS testing_commissioning (
  id                          SERIAL PRIMARY KEY,
  project_id                  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tc_number                   VARCHAR(30) UNIQUE,
  test_date                   DATE,
  conducted_by                INTEGER REFERENCES users(id) ON DELETE SET NULL,
  witnessed_by                VARCHAR(255),
  test_type                   VARCHAR(30) NOT NULL DEFAULT 'FullCommissioning'
    CHECK (test_type IN ('IVCurveTest','InsulationResistance','EarthContinuity',
                         'StringTest','GridSyncTest','Performance','FullCommissioning')),
  system_capacity_kwp         NUMERIC(10,3),
  measured_output_kw          NUMERIC(10,3),
  performance_ratio           NUMERIC(8,4),
  grid_voltage_v              NUMERIC(8,2),
  grid_frequency_hz           NUMERIC(6,3),
  insulation_resistance_mohm  NUMERIC(10,3),
  earth_continuity_ohm        NUMERIC(10,4),
  test_results                JSONB NOT NULL DEFAULT '{}',
  status                      VARCHAR(20) NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Submitted','Passed','Failed','ConditionalPass')),
  remarks                     TEXT,
  snag_item_ids               JSONB NOT NULL DEFAULT '[]',
  attachment_urls             JSONB NOT NULL DEFAULT '[]',
  approved_by                 INTEGER,
  approved_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_testing_commissioning_project_id ON testing_commissioning(project_id);

-- ── Seed standard inspection checklists ──────────────────────────────────────
INSERT INTO inspection_checklists (name, inspection_type, items) VALUES
('Module Mounting Inspection','ModuleMounting','[{"id":"mm1","section":"Structural","description":"Mounting structure is level and properly aligned","passCriteria":"Level within ±2mm over 1m","isRequired":true},{"id":"mm2","section":"Structural","description":"All bolts and fasteners are torqued to specification","passCriteria":"Per manufacturer torque spec","isRequired":true},{"id":"mm3","section":"Structural","description":"Module frames are undamaged (no cracks or dents)","passCriteria":"Visual inspection — no damage","isRequired":true},{"id":"mm4","section":"Structural","description":"Tilt angle matches design drawings","passCriteria":"Within ±1° of design angle","isRequired":true},{"id":"mm5","section":"Safety","description":"Anti-bird and anti-theft measures installed","passCriteria":"Mesh and locks present","isRequired":false}]'),
('DC Wiring Inspection','DCWiring','[{"id":"dc1","section":"Wiring","description":"All DC cables are correctly sized per design","passCriteria":"Per approved cable schedule","isRequired":true},{"id":"dc2","section":"Wiring","description":"Cable routing follows approved drawings","passCriteria":"As per DC layout drawing","isRequired":true},{"id":"dc3","section":"Protection","description":"All DC cables are protected in conduit/trunking","passCriteria":"Continuous protection throughout","isRequired":true},{"id":"dc4","section":"Protection","description":"String fuses/breakers installed and labelled","passCriteria":"Correct rating, clearly labelled","isRequired":true},{"id":"dc5","section":"Wiring","description":"Polarity of all strings verified before connection","passCriteria":"Positive/negative confirmed with multimeter","isRequired":true},{"id":"dc6","section":"Wiring","description":"MC4 connectors properly crimped and mated","passCriteria":"Click-locked, no exposed conductors","isRequired":true}]'),
('AC Wiring Inspection','ACWiring','[{"id":"ac1","section":"Wiring","description":"AC cable sizing is per approved load calculations","passCriteria":"Per approved cable schedule","isRequired":true},{"id":"ac2","section":"Protection","description":"RCBO/MCB of correct rating installed at AC output","passCriteria":"Per protection coordination study","isRequired":true},{"id":"ac3","section":"Metering","description":"Generation meter installed and wired correctly","passCriteria":"Meter reads forward direction","isRequired":true},{"id":"ac4","section":"Protection","description":"Anti-islanding protection configured","passCriteria":"Test trip confirmed","isRequired":true},{"id":"ac5","section":"Wiring","description":"All AC terminations are tight and properly sleeved","passCriteria":"Visual + tug test","isRequired":true}]'),
('Earthing & Bonding Inspection','Earthing','[{"id":"e1","section":"Earthing","description":"Earth electrode installed per design","passCriteria":"Depth and type per drawing","isRequired":true},{"id":"e2","section":"Earthing","description":"Earth resistance measured ≤ 5 Ω","passCriteria":"<= 5 Ohm by fall-of-potential method","isRequired":true},{"id":"e3","section":"Bonding","description":"All module frames bonded to earth bus","passCriteria":"Continuity < 0.5 Ω each frame","isRequired":true},{"id":"e4","section":"Bonding","description":"Inverter chassis bonded to main earth","passCriteria":"Continuity < 0.1 Ω","isRequired":true},{"id":"e5","section":"Protection","description":"Lightning protection system installed if required","passCriteria":"As per risk assessment","isRequired":false}]'),
('Full Commissioning Inspection','Commissioning','[{"id":"c1","section":"Pre-energisation","description":"All DC string voltages within acceptable range","passCriteria":"Within ±5% of design VOC","isRequired":true},{"id":"c2","section":"Pre-energisation","description":"Insulation resistance of all strings > 1 MΩ","passCriteria":"> 1 MOhm at 1000V DC","isRequired":true},{"id":"c3","section":"Inverter","description":"Inverter firmware updated to latest version","passCriteria":"As per manufacturer recommendation","isRequired":true},{"id":"c4","section":"Grid","description":"Grid voltage and frequency within inverter tolerance","passCriteria":"230V ±10%, 50 Hz ±2%","isRequired":true},{"id":"c5","section":"Performance","description":"System generates expected output at time of test","passCriteria":"PR > 70% at irradiance > 500 W/m²","isRequired":true},{"id":"c6","section":"Monitoring","description":"Monitoring system communicating and logging data","passCriteria":"Data visible in portal","isRequired":true},{"id":"c7","section":"Safety","description":"All safety labels and documentation in place","passCriteria":"Per IEC 62548 labelling requirements","isRequired":true}]')
ON CONFLICT DO NOTHING;
