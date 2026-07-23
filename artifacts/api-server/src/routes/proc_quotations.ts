import { Router, type IRouter } from "express";
import pg from "pg";
import {
  db, procurementQuotationsTable, procQuotationItemsTable,
  quotationVersionsTable, quotationAuditLogsTable, quotationAttachmentsTable,
  procurementPOsTable, procPOItemsTable,
  vendorsTable, materialRequestsTable,
  approvalRequestsTable, approvalRequestStepsTable, approvalActionsTable,
  approvalWorkflowsTable, approvalWorkflowStepsTable,
  notificationsTable, usersTable,
} from "@workspace/db";
import { eq, desc, and, sql, inArray, or } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

const storage = new ObjectStorageService();

let vqCounter = 1;
let poProcCounter = 1;
let aprCounter = 1;

(async () => {
  const r1 = await db.select({ id: procurementQuotationsTable.id }).from(procurementQuotationsTable).orderBy(desc(procurementQuotationsTable.id)).limit(1);
  if (r1.length > 0) vqCounter = r1[0]!.id + 1;
  const r2 = await db.select({ id: procurementPOsTable.id }).from(procurementPOsTable).orderBy(desc(procurementPOsTable.id)).limit(1);
  if (r2.length > 0) poProcCounter = r2[0]!.id + 1;
  const r3 = await db.select({ id: approvalRequestsTable.id }).from(approvalRequestsTable).orderBy(desc(approvalRequestsTable.id)).limit(1);
  if (r3.length > 0) aprCounter = r3[0]!.id + 1;
})();

/* ── Auth helper ─────────────────────────────────────────────────────────── */
function getActor(req: any): { userId: number; role: string; name?: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; }
  catch { return null; }
}

/* ── Formatters ──────────────────────────────────────────────────────────── */
function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

function fmtItem(i: typeof procQuotationItemsTable.$inferSelect) {
  return {
    id: i.id, quotationId: i.quotationId, lineNo: i.lineNo,
    materialId: i.materialId, materialCode: i.materialCode, materialName: i.materialName,
    description: i.description, uom: i.uom, hsnSacCode: i.hsnSacCode, brand: i.brand,
    qty: n(i.qty), unitPrice: n(i.unitPrice), discountPct: n(i.discountPct),
    discountAmount: n(i.discountAmount), taxableAmount: n(i.taxableAmount),
    gstRate: n(i.gstRate), cgstAmount: n(i.cgstAmount), sgstAmount: n(i.sgstAmount),
    igstAmount: n(i.igstAmount), totalGst: n(i.totalGst), lineTotal: n(i.lineTotal),
    deliveryDays: i.deliveryDays, remarks: i.remarks,
  };
}

function fmtQ(
  q: typeof procurementQuotationsTable.$inferSelect,
  items: any[] = [],
  versions: any[] = [],
  auditLogs: any[] = [],
  attachments: any[] = [],
  approvalRequest: any = null,
) {
  return {
    id: q.id, referenceId: q.referenceId, version: q.version, status: q.status,
    mrId: q.mrId, vendorId: q.vendorId, vendorSnapshotName: q.vendorSnapshotName,
    quotationDate: q.quotationDate, validityDate: q.validityDate, currency: q.currency,
    paymentTerms: q.paymentTerms, deliveryTerms: q.deliveryTerms,
    deliveryLeadDays: q.deliveryLeadDays, warrantyMonths: q.warrantyMonths,
    subtotal: n(q.subtotal), totalDiscount: n(q.totalDiscount), totalGst: n(q.totalGst),
    freightCharges: n(q.freightCharges), otherCharges: n(q.otherCharges), totalAmount: n(q.totalAmount),
    fileUrl: q.fileUrl, fileOriginalName: q.fileOriginalName,
    vendorRemarks: q.vendorRemarks, internalNotes: q.internalNotes,
    submittedAt: q.submittedAt?.toISOString(), submittedBy: q.submittedBy, submittedByName: q.submittedByName,
    reviewedAt: q.reviewedAt?.toISOString(), reviewedBy: q.reviewedBy, reviewedByName: q.reviewedByName,
    approvedAt: q.approvedAt?.toISOString(), approvedBy: q.approvedBy, approvedByName: q.approvedByName,
    rejectedAt: q.rejectedAt?.toISOString(), rejectedBy: q.rejectedBy, rejectedByName: q.rejectedByName,
    approvalRemarks: q.approvalRemarks,
    isL1: q.isL1, isRecommended: q.isRecommended, recommendationNotes: q.recommendationNotes,
    poGenerated: q.poGenerated,
    // Lock / reopen
    lockedAt: (q as any).lockedAt?.toISOString() ?? null,
    lockedBy: (q as any).lockedBy ?? null,
    reopenedAt: (q as any).reopenedAt?.toISOString() ?? null,
    reopenedBy: (q as any).reopenedBy ?? null,
    reopenReason: (q as any).reopenReason ?? null,
    approvalRequestId: (q as any).approvalRequestId ?? null,
    createdBy: q.createdBy, createdByName: q.createdByName,
    updatedBy: q.updatedBy, updatedByName: q.updatedByName,
    createdAt: q.createdAt.toISOString(), updatedAt: q.updatedAt.toISOString(),
    items, versions, auditLogs, attachments, approvalRequest,
  };
}

function calcTotals(items: any[]) {
  let subtotal = 0, totalDiscount = 0, totalGst = 0;
  const calcItems = items.map((item, idx) => {
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const discountPct = Number(item.discountPct) || 0;
    const gstRate = Number(item.gstRate) || 18;
    const gross = qty * unitPrice;
    const discountAmount = parseFloat((gross * discountPct / 100).toFixed(2));
    const taxableAmount = parseFloat((gross - discountAmount).toFixed(2));
    const totalGstItem = parseFloat((taxableAmount * gstRate / 100).toFixed(2));
    const cgst = parseFloat((totalGstItem / 2).toFixed(2));
    const sgst = parseFloat((totalGstItem / 2).toFixed(2));
    const lineTotal = parseFloat((taxableAmount + totalGstItem).toFixed(2));
    subtotal += gross;
    totalDiscount += discountAmount;
    totalGst += totalGstItem;
    return { ...item, lineNo: idx + 1, qty, unitPrice, discountPct, discountAmount, taxableAmount, gstRate, cgstAmount: cgst, sgstAmount: sgst, igstAmount: 0, totalGst: totalGstItem, lineTotal };
  });
  return { calcItems, subtotal: parseFloat(subtotal.toFixed(2)), totalDiscount: parseFloat(totalDiscount.toFixed(2)), totalGst: parseFloat(totalGst.toFixed(2)) };
}

async function logAudit(
  quotationId: number, action: typeof quotationAuditLogsTable.$inferInsert["action"],
  performedByName: string, performedBy?: number, performedByRole?: string,
  remarks?: string, oldValues?: any, newValues?: any,
) {
  await db.insert(quotationAuditLogsTable).values({
    quotationId, action, performedByName, performedBy, performedByRole,
    remarks, oldValues: oldValues ?? null, newValues: newValues ?? null,
  });
}

/* ── Notification helper ─────────────────────────────────────────────────── */
async function emitNotifications(
  userIds: (number | null | undefined)[],
  opts: { type?: string; title: string; message: string; entityType?: string; entityId?: number; entityRef?: string; actionUrl?: string },
) {
  const ids = [...new Set(userIds.filter(Boolean))] as number[];
  if (!ids.length) return;
  await db.insert(notificationsTable).values(
    ids.map(uid => ({
      userId: uid,
      type: opts.type ?? "info",
      title: opts.title,
      message: opts.message,
      entityType: opts.entityType ?? "quotation",
      entityId: opts.entityId,
      entityRef: opts.entityRef,
      actionUrl: opts.actionUrl,
    })),
  );
}

async function getUserIdsByRoles(roles: string[]): Promise<number[]> {
  const rows = await db.select({ id: usersTable.id }).from(usersTable)
    .where(inArray(usersTable.role as any, roles));
  return rows.map(r => r.id);
}

/* ── Approval engine helpers ─────────────────────────────────────────────── */
async function findQuotationWorkflow(): Promise<typeof approvalWorkflowsTable.$inferSelect | null> {
  const [wf] = await db.select().from(approvalWorkflowsTable)
    .where(and(
      eq(approvalWorkflowsTable.module, "procurement"),
      eq(approvalWorkflowsTable.isActive, true),
      sql`lower(${approvalWorkflowsTable.name}) like '%quotation%'`,
    ))
    .limit(1);
  return wf ?? null;
}

async function createApprovalRequest(
  quotationId: number, referenceId: string, submitterId: number, submitterName: string,
): Promise<number> {
  const ref = `APR-${String(aprCounter++).padStart(5, "0")}`;

  // Find the procurement quotation workflow, or use ad-hoc PM → Director
  const wf = await findQuotationWorkflow();
  let wfSteps: typeof approvalWorkflowStepsTable.$inferSelect[] = [];
  if (wf) {
    wfSteps = await db.select().from(approvalWorkflowStepsTable)
      .where(eq(approvalWorkflowStepsTable.workflowId, wf.id))
      .orderBy(approvalWorkflowStepsTable.stepOrder);
  }

  const totalSteps = wfSteps.length || 2; // default: PM + Director
  const firstSlaHours = wfSteps[0]?.slaHours ?? 24;
  const slaDeadline = new Date(Date.now() + firstSlaHours * 3_600_000);

  // Use a dedicated client (not the shared pool) to avoid connection exhaustion
  // caused by Drizzle's prepared-statement cache leaking connections on retry
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
        `Vendor Quotation ${referenceId}`, `Approval request for quotation ${referenceId}`,
        "procurement", "quotation", referenceId, `/procurement/quotations/${quotationId}`,
        submitterId, "medium", "pending", 1, totalSteps, slaDeadline,
        `Submitted by ${submitterName}`,
      ],
    );

    const now = new Date();
    const steps = wfSteps.length
      ? wfSteps.map((s) => ({
          order: s.stepOrder, name: s.name, type: s.stepType,
          approverType: s.approverType, role: s.approverRole ?? null,
          sla: new Date(now.getTime() + (s.slaHours ?? 24) * 3_600_000),
        }))
      : [
          { order: 1, name: "PM Review",        type: "sequential", approverType: "role", role: "pm",       sla: new Date(now.getTime() + 24 * 3_600_000) },
          { order: 2, name: "Director Sign-off", type: "sequential", approverType: "role", role: "director", sla: new Date(now.getTime() + 48 * 3_600_000) },
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
      [req.id, submitterId, `Vendor quotation ${referenceId} submitted for approval`],
    );

    return req.id;
  } finally {
    await client.end();
  }
}

async function syncApprovalRequest(approvalRequestId: number, newStatus: "approved" | "rejected" | "recalled", comment?: string, actorId?: number) {
  if (!approvalRequestId) return;
  const terminalStatus = newStatus === "recalled" ? "recalled" : newStatus;
  await db.update(approvalRequestsTable)
    .set({ status: terminalStatus, updatedAt: new Date(), resolvedAt: new Date() })
    .where(eq(approvalRequestsTable.id, approvalRequestId));
  // Mark all pending steps as skipped/approved/rejected
  await db.update(approvalRequestStepsTable)
    .set({ status: newStatus === "approved" ? "approved" : newStatus === "rejected" ? "rejected" : "skipped", actedAt: new Date(), actedById: actorId ?? null })
    .where(and(eq(approvalRequestStepsTable.requestId, approvalRequestId), eq(approvalRequestStepsTable.status, "pending")));
  if (actorId) {
    await db.insert(approvalActionsTable).values({
      requestId: approvalRequestId, actorId, actionType: newStatus, comment: comment ?? null,
    });
  }
}

async function getApprovalRequestForQuotation(approvalRequestId: number | null) {
  if (!approvalRequestId) return null;
  const [req] = await db.select().from(approvalRequestsTable).where(eq(approvalRequestsTable.id, approvalRequestId));
  if (!req) return null;
  const steps = await db.select().from(approvalRequestStepsTable)
    .where(eq(approvalRequestStepsTable.requestId, approvalRequestId))
    .orderBy(approvalRequestStepsTable.stepOrder);
  const actions = await db.select().from(approvalActionsTable)
    .where(eq(approvalActionsTable.requestId, approvalRequestId))
    .orderBy(desc(approvalActionsTable.createdAt));
  // Enrich actor names
  const actorIds = [...new Set([
    ...steps.map(s => s.actedById).filter(Boolean),
    ...steps.map(s => s.delegatedToId).filter(Boolean),
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
      delegatedToName: s.delegatedToId ? (nameMap.get(s.delegatedToId) ?? null) : null,
    })),
    actions: actions.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      actorName: a.actorId ? (nameMap.get(a.actorId) ?? null) : null,
    })),
  };
}

/* ── Full detail loader ──────────────────────────────────────────────────── */
async function loadFullQuotation(id: number) {
  const [q] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!q) return null;
  const [items, versions, auditLogs, attachments] = await Promise.all([
    db.select().from(procQuotationItemsTable).where(eq(procQuotationItemsTable.quotationId, id)).orderBy(procQuotationItemsTable.lineNo),
    db.select().from(quotationVersionsTable).where(eq(quotationVersionsTable.quotationId, id)).orderBy(desc(quotationVersionsTable.version)),
    db.select().from(quotationAuditLogsTable).where(eq(quotationAuditLogsTable.quotationId, id)).orderBy(desc(quotationAuditLogsTable.createdAt)),
    db.select().from(quotationAttachmentsTable).where(eq(quotationAttachmentsTable.quotationId, id)).orderBy(desc(quotationAttachmentsTable.uploadedAt)),
  ]);
  const approvalRequest = await getApprovalRequestForQuotation((q as any).approvalRequestId ?? null);
  return fmtQ(
    q,
    items.map(fmtItem),
    versions,
    auditLogs.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })),
    attachments.map(a => ({ ...a, uploadedAt: a.uploadedAt.toISOString() })),
    approvalRequest,
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════════════════════════════════ */

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get("/procurement-quotations", async (req, res): Promise<void> => {
  const { mrId, vendorId, status } = req.query as Record<string, string>;
  let rows = await db.select().from(procurementQuotationsTable).orderBy(desc(procurementQuotationsTable.createdAt));
  if (mrId)     rows = rows.filter(r => r.mrId === Number(mrId));
  if (vendorId) rows = rows.filter(r => r.vendorId === Number(vendorId));
  if (status)   rows = rows.filter(r => r.status === status);
  res.json(rows.map(q => fmtQ(q)));
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post("/procurement-quotations", async (req, res): Promise<void> => {
  const { items: itemsBody = [], userName = "System", userId, userRole, ...body } = req.body;
  const year = new Date().getFullYear();
  const referenceId = `VQ-${year}-${String(vqCounter++).padStart(4, "0")}`;
  const { calcItems, subtotal, totalDiscount, totalGst } = calcTotals(itemsBody);
  const freight = Number(body.freightCharges) || 0;
  const other = Number(body.otherCharges) || 0;
  const totalAmount = parseFloat((subtotal - totalDiscount + totalGst + freight + other).toFixed(2));

  let vendorSnapshotName = body.vendorSnapshotName;
  if (!vendorSnapshotName && body.vendorId) {
    const [v] = await db.select({ name: vendorsTable.name }).from(vendorsTable).where(eq(vendorsTable.id, Number(body.vendorId)));
    vendorSnapshotName = v?.name ?? null;
  }

  const [q] = await db.insert(procurementQuotationsTable).values({
    referenceId, version: 1, status: "Draft",
    mrId: body.mrId ? Number(body.mrId) : null,
    vendorId: body.vendorId ? Number(body.vendorId) : null,
    vendorSnapshotName,
    quotationDate: body.quotationDate ?? null,
    validityDate: body.validityDate ?? null,
    currency: body.currency ?? "INR",
    paymentTerms: body.paymentTerms ?? null,
    deliveryTerms: body.deliveryTerms ?? null,
    deliveryLeadDays: body.deliveryLeadDays ? Number(body.deliveryLeadDays) : null,
    warrantyMonths: body.warrantyMonths ? Number(body.warrantyMonths) : null,
    subtotal: subtotal.toString(), totalDiscount: totalDiscount.toString(),
    totalGst: totalGst.toString(), freightCharges: freight.toString(),
    otherCharges: other.toString(), totalAmount: totalAmount.toString(),
    fileUrl: body.fileUrl ?? null, fileOriginalName: body.fileOriginalName ?? null,
    vendorRemarks: body.vendorRemarks ?? null, internalNotes: body.internalNotes ?? null,
    isL1: body.isL1 ?? false, isRecommended: body.isRecommended ?? false,
    recommendationNotes: body.recommendationNotes ?? null,
    createdBy: userId, createdByName: userName,
    updatedBy: userId, updatedByName: userName,
  }).returning();

  if (calcItems.length > 0) {
    await db.insert(procQuotationItemsTable).values(
      calcItems.map((item: any) => ({
        quotationId: q.id, lineNo: item.lineNo, materialId: item.materialId ?? null,
        materialCode: item.materialCode ?? null, materialName: item.materialName,
        description: item.description ?? null, uom: item.uom ?? "Nos",
        hsnSacCode: item.hsnSacCode ?? null, brand: item.brand ?? null,
        qty: item.qty.toString(), unitPrice: item.unitPrice.toString(),
        discountPct: item.discountPct.toString(), discountAmount: item.discountAmount.toString(),
        taxableAmount: item.taxableAmount.toString(), gstRate: item.gstRate.toString(),
        cgstAmount: item.cgstAmount.toString(), sgstAmount: item.sgstAmount.toString(),
        igstAmount: "0", totalGst: item.totalGst.toString(), lineTotal: item.lineTotal.toString(),
        deliveryDays: item.deliveryDays ?? null, remarks: item.remarks ?? null,
      })),
    );
  }

  await db.insert(quotationVersionsTable).values({
    quotationId: q.id, version: 1,
    snapshot: { header: q, items: calcItems } as any,
    changedBy: userId, changedByName: userName, changeSummary: "Initial draft",
  });

  await logAudit(q.id, "Created", userName, userId, userRole, `Quotation ${referenceId} created`);
  const result = await loadFullQuotation(q.id);
  res.status(201).json(result);
});

// ── GET DETAIL ────────────────────────────────────────────────────────────────
router.get("/procurement-quotations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const result = await loadFullQuotation(id);
  if (!result) { res.status(404).json({ error: "Quotation not found" }); return; }
  res.json(result);
});

// ── UPDATE (Draft/RevisionRequested only — Approved is LOCKED 423) ────────────
router.patch("/procurement-quotations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Quotation not found" }); return; }

  // 🔒 Lock enforcement
  if (existing.status === "Approved") {
    res.status(423).json({
      error: "This quotation is locked after approval. Use the Reopen workflow to make changes.",
      locked: true, lockedAt: (existing as any).lockedAt?.toISOString() ?? null,
    });
    return;
  }
  if (!["Draft", "RevisionRequested"].includes(existing.status)) {
    res.status(403).json({ error: `Cannot edit quotation in ${existing.status} status` }); return;
  }

  const { items: itemsBody, userName = "System", userId, userRole, ...body } = req.body;
  const newVersion = existing.version + 1;
  const existingItems = await db.select().from(procQuotationItemsTable).where(eq(procQuotationItemsTable.quotationId, id));
  const itemsToCalc = itemsBody ?? existingItems;
  const { calcItems, subtotal, totalDiscount, totalGst } = calcTotals(itemsToCalc);
  const freight = Number(body.freightCharges ?? existing.freightCharges) || 0;
  const other = Number(body.otherCharges ?? existing.otherCharges) || 0;
  const totalAmount = parseFloat((subtotal - totalDiscount + totalGst + freight + other).toFixed(2));

  const [q] = await db.update(procurementQuotationsTable).set({
    ...body, version: newVersion, updatedAt: new Date(),
    updatedBy: userId, updatedByName: userName,
    subtotal: subtotal.toString(), totalDiscount: totalDiscount.toString(),
    totalGst: totalGst.toString(), totalAmount: totalAmount.toString(),
    freightCharges: freight.toString(), otherCharges: other.toString(),
  }).where(eq(procurementQuotationsTable.id, id)).returning();

  let insertedItems = existingItems;
  if (itemsBody) {
    await db.delete(procQuotationItemsTable).where(eq(procQuotationItemsTable.quotationId, id));
    if (calcItems.length > 0) {
      insertedItems = await db.insert(procQuotationItemsTable).values(
        calcItems.map((item: any) => ({
          quotationId: id, lineNo: item.lineNo, materialId: item.materialId ?? null,
          materialCode: item.materialCode ?? null, materialName: item.materialName,
          description: item.description ?? null, uom: item.uom ?? "Nos",
          hsnSacCode: item.hsnSacCode ?? null, brand: item.brand ?? null,
          qty: item.qty.toString(), unitPrice: item.unitPrice.toString(),
          discountPct: item.discountPct.toString(), discountAmount: item.discountAmount.toString(),
          taxableAmount: item.taxableAmount.toString(), gstRate: item.gstRate.toString(),
          cgstAmount: item.cgstAmount.toString(), sgstAmount: item.sgstAmount.toString(),
          igstAmount: "0", totalGst: item.totalGst.toString(), lineTotal: item.lineTotal.toString(),
          deliveryDays: item.deliveryDays ?? null, remarks: item.remarks ?? null,
        })),
      ).returning();
    }
  }

  await db.insert(quotationVersionsTable).values({
    quotationId: id, version: newVersion,
    snapshot: { header: q, items: insertedItems } as any,
    changedBy: userId, changedByName: userName, changeSummary: body.changeSummary ?? "Updated",
  });

  await logAudit(id, "Updated", userName, userId, userRole, body.changeSummary, { version: existing.version }, { version: newVersion, totalAmount });
  const result = await loadFullQuotation(id);
  res.json(result);
});

// ── DELETE (Draft only) ───────────────────────────────────────────────────────
router.delete("/procurement-quotations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [q] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  if (q.status !== "Draft") { res.status(403).json({ error: "Only Draft quotations can be deleted" }); return; }
  const { userName = "System", userId, userRole } = req.body;
  await logAudit(id, "Deleted", userName, userId, userRole, "Quotation deleted");
  await db.delete(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  res.json({ ok: true });
});

// ── SUBMIT ────────────────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/submit", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  const { userName = actor?.name ?? "System", userId = actor?.userId, userRole = actor?.role } = req.body;

  const [current] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!current) { res.status(404).json({ error: "Quotation not found" }); return; }

  if (current.status === "RevisionRequested") {
    const [revLog] = await db.select({ oldValues: quotationAuditLogsTable.oldValues })
      .from(quotationAuditLogsTable)
      .where(and(eq(quotationAuditLogsTable.quotationId, id), eq(quotationAuditLogsTable.action, "RevisionRequested" as any)))
      .orderBy(desc(quotationAuditLogsTable.createdAt)).limit(1);
    const revisionVersion = revLog?.oldValues ? (revLog.oldValues as any).version : null;
    if (revisionVersion !== null && (current.version ?? 1) <= revisionVersion) {
      res.status(400).json({ error: "Quotation has not been updated since the revision was requested. Please make the required changes before re-submitting." }); return;
    }
  }

  const [q] = await db.update(procurementQuotationsTable).set({
    status: "Submitted", submittedAt: new Date(), submittedBy: userId, submittedByName: userName, updatedAt: new Date(),
  }).where(and(
    eq(procurementQuotationsTable.id, id),
    inArray(procurementQuotationsTable.status, ["Draft", "RevisionRequested"]),
  )).returning();

  if (!q) {
    const [existing] = await db.select({ status: procurementQuotationsTable.status }).from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Quotation not found" }); return; }
    res.status(400).json({ error: `Quotation must be in Draft or RevisionRequested status (currently ${existing.status})` }); return;
  }

  // Create approval request — use JWT actor's userId for the FK (body userId may differ)
  const jwtUserId = actor?.userId ?? userId ?? 0;
  let approvalRequestId: number | null = null;
  try {
    approvalRequestId = await createApprovalRequest(id, q.referenceId, jwtUserId, userName);
    await db.update(procurementQuotationsTable)
      .set({ approvalRequestId } as any)
      .where(eq(procurementQuotationsTable.id, id));
  } catch (aprErr) {
    console.error("[Submit] Approval request creation failed (non-fatal):", aprErr);
  }

  await logAudit(id, "Submitted", userName, userId, userRole, `Submitted for approval (${q.referenceId})`);

  // Notify first-step approvers (PM + Director by default)
  const approverIds = await getUserIdsByRoles(["pm", "director", "admin"]);
  await emitNotifications(approverIds, {
    type: "info", title: "Quotation Awaiting Approval",
    message: `${q.referenceId} from ${q.vendorSnapshotName ?? "a vendor"} (${q.totalAmount ? `₹${Number(q.totalAmount).toLocaleString("en-IN")}` : ""}) has been submitted for your approval.`,
    entityId: id, entityRef: q.referenceId, actionUrl: `/procurement/quotations/${id}`,
  });

  const result = await loadFullQuotation(id);
  res.json(result);
});

// ── START REVIEW ──────────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/start-review", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  const { userName = actor?.name ?? "System", userId = actor?.userId, userRole = actor?.role, remarks } = req.body;
  const [existing] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "Submitted") {
    res.status(400).json({ error: `Cannot start review: quotation must be in Submitted status (currently ${existing.status})` }); return;
  }
  const [q] = await db.update(procurementQuotationsTable).set({
    status: "UnderReview", reviewedAt: new Date(), reviewedBy: userId, reviewedByName: userName, updatedAt: new Date(),
  }).where(eq(procurementQuotationsTable.id, id)).returning();
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  await logAudit(id, "ReviewStarted", userName, userId, userRole, remarks ?? "Review started");

  // Notify submitter
  await emitNotifications([existing.submittedBy], {
    type: "info", title: "Quotation Review Started",
    message: `${existing.referenceId} is now under review by ${userName}.`,
    entityId: id, entityRef: existing.referenceId, actionUrl: `/procurement/quotations/${id}`,
  });

  const result = await loadFullQuotation(id);
  res.json(result);
});

// ── REQUEST REVISION ──────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/request-revision", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  const { userName = actor?.name ?? "System", userId = actor?.userId, userRole = actor?.role, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Remarks are required for revision request" }); return; }

  const [q] = await db.update(procurementQuotationsTable).set({
    status: "RevisionRequested", approvalRemarks: remarks, updatedAt: new Date(),
  }).where(and(
    eq(procurementQuotationsTable.id, id),
    inArray(procurementQuotationsTable.status, ["Submitted", "UnderReview"]),
  )).returning();

  if (!q) {
    const [existing] = await db.select({ id: procurementQuotationsTable.id, status: procurementQuotationsTable.status, version: procurementQuotationsTable.version }).from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    res.status(400).json({ error: `Cannot request revision: must be Submitted or UnderReview (currently ${existing.status})` }); return;
  }

  // Recall the approval request
  if ((q as any).approvalRequestId) await syncApprovalRequest((q as any).approvalRequestId, "recalled", remarks, userId);

  await logAudit(id, "RevisionRequested", userName, userId, userRole, remarks, { version: q.version }, null);

  // Notify submitter
  await emitNotifications([q.submittedBy], {
    type: "warning", title: "Revision Required",
    message: `${q.referenceId}: ${userName} has requested revisions — "${remarks}"`,
    entityId: id, entityRef: q.referenceId, actionUrl: `/procurement/quotations/${id}`,
  });

  const result = await loadFullQuotation(id);
  res.json(result);
});

// ── APPROVE ───────────────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  const { userName = actor?.name ?? "System", userId = actor?.userId, userRole = actor?.role, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Approval remarks are required" }); return; }
  const [existing] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "UnderReview") {
    res.status(400).json({ error: `Cannot approve: must be UnderReview (currently ${existing.status})` }); return;
  }

  const items = await db.select().from(procQuotationItemsTable).where(eq(procQuotationItemsTable.quotationId, id)).orderBy(procQuotationItemsTable.lineNo);
  let vendor: typeof vendorsTable.$inferSelect | null = null;
  if (existing.vendorId) {
    const [v] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, existing.vendorId));
    vendor = v ?? null;
  }
  const year = new Date().getFullYear();
  const poNumber = `PO-${year}-${String(poProcCounter++).padStart(4, "0")}`;
  const today = new Date().toISOString().split("T")[0]!;
  const now = new Date();

  let qFresh: typeof procurementQuotationsTable.$inferSelect;
  let po: typeof procurementPOsTable.$inferSelect;
  try {
    [qFresh, po] = await db.transaction(async (tx) => {
      const [q] = await tx.update(procurementQuotationsTable).set({
        status: "Approved",
        approvedAt: now, approvedBy: userId, approvedByName: userName,
        approvalRemarks: remarks, updatedAt: now,
        lockedAt: now, lockedBy: userId,
      } as any).where(eq(procurementQuotationsTable.id, id)).returning();
      if (!q) throw new Error("Quotation not found");

      const [newPO] = await tx.insert(procurementPOsTable).values({
        poNumber, quotationId: id, vendorId: existing.vendorId,
        vendorName: existing.vendorSnapshotName ?? vendor?.name ?? "Unknown",
        vendorGstin: vendor?.gstin ?? null, vendorAddress: vendor?.billingAddress ?? null,
        vendorContact: vendor?.primaryPhone ?? null,
        status: "Draft", poDate: today,
        paymentTerms: existing.paymentTerms, warrantyMonths: existing.warrantyMonths,
        freightCharges: existing.freightCharges, otherCharges: existing.otherCharges,
        subtotal: existing.subtotal, totalGst: existing.totalGst, totalAmount: existing.totalAmount,
        approvedBy: userId, approvedByName: userName, approvedAt: now,
        createdBy: userId, createdByName: userName,
      }).returning();

      if (items.length > 0) {
        await tx.insert(procPOItemsTable).values(items.map(item => ({
          poId: newPO.id, lineNo: item.lineNo, materialId: item.materialId,
          materialCode: item.materialCode, materialName: item.materialName, description: item.description,
          uom: item.uom, hsnSacCode: item.hsnSacCode, brand: item.brand,
          qty: item.qty, unitPrice: item.unitPrice, discountPct: item.discountPct,
          discountAmount: item.discountAmount, taxableAmount: item.taxableAmount,
          gstRate: item.gstRate, totalGst: item.totalGst, lineTotal: item.lineTotal,
        })));
      }

      const [qUpdated] = await tx.update(procurementQuotationsTable)
        .set({ poGenerated: true })
        .where(eq(procurementQuotationsTable.id, id))
        .returning();

      return [qUpdated ?? q, newPO];
    });
  } catch (err: any) {
    res.status(500).json({ error: `Approval failed: ${err?.message ?? "PO generation error"}. No changes saved. Please try again.` }); return;
  }

  // Sync approval request
  if ((existing as any).approvalRequestId) {
    await syncApprovalRequest((existing as any).approvalRequestId, "approved", remarks, userId);
  }

  await logAudit(id, "Approved", userName, userId, userRole, remarks, null, { status: "Approved" });
  await logAudit(id, "POGenerated", userName, userId, userRole, `PO ${poNumber} generated`);

  // Notify submitter + all procurement staff
  const notifyIds = [qFresh.submittedBy, ...(await getUserIdsByRoles(["pm", "director"]))];
  await emitNotifications(notifyIds, {
    type: "success", title: "Quotation Approved & PO Generated",
    message: `${qFresh.referenceId} approved by ${userName}. PO ${poNumber} has been generated automatically.`,
    entityId: id, entityRef: qFresh.referenceId, actionUrl: `/procurement/quotations/${id}`,
  });

  const [auditLogs, versions, attachments] = await Promise.all([
    db.select().from(quotationAuditLogsTable).where(eq(quotationAuditLogsTable.quotationId, id)).orderBy(desc(quotationAuditLogsTable.createdAt)),
    db.select().from(quotationVersionsTable).where(eq(quotationVersionsTable.quotationId, id)).orderBy(desc(quotationVersionsTable.version)),
    db.select().from(quotationAttachmentsTable).where(eq(quotationAttachmentsTable.quotationId, id)).orderBy(desc(quotationAttachmentsTable.uploadedAt)),
  ]);
  const approvalRequest = await getApprovalRequestForQuotation((qFresh as any).approvalRequestId ?? null);
  res.json({
    quotation: fmtQ(qFresh, items.map(fmtItem), versions, auditLogs.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })), attachments.map(a => ({ ...a, uploadedAt: a.uploadedAt.toISOString() })), approvalRequest),
    po: { ...po, createdAt: po.createdAt.toISOString() },
  });
});

// ── REJECT ────────────────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/reject", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  const { userName = actor?.name ?? "System", userId = actor?.userId, userRole = actor?.role, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Rejection remarks are mandatory" }); return; }
  const [existing] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!["Submitted", "UnderReview"].includes(existing.status ?? "")) {
    res.status(400).json({ error: `Cannot reject: must be Submitted or UnderReview (currently ${existing.status})` }); return;
  }
  const [q] = await db.update(procurementQuotationsTable).set({
    status: "Rejected", rejectedAt: new Date(), rejectedBy: userId, rejectedByName: userName,
    approvalRemarks: remarks, updatedAt: new Date(),
  }).where(eq(procurementQuotationsTable.id, id)).returning();
  if (!q) { res.status(404).json({ error: "Not found" }); return; }

  if ((existing as any).approvalRequestId) await syncApprovalRequest((existing as any).approvalRequestId, "rejected", remarks, userId);

  await logAudit(id, "Rejected", userName, userId, userRole, remarks, null, { status: "Rejected" });

  // Notify submitter
  await emitNotifications([existing.submittedBy], {
    type: "error", title: "Quotation Rejected",
    message: `${existing.referenceId} was rejected by ${userName}: "${remarks}"`,
    entityId: id, entityRef: existing.referenceId, actionUrl: `/procurement/quotations/${id}`,
  });

  const result = await loadFullQuotation(id);
  res.json(result);
});

// ── CANCEL ────────────────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/cancel", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  const { userName = actor?.name ?? "System", userId = actor?.userId, userRole = actor?.role, remarks } = req.body;
  const [existing] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (["Approved", "Rejected"].includes(existing.status ?? "")) {
    res.status(400).json({ error: `Cannot cancel a ${existing.status} quotation` }); return;
  }
  const [q] = await db.update(procurementQuotationsTable).set({
    status: "Rejected", rejectedAt: new Date(), rejectedBy: userId, rejectedByName: userName,
    approvalRemarks: remarks ?? "Cancelled", updatedAt: new Date(),
  }).where(eq(procurementQuotationsTable.id, id)).returning();

  if ((existing as any).approvalRequestId) await syncApprovalRequest((existing as any).approvalRequestId, "rejected", remarks ?? "Cancelled", userId);
  await logAudit(id, "Cancelled", userName, userId, userRole, remarks ?? "Cancelled");

  const result = await loadFullQuotation(id);
  res.json(result);
});

// ── REOPEN (admin/director only) ──────────────────────────────────────────────
router.post("/procurement-quotations/:id/reopen", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!["admin", "director"].includes(actor.role)) {
    res.status(403).json({ error: "Only Admin or Director can reopen an approved quotation" }); return;
  }
  const id = Number(req.params.id);
  const { reason, userName = actor.name ?? "System" } = req.body;
  if (!reason?.trim()) { res.status(400).json({ error: "Reopen reason is required" }); return; }

  const [existing] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "Approved") {
    res.status(400).json({ error: `Can only reopen Approved quotations (currently ${existing.status})` }); return;
  }

  const newVersion = existing.version + 1;
  const [q] = await db.update(procurementQuotationsTable).set({
    status: "RevisionRequested",
    version: newVersion,
    lockedAt: null, lockedBy: null,
    reopenedAt: new Date(), reopenedBy: actor.userId,
    reopenReason: reason,
    approvalRemarks: `Reopened: ${reason}`,
    approvalRequestId: null,
    updatedAt: new Date(),
  } as any).where(eq(procurementQuotationsTable.id, id)).returning();

  await db.insert(quotationVersionsTable).values({
    quotationId: id, version: newVersion,
    snapshot: { header: q, items: [] } as any,
    changedBy: actor.userId, changedByName: userName, changeSummary: `Reopened: ${reason}`,
  });

  await logAudit(id, "Reopened", userName, actor.userId, actor.role, reason, { status: "Approved" }, { status: "RevisionRequested" });

  // Notify submitter + procurement team
  const notifyIds = [existing.submittedBy, ...(await getUserIdsByRoles(["pm", "admin"]))];
  await emitNotifications(notifyIds, {
    type: "warning", title: "Quotation Reopened",
    message: `${existing.referenceId} has been reopened by ${userName}. Reason: "${reason}"`,
    entityId: id, entityRef: existing.referenceId, actionUrl: `/procurement/quotations/${id}`,
  });

  const result = await loadFullQuotation(id);
  res.json(result);
});

// ── ADD COMMENT ───────────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/comment", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  const { userName = actor?.name ?? "System", userId = actor?.userId, userRole = actor?.role, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Comment text is required" }); return; }
  await logAudit(id, "CommentAdded", userName, userId, userRole, remarks);
  const logs = await db.select().from(quotationAuditLogsTable).where(eq(quotationAuditLogsTable.quotationId, id)).orderBy(desc(quotationAuditLogsTable.createdAt));
  res.json({ ok: true, logs: logs.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })) });
});

// ── ATTACHMENT: Request upload URL ────────────────────────────────────────────
router.post("/procurement-quotations/:id/attachments/request-url", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [existing] = await db.select({ id: procurementQuotationsTable.id, status: procurementQuotationsTable.status })
    .from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "Approved") {
    res.status(423).json({ error: "Cannot add attachments to a locked quotation. Reopen first." }); return;
  }
  try {
    const uploadURL = await storage.getObjectEntityUploadURL();
    res.json({ uploadURL });
  } catch (err: any) {
    res.status(500).json({ error: `Storage error: ${err?.message}` });
  }
});

// ── ATTACHMENT: Register after client upload ──────────────────────────────────
router.post("/procurement-quotations/:id/attachments", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = getActor(req);
  const { objectPath, fileName, fileSize, mimeType, userName = actor?.name ?? "System", userId = actor?.userId } = req.body;
  if (!objectPath || !fileName) { res.status(400).json({ error: "objectPath and fileName required" }); return; }

  const [existing] = await db.select({ status: procurementQuotationsTable.status, referenceId: procurementQuotationsTable.referenceId })
    .from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const normalizedPath = storage.normalizeObjectEntityPath(objectPath);
  const [att] = await db.insert(quotationAttachmentsTable).values({
    quotationId: id, fileName, objectPath: normalizedPath,
    fileSize: fileSize ? Number(fileSize) : null,
    mimeType: mimeType ?? null,
    uploadedBy: userId ? Number(userId) : null,
    uploadedByName: userName,
  }).returning();

  await logAudit(id, "AttachmentAdded", userName, userId ? Number(userId) : undefined, undefined, `Attached: ${fileName}`);
  res.status(201).json({ ...att, uploadedAt: att.uploadedAt.toISOString() });
});

// ── ATTACHMENT: Delete ────────────────────────────────────────────────────────
router.delete("/procurement-quotations/:id/attachments/:attachmentId", async (req, res): Promise<void> => {
  const quotationId = Number(req.params.id);
  const attachmentId = Number(req.params.attachmentId);
  const actor = getActor(req);
  const { userName = actor?.name ?? "System", userId = actor?.userId } = req.body;

  const [att] = await db.select().from(quotationAttachmentsTable)
    .where(and(eq(quotationAttachmentsTable.id, attachmentId), eq(quotationAttachmentsTable.quotationId, quotationId)));
  if (!att) { res.status(404).json({ error: "Attachment not found" }); return; }

  // Only uploader, admin or director can delete
  if (att.uploadedBy !== (userId ? Number(userId) : -1) && !["admin", "director"].includes(actor?.role ?? "")) {
    res.status(403).json({ error: "Only the uploader, Admin, or Director can delete attachments" }); return;
  }

  await db.delete(quotationAttachmentsTable).where(eq(quotationAttachmentsTable.id, attachmentId));
  await logAudit(quotationId, "AttachmentRemoved", userName ?? "System", userId ? Number(userId) : undefined, undefined, `Removed: ${att.fileName}`);
  res.json({ ok: true });
});

// ── SERVE ATTACHMENT ──────────────────────────────────────────────────────────
router.get("/procurement-quotations/:id/attachments/:attachmentId/download", async (req, res): Promise<void> => {
  const quotationId = Number(req.params.id);
  const attachmentId = Number(req.params.attachmentId);
  const [att] = await db.select().from(quotationAttachmentsTable)
    .where(and(eq(quotationAttachmentsTable.id, attachmentId), eq(quotationAttachmentsTable.quotationId, quotationId)));
  if (!att) { res.status(404).json({ error: "Not found" }); return; }
  try {
    const file = await storage.getObjectEntityFile(att.objectPath);
    const response = await storage.downloadObject(file);
    res.setHeader("Content-Disposition", `attachment; filename="${att.fileName}"`);
    if (att.mimeType) res.setHeader("Content-Type", att.mimeType);
    const buf = await response.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (err: any) {
    res.status(500).json({ error: `Download failed: ${err?.message}` });
  }
});

// ── L1 COMPARISON (all quotations for an MR) ──────────────────────────────────
router.get("/material-requests/:id/quotation-comparison", async (req, res): Promise<void> => {
  const mrId = Number(req.params.id);
  const quotations = await db.select().from(procurementQuotationsTable)
    .where(eq(procurementQuotationsTable.mrId, mrId))
    .orderBy(procurementQuotationsTable.totalAmount);

  if (quotations.length === 0) { res.json({ quotations: [], l1VendorId: null, l1ReferenceId: null }); return; }

  const allItems = await Promise.all(
    quotations.map(q => db.select().from(procQuotationItemsTable)
      .where(eq(procQuotationItemsTable.quotationId, q.id))
      .orderBy(procQuotationItemsTable.lineNo)),
  );

  const allMaterialNames = [...new Set(allItems.flat().map(i => i.materialName))];
  const materialLowest: Record<string, number> = {};
  allMaterialNames.forEach(name => {
    const prices = allItems.flat().filter(i => i.materialName === name).map(i => Number(i.unitPrice));
    materialLowest[name] = Math.min(...prices);
  });

  const eligible = quotations.filter(q => q.status !== "Rejected");
  const l1 = eligible[0];

  const comparison = quotations.map((q, idx) => ({
    ...fmtQ(q, allItems[idx]!.map(fmtItem)),
    isL1Candidate: l1 ? q.id === l1.id : false,
    items: allItems[idx]!.map(fmtItem).map(item => ({
      ...item,
      isLowest: Math.abs((item.unitPrice ?? 0) - (materialLowest[item.materialName] ?? 0)) < 0.01,
      lowestPrice: materialLowest[item.materialName] ?? null,
    })),
  }));

  res.json({
    quotations: comparison, materialNames: allMaterialNames, materialLowest,
    l1VendorId: l1?.vendorId ?? null, l1ReferenceId: l1?.referenceId ?? null,
    l1Amount: l1 ? n(l1.totalAmount) : null,
  });
});

export default router;
