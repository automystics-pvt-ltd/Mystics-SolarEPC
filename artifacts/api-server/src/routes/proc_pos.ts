import { Router, type IRouter } from "express";
import pg from "pg";
import {
  db, procurementPOsTable, procPOItemsTable, procurementQuotationsTable, vendorsTable,
  procPOAuditLogsTable, procGRNsTable, procInvoicesTable,
  approvalRequestsTable, approvalRequestStepsTable, approvalActionsTable,
  approvalWorkflowsTable, approvalWorkflowStepsTable,
  notificationsTable, usersTable,
} from "@workspace/db";
import { poCommentsTable, poVersionsTable } from "@workspace/db";
import { eq, desc, inArray, sql, and } from "drizzle-orm";
import { requireAuth, requirePermission } from "../lib/rbac";
import jwt from "jsonwebtoken";

import { CATEGORY_DEFS, OTHER_CATEGORY } from "../lib/category-rules";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

function getActor(req: any): { userId: number; role: string; name?: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; }
  catch { return null; }
}

/* ── Approval counter ─────────────────────────────────────────────────────── */
let aprCounter = 1;
(async () => {
  const r = await db.select({ id: approvalRequestsTable.id }).from(approvalRequestsTable).orderBy(desc(approvalRequestsTable.id)).limit(1);
  if (r.length > 0) aprCounter = r[0]!.id + 1;
})();

/* ── SLA status helper ────────────────────────────────────────────────────── */
function computeSlaStatus(slaDeadline: Date | null | undefined): "OnTrack" | "DueSoon" | "Breached" | null {
  if (!slaDeadline) return null;
  const msLeft = slaDeadline.getTime() - Date.now();
  const hoursLeft = msLeft / 3_600_000;
  if (hoursLeft < 0) return "Breached";
  if (hoursLeft <= 48) return "DueSoon";
  return "OnTrack";
}

/* ── Payment status helper ────────────────────────────────────────────────── */
function computePaymentStatus(totalAmount: string | null, invoices: any[]): "Outstanding" | "PartiallyPaid" | "FullyPaid" | null {
  if (!totalAmount || !invoices.length) return invoices.length ? "Outstanding" : null;
  const total = Number(totalAmount);
  if (!total) return null;
  const paid = invoices
    .filter(i => ["Paid", "PartiallyPaid"].includes(i.status))
    .reduce((s, i) => s + Number(i.totalAmount ?? 0), 0);
  if (paid <= 0) return "Outstanding";
  if (paid >= total * 0.999) return "FullyPaid";
  return "PartiallyPaid";
}

function fmtPO(po: typeof procurementPOsTable.$inferSelect, items: any[] = [], auditLogs: any[] = [], grns: any[] = [], invoices: any[] = [], comments: any[] = [], versions: any[] = [], approvalRequest: any = null) {
  const today = new Date().toISOString().split("T")[0];
  const deadline = po.deliveryDeadline ?? po.expectedDeliveryDate;
  const isOverdue = deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(po.status);
  const slaStatus = computeSlaStatus((po as any).slaDeadline);
  const paymentStatus = computePaymentStatus(po.totalAmount, invoices);
  return {
    id: po.id, poNumber: po.poNumber, quotationId: po.quotationId,
    projectId: po.projectId ?? null,
    vendorId: po.vendorId,
    vendorName: po.vendorName, vendorGstin: po.vendorGstin, vendorAddress: po.vendorAddress, vendorContact: po.vendorContact,
    status: po.status, poDate: po.poDate, deliveryDeadline: po.deliveryDeadline, deliveryAddress: po.deliveryAddress,
    paymentTerms: po.paymentTerms, warrantyMonths: po.warrantyMonths,
    freightCharges: n(po.freightCharges), otherCharges: n(po.otherCharges),
    subtotal: n(po.subtotal), totalGst: n(po.totalGst), totalAmount: n(po.totalAmount),
    specialTerms: po.specialTerms, internalNotes: po.internalNotes,
    approvedBy: po.approvedBy, approvedByName: po.approvedByName, approvedAt: po.approvedAt?.toISOString(),
    acknowledgedAt: po.acknowledgedAt?.toISOString(), closedAt: po.closedAt?.toISOString(),
    // Approval workflow fields
    isLocked: (po as any).isLocked ?? false,
    approvalRequestId: (po as any).approvalRequestId ?? null,
    slaDeadline: (po as any).slaDeadline?.toISOString() ?? null,
    slaStatus,
    revisionNumber: (po as any).revisionNumber ?? 1,
    submittedAt: (po as any).submittedAt?.toISOString() ?? null,
    submittedBy: (po as any).submittedBy ?? null,
    submittedByName: (po as any).submittedByName ?? null,
    rejectedAt: (po as any).rejectedAt?.toISOString() ?? null,
    rejectedBy: (po as any).rejectedBy ?? null,
    rejectedByName: (po as any).rejectedByName ?? null,
    rejectionReason: (po as any).rejectionReason ?? null,
    onHoldAt: (po as any).onHoldAt?.toISOString() ?? null,
    onHoldReason: (po as any).onHoldReason ?? null,
    // Payment status (aggregated from invoices)
    paymentStatus,
    // Dispatch tracking
    vendorDispatchRef: po.vendorDispatchRef, trackingNumber: po.trackingNumber,
    dispatchedAt: po.dispatchedAt?.toISOString(), expectedDeliveryDate: po.expectedDeliveryDate,
    isOverdue: !!isOverdue,
    createdBy: po.createdBy, createdByName: po.createdByName,
    createdAt: po.createdAt.toISOString(), updatedAt: po.updatedAt.toISOString(),
    items: items.map(i => ({
      id: i.id, poId: i.poId, lineNo: i.lineNo, materialId: i.materialId,
      materialCode: i.materialCode, materialName: i.materialName, description: i.description,
      uom: i.uom, hsnSacCode: i.hsnSacCode, brand: i.brand,
      qty: n(i.qty), unitPrice: n(i.unitPrice), discountPct: n(i.discountPct),
      discountAmount: n(i.discountAmount), taxableAmount: n(i.taxableAmount),
      gstRate: n(i.gstRate), totalGst: n(i.totalGst), lineTotal: n(i.lineTotal),
      deliveredQty: n(i.deliveredQty), remarks: i.remarks,
    })),
    auditLogs: auditLogs.map(a => ({
      id: a.id, poId: a.poId, action: a.action,
      performedBy: a.performedBy, performedByName: a.performedByName,
      remarks: a.remarks, createdAt: a.createdAt.toISOString(),
      oldValues: a.oldValues, newValues: a.newValues,
    })),
    grns: grns.map(g => ({ id: g.id, grnNumber: g.grnNumber, status: g.status, deliveryDate: g.deliveryDate, createdAt: g.createdAt.toISOString() })),
    invoices: invoices.map(i => ({ id: i.id, invoiceNumber: i.invoiceNumber, status: i.status, totalAmount: n(i.totalAmount), createdAt: i.createdAt.toISOString() })),
    comments: comments.map(c => ({
      id: c.id, poId: c.poId, userId: c.userId, userName: c.userName, body: c.body,
      parentId: c.parentId, attachmentUrl: c.attachmentUrl, attachmentName: c.attachmentName,
      createdAt: c.createdAt.toISOString(),
    })),
    versions: versions.map(v => ({
      id: v.id, poId: v.poId, revisionNumber: v.revisionNumber, snapshot: v.snapshot,
      changedBy: v.changedBy, changedByName: v.changedByName,
      changedAt: v.changedAt.toISOString(), changeSummary: v.changeSummary,
    })),
    approvalRequest,
  };
}

async function loadApprovalRequest(approvalRequestId: number | null) {
  if (!approvalRequestId) return null;
  const [req] = await db.select().from(approvalRequestsTable).where(eq(approvalRequestsTable.id, approvalRequestId));
  if (!req) return null;
  const steps = await db.select().from(approvalRequestStepsTable)
    .where(eq(approvalRequestStepsTable.requestId, approvalRequestId))
    .orderBy(approvalRequestStepsTable.stepOrder);
  const actions = await db.select().from(approvalActionsTable)
    .where(eq(approvalActionsTable.requestId, approvalRequestId))
    .orderBy(desc(approvalActionsTable.createdAt));
  const actorIds = [...new Set([
    ...steps.map(s => s.actedById).filter(Boolean),
    ...actions.map(a => a.actorId).filter(Boolean),
  ])] as number[];
  const nameMap = new Map<number, string>();
  if (actorIds.length) {
    const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
      .where(inArray(usersTable.id, actorIds));
    users.forEach(u => nameMap.set(u.id, u.name));
  }
  return {
    ...req,
    slaDeadline: req.slaDeadline?.toISOString() ?? null,
    resolvedAt: req.resolvedAt?.toISOString() ?? null,
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
    steps: steps.map(s => ({
      ...s,
      slaDeadline: s.slaDeadline?.toISOString() ?? null,
      actedAt: s.actedAt?.toISOString() ?? null,
      escalatedAt: s.escalatedAt?.toISOString() ?? null,
      actedByName: s.actedById ? (nameMap.get(s.actedById) ?? null) : null,
    })),
    actions: actions.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      actorName: a.actorId ? (nameMap.get(a.actorId) ?? null) : null,
    })),
  };
}

async function loadFullPO(id: number) {
  const [po] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!po) return null;
  const [items, auditLogs, grns, invoices, comments, versions] = await Promise.all([
    db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, id)).orderBy(procPOItemsTable.lineNo),
    db.select().from(procPOAuditLogsTable).where(eq(procPOAuditLogsTable.poId, id)).orderBy(desc(procPOAuditLogsTable.createdAt)),
    db.select().from(procGRNsTable).where(eq(procGRNsTable.poId, id)).orderBy(desc(procGRNsTable.createdAt)),
    db.select().from(procInvoicesTable).where(eq(procInvoicesTable.poId, id)).orderBy(desc(procInvoicesTable.createdAt)),
    db.select().from(poCommentsTable).where(eq(poCommentsTable.poId, id)).orderBy(poCommentsTable.createdAt),
    db.select().from(poVersionsTable).where(eq(poVersionsTable.poId, id)).orderBy(desc(poVersionsTable.revisionNumber)),
  ]);
  const approvalRequest = await loadApprovalRequest((po as any).approvalRequestId ?? null);
  return fmtPO(po, items, auditLogs, grns, invoices, comments, versions, approvalRequest);
}

async function logAudit(poId: number, action: string, performedByName: string, performedBy?: number, remarks?: string, oldValues?: any, newValues?: any) {
  await db.insert(procPOAuditLogsTable).values({ poId, action, performedBy, performedByName, remarks, oldValues: oldValues ?? null, newValues: newValues ?? null });
}

async function getUserIdsByRoles(roles: string[]): Promise<number[]> {
  const rows = await db.select({ id: usersTable.id }).from(usersTable)
    .where(inArray(usersTable.role as any, roles));
  return rows.map(r => r.id);
}

async function emitNotifications(
  userIds: (number | null | undefined)[],
  opts: { type?: string; title: string; message: string; entityType?: string; entityId?: number; entityRef?: string; actionUrl?: string },
) {
  const ids = [...new Set(userIds.filter(Boolean))] as number[];
  if (!ids.length) return;
  await db.insert(notificationsTable).values(
    ids.map(uid => ({
      userId: uid,
      type: (opts.type ?? "info") as "error" | "info" | "warning" | "success" | "approval",
      title: opts.title,
      message: opts.message,
      entityType: opts.entityType ?? "po",
      entityId: opts.entityId ?? null,
      entityRef: opts.entityRef ?? null,
      actionUrl: opts.actionUrl ?? null,
    })),
  );
}

async function saveVersionSnapshot(poId: number, revisionNumber: number, snapshot: any, changedBy?: number, changedByName?: string, changeSummary?: string) {
  await db.insert(poVersionsTable).values({
    poId, revisionNumber, snapshot,
    changedBy: changedBy ?? null, changedByName: changedByName ?? null,
    changeSummary: changeSummary ?? null,
  });
}

/* ── Approval request creation ────────────────────────────────────────────── */
async function createPOApprovalRequest(
  poId: number, poNumber: string, submitterId: number, submitterName: string,
): Promise<number> {
  const ref = `APR-${String(aprCounter++).padStart(5, "0")}`;

  // Find a PO approval workflow if one exists
  const [wf] = await db.select().from(approvalWorkflowsTable)
    .where(and(
      eq(approvalWorkflowsTable.module, "procurement"),
      eq(approvalWorkflowsTable.isActive, true),
      sql`lower(${approvalWorkflowsTable.name}) like '%purchase order%' or lower(${approvalWorkflowsTable.name}) like '%po%'`,
    ))
    .limit(1);

  let wfSteps: typeof approvalWorkflowStepsTable.$inferSelect[] = [];
  if (wf) {
    wfSteps = await db.select().from(approvalWorkflowStepsTable)
      .where(eq(approvalWorkflowStepsTable.workflowId, wf.id))
      .orderBy(approvalWorkflowStepsTable.stepOrder);
  }

  const totalSteps = wfSteps.length || 2; // default: PM → Director
  const firstSlaHours = wfSteps[0]?.slaHours ?? 48;
  const slaDeadline = new Date(Date.now() + firstSlaHours * 3_600_000);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: [req] } = await client.query<{ id: number }>(
      `INSERT INTO approval_requests
         (workflow_id, ref_number, title, description, module, entity_type, entity_ref,
          entity_url, requester_id, priority, status, current_step, total_steps, sla_deadline, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        wf?.id ?? null, ref,
        `Purchase Order ${poNumber}`, `Approval request for PO ${poNumber}`,
        "procurement", "purchase_order", poNumber, `/procurement/pos/${poId}`,
        submitterId, "medium", "pending", 1, totalSteps, slaDeadline,
        `Submitted by ${submitterName}`,
      ],
    );

    const now = new Date();
    const steps = wfSteps.length
      ? wfSteps.map((s) => ({
          order: s.stepOrder, name: s.name, type: s.stepType,
          approverType: s.approverType, role: s.approverRole ?? null,
          sla: new Date(now.getTime() + (s.slaHours ?? 48) * 3_600_000),
        }))
      : [
          { order: 1, name: "PM Review",         type: "sequential", approverType: "role", role: "pm",       sla: new Date(now.getTime() + 48 * 3_600_000) },
          { order: 2, name: "Director Sign-off",  type: "sequential", approverType: "role", role: "director", sla: new Date(now.getTime() + 96 * 3_600_000) },
        ];

    for (const s of steps) {
      await client.query(
        `INSERT INTO approval_request_steps
           (request_id, step_order, name, step_type, approver_type, approver_role, status, sla_deadline)
         VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)`,
        [req.id, s.order, s.name, s.type, s.approverType, s.role, s.sla],
      );
    }

    await client.query(
      `INSERT INTO approval_actions (request_id, actor_id, action_type, comment)
       VALUES ($1,$2,'submitted',$3)`,
      [req.id, submitterId, `Purchase order ${poNumber} submitted for approval`],
    );

    return req.id;
  } finally {
    await client.end();
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  Draft:             ["Submitted", "Cancelled"],
  Submitted:         ["PendingApproval", "Rejected", "Cancelled"],
  PendingApproval:   ["Approved", "Rejected"],
  Approved:          ["Issued", "OnHold", "Cancelled"],
  Rejected:          ["Draft", "Cancelled"],
  OnHold:            ["Approved", "Cancelled"],
  Revised:           ["Submitted", "Cancelled"],
  Issued:            ["Acknowledged", "OnHold", "Cancelled"],
  Acknowledged:      ["PartiallyReceived", "FullyReceived", "OnHold", "Cancelled"],
  PartiallyReceived: ["FullyReceived", "OnHold", "Cancelled"],
  FullyReceived:     ["InvoiceMatched", "Closed"],
  InvoiceMatched:    ["PaymentPending", "Closed"],
  PaymentPending:    ["Paid", "Closed"],
  Paid:              ["Closed"],
  Closed:            [], Cancelled: [],
};

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get("/procurement-pos", async (req, res): Promise<void> => {
  let query = db.select().from(procurementPOsTable).orderBy(desc(procurementPOsTable.createdAt)).$dynamic();
  if (req.query.status) query = query.where(eq(procurementPOsTable.status, req.query.status as any));
  if (req.query.vendorId) query = query.where(eq(procurementPOsTable.vendorId, Number(req.query.vendorId)));
  if (req.query.projectId) query = query.where(eq(procurementPOsTable.projectId, Number(req.query.projectId)));
  if (req.query.vendor) {
    const vendorName = `%${String(req.query.vendor).toLowerCase()}%`;
    query = query.where(sql`lower(${procurementPOsTable.vendorName}) LIKE ${vendorName}`);
  }
  if (req.query.category) {
    const categoryLabel = String(req.query.category);
    const def = CATEGORY_DEFS.find(d => d.label === categoryLabel);

    if (categoryLabel === OTHER_CATEGORY) {
      const allPatterns = CATEGORY_DEFS.flatMap(d => d.likePatterns);
      const noneOfKnownClause = allPatterns
        .map(p => sql`lower(${procPOItemsTable.materialName}) LIKE ${p}`)
        .reduce((a, b) => sql`${a} OR ${b}`);
      const otherItemPoIds = await db
        .selectDistinct({ poId: procPOItemsTable.poId })
        .from(procPOItemsTable)
        .where(sql`NOT (${noneOfKnownClause})`);
      const otherIds = otherItemPoIds.map(r => r.poId);
      if (otherIds.length > 0) {
        query = query.where(inArray(procurementPOsTable.id, otherIds));
      } else {
        res.json([]); return;
      }
    } else if (def) {
      const likeClause = def.likePatterns
        .map(p => sql`lower(${procPOItemsTable.materialName}) LIKE ${p}`)
        .reduce((a, b) => sql`${a} OR ${b}`);
      const matchingPoIds = await db
        .selectDistinct({ poId: procPOItemsTable.poId })
        .from(procPOItemsTable)
        .where(sql`(${likeClause})`);
      const ids = matchingPoIds.map(r => r.poId);
      if (ids.length > 0) {
        query = query.where(inArray(procurementPOsTable.id, ids));
      } else {
        res.json([]); return;
      }
    }
  }
  const rows = await query;
  const today = new Date().toISOString().split("T")[0];
  res.json(rows.map(po => {
    const deadline = po.deliveryDeadline ?? po.expectedDeliveryDate;
    const isOverdue = deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(po.status);
    const slaStatus = computeSlaStatus((po as any).slaDeadline);
    return { ...fmtPO(po), isOverdue: !!isOverdue, slaStatus };
  }));
});

// ── GET SINGLE ────────────────────────────────────────────────────────────────
router.get("/procurement-pos/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const result = await loadFullPO(id);
  if (!result) { res.status(404).json({ error: "PO not found" }); return; }
  res.json(result);
});

// ── UPDATE METADATA ONLY (non-lifecycle fields) ────────────────────────────────
// This route is intentionally restricted to safe metadata fields.
// All lifecycle transitions (submit, approve, reject, revise, cancel, hold, issue…)
// must go through their dedicated POST action endpoints, which carry proper auth gates.
// Locked POs reject all mutations here — unlock only via /revise or /unhold.
router.patch("/procurement-pos/:id", requirePermission("procurement", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }

  // Hard lock — no mutations allowed on locked POs via this generic route
  if ((existing as any).isLocked) {
    res.status(423).json({ error: "This PO is locked after approval. Use the dedicated action endpoints to advance its lifecycle.", locked: true }); return;
  }

  // Block terminal/closed states from any mutation
  if (["Closed", "Cancelled"].includes(existing.status)) {
    res.status(400).json({ error: `Cannot edit a PO in ${existing.status} status` }); return;
  }

  // Whitelist of safe metadata-only fields — lifecycle status is explicitly excluded
  // internalRef is NOT a column in procurement_pos — excluded from update payload
  const { deliveryAddress, specialTerms, internalNotes, paymentTerms, warrantyMonths,
          freightCharges, otherCharges, remarks, projectId } = req.body;

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (deliveryAddress  !== undefined) updateData.deliveryAddress  = deliveryAddress;
  if (specialTerms     !== undefined) updateData.specialTerms     = specialTerms;
  if (internalNotes    !== undefined) updateData.internalNotes    = internalNotes;
  if (paymentTerms     !== undefined) updateData.paymentTerms     = paymentTerms;
  if (warrantyMonths   !== undefined) updateData.warrantyMonths   = warrantyMonths;
  if (freightCharges   !== undefined) updateData.freightCharges   = freightCharges;
  if (otherCharges     !== undefined) updateData.otherCharges     = otherCharges;
  if (projectId        !== undefined) updateData.projectId        = projectId ?? null;

  await db.update(procurementPOsTable).set(updateData).where(eq(procurementPOsTable.id, id));
  if (remarks) await logAudit(id, "MetadataUpdated", actor.name ?? "Unknown", actor.userId, remarks);

  const result = await loadFullPO(id);
  res.json(result);
});

// ── ACKNOWLEDGE ───────────────────────────────────────────────────────────────
router.post("/procurement-pos/:id/acknowledge", requirePermission("procurement", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }
  if (existing.status !== "Issued") {
    res.status(400).json({ error: `PO must be Issued to acknowledge (currently ${existing.status})` }); return;
  }
  await db.update(procurementPOsTable).set({
    status: "Acknowledged", acknowledgedAt: new Date(), updatedAt: new Date(),
  } as any).where(eq(procurementPOsTable.id, id));
  await logAudit(id, "Acknowledged", actor.name ?? "System", actor.userId, "Vendor acknowledged the PO");
  const result = await loadFullPO(id);
  res.json(result);
});

// ── CLOSE ─────────────────────────────────────────────────────────────────────
router.post("/procurement-pos/:id/close", requirePermission("procurement", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }
  if (!["FullyReceived", "InvoiceMatched", "Paid"].includes(existing.status)) {
    res.status(400).json({ error: `PO cannot be closed from ${existing.status} status` }); return;
  }
  await db.update(procurementPOsTable).set({
    status: "Closed", closedAt: new Date(), updatedAt: new Date(),
  } as any).where(eq(procurementPOsTable.id, id));
  await logAudit(id, "Closed", actor.name ?? "System", actor.userId, "PO closed");
  const result = await loadFullPO(id);
  res.json(result);
});

// ── SUBMIT FOR APPROVAL ───────────────────────────────────────────────────────
router.post("/procurement-pos/:id/submit", requirePermission("procurement", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  // Actor identity comes ONLY from the verified JWT — never from the request body
  const actorId   = actor.userId;
  const actorName = actor.name ?? "System";
  const { remarks } = req.body;

  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }
  if (!["Draft", "Revised"].includes(existing.status)) {
    res.status(400).json({ error: `PO must be in Draft or Revised status to submit (currently ${existing.status})` }); return;
  }
  if ((existing as any).isLocked) {
    res.status(423).json({ error: "PO is locked and cannot be re-submitted" }); return;
  }

  // Snapshot current state before submission
  const items = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, id)).orderBy(procPOItemsTable.lineNo);
  const revNumber = (existing as any).revisionNumber ?? 1;
  await saveVersionSnapshot(id, revNumber, { header: existing, items }, actorId, actorName, "Submitted for approval");

  // Create approval request
  const slaDeadline = new Date(Date.now() + 48 * 3_600_000);
  const approvalRequestId = await createPOApprovalRequest(id, existing.poNumber, actorId!, actorName);

  const now = new Date();
  await db.update(procurementPOsTable).set({
    status: "Submitted",
    submittedAt: now, submittedBy: actorId, submittedByName: actorName,
    approvalRequestId,
    slaDeadline,
    updatedAt: now,
  } as any).where(eq(procurementPOsTable.id, id));

  await logAudit(id, "Submitted", actorName, actorId, remarks ?? "Submitted for approval");

  // Notify approvers
  const approverIds = await getUserIdsByRoles(["pm", "director", "admin"]);
  await emitNotifications(approverIds, {
    type: "approval",
    title: "Purchase Order Pending Approval",
    message: `${existing.poNumber} (${existing.vendorName}) has been submitted for approval by ${actorName}. Total: ₹${Number(existing.totalAmount ?? 0).toLocaleString("en-IN")}`,
    entityType: "purchase_order", entityId: id, entityRef: existing.poNumber,
    actionUrl: `/procurement/pos/${id}`,
  });

  const result = await loadFullPO(id);
  res.json(result);
});

// NOTE: PO approve and reject are intentionally NOT exposed as direct REST endpoints here.
// All approval/rejection flows MUST go through the Approval Workbench:
//   PATCH /approvals/:id/approve  — enforces canAct step-level gating
//   PATCH /approvals/:id/reject   — enforces canAct step-level gating
// Both workbench routes perform full bidirectional sync back to the PO
// (status, lock, audit log, notifications) via the entity-type switch in approvals.ts.

// ── REVISE (Rejected → Draft, unlocked, new revision) ────────────────────────
router.post("/procurement-pos/:id/revise", requirePermission("procurement", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const actorId   = actor.userId;
  const actorName = actor.name ?? "System";
  const { remarks } = req.body;

  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }
  if (existing.status !== "Rejected") {
    res.status(400).json({ error: `Only Rejected POs can be revised (currently ${existing.status})` }); return;
  }

  const newRevision = ((existing as any).revisionNumber ?? 1) + 1;
  const items = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, id)).orderBy(procPOItemsTable.lineNo);
  await saveVersionSnapshot(id, newRevision, { header: existing, items }, actorId, actorName, remarks ?? `Revision ${newRevision} started`);

  await db.update(procurementPOsTable).set({
    status: "Draft",
    isLocked: false,
    revisionNumber: newRevision,
    rejectionReason: null,
    approvalRequestId: null,
    slaDeadline: null,
    updatedAt: new Date(),
  } as any).where(eq(procurementPOsTable.id, id));

  await logAudit(id, "Revised", actorName, actorId, remarks ?? `Revision ${newRevision} started`,
    { status: "Rejected" }, { status: "Draft", revisionNumber: newRevision });

  // Notify team
  const teamIds = await getUserIdsByRoles(["pm", "admin"]);
  await emitNotifications(teamIds, {
    type: "info", title: "PO Revision Started",
    message: `${existing.poNumber} has been revised (revision ${newRevision}) by ${actorName} and is open for editing.`,
    entityType: "purchase_order", entityId: id, entityRef: existing.poNumber,
    actionUrl: `/procurement/pos/${id}`,
  });

  const result = await loadFullPO(id);
  res.json(result);
});

// ── CANCEL ────────────────────────────────────────────────────────────────────
router.post("/procurement-pos/:id/cancel", requirePermission("procurement", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const actorId   = actor.userId;
  const actorName = actor.name ?? "System";
  const { reason } = req.body;

  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }
  if (["Closed", "Cancelled"].includes(existing.status)) {
    res.status(400).json({ error: `PO is already ${existing.status}` }); return;
  }

  // Block cancel if GRNs exist
  const grns = await db.select({ id: procGRNsTable.id, grnNumber: procGRNsTable.grnNumber })
    .from(procGRNsTable).where(eq(procGRNsTable.poId, id));
  if (grns.length > 0) {
    res.status(400).json({
      error: `Cannot cancel PO: ${grns.length} GRN(s) exist (${grns.map(g => g.grnNumber).join(", ")}). Resolve them first.`,
    }); return;
  }

  // Sync approval request if pending
  if ((existing as any).approvalRequestId) {
    await db.update(approvalRequestsTable)
      .set({ status: "cancelled", updatedAt: new Date(), resolvedAt: new Date() })
      .where(eq(approvalRequestsTable.id, (existing as any).approvalRequestId));
  }

  await db.update(procurementPOsTable).set({
    status: "Cancelled", isLocked: false, updatedAt: new Date(),
  } as any).where(eq(procurementPOsTable.id, id));

  await logAudit(id, "Cancelled", actorName, actorId, reason ?? "PO cancelled");

  // Notify team
  const teamIds = await getUserIdsByRoles(["pm", "admin", "director"]);
  await emitNotifications(teamIds, {
    type: "warning", title: "Purchase Order Cancelled",
    message: `${existing.poNumber} has been cancelled by ${actorName}${reason ? `. Reason: "${reason}"` : ""}.`,
    entityType: "purchase_order", entityId: id, entityRef: existing.poNumber,
    actionUrl: `/procurement/pos/${id}`,
  });

  const result = await loadFullPO(id);
  res.json(result);
});

// ── HOLD / UNHOLD ─────────────────────────────────────────────────────────────
router.post("/procurement-pos/:id/hold", requirePermission("procurement", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const actorId   = actor.userId;
  const actorName = actor.name ?? "System";
  const { reason } = req.body;

  if (!reason?.trim()) { res.status(400).json({ error: "Hold reason is required" }); return; }

  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }
  if (["Closed", "Cancelled", "OnHold"].includes(existing.status)) {
    res.status(400).json({ error: `Cannot hold a PO in ${existing.status} status` }); return;
  }

  const now = new Date();
  await db.update(procurementPOsTable).set({
    status: "OnHold",
    onHoldAt: now, onHoldBy: actorId, onHoldReason: reason,
    updatedAt: now,
  } as any).where(eq(procurementPOsTable.id, id));

  await logAudit(id, "OnHold", actorName, actorId, reason, { status: existing.status }, { status: "OnHold" });

  // Notify procurement team
  const teamIds = await getUserIdsByRoles(["pm", "admin"]);
  const holderIds = [...new Set([...(existing as any).submittedBy ? [(existing as any).submittedBy] : [], ...teamIds])];
  await emitNotifications(holderIds, {
    type: "warning", title: "Purchase Order On Hold",
    message: `${existing.poNumber} has been placed on hold by ${actorName}. Reason: "${reason}"`,
    entityType: "purchase_order", entityId: id, entityRef: existing.poNumber,
    actionUrl: `/procurement/pos/${id}`,
  });

  const result = await loadFullPO(id);
  res.json(result);
});

router.post("/procurement-pos/:id/unhold", requirePermission("procurement", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const actorId   = actor.userId;
  const actorName = actor.name ?? "System";
  const { remarks } = req.body; // do NOT accept previousStatus from body — derive from audit log

  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }
  if (existing.status !== "OnHold") {
    res.status(400).json({ error: "PO is not On Hold" }); return;
  }

  // Derive pre-hold status from the audit log old_values recorded when the hold was placed.
  // Allowed set: only non-terminal, non-hold statuses that can logically follow unhold.
  const RESUMABLE = new Set(["Draft", "Submitted", "PendingApproval", "Approved", "Issued", "Acknowledged", "PartiallyReceived", "FullyReceived"]);
  let restoreStatus = "Approved"; // safe default
  try {
    const [holdEntry] = await db.select({ oldValues: procPOAuditLogsTable.oldValues })
      .from(procPOAuditLogsTable)
      .where(and(eq(procPOAuditLogsTable.poId, id), sql`${procPOAuditLogsTable.action} = 'OnHold'`))
      .orderBy(desc(procPOAuditLogsTable.createdAt))
      .limit(1);
    const prevStatus = (holdEntry?.oldValues as any)?.status;
    if (prevStatus && RESUMABLE.has(prevStatus)) restoreStatus = prevStatus;
  } catch { /* fall through to default */ }

  await db.update(procurementPOsTable).set({
    status: restoreStatus as any, onHoldAt: null, onHoldBy: null, onHoldReason: null, updatedAt: new Date(),
  } as any).where(eq(procurementPOsTable.id, id));

  await logAudit(id, "Unhold", actorName, actorId, remarks ?? `PO resumed from hold → ${restoreStatus}`);

  const result = await loadFullPO(id);
  res.json(result);
});

// ── ISSUE (Approved → Issued, only when locked) ───────────────────────────────
router.post("/procurement-pos/:id/issue", requirePermission("procurement", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const actorId   = actor.userId;
  const actorName = actor.name ?? "System";
  const { deliveryDeadline, deliveryAddress, specialTerms, remarks } = req.body;

  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }
  if (existing.status !== "Approved") {
    res.status(400).json({ error: `PO must be Approved to issue (currently ${existing.status})` }); return;
  }
  if (!(existing as any).isLocked) {
    res.status(400).json({ error: "PO must be locked (approved) before issuing" }); return;
  }
  if (!deliveryDeadline) {
    res.status(400).json({ error: "Delivery deadline is required when issuing a PO" }); return;
  }

  const updateData: Record<string, any> = {
    status: "Issued", deliveryDeadline, updatedAt: new Date(),
  };
  if (deliveryAddress) updateData.deliveryAddress = deliveryAddress;
  if (specialTerms)    updateData.specialTerms    = specialTerms;

  await db.update(procurementPOsTable).set(updateData as any).where(eq(procurementPOsTable.id, id));
  await logAudit(id, "Issued", actorName, actorId, remarks ?? "PO issued to vendor");

  // Notify team
  const teamIds = await getUserIdsByRoles(["pm", "admin"]);
  await emitNotifications(teamIds, {
    type: "info", title: "Purchase Order Issued",
    message: `${existing.poNumber} has been formally issued to ${existing.vendorName} by ${actorName}.`,
    entityType: "purchase_order", entityId: id, entityRef: existing.poNumber,
    actionUrl: `/procurement/pos/${id}`,
  });

  const result = await loadFullPO(id);
  res.json(result);
});

// ── RECORD DISPATCH ───────────────────────────────────────────────────────────
router.post("/procurement-pos/:id/record-dispatch", requirePermission("procurement", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const actorId   = actor.userId;
  const actorName = actor.name ?? "System";
  const { vendorDispatchRef, trackingNumber, expectedDeliveryDate, remarks } = req.body;
  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }
  if (!["Issued", "Acknowledged"].includes(existing.status)) {
    res.status(400).json({ error: `Cannot record dispatch on a PO in '${existing.status}' status. Must be Issued or Acknowledged.` }); return;
  }
  await db.update(procurementPOsTable).set({
    vendorDispatchRef, trackingNumber, dispatchedAt: new Date(),
    expectedDeliveryDate: expectedDeliveryDate ?? null,
    updatedAt: new Date(),
  }).where(eq(procurementPOsTable.id, id));
  await logAudit(id, "DispatchRecorded", actorName, actorId, remarks ?? `Dispatch ref: ${vendorDispatchRef}, Tracking: ${trackingNumber}`);
  const result = await loadFullPO(id);
  res.json(result);
});

// ── COMMENTS ─────────────────────────────────────────────────────────────────

router.get("/procurement-pos/:id/comments", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const comments = await db.select().from(poCommentsTable)
    .where(eq(poCommentsTable.poId, id))
    .orderBy(poCommentsTable.createdAt);
  res.json(comments.map(c => ({
    ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
  })));
});

router.post("/procurement-pos/:id/comments", requirePermission("procurement", "view"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const actorId   = actor.userId;
  const actorName = actor.name ?? "User";
  // Note: parentId and attachmentUrl/Name are content from body — OK to accept
  const { body, parentId, attachmentUrl, attachmentName } = req.body;
  if (!body?.trim()) { res.status(400).json({ error: "Comment body is required" }); return; }
  const [existing] = await db.select({ id: procurementPOsTable.id }).from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }
  const [comment] = await db.insert(poCommentsTable).values({
    poId: id, userId: actorId, userName: actorName, body: body.trim(),
    parentId: parentId ?? null,
    attachmentUrl: attachmentUrl ?? null,
    attachmentName: attachmentName ?? null,
  }).returning();
  await logAudit(id, "CommentAdded", actorName, actorId, body.substring(0, 100));
  res.status(201).json({ ...comment, createdAt: comment.createdAt.toISOString(), updatedAt: comment.updatedAt.toISOString() });
});

router.delete("/procurement-pos/:id/comments/:cid", requirePermission("procurement", "delete"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const cid = Number(req.params.cid);
  const actor = getActor(req);
  const [comment] = await db.select().from(poCommentsTable).where(eq(poCommentsTable.id, cid));
  if (!comment || comment.poId !== id) { res.status(404).json({ error: "Comment not found" }); return; }
  // Only the comment author or admin can delete
  if (comment.userId !== actor?.userId && !["admin", "director"].includes(actor?.role ?? "")) {
    res.status(403).json({ error: "Cannot delete another user's comment" }); return;
  }
  await db.delete(poCommentsTable).where(eq(poCommentsTable.id, cid));
  res.json({ ok: true });
});

// ── VERSION HISTORY ──────────────────────────────────────────────────────────

router.get("/procurement-pos/:id/versions", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const versions = await db.select().from(poVersionsTable)
    .where(eq(poVersionsTable.poId, id))
    .orderBy(desc(poVersionsTable.revisionNumber));
  res.json(versions.map(v => ({
    ...v, changedAt: v.changedAt.toISOString(),
  })));
});

export default router;
