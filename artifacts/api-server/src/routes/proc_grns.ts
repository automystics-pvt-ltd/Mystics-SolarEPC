import { Router, type IRouter } from "express";
import {
  db, procGRNsTable, procGRNItemsTable, procGRNAuditLogsTable,
  procurementPOsTable, procPOItemsTable, procPOAuditLogsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

let grnCounter = 1;
(async () => {
  const r = await db.select().from(procGRNsTable).orderBy(desc(procGRNsTable.id)).limit(1);
  if (r.length > 0) grnCounter = r[0].id + 1;
})();

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

function fmtGRN(grn: typeof procGRNsTable.$inferSelect, items: any[] = [], auditLogs: any[] = []) {
  return {
    id: grn.id, grnNumber: grn.grnNumber, poId: grn.poId, vendorId: grn.vendorId,
    vendorName: grn.vendorName, status: grn.status,
    deliveryDate: grn.deliveryDate, vehicleNumber: grn.vehicleNumber,
    dcNumber: grn.dcNumber, dcDate: grn.dcDate,
    receivedBy: grn.receivedBy, receivedByName: grn.receivedByName,
    receivedAt: grn.receivedAt?.toISOString(),
    inspectedBy: grn.inspectedBy, inspectedByName: grn.inspectedByName,
    inspectedAt: grn.inspectedAt?.toISOString(),
    approvedBy: grn.approvedBy, approvedByName: grn.approvedByName,
    approvedAt: grn.approvedAt?.toISOString(),
    rejectedBy: grn.rejectedBy, rejectedByName: grn.rejectedByName,
    rejectedAt: grn.rejectedAt?.toISOString(),
    approvalRemarks: grn.approvalRemarks,
    totalOrderedQty: n(grn.totalOrderedQty), totalReceivedQty: n(grn.totalReceivedQty),
    totalAcceptedQty: n(grn.totalAcceptedQty), totalRejectedQty: n(grn.totalRejectedQty),
    totalAcceptedValue: n(grn.totalAcceptedValue),
    remarks: grn.remarks, internalNotes: grn.internalNotes,
    createdBy: grn.createdBy, createdByName: grn.createdByName,
    createdAt: grn.createdAt.toISOString(), updatedAt: grn.updatedAt.toISOString(),
    items: items.map(i => ({
      id: i.id, grnId: i.grnId, poItemId: i.poItemId, lineNo: i.lineNo,
      materialId: i.materialId, materialCode: i.materialCode, materialName: i.materialName,
      description: i.description, uom: i.uom, hsnSacCode: i.hsnSacCode,
      orderedQty: n(i.orderedQty), receivedQty: n(i.receivedQty),
      acceptedQty: n(i.acceptedQty), rejectedQty: n(i.rejectedQty),
      damagedQty: n(i.damagedQty), excessQty: n(i.excessQty), shortQty: n(i.shortQty),
      qcStatus: i.qcStatus, rejectionReason: i.rejectionReason, itemRemarks: i.itemRemarks,
      unitPrice: n(i.unitPrice), acceptedValue: n(i.acceptedValue),
    })),
    auditLogs: auditLogs.map(a => ({
      id: a.id, grnId: a.grnId, action: a.action,
      performedBy: a.performedBy, performedByName: a.performedByName,
      remarks: a.remarks, oldValues: a.oldValues, newValues: a.newValues,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

async function logGRNAudit(grnId: number, action: string, performedByName: string, performedBy?: number, remarks?: string, oldValues?: any, newValues?: any) {
  await db.insert(procGRNAuditLogsTable).values({
    grnId, action, performedBy, performedByName, remarks,
    oldValues: oldValues ?? null, newValues: newValues ?? null,
  });
}

async function logPOAudit(poId: number, action: string, performedByName: string, performedBy?: number, remarks?: string) {
  await db.insert(procPOAuditLogsTable).values({
    poId, action, performedBy, performedByName, remarks,
  });
}

// ── LIST ─────────────────────────────────────────────────────────────────────
router.get("/proc-grns", async (req, res): Promise<void> => {
  let query = db.select().from(procGRNsTable).orderBy(desc(procGRNsTable.createdAt)).$dynamic();
  if (req.query.poId) query = query.where(eq(procGRNsTable.poId, Number(req.query.poId)));
  if (req.query.status) query = query.where(eq(procGRNsTable.status, req.query.status as any));
  const rows = await query;
  res.json(rows.map(r => fmtGRN(r)));
});

// ── GET SINGLE ────────────────────────────────────────────────────────────────
router.get("/proc-grns/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [grn] = await db.select().from(procGRNsTable).where(eq(procGRNsTable.id, id));
  if (!grn) { res.status(404).json({ error: "GRN not found" }); return; }
  const [items, auditLogs] = await Promise.all([
    db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, id)).orderBy(procGRNItemsTable.lineNo),
    db.select().from(procGRNAuditLogsTable).where(eq(procGRNAuditLogsTable.grnId, id)).orderBy(desc(procGRNAuditLogsTable.createdAt)),
  ]);
  res.json(fmtGRN(grn, items, auditLogs));
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post("/proc-grns", async (req, res): Promise<void> => {
  const { poId, items: itemsBody = [], userName = "System", userId, userRole, ...body } = req.body;

  // Fetch PO for vendor details
  const [po] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, Number(poId)));
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }

  // Only allow GRN creation against POs that have been issued to the vendor.
  // Allowlist: Issued, Acknowledged, PartiallyReceived, FullyReceived.
  const ALLOWED_GRN_STATUSES = ["Issued", "Acknowledged", "PartiallyReceived", "FullyReceived"];
  if (!ALLOWED_GRN_STATUSES.includes(po.status)) {
    res.status(400).json({
      error: `Cannot create a GRN against PO ${po.poNumber} because it is ${po.status}. Allowed statuses: ${ALLOWED_GRN_STATUSES.join(", ")}.`,
    });
    return;
  }

  // Fetch PO items to get ordered quantities
  const poItems = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, Number(poId))).orderBy(procPOItemsTable.lineNo);

  const year = new Date().getFullYear();
  const grnNumber = `GRN-${year}-${String(grnCounter++).padStart(4, "0")}`;
  const now = new Date();

  // Calculate totals
  let totalOrdered = 0, totalReceived = 0, totalAccepted = 0, totalRejected = 0, totalAcceptedValue = 0;
  const calcItems = itemsBody.map((item: any, idx: number) => {
    const orderedQty = Number(item.orderedQty) || 0;
    const receivedQty = Number(item.receivedQty) || 0;
    const acceptedQty = Number(item.acceptedQty) || 0;
    const rejectedQty = Number(item.rejectedQty) || 0;
    const damagedQty = Number(item.damagedQty) || 0;
    const excessQty = Math.max(0, receivedQty - orderedQty);
    const shortQty = Math.max(0, orderedQty - receivedQty);
    const unitPrice = Number(item.unitPrice) || 0;
    const acceptedValue = parseFloat((acceptedQty * unitPrice).toFixed(2));
    totalOrdered += orderedQty;
    totalReceived += receivedQty;
    totalAccepted += acceptedQty;
    totalRejected += rejectedQty;
    totalAcceptedValue += acceptedValue;

    let qcStatus: "Pending" | "Accepted" | "PartiallyAccepted" | "Rejected" = "Pending";
    if (acceptedQty > 0 && rejectedQty === 0) qcStatus = "Accepted";
    else if (acceptedQty > 0 && rejectedQty > 0) qcStatus = "PartiallyAccepted";
    else if (acceptedQty === 0 && rejectedQty > 0) qcStatus = "Rejected";

    return {
      ...item, lineNo: idx + 1, excessQty, shortQty, qcStatus, acceptedValue: acceptedValue.toString(),
      orderedQty: orderedQty.toString(), receivedQty: receivedQty.toString(),
      acceptedQty: acceptedQty.toString(), rejectedQty: rejectedQty.toString(),
      damagedQty: damagedQty.toString(), unitPrice: unitPrice.toString(),
    };
  });

  const [grn] = await db.insert(procGRNsTable).values({
    grnNumber, poId: Number(poId),
    vendorId: po.vendorId, vendorName: po.vendorName,
    totalOrderedQty: totalOrdered.toString(), totalReceivedQty: totalReceived.toString(),
    totalAcceptedQty: totalAccepted.toString(), totalRejectedQty: totalRejected.toString(),
    totalAcceptedValue: totalAcceptedValue.toString(),
    receivedByName: userName, receivedBy: userId, receivedAt: now,
    ...body, createdBy: userId, createdByName: userName,
  }).returning();

  let insertedItems: any[] = [];
  if (calcItems.length > 0) {
    insertedItems = await db.insert(procGRNItemsTable).values(
      calcItems.map((item: any) => ({
        grnId: grn.id, lineNo: item.lineNo, poItemId: item.poItemId ?? null,
        materialId: item.materialId ?? null, materialCode: item.materialCode ?? null,
        materialName: item.materialName, description: item.description ?? null,
        uom: item.uom ?? "Nos", hsnSacCode: item.hsnSacCode ?? null,
        orderedQty: item.orderedQty, receivedQty: item.receivedQty,
        acceptedQty: item.acceptedQty, rejectedQty: item.rejectedQty,
        damagedQty: item.damagedQty, excessQty: item.excessQty.toString(),
        shortQty: item.shortQty.toString(), qcStatus: item.qcStatus,
        rejectionReason: item.rejectionReason ?? null, itemRemarks: item.itemRemarks ?? null,
        unitPrice: item.unitPrice, acceptedValue: item.acceptedValue,
      }))
    ).returning();
  }

  await logGRNAudit(grn.id, "Created", userName, userId, `GRN ${grnNumber} created for PO ${po.poNumber}`);
  res.status(201).json(fmtGRN(grn, insertedItems, []));
});

// ── SUBMIT FOR INSPECTION ──────────────────────────────────────────────────────
router.post("/proc-grns/:id/submit", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, remarks } = req.body;
  const [existing] = await db.select().from(procGRNsTable).where(eq(procGRNsTable.id, id));
  if (!existing) { res.status(404).json({ error: "GRN not found" }); return; }
  if (existing.status !== "Draft") { res.status(400).json({ error: "GRN must be in Draft status to submit" }); return; }
  const [grn] = await db.update(procGRNsTable).set({
    status: "Submitted", inspectedAt: new Date(), inspectedBy: userId, inspectedByName: userName, updatedAt: new Date(),
  }).where(eq(procGRNsTable.id, id)).returning();
  await logGRNAudit(id, "Submitted", userName, userId, remarks ?? "Submitted for inspection");
  res.json(fmtGRN(grn));
});

// ── APPROVE ───────────────────────────────────────────────────────────────────
router.post("/proc-grns/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Remarks are required for GRN approval" }); return; }
  const [existing] = await db.select().from(procGRNsTable).where(eq(procGRNsTable.id, id));
  if (!existing) { res.status(404).json({ error: "GRN not found" }); return; }
  if (existing.status !== "Submitted") { res.status(400).json({ error: "GRN must be in Submitted status to approve" }); return; }

  // Determine accepted vs total to decide partial or full
  const totalOrdered = Number(existing.totalOrderedQty) || 0;
  const totalAccepted = Number(existing.totalAcceptedQty) || 0;
  const newStatus: "Accepted" | "PartiallyAccepted" = totalAccepted >= totalOrdered ? "Accepted" : "PartiallyAccepted";

  const [grn] = await db.update(procGRNsTable).set({
    status: newStatus, approvedAt: new Date(), approvedBy: userId, approvedByName: userName,
    approvalRemarks: remarks, updatedAt: new Date(),
  }).where(eq(procGRNsTable.id, id)).returning();

  // Update PO items deliveredQty and PO status
  const grnItems = await db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, id));
  for (const item of grnItems) {
    if (item.poItemId) {
      const [poItem] = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.id, item.poItemId));
      if (poItem) {
        const newDelivered = (Number(poItem.deliveredQty) || 0) + (Number(item.acceptedQty) || 0);
        await db.update(procPOItemsTable).set({ deliveredQty: newDelivered.toString() }).where(eq(procPOItemsTable.id, item.poItemId));
      }
    }
  }

  // Update PO status based on all items' delivery progress
  const poItems = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, existing.poId));
  const allFull = poItems.every(i => Number(i.deliveredQty) >= Number(i.qty));
  const anyDelivered = poItems.some(i => Number(i.deliveredQty) > 0);
  const newPOStatus = allFull ? "FullyReceived" : anyDelivered ? "PartiallyReceived" : undefined;
  if (newPOStatus) {
    await db.update(procurementPOsTable).set({ status: newPOStatus, updatedAt: new Date() }).where(eq(procurementPOsTable.id, existing.poId));
    await logPOAudit(existing.poId, newPOStatus, userName, userId, `Updated via GRN ${existing.grnNumber} approval`);
  }

  await logGRNAudit(id, "Approved", userName, userId, remarks, { status: existing.status }, { status: newStatus });
  const [items, auditLogs] = await Promise.all([
    db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, id)).orderBy(procGRNItemsTable.lineNo),
    db.select().from(procGRNAuditLogsTable).where(eq(procGRNAuditLogsTable.grnId, id)).orderBy(desc(procGRNAuditLogsTable.createdAt)),
  ]);
  res.json(fmtGRN(grn, items, auditLogs));
});

// ── REJECT ────────────────────────────────────────────────────────────────────
router.post("/proc-grns/:id/reject", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, remarks } = req.body;
  if (!remarks) { res.status(400).json({ error: "Remarks are required for GRN rejection" }); return; }
  const [existing] = await db.select().from(procGRNsTable).where(eq(procGRNsTable.id, id));
  if (!existing) { res.status(404).json({ error: "GRN not found" }); return; }
  if (existing.status !== "Submitted") { res.status(400).json({ error: "GRN must be in Submitted status to reject" }); return; }
  const [grn] = await db.update(procGRNsTable).set({
    status: "Rejected", rejectedAt: new Date(), rejectedBy: userId, rejectedByName: userName,
    approvalRemarks: remarks, updatedAt: new Date(),
  }).where(eq(procGRNsTable.id, id)).returning();
  await logGRNAudit(id, "Rejected", userName, userId, remarks);
  const [items, auditLogs] = await Promise.all([
    db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, id)).orderBy(procGRNItemsTable.lineNo),
    db.select().from(procGRNAuditLogsTable).where(eq(procGRNAuditLogsTable.grnId, id)).orderBy(desc(procGRNAuditLogsTable.createdAt)),
  ]);
  res.json(fmtGRN(grn, items, auditLogs));
});

export default router;
