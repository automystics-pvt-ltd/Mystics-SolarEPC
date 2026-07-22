import { Router, type IRouter } from "express";
import { db, procurementPOsTable, procPOItemsTable, procurementQuotationsTable, vendorsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

function fmtPO(po: typeof procurementPOsTable.$inferSelect, items: any[] = []) {
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
  };
}

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get("/procurement-pos", async (req, res): Promise<void> => {
  let query = db.select().from(procurementPOsTable).orderBy(desc(procurementPOsTable.createdAt)).$dynamic();
  if (req.query.status) query = query.where(eq(procurementPOsTable.status, req.query.status as any));
  if (req.query.vendorId) query = query.where(eq(procurementPOsTable.vendorId, Number(req.query.vendorId)));
  const rows = await query;
  res.json(rows.map(r => fmtPO(r)));
});

// ── GET SINGLE ────────────────────────────────────────────────────────────────
router.get("/procurement-pos/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [po] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, id));
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }
  const items = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, id)).orderBy(procPOItemsTable.lineNo);
  res.json(fmtPO(po, items));
});

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────
router.patch("/procurement-pos/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { status, deliveryAddress, specialTerms, internalNotes } = req.body;
  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (status) updateData.status = status;
  if (deliveryAddress) updateData.deliveryAddress = deliveryAddress;
  if (specialTerms !== undefined) updateData.specialTerms = specialTerms;
  if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
  if (status === "Acknowledged") updateData.acknowledgedAt = new Date();
  if (status === "Closed") updateData.closedAt = new Date();
  const [po] = await db.update(procurementPOsTable).set(updateData).where(eq(procurementPOsTable.id, id)).returning();
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }
  const items = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, id)).orderBy(procPOItemsTable.lineNo);
  res.json(fmtPO(po, items));
});

export default router;
