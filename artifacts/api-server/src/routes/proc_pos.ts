import { Router, type IRouter } from "express";
import {
  db, procurementPOsTable, procPOItemsTable, procurementQuotationsTable, vendorsTable,
  procPOAuditLogsTable, procGRNsTable, procInvoicesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

function fmtPO(po: typeof procurementPOsTable.$inferSelect, items: any[] = [], auditLogs: any[] = [], grns: any[] = [], invoices: any[] = []) {
  const today = new Date().toISOString().split("T")[0];
  const deadline = po.deliveryDeadline ?? po.expectedDeliveryDate;
  const isOverdue = deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(po.status);
  return {
    id: po.id, poNumber: po.poNumber, quotationId: po.quotationId, vendorId: po.vendorId,
    vendorName: po.vendorName, vendorGstin: po.vendorGstin, vendorAddress: po.vendorAddress, vendorContact: po.vendorContact,
    status: po.status, poDate: po.poDate, deliveryDeadline: po.deliveryDeadline, deliveryAddress: po.deliveryAddress,
    paymentTerms: po.paymentTerms, warrantyMonths: po.warrantyMonths,
    freightCharges: n(po.freightCharges), otherCharges: n(po.otherCharges),
    subtotal: n(po.subtotal), totalGst: n(po.totalGst), totalAmount: n(po.totalAmount),
    specialTerms: po.specialTerms, internalNotes: po.internalNotes,
    approvedBy: po.approvedBy, approvedByName: po.approvedByName, approvedAt: po.approvedAt?.toISOString(),
    acknowledgedAt: po.acknowledgedAt?.toISOString(), closedAt: po.closedAt?.toISOString(),
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
    })),
    grns: grns.map(g => ({ id: g.id, grnNumber: g.grnNumber, status: g.status, deliveryDate: g.deliveryDate, createdAt: g.createdAt.toISOString() })),
    invoices: invoices.map(i => ({ id: i.id, invoiceNumber: i.invoiceNumber, status: i.status, totalAmount: n(i.totalAmount), createdAt: i.createdAt.toISOString() })),
  };
}

async function logAudit(poId: number, action: string, performedByName: string, performedBy?: number, remarks?: string) {
  await db.insert(procPOAuditLogsTable).values({ poId, action, performedBy, performedByName, remarks });
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  Draft: ["Issued", "Cancelled"],
  Issued: ["Acknowledged", "Cancelled"],
  Acknowledged: ["PartiallyReceived", "FullyReceived", "Cancelled"],
  PartiallyReceived: ["FullyReceived", "Cancelled"],
  FullyReceived: ["Closed"],
  Closed: [], Cancelled: [],
};

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get("/procurement-pos", async (req, res): Promise<void> => {
  let query = db.select().from(procurementPOsTable).orderBy(desc(procurementPOsTable.createdAt)).$dynamic();
  if (req.query.status) query = query.where(eq(procurementPOsTable.status, req.query.status as any));
  if (req.query.vendorId) query = query.where(eq(procurementPOsTable.vendorId, Number(req.query.vendorId)));
  const rows = await query;
  // Add isOverdue to list items too
  const today = new Date().toISOString().split("T")[0];
  res.json(rows.map(po => {
    const deadline = po.deliveryDeadline ?? po.expectedDeliveryDate;
    const isOverdue = deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(po.status);
    return { ...fmtPO(po), isOverdue: !!isOverdue };
  }));
});

// ── GET SINGLE ────────────────────────────────────────────────────────────────
router.get("/procurement-pos/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [po] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }
  const [items, auditLogs, grns, invoices] = await Promise.all([
    db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, id)).orderBy(procPOItemsTable.lineNo),
    db.select().from(procPOAuditLogsTable).where(eq(procPOAuditLogsTable.poId, id)).orderBy(desc(procPOAuditLogsTable.createdAt)),
    db.select().from(procGRNsTable).where(eq(procGRNsTable.poId, id)).orderBy(desc(procGRNsTable.createdAt)),
    db.select().from(procInvoicesTable).where(eq(procInvoicesTable.poId, id)).orderBy(desc(procInvoicesTable.createdAt)),
  ]);
  res.json(fmtPO(po, items, auditLogs, grns, invoices));
});

// ── UPDATE STATUS / METADATA ──────────────────────────────────────────────────
router.patch("/procurement-pos/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { status, deliveryAddress, specialTerms, internalNotes, userName = "System", userId, remarks, ...rest } = req.body;

  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }

  if (status && !VALID_TRANSITIONS[existing.status]?.includes(status)) {
    res.status(400).json({ error: `Cannot transition from ${existing.status} to ${status}. Valid next: ${VALID_TRANSITIONS[existing.status]?.join(", ") || "none"}` }); return;
  }

  if (status === "Cancelled") {
    const existingGRNs = await db.select({ grnNumber: procGRNsTable.grnNumber })
      .from(procGRNsTable)
      .where(eq(procGRNsTable.poId, id));
    if (existingGRNs.length > 0) {
      const grnNumbers = existingGRNs.map(g => g.grnNumber).join(", ");
      res.status(400).json({
        error: `Cannot cancel PO: goods have already started arriving. Resolve the following GRN(s) first: ${grnNumbers}`,
      });
      return;
    }
  }

  // When issuing, delivery deadline is strongly recommended
  const { deliveryDeadline } = req.body;

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (status) updateData.status = status;
  if (deliveryAddress !== undefined) updateData.deliveryAddress = deliveryAddress;
  if (specialTerms !== undefined) updateData.specialTerms = specialTerms;
  if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
  if (deliveryDeadline !== undefined) updateData.deliveryDeadline = deliveryDeadline;
  if (status === "Acknowledged") updateData.acknowledgedAt = new Date();
  if (status === "Closed") updateData.closedAt = new Date();

  const [po] = await db.update(procurementPOsTable).set(updateData).where(eq(procurementPOsTable.id, id)).returning();
  if (status) await logAudit(id, status, userName, userId, remarks ?? `Status changed to ${status}`);

  const [items, auditLogs, grns, invoices] = await Promise.all([
    db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, id)).orderBy(procPOItemsTable.lineNo),
    db.select().from(procPOAuditLogsTable).where(eq(procPOAuditLogsTable.poId, id)).orderBy(desc(procPOAuditLogsTable.createdAt)),
    db.select().from(procGRNsTable).where(eq(procGRNsTable.poId, id)).orderBy(desc(procGRNsTable.createdAt)),
    db.select().from(procInvoicesTable).where(eq(procInvoicesTable.poId, id)).orderBy(desc(procInvoicesTable.createdAt)),
  ]);
  res.json(fmtPO(po, items, auditLogs, grns, invoices));
});

// ── RECORD DISPATCH ───────────────────────────────────────────────────────────
router.post("/procurement-pos/:id/record-dispatch", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { vendorDispatchRef, trackingNumber, expectedDeliveryDate, userName = "System", userId, remarks } = req.body;
  const [existing] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!existing) { res.status(404).json({ error: "PO not found" }); return; }
  if (!["Issued", "Acknowledged"].includes(existing.status)) {
    res.status(400).json({ error: `Cannot record dispatch details on a PO in '${existing.status}' status. The PO must be in Issued or Acknowledged status.` }); return;
  }
  const [po] = await db.update(procurementPOsTable).set({
    vendorDispatchRef, trackingNumber, dispatchedAt: new Date(),
    expectedDeliveryDate: expectedDeliveryDate ?? null,
    updatedAt: new Date(),
  }).where(eq(procurementPOsTable.id, id)).returning();
  await logAudit(id, "DispatchRecorded", userName, userId, remarks ?? `Dispatch ref: ${vendorDispatchRef}, Tracking: ${trackingNumber}`);
  const [items, auditLogs, grns, invoices] = await Promise.all([
    db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, id)).orderBy(procPOItemsTable.lineNo),
    db.select().from(procPOAuditLogsTable).where(eq(procPOAuditLogsTable.poId, id)).orderBy(desc(procPOAuditLogsTable.createdAt)),
    db.select().from(procGRNsTable).where(eq(procGRNsTable.poId, id)).orderBy(desc(procGRNsTable.createdAt)),
    db.select().from(procInvoicesTable).where(eq(procInvoicesTable.poId, id)).orderBy(desc(procInvoicesTable.createdAt)),
  ]);
  res.json(fmtPO(po, items, auditLogs, grns, invoices));
});

export default router;
