import { Router, type IRouter } from "express";
import {
  db, procInvoicesTable, procInvoiceItemsTable, procInvoiceAuditLogsTable,
  procurementPOsTable, procPOItemsTable, procGRNsTable, procGRNItemsTable,
  invoiceCommentsTable, invoicePaymentsTable, notificationsTable, procurementQuotationsTable,
} from "@workspace/db";
import { eq, desc, and, sql, or, gte, lte, ilike } from "drizzle-orm";
import { requireAuth, requirePermission } from "../lib/rbac";
import pg from "pg";

const router: IRouter = Router();

let invCounter = 1;
(async () => {
  const r = await db.select().from(procInvoicesTable).orderBy(desc(procInvoicesTable.id)).limit(1);
  if (r.length > 0) invCounter = r[0].id + 1;
})();

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

function calcAgingDays(dueDate: string | null | undefined, status: string): number | null {
  if (!dueDate || ["Paid", "Cancelled"].includes(status)) return null;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due.getTime()) / 86400000);
  return diff;
}

function fmtInvoice(inv: typeof procInvoicesTable.$inferSelect, items: any[] = [], auditLogs: any[] = [], comments: any[] = [], payments: any[] = []) {
  const agingDays = calcAgingDays(inv.dueDate, inv.status);
  return {
    id: inv.id, invoiceNumber: inv.invoiceNumber, invoiceType: inv.invoiceType,
    poId: inv.poId, grnId: inv.grnId, vendorId: inv.vendorId, vendorName: inv.vendorName,
    vendorInvoiceNumber: inv.vendorInvoiceNumber, vendorInvoiceDate: inv.vendorInvoiceDate,
    status: inv.status, isLocked: inv.isLocked,
    revisionNumber: inv.revisionNumber, originalInvoiceId: inv.originalInvoiceId,
    linkedCreditNoteId: inv.linkedCreditNoteId, linkedDebitNoteId: inv.linkedDebitNoteId,
    matchStatus: inv.matchStatus, mismatchDetails: inv.mismatchDetails,
    mismatchApprovedBy: inv.mismatchApprovedBy, mismatchApprovedByName: inv.mismatchApprovedByName,
    mismatchApprovedAt: inv.mismatchApprovedAt?.toISOString(),
    subtotal: n(inv.subtotal), totalGst: n(inv.totalGst),
    freightCharges: n(inv.freightCharges), otherCharges: n(inv.otherCharges),
    discountAmount: n(inv.discountAmount),
    totalAmount: n(inv.totalAmount), tdsAmount: n(inv.tdsAmount),
    netPayable: n(inv.netPayable), paidAmount: n(inv.paidAmount),
    paymentTerms: inv.paymentTerms, paymentTermsDays: inv.paymentTermsDays, dueDate: inv.dueDate,
    bankName: inv.bankName, bankAccount: inv.bankAccount, bankIfsc: inv.bankIfsc, bankBranch: inv.bankBranch,
    isDuplicateFlagged: inv.isDuplicateFlagged, duplicateOfId: inv.duplicateOfId,
    attachmentUrls: inv.attachmentUrls ?? [],
    agingDays,
    submittedAt: inv.submittedAt?.toISOString(), submittedBy: inv.submittedBy, submittedByName: inv.submittedByName,
    approvedBy: inv.approvedBy, approvedByName: inv.approvedByName, approvedAt: inv.approvedAt?.toISOString(),
    rejectedBy: inv.rejectedBy, rejectedByName: inv.rejectedByName, rejectedAt: inv.rejectedAt?.toISOString(),
    approvalRemarks: inv.approvalRemarks,
    paidAt: inv.paidAt?.toISOString(), paidBy: inv.paidBy, paidByName: inv.paidByName,
    paymentReference: inv.paymentReference, paymentMode: inv.paymentMode,
    heldReason: inv.heldReason, heldAt: inv.heldAt?.toISOString(), heldBy: inv.heldBy, heldByName: inv.heldByName,
    holdReleasedAt: inv.holdReleasedAt?.toISOString(), holdReleasedByName: inv.holdReleasedByName,
    disputeReason: inv.disputeReason, disputedAt: inv.disputedAt?.toISOString(),
    disputedBy: inv.disputedBy, disputedByName: inv.disputedByName,
    disputeResolution: inv.disputeResolution, disputeResolvedAt: inv.disputeResolvedAt?.toISOString(),
    disputeResolvedByName: inv.disputeResolvedByName,
    cancelledAt: inv.cancelledAt?.toISOString(), cancelledBy: inv.cancelledBy,
    cancelledByName: inv.cancelledByName, cancellationReason: inv.cancellationReason,
    internalNotes: inv.internalNotes, createdBy: inv.createdBy, createdByName: inv.createdByName,
    createdAt: inv.createdAt.toISOString(), updatedAt: inv.updatedAt.toISOString(),
    items: items.map(i => ({
      id: i.id, invoiceId: i.invoiceId, poItemId: i.poItemId, grnItemId: i.grnItemId,
      lineNo: i.lineNo, materialName: i.materialName, materialCode: i.materialCode,
      uom: i.uom, hsnSacCode: i.hsnSacCode,
      orderedQty: n(i.orderedQty), receivedQty: n(i.receivedQty), invoicedQty: n(i.invoicedQty),
      unitPrice: n(i.unitPrice), discountPct: n(i.discountPct), discountAmount: n(i.discountAmount),
      taxableAmount: n(i.taxableAmount), gstRate: n(i.gstRate), gstAmount: n(i.gstAmount),
      cgstRate: n(i.cgstRate), sgstRate: n(i.sgstRate), igstRate: n(i.igstRate),
      lineTotal: n(i.lineTotal), isMatched: i.isMatched, mismatchNote: i.mismatchNote,
    })),
    auditLogs: auditLogs.map(a => ({
      id: a.id, invoiceId: a.invoiceId, action: a.action,
      performedBy: a.performedBy, performedByName: a.performedByName,
      remarks: a.remarks, oldValues: a.oldValues, newValues: a.newValues,
      createdAt: a.createdAt.toISOString(),
    })),
    comments: comments.map(c => ({
      id: c.id, invoiceId: c.invoiceId, parentId: c.parentId,
      userId: c.userId, userName: c.userName, userRole: c.userRole,
      body: c.body, createdAt: c.createdAt.toISOString(),
    })),
    payments: payments.map(p => ({
      id: p.id, invoiceId: p.invoiceId, amount: n(p.amount),
      paymentReference: p.paymentReference, paymentMode: p.paymentMode,
      paymentDate: p.paymentDate, bankName: p.bankName, utrNumber: p.utrNumber,
      notes: p.notes, paidBy: p.paidBy, paidByName: p.paidByName,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

async function logAudit(invoiceId: number, action: string, performedByName: string, performedBy?: number, remarks?: string, oldValues?: any, newValues?: any) {
  await db.insert(procInvoiceAuditLogsTable).values({
    invoiceId, action, performedBy, performedByName, remarks,
    oldValues: oldValues ?? null, newValues: newValues ?? null,
  });
}

async function notifyUser(userId: number, title: string, message: string, entityRef: string, entityId: number, actionUrl: string, type: "info" | "success" | "warning" | "error" | "approval" = "info") {
  try {
    await db.insert(notificationsTable).values({ userId, type, title, message, entityType: "invoice", entityId, entityRef, actionUrl, isRead: false });
  } catch { /* non-fatal */ }
}

async function notifyRole(roles: string[], title: string, message: string, entityRef: string, entityId: number, actionUrl: string, type: "info" | "success" | "warning" | "error" | "approval" = "info") {
  try {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const placeholders = roles.map((_, i) => `$${i + 1}`).join(",");
      const result = await client.query(`SELECT id FROM users WHERE role IN (${placeholders}) LIMIT 30`, roles);
      for (const row of result.rows) {
        await db.insert(notificationsTable).values({ userId: row.id, type, title, message, entityType: "invoice", entityId, entityRef, actionUrl, isRead: false });
      }
    } finally { await client.end(); }
  } catch { /* non-fatal */ }
}

// ── STATS ─────────────────────────────────────────────────────────────────────
router.get("/proc-invoices/stats", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1); thisMonthStart.setHours(0, 0, 0, 0);

  const [all, pending, overdue, mismatched, paidThisMonth] = await Promise.all([
    db.select({
      total: sql<number>`COUNT(*)`,
      totalNetPayable: sql<number>`COALESCE(SUM(net_payable),0)`,
      totalPaid: sql<number>`COALESCE(SUM(paid_amount),0)`,
    }).from(procInvoicesTable).where(sql`status NOT IN ('Cancelled','Revised')`),

    db.select({ count: sql<number>`COUNT(*)`, amount: sql<number>`COALESCE(SUM(net_payable - COALESCE(paid_amount,0)),0)` })
      .from(procInvoicesTable)
      .where(sql`status IN ('Draft','PendingApproval','Approved','PartiallyPaid','OnHold','Disputed')`),

    db.select({ count: sql<number>`COUNT(*)`, amount: sql<number>`COALESCE(SUM(net_payable - COALESCE(paid_amount,0)),0)` })
      .from(procInvoicesTable)
      .where(and(
        sql`status IN ('Approved','PartiallyPaid')`,
        sql`due_date IS NOT NULL AND due_date < ${today}`
      )),

    db.select({ count: sql<number>`COUNT(*)` })
      .from(procInvoicesTable).where(eq(procInvoicesTable.matchStatus, "MismatchPending")),

    db.select({ count: sql<number>`COUNT(*)`, amount: sql<number>`COALESCE(SUM(paid_amount),0)` })
      .from(procInvoicesTable)
      .where(and(
        sql`status IN ('Paid','PartiallyPaid')`,
        gte(procInvoicesTable.paidAt, thisMonthStart)
      )),
  ]);

  res.json({
    total: Number(all[0]?.total ?? 0),
    totalNetPayable: Number(all[0]?.totalNetPayable ?? 0),
    outstanding: { count: Number(pending[0]?.count ?? 0), amount: Number(pending[0]?.amount ?? 0) },
    overdue: { count: Number(overdue[0]?.count ?? 0), amount: Number(overdue[0]?.amount ?? 0) },
    mismatched: Number(mismatched[0]?.count ?? 0),
    paidThisMonth: { count: Number(paidThisMonth[0]?.count ?? 0), amount: Number(paidThisMonth[0]?.amount ?? 0) },
  });
});

// ── LIST ─────────────────────────────────────────────────────────────────────
router.get("/proc-invoices", async (req, res): Promise<void> => {
  let query = db.select().from(procInvoicesTable).orderBy(desc(procInvoicesTable.createdAt)).$dynamic();
  if (req.query.poId) query = query.where(eq(procInvoicesTable.poId, Number(req.query.poId)));
  if (req.query.grnId) query = query.where(eq(procInvoicesTable.grnId, Number(req.query.grnId)));
  if (req.query.status) query = query.where(eq(procInvoicesTable.status, req.query.status as any));
  if (req.query.vendorId) query = query.where(eq(procInvoicesTable.vendorId, Number(req.query.vendorId)));
  if (req.query.invoiceType) query = query.where(eq(procInvoicesTable.invoiceType, req.query.invoiceType as any));
  if (req.query.matchStatus) query = query.where(eq(procInvoicesTable.matchStatus, req.query.matchStatus as any));
  if (req.query.isDuplicateFlagged) query = query.where(eq(procInvoicesTable.isDuplicateFlagged, true));
  const rows = await query;
  res.json(rows.map(r => fmtInvoice(r)));
});

// ── GET SINGLE ────────────────────────────────────────────────────────────────
router.get("/proc-invoices/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [inv] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  const [items, auditLogs, comments, payments] = await Promise.all([
    db.select().from(procInvoiceItemsTable).where(eq(procInvoiceItemsTable.invoiceId, id)).orderBy(procInvoiceItemsTable.lineNo),
    db.select().from(procInvoiceAuditLogsTable).where(eq(procInvoiceAuditLogsTable.invoiceId, id)).orderBy(desc(procInvoiceAuditLogsTable.createdAt)),
    db.select().from(invoiceCommentsTable).where(eq(invoiceCommentsTable.invoiceId, id)).orderBy(invoiceCommentsTable.createdAt),
    db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, id)).orderBy(desc(invoicePaymentsTable.createdAt)),
  ]);
  // Back-link: resolve quotation from the linked PO
  let quotationId: number | null = null;
  let quotationRef: string | null = null;
  let projectId: number | null = null;
  if (inv.poId) {
    const [po] = await db.select({ qId: procurementPOsTable.quotationId, projId: procurementPOsTable.projectId })
      .from(procurementPOsTable).where(eq(procurementPOsTable.id, inv.poId));
    if (po?.qId) {
      quotationId = po.qId;
      const [quot] = await db.select({ referenceId: procurementQuotationsTable.referenceId })
        .from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, po.qId));
      quotationRef = quot?.referenceId ?? null;
    }
    if (po?.projId) projectId = po.projId;
  }
  res.json({ ...fmtInvoice(inv, items, auditLogs, comments, payments), quotationId, quotationRef, projectId });
});

// ── CREATE (with 3-way match + duplicate detection) ───────────────────────────
router.post("/proc-invoices", requirePermission("procurement", "create"), async (req, res): Promise<void> => {
  const { poId, grnId, items: itemsBody = [], userName = "System", userId, invoiceType = "Standard", ...body } = req.body;

  const [po] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, Number(poId)));
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }

  // Duplicate invoice detection — same vendor + same vendor invoice number
  let isDuplicateFlagged = false;
  let duplicateOfId: number | null = null;
  if (body.vendorInvoiceNumber) {
    const existing = await db.select({ id: procInvoicesTable.id })
      .from(procInvoicesTable)
      .where(and(
        eq(procInvoicesTable.vendorInvoiceNumber, body.vendorInvoiceNumber),
        po.vendorId ? eq(procInvoicesTable.vendorId, po.vendorId) : sql`1=1`,
        sql`status NOT IN ('Cancelled','Revised')`
      )).limit(1);
    if (existing.length > 0) {
      isDuplicateFlagged = true;
      duplicateOfId = existing[0].id;
    }
  }

  // 3-way match
  const poItems = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, Number(poId))).orderBy(procPOItemsTable.lineNo);
  let grnItems: any[] = [];
  if (grnId) {
    const [grn] = await db.select().from(procGRNsTable).where(eq(procGRNsTable.id, Number(grnId)));
    if (!grn || !["Accepted", "PartiallyAccepted"].includes(grn.status)) {
      res.status(400).json({ error: "GRN must be Accepted or PartiallyAccepted to create an invoice" }); return;
    }
    grnItems = await db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, Number(grnId))).orderBy(procGRNItemsTable.lineNo);
  }

  let hasMismatch = false;
  const mismatchLines: string[] = [];
  let subtotal = 0, totalGst = 0;

  const calcItems = (itemsBody.length > 0 ? itemsBody : poItems).map((item: any, idx: number) => {
    const poItem = poItems[idx] ?? poItems.find((p: any) => p.materialName === item.materialName);
    const grnItem = grnItems.find((g: any) => g.poItemId === (poItem?.id ?? null) || g.materialName === (poItem?.materialName ?? item.materialName));

    const orderedQty = n(poItem?.qty) ?? 0;
    const receivedQty = n(grnItem?.acceptedQty) ?? 0;
    const invoicedQty = Number(item.invoicedQty ?? item.qty ?? (grnId ? receivedQty : orderedQty));
    const unitPrice = Number(item.unitPrice ?? poItem?.unitPrice ?? 0);
    const discountPct = Number(item.discountPct ?? poItem?.discountPct ?? 0);
    const gstRate = Number(item.gstRate ?? poItem?.gstRate ?? 18);
    const discountAmount = parseFloat((invoicedQty * unitPrice * discountPct / 100).toFixed(2));
    const taxableAmount = parseFloat((invoicedQty * unitPrice * (1 - discountPct / 100)).toFixed(2));
    const gstAmount = parseFloat((taxableAmount * gstRate / 100).toFixed(2));
    const lineTotal = parseFloat((taxableAmount + gstAmount).toFixed(2));
    subtotal += taxableAmount;
    totalGst += gstAmount;

    const isMatched = grnId
      ? Math.abs(invoicedQty - receivedQty) < 0.001
      : invoicedQty <= orderedQty;
    if (!isMatched) {
      hasMismatch = true;
      mismatchLines.push(`${item.materialName ?? poItem?.materialName}: ordered ${orderedQty}, received ${receivedQty}, invoiced ${invoicedQty}`);
    }

    return {
      poItemId: poItem?.id ?? null, grnItemId: grnItem?.id ?? null,
      lineNo: idx + 1, materialName: item.materialName ?? poItem?.materialName ?? "",
      materialCode: item.materialCode ?? poItem?.materialCode ?? null,
      uom: item.uom ?? poItem?.uom ?? "Nos", hsnSacCode: item.hsnSacCode ?? poItem?.hsnSacCode ?? null,
      orderedQty: orderedQty.toString(), receivedQty: receivedQty.toString(),
      invoicedQty: invoicedQty.toString(), unitPrice: unitPrice.toString(),
      discountPct: discountPct.toString(), discountAmount: discountAmount.toString(),
      taxableAmount: taxableAmount.toString(), gstRate: gstRate.toString(),
      cgstRate: (gstRate / 2).toString(), sgstRate: (gstRate / 2).toString(), igstRate: "0",
      gstAmount: gstAmount.toString(), lineTotal: lineTotal.toString(),
      isMatched, mismatchNote: isMatched ? null : `Expected ${receivedQty}, got ${invoicedQty}`,
    };
  });

  const freight = Number(body.freightCharges) || 0;
  const other = Number(body.otherCharges) || 0;
  const discount = Number(body.discountAmount) || 0;
  const tds = Number(body.tdsAmount) || 0;
  const totalAmount = parseFloat((subtotal + totalGst + freight + other - discount).toFixed(2));
  const netPayable = parseFloat((totalAmount - tds).toFixed(2));

  // Auto-calculate due date from payment terms days
  let dueDate = body.dueDate;
  if (!dueDate && body.paymentTermsDays && body.vendorInvoiceDate) {
    const d = new Date(body.vendorInvoiceDate);
    d.setDate(d.getDate() + Number(body.paymentTermsDays));
    dueDate = d.toISOString().slice(0, 10);
  }

  const year = new Date().getFullYear();
  const invoiceNumber = `INV-${year}-${String(invCounter++).padStart(4, "0")}`;

  const [inv] = await db.insert(procInvoicesTable).values({
    invoiceNumber, invoiceType: invoiceType as any,
    poId: Number(poId), grnId: grnId ? Number(grnId) : null,
    vendorId: po.vendorId, vendorName: po.vendorName,
    matchStatus: hasMismatch ? "MismatchPending" : "Matched",
    mismatchDetails: hasMismatch ? mismatchLines.join("; ") : null,
    subtotal: subtotal.toString(), totalGst: totalGst.toString(),
    freightCharges: freight.toString(), otherCharges: other.toString(),
    discountAmount: discount.toString(),
    totalAmount: totalAmount.toString(), tdsAmount: tds.toString(), netPayable: netPayable.toString(),
    paidAmount: "0",
    vendorInvoiceNumber: body.vendorInvoiceNumber ?? null,
    vendorInvoiceDate: body.vendorInvoiceDate ?? null,
    paymentTerms: body.paymentTerms ?? po.paymentTerms,
    paymentTermsDays: body.paymentTermsDays ? Number(body.paymentTermsDays) : null,
    dueDate: dueDate ?? null,
    bankName: body.bankName ?? null, bankAccount: body.bankAccount ?? null,
    bankIfsc: body.bankIfsc ?? null, bankBranch: body.bankBranch ?? null,
    isDuplicateFlagged, duplicateOfId,
    internalNotes: body.internalNotes ?? null,
    createdBy: userId, createdByName: userName,
  }).returning();

  const insertedItems = await db.insert(procInvoiceItemsTable).values(
    calcItems.map((i: any) => ({ ...i, invoiceId: inv.id }))
  ).returning();

  const msg = isDuplicateFlagged
    ? `Invoice created — DUPLICATE FLAG: same vendor invoice # already exists (ref: #${duplicateOfId})`
    : hasMismatch
      ? `Invoice created with mismatches: ${mismatchLines.join("; ")}`
      : "Invoice created — 3-way match passed";

  await logAudit(inv.id, "Created", userName, userId, msg);

  if (isDuplicateFlagged) {
    notifyRole(["admin", "approver"], `Duplicate Invoice Flag — ${invoiceNumber}`,
      `Invoice ${invoiceNumber} may be a duplicate of INV #${duplicateOfId} for vendor ${po.vendorName}. Please review.`,
      invoiceNumber, inv.id, `/procurement/invoices/${inv.id}`, "warning");
  }

  res.status(201).json(fmtInvoice(inv, insertedItems, []));
});

// ── SUBMIT FOR APPROVAL ────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/submit", requirePermission("procurement", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, remarks } = req.body;
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (!["Draft", "OnHold"].includes(existing.status)) { res.status(400).json({ error: `Invoice must be in Draft or OnHold to submit (current: ${existing.status})` }); return; }
  if (existing.matchStatus === "MismatchPending" && !existing.mismatchApprovedAt) {
    res.status(400).json({ error: "Mismatch must be approved before submitting this invoice" }); return;
  }
  const [inv] = await db.update(procInvoicesTable).set({
    status: "PendingApproval", submittedAt: new Date(), submittedBy: userId, submittedByName: userName, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "Submitted", userName, userId, remarks ?? "Submitted for approval");
  notifyRole(["admin", "approver"], `Invoice Approval Required — ${existing.invoiceNumber}`,
    `Invoice ${existing.invoiceNumber} (${existing.vendorName}) for ₹${n(existing.netPayable)?.toLocaleString("en-IN")} has been submitted for approval by ${userName}.`,
    existing.invoiceNumber, id, `/procurement/invoices/${id}`, "approval");
  res.json(fmtInvoice(inv));
});

// ── APPROVE MISMATCH ───────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/approve-mismatch", requirePermission("procurement", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Remarks required to approve a mismatch" }); return; }
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.matchStatus !== "MismatchPending") { res.status(400).json({ error: "Invoice has no pending mismatch" }); return; }
  const [inv] = await db.update(procInvoicesTable).set({
    matchStatus: "MismatchApproved", mismatchApprovedBy: userId, mismatchApprovedByName: userName,
    mismatchApprovedAt: new Date(), updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "MismatchApproved", userName, userId, remarks);
  if (existing.createdBy) notifyUser(existing.createdBy, `Mismatch Approved — ${existing.invoiceNumber}`, `The 3-way match mismatch on ${existing.invoiceNumber} has been signed off by ${userName}.`, existing.invoiceNumber, id, `/procurement/invoices/${id}`, "success");
  res.json(fmtInvoice(inv));
});

// ── APPROVE ───────────────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/approve", requirePermission("procurement", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Remarks required to approve invoice" }); return; }
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "PendingApproval") { res.status(400).json({ error: "Invoice must be in PendingApproval to approve" }); return; }
  if (existing.matchStatus === "MismatchPending" && !existing.mismatchApprovedAt) {
    res.status(400).json({ error: "This invoice has a 3-way match mismatch that has not been signed off. Use 'Approve Mismatch' first." }); return;
  }
  const [inv] = await db.update(procInvoicesTable).set({
    status: "Approved", isLocked: true,
    approvedAt: new Date(), approvedBy: userId, approvedByName: userName,
    approvalRemarks: remarks, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "Approved", userName, userId, remarks, { status: "PendingApproval" }, { status: "Approved" });
  if (existing.createdBy) notifyUser(existing.createdBy, `Invoice Approved — ${existing.invoiceNumber}`, `Your invoice ${existing.invoiceNumber} has been approved by ${userName}. Remarks: ${remarks}`, existing.invoiceNumber, id, `/procurement/invoices/${id}`, "success");
  notifyRole(["finance", "admin"], `Invoice Ready for Payment — ${existing.invoiceNumber}`, `Invoice ${existing.invoiceNumber} (${existing.vendorName}) ₹${n(existing.netPayable)?.toLocaleString("en-IN")} is approved and ready for payment.`, existing.invoiceNumber, id, `/procurement/invoices/${id}`, "info");
  const [items, auditLogs, comments, payments] = await Promise.all([
    db.select().from(procInvoiceItemsTable).where(eq(procInvoiceItemsTable.invoiceId, id)).orderBy(procInvoiceItemsTable.lineNo),
    db.select().from(procInvoiceAuditLogsTable).where(eq(procInvoiceAuditLogsTable.invoiceId, id)).orderBy(desc(procInvoiceAuditLogsTable.createdAt)),
    db.select().from(invoiceCommentsTable).where(eq(invoiceCommentsTable.invoiceId, id)).orderBy(invoiceCommentsTable.createdAt),
    db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, id)).orderBy(desc(invoicePaymentsTable.createdAt)),
  ]);
  res.json(fmtInvoice(inv, items, auditLogs, comments, payments));
});

// ── REJECT → ON HOLD ────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/reject", requirePermission("procurement", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Remarks required to reject invoice" }); return; }
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "PendingApproval") { res.status(400).json({ error: "Invoice must be in PendingApproval to reject" }); return; }
  const [inv] = await db.update(procInvoicesTable).set({
    status: "OnHold", rejectedAt: new Date(), rejectedBy: userId, rejectedByName: userName,
    heldReason: remarks, heldAt: new Date(), heldBy: userId, heldByName: userName,
    approvalRemarks: remarks, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "Rejected → OnHold", userName, userId, remarks);
  if (existing.createdBy) notifyUser(existing.createdBy, `Invoice On Hold — ${existing.invoiceNumber}`, `Invoice ${existing.invoiceNumber} has been put on hold by ${userName}. Reason: ${remarks}`, existing.invoiceNumber, id, `/procurement/invoices/${id}`, "warning");
  res.json(fmtInvoice(inv));
});

// ── PUT ON HOLD ───────────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/put-on-hold", requirePermission("procurement", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, reason } = req.body;
  if (!reason) { res.status(400).json({ error: "Reason is required" }); return; }
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (!["Approved", "PartiallyPaid"].includes(existing.status)) { res.status(400).json({ error: "Only Approved or PartiallyPaid invoices can be put on hold" }); return; }
  const [inv] = await db.update(procInvoicesTable).set({
    status: "OnHold", heldReason: reason, heldAt: new Date(), heldBy: userId, heldByName: userName, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "PutOnHold", userName, userId, reason);
  res.json(fmtInvoice(inv));
});

// ── RELEASE HOLD ─────────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/release-hold", requirePermission("procurement", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, remarks } = req.body;
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "OnHold") { res.status(400).json({ error: "Invoice is not on hold" }); return; }
  // If was previously approved, go back to PendingApproval; otherwise Draft
  const prevStatus = existing.approvedAt ? "PendingApproval" : "Draft";
  const [inv] = await db.update(procInvoicesTable).set({
    status: prevStatus as any,
    holdReleasedAt: new Date(), holdReleasedBy: userId, holdReleasedByName: userName, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "HoldReleased", userName, userId, remarks ?? `Hold released — moved to ${prevStatus}`);
  res.json(fmtInvoice(inv));
});

// ── DISPUTE ───────────────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/dispute", requirePermission("procurement", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, reason } = req.body;
  if (!reason) { res.status(400).json({ error: "Dispute reason is required" }); return; }
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (!["Approved", "PartiallyPaid", "PendingApproval"].includes(existing.status)) {
    res.status(400).json({ error: "Invoice must be Approved, PartiallyPaid, or PendingApproval to dispute" }); return;
  }
  const [inv] = await db.update(procInvoicesTable).set({
    status: "Disputed", disputeReason: reason, disputedAt: new Date(),
    disputedBy: userId, disputedByName: userName, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "Disputed", userName, userId, reason);
  if (existing.createdBy) notifyUser(existing.createdBy, `Invoice Disputed — ${existing.invoiceNumber}`, `Invoice ${existing.invoiceNumber} has been disputed. Reason: ${reason}`, existing.invoiceNumber, id, `/procurement/invoices/${id}`, "error");
  res.json(fmtInvoice(inv));
});

// ── RESOLVE DISPUTE ───────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/resolve-dispute", requirePermission("procurement", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, resolution, resolveAs = "Approved" } = req.body;
  if (!resolution) { res.status(400).json({ error: "Resolution details are required" }); return; }
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "Disputed") { res.status(400).json({ error: "Invoice is not in Disputed status" }); return; }
  const targetStatus = ["Approved", "Cancelled"].includes(resolveAs) ? resolveAs : "Approved";
  const [inv] = await db.update(procInvoicesTable).set({
    status: targetStatus as any, disputeResolution: resolution,
    disputeResolvedAt: new Date(), disputeResolvedBy: userId, disputeResolvedByName: userName,
    updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, `DisputeResolved → ${targetStatus}`, userName, userId, resolution);
  if (existing.createdBy) notifyUser(existing.createdBy, `Dispute Resolved — ${existing.invoiceNumber}`, `The dispute on invoice ${existing.invoiceNumber} has been resolved. Resolution: ${resolution}`, existing.invoiceNumber, id, `/procurement/invoices/${id}`, "success");
  const [items, auditLogs, comments, payments] = await Promise.all([
    db.select().from(procInvoiceItemsTable).where(eq(procInvoiceItemsTable.invoiceId, id)).orderBy(procInvoiceItemsTable.lineNo),
    db.select().from(procInvoiceAuditLogsTable).where(eq(procInvoiceAuditLogsTable.invoiceId, id)).orderBy(desc(procInvoiceAuditLogsTable.createdAt)),
    db.select().from(invoiceCommentsTable).where(eq(invoiceCommentsTable.invoiceId, id)).orderBy(invoiceCommentsTable.createdAt),
    db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, id)).orderBy(desc(invoicePaymentsTable.createdAt)),
  ]);
  res.json(fmtInvoice(inv, items, auditLogs, comments, payments));
});

// ── CANCEL ────────────────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/cancel", requirePermission("procurement", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, reason } = req.body;
  if (!reason) { res.status(400).json({ error: "Cancellation reason is required" }); return; }
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (["Paid", "Cancelled"].includes(existing.status)) { res.status(400).json({ error: `Cannot cancel an invoice in ${existing.status} status` }); return; }
  const [inv] = await db.update(procInvoicesTable).set({
    status: "Cancelled", cancelledAt: new Date(), cancelledBy: userId, cancelledByName: userName,
    cancellationReason: reason, isLocked: false, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "Cancelled", userName, userId, reason, { status: existing.status }, { status: "Cancelled" });
  if (existing.createdBy) notifyUser(existing.createdBy, `Invoice Cancelled — ${existing.invoiceNumber}`, `Invoice ${existing.invoiceNumber} has been cancelled. Reason: ${reason}`, existing.invoiceNumber, id, `/procurement/invoices/${id}`, "error");
  res.json(fmtInvoice(inv));
});

// ── RECORD PAYMENT (partial or full) ──────────────────────────────────────────
router.post("/proc-invoices/:id/record-payment", requirePermission("finance", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, amount, paymentReference, paymentMode, paymentDate, bankName, utrNumber, notes } = req.body;
  if (!amount || Number(amount) <= 0) { res.status(400).json({ error: "Payment amount must be > 0" }); return; }
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (!["Approved", "PartiallyPaid"].includes(existing.status)) { res.status(400).json({ error: "Invoice must be Approved or PartiallyPaid to record a payment" }); return; }

  const newPaidAmount = parseFloat((Number(existing.paidAmount) + Number(amount)).toFixed(2));
  const netPayable = Number(existing.netPayable);
  const newStatus = newPaidAmount >= netPayable - 0.01 ? "Paid" : "PartiallyPaid";

  // Insert payment record
  await db.insert(invoicePaymentsTable).values({
    invoiceId: id, amount: amount.toString(), paymentReference: paymentReference ?? null,
    paymentMode: paymentMode ?? null, paymentDate: paymentDate ?? new Date().toISOString().slice(0, 10),
    bankName: bankName ?? null, utrNumber: utrNumber ?? null, notes: notes ?? null,
    paidBy: userId, paidByName: userName,
  });

  const updateData: any = {
    paidAmount: newPaidAmount.toString(), status: newStatus, updatedAt: new Date(),
  };
  if (newStatus === "Paid") {
    updateData.paidAt = new Date(); updateData.paidBy = userId; updateData.paidByName = userName;
    updateData.paymentReference = paymentReference ?? null; updateData.paymentMode = paymentMode ?? null;
  }

  const [inv] = await db.update(procInvoicesTable).set(updateData).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, `PaymentRecorded — ₹${amount}`, userName, userId,
    `Payment of ₹${amount} recorded. Ref: ${paymentReference ?? "N/A"}. Total paid: ₹${newPaidAmount} / ₹${netPayable}. Status: ${newStatus}`);

  if (existing.createdBy) notifyUser(existing.createdBy, `Payment Recorded — ${existing.invoiceNumber}`, `₹${Number(amount).toLocaleString("en-IN")} recorded against ${existing.invoiceNumber}. Total paid: ₹${newPaidAmount.toLocaleString("en-IN")} of ₹${netPayable.toLocaleString("en-IN")}.`, existing.invoiceNumber, id, `/procurement/invoices/${id}`, "success");

  const [items, auditLogs, comments, payments] = await Promise.all([
    db.select().from(procInvoiceItemsTable).where(eq(procInvoiceItemsTable.invoiceId, id)).orderBy(procInvoiceItemsTable.lineNo),
    db.select().from(procInvoiceAuditLogsTable).where(eq(procInvoiceAuditLogsTable.invoiceId, id)).orderBy(desc(procInvoiceAuditLogsTable.createdAt)),
    db.select().from(invoiceCommentsTable).where(eq(invoiceCommentsTable.invoiceId, id)).orderBy(invoiceCommentsTable.createdAt),
    db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, id)).orderBy(desc(invoicePaymentsTable.createdAt)),
  ]);
  res.json(fmtInvoice(inv, items, auditLogs, comments, payments));
});

// ── MARK FULLY PAID (legacy + convenience) ────────────────────────────────────
router.post("/proc-invoices/:id/mark-paid", requirePermission("finance", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, paymentReference, paymentMode, remarks, amount, paymentDate, utrNumber, bankName } = req.body;
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (!["Approved", "PartiallyPaid"].includes(existing.status)) { res.status(400).json({ error: "Invoice must be Approved or PartiallyPaid before marking as Paid" }); return; }

  const payAmount = amount ? Number(amount) : Number(existing.netPayable);

  await db.insert(invoicePaymentsTable).values({
    invoiceId: id, amount: payAmount.toString(),
    paymentReference: paymentReference ?? null, paymentMode: paymentMode ?? null,
    paymentDate: paymentDate ?? new Date().toISOString().slice(0, 10),
    bankName: bankName ?? null, utrNumber: utrNumber ?? null,
    notes: remarks ?? null, paidBy: userId, paidByName: userName,
  });

  const [inv] = await db.update(procInvoicesTable).set({
    status: "Paid", paidAt: new Date(), paidBy: userId, paidByName: userName,
    paidAmount: Number(existing.netPayable).toString(),
    paymentReference: paymentReference ?? null, paymentMode: paymentMode ?? null, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "Paid", userName, userId, remarks ?? `Full payment recorded. Ref: ${paymentReference ?? "N/A"}`);
  if (existing.createdBy) notifyUser(existing.createdBy, `Invoice Paid — ${existing.invoiceNumber}`, `Invoice ${existing.invoiceNumber} has been fully paid. Reference: ${paymentReference ?? "N/A"}.`, existing.invoiceNumber, id, `/procurement/invoices/${id}`, "success");
  const [items, auditLogs, comments, payments] = await Promise.all([
    db.select().from(procInvoiceItemsTable).where(eq(procInvoiceItemsTable.invoiceId, id)).orderBy(procInvoiceItemsTable.lineNo),
    db.select().from(procInvoiceAuditLogsTable).where(eq(procInvoiceAuditLogsTable.invoiceId, id)).orderBy(desc(procInvoiceAuditLogsTable.createdAt)),
    db.select().from(invoiceCommentsTable).where(eq(invoiceCommentsTable.invoiceId, id)).orderBy(invoiceCommentsTable.createdAt),
    db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, id)).orderBy(desc(invoicePaymentsTable.createdAt)),
  ]);
  res.json(fmtInvoice(inv, items, auditLogs, comments, payments));
});

// ── CREATE CREDIT NOTE ────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/create-credit-note", requirePermission("procurement", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, reason, amount } = req.body;
  if (!reason) { res.status(400).json({ error: "Reason is required for credit note" }); return; }
  const [original] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!original) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (!["Approved", "Paid", "PartiallyPaid"].includes(original.status)) { res.status(400).json({ error: "Credit notes can only be created against Approved or Paid invoices" }); return; }

  const year = new Date().getFullYear();
  const creditNumber = `CN-${year}-${String(invCounter++).padStart(4, "0")}`;
  const creditAmount = amount ? Number(amount) : Number(original.netPayable);

  const [cn] = await db.insert(procInvoicesTable).values({
    invoiceNumber: creditNumber, invoiceType: "CreditNote",
    poId: original.poId, grnId: original.grnId,
    vendorId: original.vendorId, vendorName: original.vendorName,
    originalInvoiceId: id, matchStatus: "Matched",
    subtotal: (-creditAmount).toString(), totalGst: "0",
    freightCharges: "0", otherCharges: "0", discountAmount: "0",
    totalAmount: (-creditAmount).toString(), tdsAmount: "0",
    netPayable: (-creditAmount).toString(), paidAmount: "0",
    internalNotes: reason, createdBy: userId, createdByName: userName,
  }).returning();

  // Link credit note to original invoice
  await db.update(procInvoicesTable).set({ linkedCreditNoteId: cn.id, updatedAt: new Date() }).where(eq(procInvoicesTable.id, id));
  await logAudit(id, `CreditNoteCreated — ${creditNumber}`, userName, userId, reason);
  await logAudit(cn.id, `Created (Credit Note against ${original.invoiceNumber})`, userName, userId, reason);

  res.status(201).json({ creditNote: fmtInvoice(cn), originalInvoiceId: id });
});

// ── COMMENTS ─────────────────────────────────────────────────────────────────
router.get("/proc-invoices/:id/comments", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const comments = await db.select().from(invoiceCommentsTable).where(eq(invoiceCommentsTable.invoiceId, id)).orderBy(invoiceCommentsTable.createdAt);
  res.json(comments.map(c => ({ id: c.id, invoiceId: c.invoiceId, parentId: c.parentId, userId: c.userId, userName: c.userName, userRole: c.userRole, body: c.body, createdAt: c.createdAt.toISOString() })));
});

router.post("/proc-invoices/:id/comments", requirePermission("procurement", "view"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userId, userName, userRole, body, parentId } = req.body;
  if (!body?.trim()) { res.status(400).json({ error: "Comment body is required" }); return; }
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  const [comment] = await db.insert(invoiceCommentsTable).values({
    invoiceId: id, userId, userName, userRole, body: body.trim(), parentId: parentId ?? null,
  }).returning();
  if (existing.createdBy && existing.createdBy !== userId) {
    notifyUser(existing.createdBy, `New comment on ${existing.invoiceNumber}`, `${userName ?? "Someone"} commented: "${body.trim().slice(0, 80)}"`, existing.invoiceNumber, id, `/procurement/invoices/${id}`, "info");
  }
  res.status(201).json({ id: comment.id, invoiceId: comment.invoiceId, parentId: comment.parentId, userId: comment.userId, userName: comment.userName, userRole: comment.userRole, body: comment.body, createdAt: comment.createdAt.toISOString() });
});

router.delete("/proc-invoices/:id/comments/:commentId", requirePermission("procurement", "delete"), async (req, res): Promise<void> => {
  const invoiceId = Number(req.params.id);
  const commentId = Number(req.params.commentId);
  const [comment] = await db.select().from(invoiceCommentsTable).where(and(eq(invoiceCommentsTable.id, commentId), eq(invoiceCommentsTable.invoiceId, invoiceId)));
  if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }
  await db.delete(invoiceCommentsTable).where(eq(invoiceCommentsTable.id, commentId));
  res.json({ success: true });
});

export default router;
