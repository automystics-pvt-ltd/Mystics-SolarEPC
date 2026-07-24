/**
 * Project Lifecycle Routes — Phase Engine, Site Survey, BOQ, Change Requests, Risk Register
 * All queries use pg.Client (new tables not in Drizzle schema)
 */
import { Router, type IRouter } from "express";
import pg from "pg";

const router: IRouter = Router();

async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// ── PHASES ───────────────────────────────────────────────────────────────────

const PHASE_ORDER = [
  "SiteSurvey", "Planning", "BOQ", "Budgeting", "ResourceAllocation",
  "Procurement", "Installation", "QualityInspection", "TestingCommissioning",
  "Handover", "Warranty", "Closure",
];

router.get("/projects/:id/phases", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project id" }); return; }
  await withClient(async (c) => {
    // Ensure all 12 phase rows exist (idempotent)
    for (const phase of PHASE_ORDER) {
      await c.query(
        `INSERT INTO project_phases (project_id, phase, status) VALUES ($1, $2, 'NotStarted')
         ON CONFLICT (project_id, phase) DO NOTHING`,
        [projectId, phase]
      );
    }
    const { rows } = await c.query(
      `SELECT * FROM project_phases WHERE project_id = $1 ORDER BY array_position($2::text[], phase)`,
      [projectId, PHASE_ORDER]
    );
    res.json(rows.map(r => ({
      id: r.id, projectId: r.project_id, phase: r.phase, status: r.status,
      startedAt: r.started_at, completedAt: r.completed_at, completedBy: r.completed_by,
      notes: r.notes, createdAt: r.created_at,
    })));
  });
});

router.patch("/projects/:id/phases/:phase", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  const { phase } = req.params;
  if (!PHASE_ORDER.includes(phase)) { res.status(400).json({ error: "Invalid phase" }); return; }
  const { status, notes } = req.body;
  await withClient(async (c) => {
    const extras: Record<string, unknown> = { notes };
    if (status === "InProgress") extras.started_at = new Date();
    if (status === "Completed") { extras.completed_at = new Date(); extras.completed_by = (req as any).user?.id ?? null; }
    const sets = Object.entries(extras).filter(([, v]) => v !== undefined).map(([k], i) => `${k} = $${i + 3}`);
    const vals = Object.values(extras).filter(v => v !== undefined);
    const { rows } = await c.query(
      `UPDATE project_phases SET status = $1, ${sets.join(", ")} WHERE project_id = $2 AND phase = '${phase}' RETURNING *`,
      [status, projectId, ...vals]
    );
    if (!rows.length) { res.status(404).json({ error: "Phase not found" }); return; }
    const r = rows[0];
    res.json({ id: r.id, projectId: r.project_id, phase: r.phase, status: r.status, startedAt: r.started_at, completedAt: r.completed_at, notes: r.notes });
  });
});

// ── SITE SURVEYS ─────────────────────────────────────────────────────────────

router.get("/projects/:id/site-surveys", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT * FROM project_site_surveys WHERE project_id = $1 ORDER BY created_at DESC`, [projectId]
    );
    res.json(rows.map(fmtSurvey));
  });
});

router.post("/projects/:id/site-surveys", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  const b = req.body;
  await withClient(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO project_site_surveys
        (project_id, survey_date, surveyed_by, site_area_sqm, roof_type, roof_condition, structural_status,
         shading_analysis, grid_connection_type, grid_voltage, meter_location, access_road,
         latitude, longitude, proposed_capacity_kwp, panel_layout, inverter_location,
         cable_route, earthing_status, safety_hazards, attachment_urls, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING *`,
      [projectId, b.surveyDate || null, b.surveyedBy || null, b.siteAreaSqm || null,
       b.roofType || null, b.roofCondition || null, b.structuralStatus || null,
       b.shadingAnalysis || null, b.gridConnectionType || null, b.gridVoltage || null,
       b.meterLocation || null, b.accessRoad ?? true, b.latitude || null, b.longitude || null,
       b.proposedCapacityKwp || null, b.panelLayout || null, b.inverterLocation || null,
       b.cableRoute || null, b.earthingStatus || null, b.safetyHazards || null,
       JSON.stringify(b.attachmentUrls ?? []), b.status || "Draft", b.notes || null]
    );
    res.status(201).json(fmtSurvey(rows[0]));
  });
});

router.patch("/project-site-surveys/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const b = req.body;
  await withClient(async (c) => {
    const fields: string[] = [];
    const vals: unknown[] = [];
    const map: Record<string, string> = {
      surveyDate: "survey_date", surveyedBy: "surveyed_by", siteAreaSqm: "site_area_sqm",
      roofType: "roof_type", roofCondition: "roof_condition", structuralStatus: "structural_status",
      shadingAnalysis: "shading_analysis", gridConnectionType: "grid_connection_type",
      gridVoltage: "grid_voltage", meterLocation: "meter_location", accessRoad: "access_road",
      latitude: "latitude", longitude: "longitude", proposedCapacityKwp: "proposed_capacity_kwp",
      panelLayout: "panel_layout", inverterLocation: "inverter_location", cableRoute: "cable_route",
      earthingStatus: "earthing_status", safetyHazards: "safety_hazards",
      attachmentUrls: "attachment_urls", status: "status", notes: "notes",
      approvedBy: "approved_by", approvedAt: "approved_at",
    };
    for (const [jsKey, dbCol] of Object.entries(map)) {
      if (b[jsKey] !== undefined) {
        vals.push(jsKey === "attachmentUrls" ? JSON.stringify(b[jsKey]) : b[jsKey]);
        fields.push(`${dbCol} = $${vals.length}`);
      }
    }
    if (!fields.length) { res.status(400).json({ error: "Nothing to update" }); return; }
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE project_site_surveys SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!rows.length) { res.status(404).json({ error: "Survey not found" }); return; }
    res.json(fmtSurvey(rows[0]));
  });
});

function fmtSurvey(r: any) {
  return {
    id: r.id, projectId: r.project_id, surveyDate: r.survey_date, surveyedBy: r.surveyed_by,
    siteAreaSqm: r.site_area_sqm ? Number(r.site_area_sqm) : null,
    roofType: r.roof_type, roofCondition: r.roof_condition, structuralStatus: r.structural_status,
    shadingAnalysis: r.shading_analysis, gridConnectionType: r.grid_connection_type,
    gridVoltage: r.grid_voltage, meterLocation: r.meter_location, accessRoad: r.access_road,
    latitude: r.latitude ? Number(r.latitude) : null, longitude: r.longitude ? Number(r.longitude) : null,
    proposedCapacityKwp: r.proposed_capacity_kwp ? Number(r.proposed_capacity_kwp) : null,
    panelLayout: r.panel_layout, inverterLocation: r.inverter_location, cableRoute: r.cable_route,
    earthingStatus: r.earthing_status, safetyHazards: r.safety_hazards,
    attachmentUrls: r.attachment_urls ?? [], status: r.status,
    approvedBy: r.approved_by, approvedAt: r.approved_at, notes: r.notes,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ── BOQ ───────────────────────────────────────────────────────────────────────

router.get("/projects/:id/boq", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT * FROM project_boq_items WHERE project_id = $1 ORDER BY id`, [projectId]
    );
    res.json(rows.map(fmtBOQ));
  });
});

router.post("/projects/:id/boq", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  const b = req.body;
  await withClient(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO project_boq_items
        (project_id, activity_id, item_code, description, category, unit, quantity, unit_rate, sourced_from, material_id, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [projectId, b.activityId || null, b.itemCode || null, b.description,
       b.category || "Material", b.unit || null, b.quantity || 0, b.unitRate || 0,
       b.sourcedFrom || "Procurement", b.materialId || null,
       b.status || "Draft", b.notes || null]
    );
    res.status(201).json(fmtBOQ(rows[0]));
  });
});

router.patch("/boq-items/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const b = req.body;
  await withClient(async (c) => {
    const fields: string[] = [];
    const vals: unknown[] = [];
    const map: Record<string, string> = {
      itemCode: "item_code", description: "description", category: "category",
      unit: "unit", quantity: "quantity", unitRate: "unit_rate",
      sourcedFrom: "sourced_from", materialId: "material_id",
      allocatedQty: "allocated_qty", consumedQty: "consumed_qty",
      status: "status", notes: "notes", activityId: "activity_id",
    };
    for (const [jsKey, dbCol] of Object.entries(map)) {
      if (b[jsKey] !== undefined) {
        vals.push(b[jsKey]);
        fields.push(`${dbCol} = $${vals.length}`);
      }
    }
    if (!fields.length) { res.status(400).json({ error: "Nothing to update" }); return; }
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE project_boq_items SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!rows.length) { res.status(404).json({ error: "BOQ item not found" }); return; }
    res.json(fmtBOQ(rows[0]));
  });
});

router.delete("/boq-items/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rowCount } = await c.query(`DELETE FROM project_boq_items WHERE id = $1`, [id]);
    if (!rowCount) { res.status(404).json({ error: "BOQ item not found" }); return; }
    res.json({ success: true });
  });
});

router.post("/projects/:id/boq/import-from-quotation", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    // Get project's clientPoId → find quotation line items
    const { rows: proj } = await c.query(`SELECT client_po_id FROM projects WHERE id = $1`, [projectId]);
    if (!proj.length || !proj[0].client_po_id) {
      res.status(400).json({ error: "Project has no linked client PO / quotation" }); return;
    }
    const clientPoId = proj[0].client_po_id;
    // Resolve: client_pos.quotation_id → quotations.boq_items (JSON array)
    const { rows: qRows } = await c.query(
      `SELECT q.boq_items
       FROM client_pos cp
       JOIN quotations q ON q.id = cp.quotation_id
       WHERE cp.id = $1`,
      [clientPoId]
    );
    if (!qRows.length || !qRows[0].boq_items) {
      res.status(404).json({ error: "No quotation line items found for this project's client PO" }); return;
    }
    const rawItems: any[] = Array.isArray(qRows[0].boq_items) ? qRows[0].boq_items : JSON.parse(qRows[0].boq_items);
    if (!rawItems.length) {
      res.status(404).json({ error: "Quotation has no BOQ line items to import" }); return;
    }
    const inserted: any[] = [];
    let seq = 1;
    for (const item of rawItems) {
      const itemCode = `IMP-${String(seq++).padStart(3, "0")}`;
      const { rows } = await c.query(
        `INSERT INTO project_boq_items (project_id, item_code, description, quantity, unit_rate, unit, category, sourced_from, status)
         VALUES ($1,$2,$3,$4,$5,$6,'Material','Procurement','Draft') RETURNING *`,
        [projectId, itemCode, item.description || "Imported Item",
         Number(item.qty ?? item.quantity) || 1,
         Number(item.unitPrice ?? item.unit_price) || 0,
         item.unit || "Unit"]
      );
      inserted.push(fmtBOQ(rows[0]));
    }
    res.status(201).json({ imported: inserted.length, items: inserted });
  });
});

function fmtBOQ(r: any) {
  return {
    id: r.id, projectId: r.project_id, activityId: r.activity_id,
    itemCode: r.item_code, description: r.description, category: r.category,
    unit: r.unit, quantity: Number(r.quantity), unitRate: Number(r.unit_rate),
    totalAmount: Number(r.total_amount ?? 0),
    sourcedFrom: r.sourced_from, materialId: r.material_id,
    allocatedQty: Number(r.allocated_qty), consumedQty: Number(r.consumed_qty),
    status: r.status, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ── CHANGE REQUESTS ───────────────────────────────────────────────────────────

router.get("/projects/:id/change-requests", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT cr.*, u.name as requester_name, rv.name as reviewer_name
       FROM change_requests cr
       LEFT JOIN users u ON u.id = cr.requested_by
       LEFT JOIN users rv ON rv.id = cr.reviewed_by
       WHERE cr.project_id = $1 ORDER BY cr.created_at DESC`,
      [projectId]
    );
    res.json(rows.map(fmtCR));
  });
});

router.post("/projects/:id/change-requests", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  const b = req.body;
  await withClient(async (c) => {
    // Generate CR number: CR-{projectId}-{seq}
    const { rows: seq } = await c.query(
      `SELECT COUNT(*) as cnt FROM change_requests WHERE project_id = $1`, [projectId]
    );
    const crNumber = `CR-${projectId}-${String(Number(seq[0].cnt) + 1).padStart(3, "0")}`;
    const { rows } = await c.query(
      `INSERT INTO change_requests
        (project_id, cr_number, title, description, type, impact, requested_by, budget_impact, timeline_impact_days, status, attachment_urls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Draft',$10) RETURNING *`,
      [projectId, crNumber, b.title, b.description || null, b.type || "Scope",
       b.impact || "Low", b.requestedBy || null, b.budgetImpact || 0,
       b.timelineImpactDays || 0, JSON.stringify(b.attachmentUrls ?? [])]
    );
    res.status(201).json(fmtCR(rows[0]));
  });
});

router.patch("/change-requests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const b = req.body;
  await withClient(async (c) => {
    const fields: string[] = [];
    const vals: unknown[] = [];
    const map: Record<string, string> = {
      title: "title", description: "description", type: "type", impact: "impact",
      budgetImpact: "budget_impact", timelineImpactDays: "timeline_impact_days",
      status: "status", reviewedBy: "reviewed_by", reviewNotes: "review_notes",
    };
    for (const [jsKey, dbCol] of Object.entries(map)) {
      if (b[jsKey] !== undefined) {
        vals.push(b[jsKey]);
        fields.push(`${dbCol} = $${vals.length}`);
      }
    }
    if (b.status === "Approved" || b.status === "Rejected") {
      vals.push(new Date());
      fields.push(`reviewed_at = $${vals.length}`);
    }
    if (!fields.length) { res.status(400).json({ error: "Nothing to update" }); return; }
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE change_requests SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!rows.length) { res.status(404).json({ error: "CR not found" }); return; }
    res.json(fmtCR(rows[0]));
  });
});

function fmtCR(r: any) {
  return {
    id: r.id, projectId: r.project_id, crNumber: r.cr_number,
    title: r.title, description: r.description, type: r.type, impact: r.impact,
    requestedBy: r.requested_by, requesterName: r.requester_name ?? null,
    requestedAt: r.requested_at, budgetImpact: Number(r.budget_impact ?? 0),
    timelineImpactDays: r.timeline_impact_days ?? 0, status: r.status,
    reviewedBy: r.reviewed_by, reviewerName: r.reviewer_name ?? null,
    reviewedAt: r.reviewed_at, reviewNotes: r.review_notes,
    attachmentUrls: r.attachment_urls ?? [], createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ── RISK REGISTER ─────────────────────────────────────────────────────────────

const PROB_SCORE: Record<string, number> = { Low: 1, Medium: 2, High: 3 };
const IMPACT_SCORE: Record<string, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };

router.get("/projects/:id/risks", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT * FROM project_risk_register WHERE project_id = $1 ORDER BY risk_score DESC, created_at DESC`,
      [projectId]
    );
    res.json(rows.map(fmtRisk));
  });
});

router.post("/projects/:id/risks", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  const b = req.body;
  const riskScore = (PROB_SCORE[b.probability] ?? 1) * (IMPACT_SCORE[b.impact] ?? 1);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO project_risk_register
        (project_id, title, category, probability, impact, risk_score, mitigation_plan, owner, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Open') RETURNING *`,
      [projectId, b.title, b.category || "Technical", b.probability || "Low",
       b.impact || "Low", riskScore, b.mitigationPlan || null, b.owner || null]
    );
    res.status(201).json(fmtRisk(rows[0]));
  });
});

router.patch("/risks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const b = req.body;
  await withClient(async (c) => {
    const fields: string[] = [];
    const vals: unknown[] = [];
    const map: Record<string, string> = {
      title: "title", category: "category", probability: "probability",
      impact: "impact", mitigationPlan: "mitigation_plan", owner: "owner", status: "status",
    };
    for (const [jsKey, dbCol] of Object.entries(map)) {
      if (b[jsKey] !== undefined) {
        vals.push(b[jsKey]);
        fields.push(`${dbCol} = $${vals.length}`);
      }
    }
    // Recompute risk score if probability or impact changed
    const prob = b.probability;
    const imp = b.impact;
    if (prob || imp) {
      // Need current values if only one changed
      const { rows: curr } = await c.query(`SELECT probability, impact FROM project_risk_register WHERE id = $1`, [id]);
      if (curr.length) {
        const p = prob ?? curr[0].probability;
        const i = imp ?? curr[0].impact;
        const score = (PROB_SCORE[p] ?? 1) * (IMPACT_SCORE[i] ?? 1);
        vals.push(score);
        fields.push(`risk_score = $${vals.length}`);
      }
    }
    if (!fields.length) { res.status(400).json({ error: "Nothing to update" }); return; }
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE project_risk_register SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!rows.length) { res.status(404).json({ error: "Risk not found" }); return; }
    res.json(fmtRisk(rows[0]));
  });
});

function fmtRisk(r: any) {
  return {
    id: r.id, projectId: r.project_id, title: r.title, category: r.category,
    probability: r.probability, impact: r.impact, riskScore: r.risk_score,
    mitigationPlan: r.mitigation_plan, owner: r.owner, status: r.status,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export default router;
