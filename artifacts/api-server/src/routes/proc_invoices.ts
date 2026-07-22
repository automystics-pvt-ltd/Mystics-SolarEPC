import { Router, type IRouter } from "express";
import {
  db, procInvoicesTable, procInvoiceItemsTable, procInvoiceAuditLogsTable,
  procurementPOsTable, procPOItemsTable, procGRNsTable, procGRNItemsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

let invCounter = 1;
(async () => {
  const r = await db.select().from(procInvoicesTable).orderBy(desc(procInvoicesTable.id)).limit(1);
  if (r.length > 0) invCounter = r[0].id + 1;
})();

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

function fmtInvoice(inv: typeof procInvoicesTable.$inferSelect, items: any[] = [], auditLogs: any[] = []) {
  return {
    id: inv.id, invoiceNumber: inv.invoiceNumber, poId: inv.poId, grnId: inv.grnId,
    vendorId: inv.vendorId, vendorName: inv.vendorName,
    vendorInvoiceNumber: inv.vendorInvoiceNumber, vendorInvoiceDate: inv.vendorInvoiceDate,
    status: inv.status, matchStatus: inv.matchStatus, mismatchDetails: inv.mismatchDetails,
    mismatchApprovedBy: inv.mismatchApprovedBy, mismatchApprovedByName: inv.mismatchApprovedByName,
    mismatchApprovedAt: inv.mismatchApprovedAt?.toISOString(),
    subtotal: n(inv.subtotal), totalGst: n(inv.totalGst),
    freightCharges: n(inv.freightCharges), otherCharges: n(inv.otherCharges),
    totalAmount: n(inv.totalAmount), tdsAmount: n(inv.tdsAmount), netPayable: n(inv.netPayable),
    paymentTerms: inv.paymentTerms, dueDate: inv.dueDate,
    submittedAt: inv.submittedAt?.toISOString(), submittedBy: inv.submittedBy, submittedByName: inv.submittedByName,
    approvedBy: inv.approvedBy, approvedByName: inv.approvedByName, approvedAt: inv.approvedAt?.toISOString(),
    rejectedBy: inv.rejectedBy, rejectedByName: inv.rejectedByName, rejectedAt: inv.rejectedAt?.toISOString(),
    approvalRemarks: inv.approvalRemarks,
    paidAt: inv.paidAt?.toISOString(), paidBy: inv.paidBy, paidByName: inv.paidByName,
    paymentReference: inv.paymentReference, paymentMode: inv.paymentMode,
    internalNotes: inv.internalNotes,
    createdBy: inv.createdBy, createdByName: inv.createdByName,
    createdAt: inv.createdAt.toISOString(), updatedAt: inv.updatedAt.toISOString(),
    items: items.map(i => ({
      id: i.id, invoiceId: i.invoiceId, poItemId: i.poItemId, grnItemId: i.grnItemId,
      lineNo: i.lineNo, materialName: i.materialName, materialCode: i.materialCode,
      uom: i.uom, hsnSacCode: i.hsnSacCode,
      orderedQty: n(i.orderedQty), receivedQty: n(i.receivedQty), invoicedQty: n(i.invoicedQty),
      unitPrice: n(i.unitPrice), discountPct: n(i.discountPct),
      taxableAmount: n(i.taxableAmount), gstRate: n(i.gstRate), gstAmount: n(i.gstAmount),
      lineTotal: n(i.lineTotal), isMatched: i.isMatched, mismatchNote: i.mismatchNote,
    })),
    auditLogs: auditLogs.map(a => ({
      id: a.id, invoiceId: a.invoiceId, action: a.action,
      performedBy: a.performedBy, performedByName: a.performedByName,
      remarks: a.remarks, oldValues: a.oldValues, newValues: a.newValues,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

async function logAudit(invoiceId: number, action: string, performedByName: string, performedBy?: number, remarks?: string, oldValues?: any, newValues?: any) {
  await db.insert(procInvoiceAuditLogsTable).values({
    invoiceId, action, performedBy, performedByName, remarks,
    oldValues: oldValues ?? null, newValues: newValues ?? null,
  });
}

// ── LIST ─────────────────────────────────────────────────────────────────────
router.get("/proc-invoices", async (req, res): Promise<void> => {
  let query = db.select().from(procInvoicesTable).orderBy(desc(procInvoicesTable.createdAt)).$dynamic();
  if (req.query.poId) query = query.where(eq(procInvoicesTable.poId, Number(req.query.poId)));
  if (req.query.grnId) query = query.where(eq(procInvoicesTable.grnId, Number(req.query.grnId)));
  if (req.query.status) query = query.where(eq(procInvoicesTable.status, req.query.status as any));
  const rows = await query;
  res.json(rows.map(r => fmtInvoice(r)));
});

// ── GET SINGLE ────────────────────────────────────────────────────────────────
router.get("/proc-invoices/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [inv] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  const [items, auditLogs] = await Promise.all([
    db.select().from(procInvoiceItemsTable).where(eq(procInvoiceItemsTable.invoiceId, id)).orderBy(procInvoiceItemsTable.lineNo),
    db.select().from(procInvoiceAuditLogsTable).where(eq(procInvoiceAuditLogsTable.invoiceId, id)).orderBy(desc(procInvoiceAuditLogsTable.createdAt)),
  ]);
  res.json(fmtInvoice(inv, items, auditLogs));
});

// ── CREATE (with 3-way match) ─────────────────────────────────────────────────
router.post("/proc-invoices", async (req, res): Promise<void> => {
  const { poId, grnId, items: itemsBody = [], userName = "System", userId, ...body } = req.body;

  const [po] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, Number(poId)));
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }

  // Fetch PO items and GRN items for 3-way match
  const poItems = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, Number(poId))).orderBy(procPOItemsTable.lineNo);
  let grnItems: any[] = [];
  if (grnId) {
    const [grn] = await db.select().from(procGRNsTable).where(eq(procGRNsTable.id, Number(grnId)));
    if (!grn || !["Accepted", "PartiallyAccepted"].includes(grn.status)) {
      res.status(400).json({ error: "GRN must be Accepted or PartiallyAccepted to create an invoice" }); return;
    }
    grnItems = await db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, Number(grnId))).orderBy(procGRNItemsTable.lineNo);
  }

  // 3-way match: compare PO qty vs GRN accepted qty vs invoiced qty
  let hasMismatch = false;
  const mismatchLines: string[] = [];
  let subtotal = 0, totalGst = 0;

  const calcItems = (itemsBody.length > 0 ? itemsBody : poItems).map((item: any, idx: number) => {
    const poItem = poItems[idx] ?? poItems.find((p: any) => p.materialName === item.materialName);
    const grnItem = grnItems.find((g: any) => g.poItemId === (poItem?.id ?? null) || g.materialName === (poItem?.materialName ?? item.materialName));

    const orderedQty = n(poItem?.qty) ?? 0;
    const receivedQty = n(grnItem?.acceptedQty) ?? 0;
    const invoicedQty = Number(item.invoicedQty ?? item.qty ?? receivedQty);
    const unitPrice = Number(item.unitPrice ?? poItem?.unitPrice ?? 0);
    const discountPct = Number(item.discountPct ?? poItem?.discountPct ?? 0);
    const gstRate = Number(item.gstRate ?? poItem?.gstRate ?? 18);
    const taxableAmount = parseFloat((invoicedQty * unitPrice * (1 - discountPct / 100)).toFixed(2));
    const gstAmount = parseFloat((taxableAmount * gstRate / 100).toFixed(2));
    const lineTotal = parseFloat((taxableAmount + gstAmount).toFixed(2));
    subtotal += taxableAmount;
    totalGst += gstAmount;

    // Check mismatch: invoiced qty must not exceed GRN accepted qty or PO ordered qty
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
      discountPct: discountPct.toString(), taxableAmount: taxableAmount.toString(),
      gstRate: gstRate.toString(), gstAmount: gstAmount.toString(), lineTotal: lineTotal.toString(),
      isMatched, mismatchNote: isMatched ? null : `Expected ${receivedQty}, got ${invoicedQty}`,
    };
  });

  const freight = Number(body.freightCharges) || 0;
  const other = Number(body.otherCharges) || 0;
  const tds = Number(body.tdsAmount) || 0;
  const totalAmount = parseFloat((subtotal + totalGst + freight + other).toFixed(2));
  const netPayable = parseFloat((totalAmount - tds).toFixed(2));

  const year = new Date().getFullYear();
  const invoiceNumber = `INV-${year}-${String(invCounter++).padStart(4, "0")}`;

  const [inv] = await db.insert(procInvoicesTable).values({
    invoiceNumber, poId: Number(poId), grnId: grnId ? Number(grnId) : null,
    vendorId: po.vendorId, vendorName: po.vendorName,
    matchStatus: hasMismatch ? "MismatchPending" : "Matched",
    mismatchDetails: hasMismatch ? mismatchLines.join("; ") : null,
    subtotal: subtotal.toString(), totalGst: totalGst.toString(),
    freightCharges: freight.toString(), otherCharges: other.toString(),
    totalAmount: totalAmount.toString(), tdsAmount: tds.toString(), netPayable: netPayable.toString(),
    vendorInvoiceNumber: body.vendorInvoiceNumber ?? null,
    vendorInvoiceDate: body.vendorInvoiceDate ?? null,
    paymentTerms: body.paymentTerms ?? po.paymentTerms,
    internalNotes: body.internalNotes ?? null,
    createdBy: userId, createdByName: userName,
  }).returning();

  const insertedItems = await db.insert(procInvoiceItemsTable).values(
    calcItems.map((i: any) => ({ ...i, invoiceId: inv.id }))
  ).returning();

  await logAudit(inv.id, "Created", userName, userId,
    hasMismatch ? `Invoice created with mismatches: ${mismatchLines.join("; ")}` : "Invoice created — 3-way match passed"
  );
  res.status(201).json(fmtInvoice(inv, insertedItems, []));
});

// ── SUBMIT FOR APPROVAL ────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/submit", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, remarks } = req.body;
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "Draft") { res.status(400).json({ error: "Invoice must be in Draft to submit" }); return; }
  if (existing.matchStatus === "MismatchPending" && !existing.mismatchApprovedAt) {
    res.status(400).json({ error: "Mismatch must be approved before submitting this invoice" }); return;
  }
  const [inv] = await db.update(procInvoicesTable).set({
    status: "PendingApproval", submittedAt: new Date(), submittedBy: userId, submittedByName: userName, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "Submitted", userName, userId, remarks ?? "Submitted for approval");
  res.json(fmtInvoice(inv));
});

// ── APPROVE MISMATCH ───────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/approve-mismatch", async (req, res): Promise<void> => {
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
  res.json(fmtInvoice(inv));
});

// ── APPROVE ───────────────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Remarks required to approve invoice" }); return; }
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "PendingApproval") { res.status(400).json({ error: "Invoice must be in PendingApproval to approve" }); return; }
  // Task 9: Prevent approval when 3-way match mismatch has not been explicitly signed off
  if (existing.matchStatus === "MismatchPending" && !existing.mismatchApprovedAt) {
    res.status(400).json({ error: "This invoice has a 3-way match mismatch that has not been signed off. Use 'Approve Mismatch' first before approving the invoice." }); return;
  }
  const [inv] = await db.update(procInvoicesTable).set({
    status: "Approved", approvedAt: new Date(), approvedBy: userId, approvedByName: userName,
    approvalRemarks: remarks, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "Approved", userName, userId, remarks);
  const [items, auditLogs] = await Promise.all([
    db.select().from(procInvoiceItemsTable).where(eq(procInvoiceItemsTable.invoiceId, id)).orderBy(procInvoiceItemsTable.lineNo),
    db.select().from(procInvoiceAuditLogsTable).where(eq(procInvoiceAuditLogsTable.invoiceId, id)).orderBy(desc(procInvoiceAuditLogsTable.createdAt)),
  ]);
  res.json(fmtInvoice(inv, items, auditLogs));
});

// ── REJECT ────────────────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/reject", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Remarks required to reject invoice" }); return; }
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "PendingApproval") { res.status(400).json({ error: "Invoice must be in PendingApproval to reject" }); return; }
  const [inv] = await db.update(procInvoicesTable).set({
    status: "OnHold", rejectedAt: new Date(), rejectedBy: userId, rejectedByName: userName,
    approvalRemarks: remarks, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "Rejected", userName, userId, remarks);
  res.json(fmtInvoice(inv));
});

// ── MARK PAID ─────────────────────────────────────────────────────────────────
router.post("/proc-invoices/:id/mark-paid", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, paymentReference, paymentMode, remarks } = req.body;
  const [existing] = await db.select().from(procInvoicesTable).where(eq(procInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "Approved") { res.status(400).json({ error: "Invoice must be Approved before marking as Paid" }); return; }
  const [inv] = await db.update(procInvoicesTable).set({
    status: "Paid", paidAt: new Date(), paidBy: userId, paidByName: userName,
    paymentReference: paymentReference ?? null, paymentMode: paymentMode ?? null, updatedAt: new Date(),
  }).where(eq(procInvoicesTable.id, id)).returning();
  await logAudit(id, "Paid", userName, userId, remarks ?? `Payment recorded. Ref: ${paymentReference ?? "N/A"}`);
  const [items, auditLogs] = await Promise.all([
    db.select().from(procInvoiceItemsTable).where(eq(procInvoiceItemsTable.invoiceId, id)).orderBy(procInvoiceItemsTable.lineNo),
    db.select().from(procInvoiceAuditLogsTable).where(eq(procInvoiceAuditLogsTable.invoiceId, id)).orderBy(desc(procInvoiceAuditLogsTable.createdAt)),
  ]);
  res.json(fmtInvoice(inv, items, auditLogs));
});

export default router;
