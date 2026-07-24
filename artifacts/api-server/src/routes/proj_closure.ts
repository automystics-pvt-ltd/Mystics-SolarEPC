/**
 * Project Handover, Warranty, Closure & Documents Routes
 * All queries use pg.Client (new tables not in Drizzle schema)
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

function fmtHandover(r: any) {
  return {
    id: r.id, projectId: r.project_id, handoverDate: r.handover_date,
    handoverType: r.handover_type, preparedBy: r.prepared_by,
    clientRepresentative: r.client_representative, clientDesignation: r.client_designation,
    systemDescription: r.system_description, installedCapacityKwp: r.installed_capacity_kwp ? Number(r.installed_capacity_kwp) : null,
    panelCount: r.panel_count, inverterCount: r.inverter_count,
    warrantyStartDate: r.warranty_start_date, warrantyEndDate: r.warranty_end_date,
    amcStartDate: r.amc_start_date, amcEndDate: r.amc_end_date,
    documentsProvided: r.documents_provided ?? [], trainingProvided: r.training_provided,
    trainingNotes: r.training_notes, pendingPunchItems: r.pending_punch_items ?? [],
    clientSignedAt: r.client_signed_at, clientSignedBy: r.client_signed_by,
    internalSignedAt: r.internal_signed_at, status: r.status,
    rejectionReason: r.rejection_reason,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function fmtWarranty(r: any) {
  return {
    id: r.id, projectId: r.project_id, handoverId: r.handover_id,
    componentType: r.component_type, manufacturer: r.manufacturer, model: r.model,
    serialNumbers: r.serial_numbers ?? [], warrantyYears: r.warranty_years,
    warrantyStartDate: r.warranty_start_date, warrantyEndDate: r.warranty_end_date,
    warrantyTerms: r.warranty_terms, amcContractId: r.amc_contract_id, status: r.status,
    createdAt: r.created_at,
  };
}

function fmtClosure(r: any) {
  return {
    id: r.id, projectId: r.project_id, closureType: r.closure_type,
    initiatedBy: r.initiated_by, initiatedAt: r.initiated_at,
    finalCost: r.final_cost ? Number(r.final_cost) : null,
    finalRevenue: r.final_revenue ? Number(r.final_revenue) : null,
    margin: r.margin ? Number(r.margin) : null,
    lessonsLearned: r.lessons_learned, customerSatisfaction: r.customer_satisfaction,
    customerFeedback: r.customer_feedback, internalReviewNotes: r.internal_review_notes,
    outstandingPayments: r.outstanding_payments ? Number(r.outstanding_payments) : null,
    retentionAmount: r.retention_amount ? Number(r.retention_amount) : null,
    retentionReleaseDate: r.retention_release_date,
    closureChecklist: r.closure_checklist ?? {}, status: r.status,
    approvedBy: r.approved_by, approvedAt: r.approved_at, closedAt: r.closed_at,
    createdAt: r.created_at,
  };
}

function fmtDoc(r: any) {
  return {
    id: r.id, projectId: r.project_id, documentType: r.document_type,
    title: r.title, version: r.version, fileUrl: r.file_url,
    fileSizeBytes: r.file_size_bytes, mimeType: r.mime_type,
    uploadedBy: r.uploaded_by, uploadedAt: r.uploaded_at,
    phase: r.phase, isCurrentVersion: r.is_current_version,
    previousVersionId: r.previous_version_id,
    tags: r.tags ?? [], description: r.description, createdAt: r.created_at,
  };
}

/* ══════════════════════════════════════════════════════════════
   HANDOVER
══════════════════════════════════════════════════════════════ */

router.get("/projects/:id/handover", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT * FROM project_handover WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    res.json(rows.length ? fmtHandover(rows[0]) : null);
  });
});

router.post("/projects/:id/handover", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id as string, 10);
  const b = req.body;
  await withClient(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO project_handover
         (project_id, handover_date, handover_type, prepared_by, client_representative,
          client_designation, system_description, installed_capacity_kwp, panel_count,
          inverter_count, warranty_start_date, warranty_end_date, amc_start_date, amc_end_date,
          documents_provided, training_provided, training_notes, pending_punch_items, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'Draft')
       RETURNING *`,
      [
        projectId, b.handoverDate || null, b.handoverType || "Provisional",
        b.preparedBy || null, b.clientRepresentative || null, b.clientDesignation || null,
        b.systemDescription || null, b.installedCapacityKwp || null,
        b.panelCount || null, b.inverterCount || null,
        b.warrantyStartDate || null, b.warrantyEndDate || null,
        b.amcStartDate || null, b.amcEndDate || null,
        JSON.stringify(b.documentsProvided ?? []),
        b.trainingProvided ?? false, b.trainingNotes || null,
        JSON.stringify(b.pendingPunchItems ?? []),
      ]
    );
    res.status(201).json(fmtHandover(rows[0]));
  });
});

router.patch("/handover/:id", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const b = req.body;
  await withClient(async (c) => {
    const fields: string[] = [];
    const vals: unknown[] = [];
    const map: Record<string, string> = {
      handoverDate: "handover_date", handoverType: "handover_type", preparedBy: "prepared_by",
      clientRepresentative: "client_representative", clientDesignation: "client_designation",
      systemDescription: "system_description", installedCapacityKwp: "installed_capacity_kwp",
      panelCount: "panel_count", inverterCount: "inverter_count",
      warrantyStartDate: "warranty_start_date", warrantyEndDate: "warranty_end_date",
      amcStartDate: "amc_start_date", amcEndDate: "amc_end_date",
      trainingProvided: "training_provided", trainingNotes: "training_notes",
      status: "status", rejectionReason: "rejection_reason",
    };
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { vals.push(b[k]); fields.push(`${col} = $${vals.length}`); }
    }
    if (b.documentsProvided !== undefined) { vals.push(JSON.stringify(b.documentsProvided)); fields.push(`documents_provided = $${vals.length}`); }
    if (b.pendingPunchItems !== undefined) { vals.push(JSON.stringify(b.pendingPunchItems)); fields.push(`pending_punch_items = $${vals.length}`); }
    if (!fields.length) { res.status(400).json({ error: "Nothing to update" }); return; }
    vals.push(new Date()); fields.push(`updated_at = $${vals.length}`);
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE project_handover SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (!rows.length) { res.status(404).json({ error: "Handover not found" }); return; }
    res.json(fmtHandover(rows[0]));
  });
});

router.post("/handover/:id/sign", requirePermission("projects", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { signedBy, type = "client" } = req.body; // type: client | internal
  await withClient(async (c) => {
    // Load the current handover record first
    const { rows: [existing] } = await c.query(
      `SELECT * FROM project_handover WHERE id = $1`, [id]
    );
    if (!existing) { res.status(404).json({ error: "Handover not found" }); return; }

    // Internal sign-off requires client sign-off to already be on record
    if (type === "internal" && !existing.client_signed_at) {
      res.status(422).json({
        error: "Client must sign before internal sign-off can be recorded",
      });
      return;
    }

    const now = new Date();
    let updateSql: string;
    if (type === "internal") {
      updateSql = `UPDATE project_handover
        SET internal_signed_at = $1, status = 'Signed', updated_at = $1
        WHERE id = $2 RETURNING *`;
    } else {
      updateSql = `UPDATE project_handover
        SET client_signed_at = $1, client_signed_by = $2, status = 'PendingClientSignoff', updated_at = $1
        WHERE id = $3 RETURNING *`;
    }
    const vals = type === "internal" ? [now, id] : [now, signedBy || "Client Representative", id];
    const { rows } = await c.query(updateSql, vals);
    if (!rows.length) { res.status(404).json({ error: "Handover not found" }); return; }

    // If fully signed, advance Handover phase to Completed
    if (rows[0].status === "Signed") {
      await c.query(
        `UPDATE project_phases SET status = 'Completed', completed_at = NOW()
         WHERE project_id = $1 AND phase = 'Handover'`,
        [rows[0].project_id]
      );
    }
    res.json(fmtHandover(rows[0]));
  });
});

/* ══════════════════════════════════════════════════════════════
   WARRANTY
══════════════════════════════════════════════════════════════ */

router.get("/projects/:id/warranty", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT * FROM project_warranty WHERE project_id = $1 ORDER BY component_type, created_at`,
      [projectId]
    );
    res.json(rows.map(fmtWarranty));
  });
});

router.get("/projects/:id/warranty/expiring", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    // Auto-update statuses
    await c.query(
      `UPDATE project_warranty
       SET status = CASE
         WHEN warranty_end_date < NOW()::date THEN 'Expired'
         WHEN warranty_end_date < (NOW() + INTERVAL '90 days')::date THEN 'Expiring'
         ELSE status
       END
       WHERE project_id = $1 AND status NOT IN ('Claimed')`,
      [projectId]
    );
    const { rows } = await c.query(
      `SELECT * FROM project_warranty
       WHERE project_id = $1 AND warranty_end_date < (NOW() + INTERVAL '90 days')::date
       ORDER BY warranty_end_date`,
      [projectId]
    );
    res.json(rows.map(fmtWarranty));
  });
});

router.post("/projects/:id/warranty", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id as string, 10);
  const b = req.body;
  await withClient(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO project_warranty
         (project_id, handover_id, component_type, manufacturer, model, serial_numbers,
          warranty_years, warranty_start_date, warranty_end_date, warranty_terms,
          amc_contract_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        projectId, b.handoverId || null, b.componentType || "Panels",
        b.manufacturer || null, b.model || null,
        JSON.stringify(b.serialNumbers ?? []),
        b.warrantyYears || null, b.warrantyStartDate || null, b.warrantyEndDate || null,
        b.warrantyTerms || null, b.amcContractId || null, b.status || "Active",
      ]
    );
    res.status(201).json(fmtWarranty(rows[0]));
  });
});

router.patch("/warranty/:id", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const b = req.body;
  await withClient(async (c) => {
    const fields: string[] = [];
    const vals: unknown[] = [];
    const map: Record<string, string> = {
      componentType: "component_type", manufacturer: "manufacturer", model: "model",
      warrantyYears: "warranty_years", warrantyStartDate: "warranty_start_date",
      warrantyEndDate: "warranty_end_date", warrantyTerms: "warranty_terms",
      amcContractId: "amc_contract_id", status: "status",
    };
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { vals.push(b[k]); fields.push(`${col} = $${vals.length}`); }
    }
    if (b.serialNumbers !== undefined) { vals.push(JSON.stringify(b.serialNumbers)); fields.push(`serial_numbers = $${vals.length}`); }
    if (!fields.length) { res.status(400).json({ error: "Nothing to update" }); return; }
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE project_warranty SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (!rows.length) { res.status(404).json({ error: "Warranty component not found" }); return; }
    res.json(fmtWarranty(rows[0]));
  });
});

/* ══════════════════════════════════════════════════════════════
   CLOSURE
══════════════════════════════════════════════════════════════ */

router.get("/projects/:id/closure/readiness", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const [milestones, snags, payments, handover] = await Promise.all([
      c.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'Completed') AS done
               FROM project_milestones WHERE project_id = $1`, [projectId]),
      c.query(`SELECT COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed')) AS open_snags
               FROM snag_logs WHERE project_id = $1`, [projectId]),
      c.query(`SELECT COUNT(*) FILTER (WHERE status NOT IN ('Paid','Invoiced')) AS unpaid
               FROM payment_milestones WHERE project_id = $1`, [projectId]),
      c.query(`SELECT status FROM project_handover WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`, [projectId]),
    ]);

    const totalMilestones = Number(milestones.rows[0]?.total ?? 0);
    const doneMilestones = Number(milestones.rows[0]?.done ?? 0);
    const allMilestonesComplete = totalMilestones > 0 && totalMilestones === doneMilestones;
    const allSnagsResolved = Number(snags.rows[0]?.open_snags ?? 0) === 0;
    const allPaymentsReceived = Number(payments.rows[0]?.unpaid ?? 0) === 0;
    const handoverSigned = handover.rows[0]?.status === "Signed";
    const documentsArchived = true; // informational — not blocking

    const checklist = {
      allMilestonesComplete,
      allSnagsResolved,
      allPaymentsReceived,
      handoverSigned,
      documentsArchived,
      teamReleased: false,
    };
    const allGreen = allMilestonesComplete && allSnagsResolved && allPaymentsReceived && handoverSigned;

    res.json({
      checklist,
      allGreen,
      summary: {
        totalMilestones, doneMilestones,
        openSnags: Number(snags.rows[0]?.open_snags ?? 0),
        unpaidMilestones: Number(payments.rows[0]?.unpaid ?? 0),
        handoverStatus: handover.rows[0]?.status ?? "None",
      },
    });
  });
});

router.get("/projects/:id/closure", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT * FROM project_closure WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    res.json(rows.length ? fmtClosure(rows[0]) : null);
  });
});

router.post("/projects/:id/closure", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id as string, 10);
  const b = req.body;
  await withClient(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO project_closure
         (project_id, closure_type, initiated_by, initiated_at, final_cost, final_revenue,
          margin, lessons_learned, customer_satisfaction, customer_feedback,
          internal_review_notes, outstanding_payments, retention_amount,
          retention_release_date, closure_checklist, status)
       VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Draft')
       RETURNING *`,
      [
        projectId, b.closureType || "Completed", b.initiatedBy || null,
        b.finalCost || null, b.finalRevenue || null, b.margin || null,
        b.lessonsLearned || null, b.customerSatisfaction || null,
        b.customerFeedback || null, b.internalReviewNotes || null,
        b.outstandingPayments || null, b.retentionAmount || null,
        b.retentionReleaseDate || null,
        JSON.stringify(b.closureChecklist ?? {}),
      ]
    );
    res.status(201).json(fmtClosure(rows[0]));
  });
});

router.patch("/closure/:id", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const b = req.body;
  await withClient(async (c) => {
    const fields: string[] = [];
    const vals: unknown[] = [];
    const map: Record<string, string> = {
      closureType: "closure_type", finalCost: "final_cost", finalRevenue: "final_revenue",
      margin: "margin", lessonsLearned: "lessons_learned",
      customerSatisfaction: "customer_satisfaction", customerFeedback: "customer_feedback",
      internalReviewNotes: "internal_review_notes", outstandingPayments: "outstanding_payments",
      retentionAmount: "retention_amount", retentionReleaseDate: "retention_release_date",
      status: "status",
    };
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { vals.push(b[k]); fields.push(`${col} = $${vals.length}`); }
    }
    if (b.closureChecklist !== undefined) { vals.push(JSON.stringify(b.closureChecklist)); fields.push(`closure_checklist = $${vals.length}`); }
    if (!fields.length) { res.status(400).json({ error: "Nothing to update" }); return; }
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE project_closure SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (!rows.length) { res.status(404).json({ error: "Closure record not found" }); return; }
    res.json(fmtClosure(rows[0]));
  });
});

router.post("/closure/:id/approve", requirePermission("projects", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { approvedBy } = req.body;
  await withClient(async (c) => {
    // ── 1. Load closure record ────────────────────────────────────────────────
    const { rows: [closureRow] } = await c.query(
      `SELECT * FROM project_closure WHERE id = $1`, [id]
    );
    if (!closureRow) { res.status(404).json({ error: "Closure not found" }); return; }
    if (closureRow.status === "Approved") {
      res.status(409).json({ error: "Closure is already approved" }); return;
    }

    const projectId = closureRow.project_id;

    // ── 2. Server-side readiness gate ─────────────────────────────────────────
    const [milestones, snags, payments, handover] = await Promise.all([
      c.query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'Completed') AS done
         FROM project_milestones WHERE project_id = $1`, [projectId]
      ),
      c.query(
        `SELECT COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed')) AS open_snags
         FROM snag_logs WHERE project_id = $1`, [projectId]
      ),
      c.query(
        `SELECT COUNT(*) FILTER (WHERE status NOT IN ('Paid','Invoiced')) AS unpaid
         FROM payment_milestones WHERE project_id = $1`, [projectId]
      ),
      c.query(
        `SELECT status FROM project_handover WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [projectId]
      ),
    ]);

    const totalMilestones = Number(milestones.rows[0]?.total ?? 0);
    const doneMilestones  = Number(milestones.rows[0]?.done  ?? 0);
    const openSnags       = Number(snags.rows[0]?.open_snags ?? 0);
    const unpaid          = Number(payments.rows[0]?.unpaid  ?? 0);
    const handoverSigned  = handover.rows[0]?.status === "Signed";

    const blockers: string[] = [];
    // Zero milestones is itself a blocker — project work cannot be verified as complete
    if (totalMilestones === 0)
      blockers.push("At least one project milestone must exist and be completed before closure");
    else if (doneMilestones < totalMilestones)
      blockers.push(`${totalMilestones - doneMilestones} of ${totalMilestones} milestone(s) not yet completed`);
    if (openSnags > 0)
      blockers.push(`${openSnags} open snag(s) must be resolved before closure`);
    if (unpaid > 0)
      blockers.push(`${unpaid} unpaid payment milestone(s) remain`);
    if (!handoverSigned)
      blockers.push("Handover must be signed before closure can be approved");

    if (blockers.length > 0) {
      res.status(422).json({
        error: "Closure readiness checks failed",
        blockers,
        readinessSnapshot: {
          allMilestonesComplete: totalMilestones > 0 && doneMilestones === totalMilestones,
          allSnagsResolved: openSnags === 0,
          allPaymentsReceived: unpaid === 0,
          handoverSigned,
        },
      });
      return;
    }

    // ── 3. All checks passed — commit in a transaction ────────────────────────
    await c.query("BEGIN");
    try {
      const { rows: [closure] } = await c.query(
        `UPDATE project_closure
         SET status = 'Approved', approved_by = $1, approved_at = NOW(), closed_at = NOW()
         WHERE id = $2 RETURNING *`,
        [approvedBy || null, id]
      );

      await c.query(`UPDATE projects SET status = 'Completed' WHERE id = $1`, [projectId]);
      await c.query(
        `UPDATE resource_allocations SET status = 'Released'
         WHERE project_id = $1 AND status IN ('Active','Planned')`, [projectId]
      );
      // Step 1: Capture Approved allocations (those that actually reserved stock) before releasing
      // Draft allocations never decremented stock so they must NOT trigger stock restoration
      const { rows: stockReservedAllocs } = await c.query(
        `UPDATE project_material_allocations
         SET status = 'Released'
         WHERE project_id = $1 AND status = 'Approved'
         RETURNING id, warehouse_id, material_id, material_name, allocated_qty`,
        [projectId]
      );
      // Step 2: Release Draft/Reserved allocations (no stock impact — never decremented available_qty)
      await c.query(
        `UPDATE project_material_allocations SET status = 'Released'
         WHERE project_id = $1 AND status IN ('Draft','Reserved')`, [projectId]
      );
      // Step 3: Restore stock only for previously-Approved allocations that had real stock reserved.
      // Join on material_id + warehouse_id (exact row identity) — avoids name-match ambiguity.
      // Allocations without material_id are skipped (they never decremented the stock ledger).
      for (const alloc of stockReservedAllocs) {
        const qty = Number(alloc.allocated_qty);
        if (!alloc.warehouse_id || !alloc.material_id || qty <= 0) continue;
        await c.query(
          `UPDATE material_stock_levels
           SET allocated_qty = GREATEST(0, allocated_qty - $1),
               available_qty  = available_qty + $1,
               updated_at     = NOW()
           WHERE material_id = $2 AND warehouse_id = $3`,
          [qty, alloc.material_id, alloc.warehouse_id]
        );
      }
      await c.query(
        `UPDATE project_phases SET status = 'Completed', completed_at = NOW()
         WHERE project_id = $1 AND phase = 'Closure'`, [projectId]
      );

      await c.query("COMMIT");
      res.json(fmtClosure(closure));
    } catch (err) {
      await c.query("ROLLBACK");
      throw err;
    }
  });
});

/* ══════════════════════════════════════════════════════════════
   DOCUMENTS
══════════════════════════════════════════════════════════════ */

router.get("/projects/:id/documents", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id, 10);
  const { phase, documentType } = req.query;
  await withClient(async (c) => {
    let sql = `SELECT * FROM project_documents WHERE project_id = $1`;
    const vals: unknown[] = [projectId];
    if (phase) { vals.push(phase); sql += ` AND phase = $${vals.length}`; }
    if (documentType) { vals.push(documentType); sql += ` AND document_type = $${vals.length}`; }
    sql += ` ORDER BY title, created_at DESC`;
    const { rows } = await c.query(sql, vals);
    res.json(rows.map(fmtDoc));
  });
});

router.post("/projects/:id/documents", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id as string, 10);
  const b = req.body;
  await withClient(async (c) => {
    // Mark previous version of same title as not current
    if (b.title) {
      const { rows: prev } = await c.query(
        `UPDATE project_documents SET is_current_version = FALSE
         WHERE project_id = $1 AND title = $2 AND is_current_version = TRUE
         RETURNING id`,
        [projectId, b.title]
      );
      const prevId = prev[0]?.id ?? null;

      const { rows } = await c.query(
        `INSERT INTO project_documents
           (project_id, document_type, title, version, file_url, file_size_bytes,
            mime_type, uploaded_by, phase, is_current_version, previous_version_id,
            tags, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10,$11,$12)
         RETURNING *`,
        [
          projectId, b.documentType || "Other", b.title,
          b.version || "v1", b.fileUrl, b.fileSizeBytes || null,
          b.mimeType || null, b.uploadedBy || null,
          b.phase || null, prevId,
          JSON.stringify(b.tags ?? []), b.description || null,
        ]
      );
      res.status(201).json(fmtDoc(rows[0]));
    } else {
      res.status(400).json({ error: "title is required" });
    }
  });
});

router.patch("/documents/:id", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const b = req.body;
  await withClient(async (c) => {
    const fields: string[] = [];
    const vals: unknown[] = [];
    const map: Record<string, string> = {
      title: "title", version: "version", phase: "phase",
      description: "description", documentType: "document_type",
    };
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { vals.push(b[k]); fields.push(`${col} = $${vals.length}`); }
    }
    if (b.tags !== undefined) { vals.push(JSON.stringify(b.tags)); fields.push(`tags = $${vals.length}`); }
    if (!fields.length) { res.status(400).json({ error: "Nothing to update" }); return; }
    vals.push(id);
    const { rows } = await c.query(
      `UPDATE project_documents SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (!rows.length) { res.status(404).json({ error: "Document not found" }); return; }
    res.json(fmtDoc(rows[0]));
  });
});

router.delete("/documents/:id", requirePermission("projects", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await withClient(async (c) => {
    const { rows } = await c.query(`DELETE FROM project_documents WHERE id = $1 RETURNING id`, [id]);
    if (!rows.length) { res.status(404).json({ error: "Document not found" }); return; }
    res.json({ ok: true });
  });
});

export default router;
