/**
 * proj_execution.ts
 * Milestone Tracker, Resource Allocations, Quality Inspections,
 * Testing & Commissioning — all on new tables not in Drizzle schema.
 */
import { Router, type IRouter } from "express";
import { requireAuth, requirePermission } from "../lib/rbac";
import pg from "pg";

const router: IRouter = Router();
router.use(requireAuth());

async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// ── MILESTONES ────────────────────────────────────────────────────────────────

function fmtMilestone(r: any) {
  return {
    id: r.id, projectId: r.project_id, phase: r.phase, name: r.name,
    description: r.description, milestoneType: r.milestone_type,
    baselineDate: r.baseline_date, forecastDate: r.forecast_date, actualDate: r.actual_date,
    weightPct: Number(r.weight_pct ?? 0), dependencies: r.dependencies ?? [],
    isCriticalPath: r.is_critical_path, completionPct: r.completion_pct,
    status: r.status, blockerReason: r.blocker_reason,
    approvalRequired: r.approval_required, approvalStatus: r.approval_status,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

router.get("/projects/:id/milestones", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY baseline_date NULLS LAST, id`, [projectId]
    );
    res.json(rows.map(fmtMilestone));
  });
});

router.post("/projects/:id/milestones", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id as string, 10);
  await withClient(async (c) => {
    const b = req.body;
    const { rows } = await c.query(
      `INSERT INTO project_milestones
       (project_id, phase, name, description, milestone_type, baseline_date, forecast_date,
        weight_pct, dependencies, is_critical_path, completion_pct, status, approval_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)
       RETURNING *`,
      [projectId, b.phase ?? null, b.name, b.description ?? null,
       b.milestoneType ?? "Manual", b.baselineDate ?? null, b.forecastDate ?? null,
       b.weightPct ?? 0, JSON.stringify(b.dependencies ?? []),
       b.isCriticalPath ?? false, b.completionPct ?? 0,
       b.status ?? "NotStarted", b.approvalRequired ?? false]
    );
    res.status(201).json(fmtMilestone(rows[0]));
  });
});

router.patch("/project-milestones/:id", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await withClient(async (c) => {
    const map: Record<string, string> = {
      phase: "phase", name: "name", description: "description",
      milestoneType: "milestone_type", baselineDate: "baseline_date",
      forecastDate: "forecast_date", actualDate: "actual_date",
      weightPct: "weight_pct", dependencies: "dependencies",
      isCriticalPath: "is_critical_path", completionPct: "completion_pct",
      status: "status", blockerReason: "blocker_reason",
      approvalRequired: "approval_required", approvalStatus: "approval_status",
    };
    const fields: string[] = [];
    const vals: any[] = [];
    for (const [k, col] of Object.entries(map)) {
      if (req.body[k] !== undefined) {
        vals.push(k === "dependencies" ? JSON.stringify(req.body[k]) : req.body[k]);
        fields.push(`${col} = $${vals.length}`);
      }
    }
    if (!fields.length) { res.status(400).json({ error: "No fields" }); return; }
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE project_milestones SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmtMilestone(rows[0]));
  });
});

router.get("/projects/:id/milestones/critical-path", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT *, (SUM(weight_pct * completion_pct / 100.0) / NULLIF(SUM(weight_pct), 0)) AS weighted_completion
       FROM project_milestones WHERE project_id = $1 AND is_critical_path = TRUE
       GROUP BY id ORDER BY baseline_date NULLS LAST`, [projectId]
    );
    const allRows = await c.query(
      `SELECT COALESCE(SUM(weight_pct * completion_pct / 100.0) / NULLIF(SUM(weight_pct),0), 0) AS overall
       FROM project_milestones WHERE project_id = $1`, [projectId]
    );
    res.json({
      milestones: rows.map(fmtMilestone),
      overallCompletionPct: Math.round(Number(allRows.rows[0]?.overall ?? 0)),
    });
  });
});

// ── RESOURCE ALLOCATIONS ──────────────────────────────────────────────────────

function fmtResource(r: any) {
  return {
    id: r.id, projectId: r.project_id, activityId: r.activity_id,
    resourceType: r.resource_type, resourceId: r.resource_id,
    resourceName: r.resource_name, role: r.role,
    allocationPct: r.allocation_pct,
    plannedStartDate: r.planned_start_date, plannedEndDate: r.planned_end_date,
    actualStartDate: r.actual_start_date, actualEndDate: r.actual_end_date,
    hourlyRate: r.hourly_rate ? Number(r.hourly_rate) : null,
    totalHours: r.total_hours ? Number(r.total_hours) : null,
    status: r.status, notes: r.notes, createdAt: r.created_at,
  };
}

router.get("/projects/:id/resources", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT ra.*, a.name AS activity_name
       FROM resource_allocations ra
       LEFT JOIN activities a ON a.id = ra.activity_id
       WHERE ra.project_id = $1
       ORDER BY ra.planned_start_date NULLS LAST, ra.id`, [projectId]
    );
    res.json(rows.map((r: Record<string, any>) => ({ ...fmtResource(r), activityName: r.activity_name })));
  });
});

router.post("/projects/:id/resources", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id as string, 10);
  await withClient(async (c) => {
    const b = req.body;
    const { rows } = await c.query(
      `INSERT INTO resource_allocations
       (project_id, activity_id, resource_type, resource_id, resource_name, role,
        allocation_pct, planned_start_date, planned_end_date, hourly_rate, total_hours, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [projectId, b.activityId ?? null, b.resourceType ?? "Employee",
       b.resourceId ?? null, b.resourceName, b.role ?? null,
       b.allocationPct ?? 100, b.plannedStartDate ?? null, b.plannedEndDate ?? null,
       b.hourlyRate ?? null, b.totalHours ?? null, b.status ?? "Planned", b.notes ?? null]
    );
    res.status(201).json(fmtResource(rows[0]));
  });
});

router.patch("/resource-allocations/:id", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await withClient(async (c) => {
    const map: Record<string, string> = {
      activityId: "activity_id", resourceType: "resource_type", resourceId: "resource_id",
      resourceName: "resource_name", role: "role", allocationPct: "allocation_pct",
      plannedStartDate: "planned_start_date", plannedEndDate: "planned_end_date",
      actualStartDate: "actual_start_date", actualEndDate: "actual_end_date",
      hourlyRate: "hourly_rate", totalHours: "total_hours", status: "status", notes: "notes",
    };
    const fields: string[] = [];
    const vals: any[] = [];
    for (const [k, col] of Object.entries(map)) {
      if (req.body[k] !== undefined) { vals.push(req.body[k]); fields.push(`${col} = $${vals.length}`); }
    }
    if (!fields.length) { res.status(400).json({ error: "No fields" }); return; }
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE resource_allocations SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmtResource(rows[0]));
  });
});

router.delete("/resource-allocations/:id", requirePermission("projects", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await withClient(async (c) => {
    const { rowCount } = await c.query(`DELETE FROM resource_allocations WHERE id = $1`, [id]);
    if (!rowCount) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).send();
  });
});

// ── INSPECTION CHECKLISTS ─────────────────────────────────────────────────────

router.get("/inspection-checklists", async (req, res): Promise<void> => {
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT * FROM inspection_checklists WHERE is_active = TRUE ORDER BY inspection_type, name`
    );
    res.json(rows.map((r: Record<string, any>) => ({
      id: r.id, name: r.name, inspectionType: r.inspection_type,
      items: r.items, isActive: r.is_active, createdAt: r.created_at,
    })));
  });
});

// ── PROJECT INSPECTIONS ───────────────────────────────────────────────────────

function fmtInspection(r: any) {
  return {
    id: r.id, projectId: r.project_id, activityId: r.activity_id,
    checklistId: r.checklist_id, checklistName: r.checklist_name,
    inspectionType: r.inspection_type, scheduledDate: r.scheduled_date,
    conductedDate: r.conducted_date, inspectedBy: r.inspected_by,
    inspectedByName: r.inspected_by_name, status: r.status,
    overallResult: r.overall_result, results: r.results ?? [],
    observations: r.observations, failureReasons: r.failure_reasons,
    reInspectionRequired: r.re_inspection_required, reInspectionDate: r.re_inspection_date,
    attachmentUrls: r.attachment_urls ?? [], approvedBy: r.approved_by,
    approvedAt: r.approved_at, createdAt: r.created_at,
  };
}

router.get("/projects/:id/inspections", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT pi.*, ic.name AS checklist_name, u.name AS inspected_by_name
       FROM project_inspections pi
       LEFT JOIN inspection_checklists ic ON ic.id = pi.checklist_id
       LEFT JOIN users u ON u.id = pi.inspected_by
       WHERE pi.project_id = $1
       ORDER BY pi.scheduled_date DESC NULLS LAST, pi.id DESC`, [projectId]
    );
    res.json(rows.map(fmtInspection));
  });
});

router.post("/projects/:id/inspections", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id as string, 10);
  await withClient(async (c) => {
    const b = req.body;
    // Determine inspectionType from checklist if not provided
    let inspType = b.inspectionType ?? null;
    if (!inspType && b.checklistId) {
      const clRes = await c.query(`SELECT inspection_type FROM inspection_checklists WHERE id = $1`, [b.checklistId]);
      if (clRes.rows.length) inspType = clRes.rows[0].inspection_type;
    }
    const { rows } = await c.query(
      `INSERT INTO project_inspections
       (project_id, activity_id, checklist_id, inspection_type, scheduled_date,
        inspected_by, status, results, attachment_urls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb) RETURNING *`,
      [projectId, b.activityId ?? null, b.checklistId ?? null,
       inspType, b.scheduledDate ?? null, b.inspectedBy ?? null,
       b.status ?? "Scheduled", JSON.stringify(b.results ?? []),
       JSON.stringify(b.attachmentUrls ?? [])]
    );
    const full = await c.query(
      `SELECT pi.*, ic.name AS checklist_name, u.name AS inspected_by_name
       FROM project_inspections pi
       LEFT JOIN inspection_checklists ic ON ic.id = pi.checklist_id
       LEFT JOIN users u ON u.id = pi.inspected_by
       WHERE pi.id = $1`, [rows[0].id]
    );
    res.status(201).json(fmtInspection(full.rows[0]));
  });
});

router.patch("/project-inspections/:id", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await withClient(async (c) => {
    const b = req.body;
    // Auto-determine overallResult and status from results if submitting
    const results = b.results;
    let status = b.status;
    let overallResult = b.overallResult;

    if (results && Array.isArray(results) && (b.status === "InProgress" || !b.status)) {
      // Fetch checklist items so we know which are required
      let clItems: any[] = [];
      if (b.checklistId) {
        const clRes = await c.query(`SELECT items FROM inspection_checklists WHERE id = $1`, [b.checklistId]);
        clItems = clRes.rows[0]?.items ?? [];
      } else {
        // Fall back to current inspection's checklist_id
        const inspRes = await c.query(`SELECT checklist_id FROM project_inspections WHERE id = $1`, [id]);
        const cid = inspRes.rows[0]?.checklist_id;
        if (cid) {
          const clRes = await c.query(`SELECT items FROM inspection_checklists WHERE id = $1`, [cid]);
          clItems = clRes.rows[0]?.items ?? [];
        }
      }
      const requiredItemIds = new Set(clItems.filter((ci: any) => ci.isRequired).map((ci: any) => ci.id));

      // Reject if any required item is missing a result
      const answeredIds = new Set(results.map((r: any) => r.checklistItemId));
      const unansweredRequired = [...requiredItemIds].filter(rid => !answeredIds.has(rid));
      if (unansweredRequired.length > 0) {
        res.status(400).json({
          error: "All required checklist items must be answered before submitting",
          unansweredCount: unansweredRequired.length,
        });
        return;
      }

      const failedRequired = results.filter((r: any) => r.result === "Fail" && requiredItemIds.has(r.checklistItemId));
      const failedOptional = results.filter((r: any) => r.result === "Fail" && !requiredItemIds.has(r.checklistItemId));

      if (failedRequired.length > 0) {
        status = "Failed";
        overallResult = "Failed";
      } else if (failedOptional.length > 0) {
        status = "PassedWithObservations";
        overallResult = "PassedWithObservations";
      } else {
        status = "Passed";
        overallResult = "Passed";
      }
    }

    const map: Record<string, string> = {
      activityId: "activity_id", checklistId: "checklist_id", inspectionType: "inspection_type",
      scheduledDate: "scheduled_date", conductedDate: "conducted_date",
      inspectedBy: "inspected_by", status: "status", overallResult: "overall_result",
      results: "results", observations: "observations", failureReasons: "failure_reasons",
      reInspectionRequired: "re_inspection_required", reInspectionDate: "re_inspection_date",
      attachmentUrls: "attachment_urls", approvedBy: "approved_by", approvedAt: "approved_at",
    };
    const fields: string[] = [];
    const vals: any[] = [];

    const effectiveBody = { ...b, status, overallResult, results };
    for (const [k, col] of Object.entries(map)) {
      if (effectiveBody[k] !== undefined) {
        const v = (k === "results" || k === "attachmentUrls") ? JSON.stringify(effectiveBody[k]) : effectiveBody[k];
        vals.push(v);
        fields.push(`${col} = $${vals.length}`);
      }
    }
    if (!fields.length) { res.status(400).json({ error: "No fields" }); return; }
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE project_inspections SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }

    // Auto-create snags for failed required items
    if (status === "Failed" && results && Array.isArray(results)) {
      const insp = rows[0];
      let cl: any[] = [];
      if (insp.checklist_id) {
        const clRes = await c.query(`SELECT items FROM inspection_checklists WHERE id = $1`, [insp.checklist_id]);
        cl = clRes.rows[0]?.items ?? [];
      }
      // Only required-item failures produce snag entries
      const requiredClIds = new Set(cl.filter((ci: any) => ci.isRequired).map((ci: any) => ci.id));
      const failedRequiredItems = results.filter((r: any) => r.result === "Fail" && requiredClIds.has(r.checklistItemId));
      for (const fi of failedRequiredItems) {
        const clItem = cl.find((ci: any) => ci.id === fi.checklistItemId);
        const desc = clItem?.description ?? fi.checklistItemId ?? "Inspection failed item";
        await c.query(
          `INSERT INTO snag_logs (project_id, category, description, severity, status)
           VALUES ($1, 'Quality', $2, 'High', 'Open')`,
          [insp.project_id, `[Inspection #${id}] ${desc}${fi.remark ? ` — ${fi.remark}` : ""}`]
        );
      }
    }

    const full = await c.query(
      `SELECT pi.*, ic.name AS checklist_name, u.name AS inspected_by_name
       FROM project_inspections pi
       LEFT JOIN inspection_checklists ic ON ic.id = pi.checklist_id
       LEFT JOIN users u ON u.id = pi.inspected_by
       WHERE pi.id = $1`, [rows[0].id]
    );
    res.json(fmtInspection(full.rows[0]));
  });
});

// ── TESTING & COMMISSIONING ───────────────────────────────────────────────────

function fmtTC(r: any) {
  return {
    id: r.id, projectId: r.project_id, tcNumber: r.tc_number,
    testDate: r.test_date, conductedBy: r.conducted_by,
    conductedByName: r.conducted_by_name, witnessedBy: r.witnessed_by,
    testType: r.test_type,
    systemCapacityKwp: r.system_capacity_kwp ? Number(r.system_capacity_kwp) : null,
    measuredOutputKw: r.measured_output_kw ? Number(r.measured_output_kw) : null,
    performanceRatio: r.performance_ratio ? Number(r.performance_ratio) : null,
    gridVoltageV: r.grid_voltage_v ? Number(r.grid_voltage_v) : null,
    gridFrequencyHz: r.grid_frequency_hz ? Number(r.grid_frequency_hz) : null,
    insulationResistanceMohm: r.insulation_resistance_mohm ? Number(r.insulation_resistance_mohm) : null,
    earthContinuityOhm: r.earth_continuity_ohm ? Number(r.earth_continuity_ohm) : null,
    testResults: r.test_results ?? {}, status: r.status, remarks: r.remarks,
    snagItemIds: r.snag_item_ids ?? [], attachmentUrls: r.attachment_urls ?? [],
    approvedBy: r.approved_by, approvedAt: r.approved_at, createdAt: r.created_at,
  };
}

router.get("/projects/:id/testing-commissioning", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT tc.*, u.name AS conducted_by_name
       FROM testing_commissioning tc
       LEFT JOIN users u ON u.id = tc.conducted_by
       WHERE tc.project_id = $1
       ORDER BY tc.test_date DESC NULLS LAST, tc.id DESC`, [projectId]
    );
    res.json(rows.map(fmtTC));
  });
});

router.post("/projects/:id/testing-commissioning", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id as string, 10);
  await withClient(async (c) => {
    // Auto-generate tc_number
    const { rows: cnt } = await c.query(
      `SELECT COUNT(*) FROM testing_commissioning WHERE project_id = $1`, [projectId]
    );
    const seq = String(Number(cnt[0].count) + 1).padStart(3, "0");
    const tcNumber = `TC-${projectId}-${seq}`;
    const b = req.body;
    // Auto-compute PR if not provided
    let pr = b.performanceRatio ?? null;
    if (!pr && b.systemCapacityKwp && b.measuredOutputKw) {
      pr = Number(b.measuredOutputKw) / Number(b.systemCapacityKwp);
    }
    const { rows } = await c.query(
      `INSERT INTO testing_commissioning
       (project_id, tc_number, test_date, conducted_by, witnessed_by, test_type,
        system_capacity_kwp, measured_output_kw, performance_ratio,
        grid_voltage_v, grid_frequency_hz, insulation_resistance_mohm, earth_continuity_ohm,
        test_results, status, remarks, snag_item_ids, attachment_urls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17::jsonb,$18::jsonb)
       RETURNING *`,
      [projectId, tcNumber, b.testDate ?? null, b.conductedBy ?? null, b.witnessedBy ?? null,
       b.testType ?? "FullCommissioning",
       b.systemCapacityKwp ?? null, b.measuredOutputKw ?? null, pr,
       b.gridVoltageV ?? null, b.gridFrequencyHz ?? null,
       b.insulationResistanceMohm ?? null, b.earthContinuityOhm ?? null,
       JSON.stringify(b.testResults ?? {}), b.status ?? "Draft",
       b.remarks ?? null, JSON.stringify(b.snagItemIds ?? []),
       JSON.stringify(b.attachmentUrls ?? [])]
    );
    const full = await c.query(
      `SELECT tc.*, u.name AS conducted_by_name FROM testing_commissioning tc
       LEFT JOIN users u ON u.id = tc.conducted_by WHERE tc.id = $1`, [rows[0].id]
    );
    res.status(201).json(fmtTC(full.rows[0]));
  });
});

router.patch("/testing-commissioning/:id", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await withClient(async (c) => {
    const map: Record<string, string> = {
      testDate: "test_date", conductedBy: "conducted_by", witnessedBy: "witnessed_by",
      testType: "test_type", systemCapacityKwp: "system_capacity_kwp",
      measuredOutputKw: "measured_output_kw", performanceRatio: "performance_ratio",
      gridVoltageV: "grid_voltage_v", gridFrequencyHz: "grid_frequency_hz",
      insulationResistanceMohm: "insulation_resistance_mohm",
      earthContinuityOhm: "earth_continuity_ohm", testResults: "test_results",
      status: "status", remarks: "remarks", snagItemIds: "snag_item_ids",
      attachmentUrls: "attachment_urls", approvedBy: "approved_by", approvedAt: "approved_at",
    };
    const fields: string[] = [];
    const vals: any[] = [];
    for (const [k, col] of Object.entries(map)) {
      if (req.body[k] !== undefined) {
        const v = (k === "testResults" || k === "snagItemIds" || k === "attachmentUrls")
          ? JSON.stringify(req.body[k]) : req.body[k];
        vals.push(v);
        fields.push(`${col} = $${vals.length}`);
      }
    }
    if (!fields.length) { res.status(400).json({ error: "No fields" }); return; }
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE testing_commissioning SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    const full = await c.query(
      `SELECT tc.*, u.name AS conducted_by_name FROM testing_commissioning tc
       LEFT JOIN users u ON u.id = tc.conducted_by WHERE tc.id = $1`, [rows[0].id]
    );
    res.json(fmtTC(full.rows[0]));
  });
});

export default router;
