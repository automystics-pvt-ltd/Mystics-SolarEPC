import { Router, type IRouter } from "express";
import {
  db, procurementQuotationsTable, procQuotationItemsTable,
  quotationVersionsTable, quotationAuditLogsTable,
  procurementPOsTable, procPOItemsTable,
  vendorsTable, materialRequestsTable,
} from "@workspace/db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

const router: IRouter = Router();

let vqCounter = 1;
let poProcCounter = 1;

// Seed counters
(async () => {
  const r1 = await db.select().from(procurementQuotationsTable).orderBy(desc(procurementQuotationsTable.id)).limit(1);
  if (r1.length > 0) vqCounter = r1[0].id + 1;
  const r2 = await db.select().from(procurementPOsTable).orderBy(desc(procurementPOsTable.id)).limit(1);
  if (r2.length > 0) poProcCounter = r2[0].id + 1;
})();

// ── Helpers ──────────────────────────────────────────────────────────────────
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

function fmtQ(q: typeof procurementQuotationsTable.$inferSelect, items: any[] = [], versions: any[] = [], auditLogs: any[] = []) {
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
    createdBy: q.createdBy, createdByName: q.createdByName,
    updatedBy: q.updatedBy, updatedByName: q.updatedByName,
    createdAt: q.createdAt.toISOString(), updatedAt: q.updatedAt.toISOString(),
    items, versions, auditLogs,
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
    return { ...item, lineNo: idx + 1, discountAmount, taxableAmount, totalGst: totalGstItem, cgstAmount: cgst, sgstAmount: sgst, igstAmount: 0, lineTotal };
  });
  return { calcItems, subtotal: parseFloat(subtotal.toFixed(2)), totalDiscount: parseFloat(totalDiscount.toFixed(2)), totalGst: parseFloat(totalGst.toFixed(2)) };
}

async function logAudit(quotationId: number, action: string, performedByName: string, performedBy?: number, role?: string, remarks?: string, oldValues?: any, newValues?: any) {
  await db.insert(quotationAuditLogsTable).values({
    quotationId, action: action as any, performedBy, performedByName, performedByRole: role,
    remarks, oldValues: oldValues ?? null, newValues: newValues ?? null,
  });
}

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get("/procurement-quotations", async (req, res): Promise<void> => {
  let query = db.select().from(procurementQuotationsTable).orderBy(desc(procurementQuotationsTable.createdAt)).$dynamic();
  if (req.query.mrId) query = query.where(eq(procurementQuotationsTable.mrId, Number(req.query.mrId)));
  if (req.query.vendorId) query = query.where(eq(procurementQuotationsTable.vendorId, Number(req.query.vendorId)));
  if (req.query.status) query = query.where(eq(procurementQuotationsTable.status, req.query.status as any));
  const rows = await query;
  res.json(rows.map(q => fmtQ(q)));
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post("/procurement-quotations", async (req, res): Promise<void> => {
  const { items: itemsBody, userName = "System", userId, userRole, ...body } = req.body;
  const year = new Date().getFullYear();
  const referenceId = `VQ-${year}-${String(vqCounter++).padStart(4, "0")}`;

  // Fetch vendor name if vendorId provided
  let vendorSnapshotName = body.vendorSnapshotName;
  if (body.vendorId && !vendorSnapshotName) {
    const [v] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, Number(body.vendorId)));
    vendorSnapshotName = v?.name ?? "";
  }

  const { calcItems, subtotal, totalDiscount, totalGst } = calcTotals(itemsBody ?? []);
  const freight = Number(body.freightCharges) || 0;
  const other = Number(body.otherCharges) || 0;
  const totalAmount = parseFloat((subtotal - totalDiscount + totalGst + freight + other).toFixed(2));

  const [q] = await db.insert(procurementQuotationsTable).values({
    ...body, referenceId, version: 1, status: "Draft",
    vendorSnapshotName, subtotal: subtotal.toString(), totalDiscount: totalDiscount.toString(),
    totalGst: totalGst.toString(), totalAmount: totalAmount.toString(),
    freightCharges: freight.toString(), otherCharges: other.toString(),
    createdByName: userName, createdBy: userId,
  }).returning();

  let insertedItems: typeof procQuotationItemsTable.$inferSelect[] = [];
  if (calcItems.length > 0) {
    insertedItems = await db.insert(procQuotationItemsTable)
      .values(calcItems.map((item: any) => ({
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
      }))).returning();
  }

  // Snapshot version 1
  await db.insert(quotationVersionsTable).values({
    quotationId: q.id, version: 1,
    snapshot: { header: q, items: insertedItems } as any,
    changedBy: userId, changedByName: userName, changeSummary: "Initial creation",
  });

  await logAudit(q.id, "Created", userName, userId, userRole, "Quotation created", null, { referenceId, totalAmount });
  res.status(201).json(fmtQ(q, insertedItems.map(fmtItem), [], []));
});

// ── GET SINGLE (with items, versions, audit) ─────────────────────────────────
router.get("/procurement-quotations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [q] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!q) { res.status(404).json({ error: "Quotation not found" }); return; }
  const [items, versions, auditLogs] = await Promise.all([
    db.select().from(procQuotationItemsTable).where(eq(procQuotationItemsTable.quotationId, id)).orderBy(procQuotationItemsTable.lineNo),
    db.select().from(quotationVersionsTable).where(eq(quotationVersionsTable.quotationId, id)).orderBy(desc(quotationVersionsTable.version)),
    db.select().from(quotationAuditLogsTable).where(eq(quotationAuditLogsTable.quotationId, id)).orderBy(desc(quotationAuditLogsTable.createdAt)),
  ]);
  res.json(fmtQ(q, items.map(fmtItem), versions, auditLogs.map(a => ({ ...a, createdAt: a.createdAt.toISOString() }))));
});

// ── UPDATE (Draft/RevisionRequested only) ────────────────────────────────────
router.patch("/procurement-quotations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Quotation not found" }); return; }
  if (!["Draft", "RevisionRequested"].includes(existing.status)) {
    res.status(403).json({ error: `Cannot edit quotation in ${existing.status} status` }); return;
  }

  const { items: itemsBody, userName = "System", userId, userRole, ...body } = req.body;
  const newVersion = existing.version + 1;

  // Recalculate totals
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

  // Replace items if provided
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
        }))
      ).returning();
    }
  }

  // Snapshot new version
  await db.insert(quotationVersionsTable).values({
    quotationId: id, version: newVersion,
    snapshot: { header: q, items: insertedItems } as any,
    changedBy: userId, changedByName: userName, changeSummary: body.changeSummary ?? "Updated",
  });

  await logAudit(id, "Updated", userName, userId, userRole, body.changeSummary, { version: existing.version }, { version: newVersion, totalAmount });
  const auditLogs = await db.select().from(quotationAuditLogsTable).where(eq(quotationAuditLogsTable.quotationId, id)).orderBy(desc(quotationAuditLogsTable.createdAt));
  const versions = await db.select().from(quotationVersionsTable).where(eq(quotationVersionsTable.quotationId, id)).orderBy(desc(quotationVersionsTable.version));
  res.json(fmtQ(q, insertedItems.map(fmtItem), versions, auditLogs.map(a => ({ ...a, createdAt: a.createdAt.toISOString() }))));
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
  const { userName = "System", userId, userRole } = req.body;
  // Atomically transition only when current status is Draft or RevisionRequested.
  // The status predicate lives in the WHERE clause of the UPDATE so there is no
  // read-then-write race window — a concurrent state change between a prior
  // SELECT and this UPDATE cannot silently overwrite the newer status.
  const [q] = await db.update(procurementQuotationsTable).set({
    status: "Submitted", submittedAt: new Date(), submittedBy: userId, submittedByName: userName, updatedAt: new Date(),
  }).where(and(
    eq(procurementQuotationsTable.id, id),
    inArray(procurementQuotationsTable.status, ["Draft", "RevisionRequested"]),
  )).returning();
  if (!q) {
    // Distinguish "record not found" from "wrong status".
    const [existing] = await db.select({ status: procurementQuotationsTable.status })
      .from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Quotation not found" }); return; }
    res.status(400).json({ error: `Quotation must be in Draft or RevisionRequested status to submit (currently ${existing.status})` }); return;
  }
  await logAudit(id, "Submitted", userName, userId, userRole, "Submitted for review");
  res.json(fmtQ(q));
});

// ── START REVIEW ──────────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/start-review", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, userRole, remarks } = req.body;
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
  res.json(fmtQ(q));
});

// ── REQUEST REVISION ──────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/request-revision", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, userRole, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Remarks are required for revision request" }); return; }
  const [existing] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!["Submitted", "UnderReview"].includes(existing.status ?? "")) {
    res.status(400).json({ error: `Cannot request revision: quotation must be in Submitted or UnderReview status (currently ${existing.status})` }); return;
  }
  const [q] = await db.update(procurementQuotationsTable).set({
    status: "RevisionRequested", approvalRemarks: remarks, updatedAt: new Date(),
  }).where(eq(procurementQuotationsTable.id, id)).returning();
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  await logAudit(id, "RevisionRequested", userName, userId, userRole, remarks);
  res.json(fmtQ(q));
});

// ── APPROVE ───────────────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, userRole, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Approval remarks are required" }); return; }
  const [existing] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "UnderReview") {
    res.status(400).json({ error: `Cannot approve: quotation must be in UnderReview status (currently ${existing.status})` }); return;
  }
  const [q] = await db.update(procurementQuotationsTable).set({
    status: "Approved", approvedAt: new Date(), approvedBy: userId, approvedByName: userName,
    approvalRemarks: remarks, updatedAt: new Date(),
  }).where(eq(procurementQuotationsTable.id, id)).returning();
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  await logAudit(id, "Approved", userName, userId, userRole, remarks, null, { status: "Approved" });

  // Auto-generate PO
  const items = await db.select().from(procQuotationItemsTable).where(eq(procQuotationItemsTable.quotationId, id)).orderBy(procQuotationItemsTable.lineNo);
  let vendor: typeof vendorsTable.$inferSelect | null = null;
  if (q.vendorId) {
    const [v] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, q.vendorId));
    vendor = v ?? null;
  }
  const year = new Date().getFullYear();
  const poNumber = `PO-${year}-${String(poProcCounter++).padStart(4, "0")}`;
  const today = new Date().toISOString().split("T")[0];
  const [po] = await db.insert(procurementPOsTable).values({
    poNumber, quotationId: id, vendorId: q.vendorId,
    vendorName: q.vendorSnapshotName ?? vendor?.name ?? "Unknown",
    vendorGstin: vendor?.gstin ?? null, vendorAddress: vendor?.billingAddress ?? null,
    vendorContact: vendor?.primaryPhone ?? null,
    status: "Draft", poDate: today,
    paymentTerms: q.paymentTerms, warrantyMonths: q.warrantyMonths,
    freightCharges: q.freightCharges, otherCharges: q.otherCharges,
    subtotal: q.subtotal, totalGst: q.totalGst, totalAmount: q.totalAmount,
    approvedBy: userId, approvedByName: userName, approvedAt: new Date(),
    createdBy: userId, createdByName: userName,
  }).returning();

  if (items.length > 0) {
    await db.insert(procPOItemsTable).values(items.map(item => ({
      poId: po.id, lineNo: item.lineNo, materialId: item.materialId,
      materialCode: item.materialCode, materialName: item.materialName, description: item.description,
      uom: item.uom, hsnSacCode: item.hsnSacCode, brand: item.brand,
      qty: item.qty, unitPrice: item.unitPrice, discountPct: item.discountPct,
      discountAmount: item.discountAmount, taxableAmount: item.taxableAmount,
      gstRate: item.gstRate, totalGst: item.totalGst, lineTotal: item.lineTotal,
    })));
  }

  await db.update(procurementQuotationsTable).set({ poGenerated: true }).where(eq(procurementQuotationsTable.id, id));
  await logAudit(id, "POGenerated", userName, userId, userRole, `PO ${poNumber} generated`);

  // Return with fresh data
  const [qFresh] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  const [auditLogs, versions] = await Promise.all([
    db.select().from(quotationAuditLogsTable).where(eq(quotationAuditLogsTable.quotationId, id)).orderBy(desc(quotationAuditLogsTable.createdAt)),
    db.select().from(quotationVersionsTable).where(eq(quotationVersionsTable.quotationId, id)).orderBy(desc(quotationVersionsTable.version)),
  ]);
  res.json({ quotation: fmtQ(qFresh, items.map(fmtItem), versions, auditLogs.map(a => ({ ...a, createdAt: a.createdAt.toISOString() }))), po: { ...po, createdAt: po.createdAt.toISOString() } });
});

// ── REJECT ────────────────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/reject", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, userRole, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Rejection remarks are mandatory" }); return; }
  const [existing] = await db.select().from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!["Submitted", "UnderReview"].includes(existing.status ?? "")) {
    res.status(400).json({ error: `Cannot reject: quotation must be in Submitted or UnderReview status (currently ${existing.status})` }); return;
  }
  const [q] = await db.update(procurementQuotationsTable).set({
    status: "Rejected", rejectedAt: new Date(), rejectedBy: userId, rejectedByName: userName,
    approvalRemarks: remarks, updatedAt: new Date(),
  }).where(eq(procurementQuotationsTable.id, id)).returning();
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  await logAudit(id, "Rejected", userName, userId, userRole, remarks, null, { status: "Rejected" });
  res.json(fmtQ(q));
});

// ── ADD COMMENT ───────────────────────────────────────────────────────────────
router.post("/procurement-quotations/:id/comment", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, userRole, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Comment text is required" }); return; }
  await logAudit(id, "CommentAdded", userName, userId, userRole, remarks);
  const logs = await db.select().from(quotationAuditLogsTable).where(eq(quotationAuditLogsTable.quotationId, id)).orderBy(desc(quotationAuditLogsTable.createdAt));
  res.json({ ok: true, logs: logs.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })) });
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
      .orderBy(procQuotationItemsTable.lineNo))
  );

  // Collect all unique material names for comparison matrix
  const allMaterialNames = [...new Set(allItems.flat().map(i => i.materialName))];

  // Build per-material lowest price map
  const materialLowest: Record<string, number> = {};
  allMaterialNames.forEach(name => {
    const prices = allItems.flat().filter(i => i.materialName === name).map(i => Number(i.unitPrice));
    materialLowest[name] = Math.min(...prices);
  });

  const eligible = quotations.filter(q => q.status !== "Rejected");
  const l1 = eligible[0];

  const comparison = quotations.map((q, idx) => ({
    ...fmtQ(q, allItems[idx].map(fmtItem)),
    isL1Candidate: l1 ? q.id === l1.id : false,
    items: allItems[idx].map(fmtItem).map(item => ({
      ...item,
      isLowest: Math.abs((item.unitPrice ?? 0) - (materialLowest[item.materialName] ?? 0)) < 0.01,
      lowestPrice: materialLowest[item.materialName] ?? null,
    })),
  }));

  res.json({
    quotations: comparison,
    materialNames: allMaterialNames,
    materialLowest,
    l1VendorId: l1?.vendorId ?? null,
    l1ReferenceId: l1?.referenceId ?? null,
    l1Amount: l1 ? n(l1.totalAmount) : null,
  });
});

export default router;
