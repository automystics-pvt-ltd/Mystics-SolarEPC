import { Router, type IRouter } from "express";
import {
  db, procGRNsTable, procGRNItemsTable, procGRNAuditLogsTable,
  procurementPOsTable, procPOItemsTable, procPOAuditLogsTable,
  grnCommentsTable, notificationsTable, stockLedgerTable,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import pg from "pg";

const router: IRouter = Router();

let grnCounter = 1;
(async () => {
  const r = await db.select().from(procGRNsTable).orderBy(desc(procGRNsTable.id)).limit(1);
  if (r.length > 0) grnCounter = r[0].id + 1;
})();

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

function fmtGRN(grn: typeof procGRNsTable.$inferSelect, items: any[] = [], auditLogs: any[] = [], comments: any[] = []) {
  return {
    id: grn.id, grnNumber: grn.grnNumber, poId: grn.poId, vendorId: grn.vendorId,
    vendorName: grn.vendorName, status: grn.status,
    isLocked: grn.isLocked,
    warehouseId: grn.warehouseId, warehouseName: grn.warehouseName,
    storageLocation: grn.storageLocation,
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
    cancelledAt: grn.cancelledAt?.toISOString(),
    cancelledBy: grn.cancelledBy, cancelledByName: grn.cancelledByName,
    cancellationReason: grn.cancellationReason,
    reversedAt: grn.reversedAt?.toISOString(),
    reversedBy: grn.reversedBy, reversedByName: grn.reversedByName,
    reversalReason: grn.reversalReason,
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
      batchNumber: i.batchNumber, serialNumbers: i.serialNumbers,
      expiryDate: i.expiryDate, barcodeData: i.barcodeData,
      storageLocation: i.storageLocation,
      unitPrice: n(i.unitPrice), acceptedValue: n(i.acceptedValue),
    })),
    auditLogs: auditLogs.map(a => ({
      id: a.id, grnId: a.grnId, action: a.action,
      performedBy: a.performedBy, performedByName: a.performedByName,
      remarks: a.remarks, oldValues: a.oldValues, newValues: a.newValues,
      createdAt: a.createdAt.toISOString(),
    })),
    comments: comments.map(c => ({
      id: c.id, grnId: c.grnId, parentId: c.parentId,
      userId: c.userId, userName: c.userName, userRole: c.userRole,
      body: c.body, attachmentUrl: c.attachmentUrl, attachmentName: c.attachmentName,
      createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
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

async function notifyAdminsAndApprovers(title: string, message: string, entityRef: string, entityId: number, actionUrl: string, type: "info" | "success" | "warning" | "error" | "approval" = "info") {
  try {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query("SELECT id FROM users WHERE role IN ('admin','approver') LIMIT 20");
      if (result.rows.length > 0) {
        const vals = result.rows.map((_: any, i: number) =>
          `($${i * 7 + 1},$${i * 7 + 2},$${i * 7 + 3},$${i * 7 + 4},$${i * 7 + 5},$${i * 7 + 6},$${i * 7 + 7})`
        ).join(",");
        const params = result.rows.flatMap((r: any) => [r.id, type, title, message, "grn", entityId, actionUrl]);
        await client.query(
          `INSERT INTO notifications (user_id,type,title,message,entity_type,entity_id,action_url,entity_ref,is_read,created_at)
           SELECT u.id,$2,$3,$4,$5,$6,$7,$8,false,NOW() FROM (VALUES ${vals}) AS u(id,a,b,c,d,e,f)
           WHERE u.id::int = u.id::int`,
          params
        );
      }
    } finally {
      await client.end();
    }
  } catch {
    // Non-fatal — notifications failure must not fail the main operation
  }
}

async function notifyUser(userId: number, title: string, message: string, entityRef: string, entityId: number, actionUrl: string, type: "info" | "success" | "warning" | "error" | "approval" = "info") {
  try {
    await db.insert(notificationsTable).values({
      userId, type, title, message, entityType: "grn", entityId, entityRef, actionUrl, isRead: false,
    });
  } catch {
    // Non-fatal
  }
}

// ── LIST ─────────────────────────────────────────────────────────────────────
router.get("/proc-grns", async (req, res): Promise<void> => {
  let query = db.select().from(procGRNsTable).orderBy(desc(procGRNsTable.createdAt)).$dynamic();
  if (req.query.poId) query = query.where(eq(procGRNsTable.poId, Number(req.query.poId)));
  if (req.query.status) query = query.where(eq(procGRNsTable.status, req.query.status as any));
  if (req.query.vendorId) query = query.where(eq(procGRNsTable.vendorId, Number(req.query.vendorId)));
  const rows = await query;
  res.json(rows.map(r => fmtGRN(r)));
});

// ── GET SINGLE ────────────────────────────────────────────────────────────────
router.get("/proc-grns/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [grn] = await db.select().from(procGRNsTable).where(eq(procGRNsTable.id, id));
  if (!grn) { res.status(404).json({ error: "GRN not found" }); return; }
  const [items, auditLogs, comments] = await Promise.all([
    db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, id)).orderBy(procGRNItemsTable.lineNo),
    db.select().from(procGRNAuditLogsTable).where(eq(procGRNAuditLogsTable.grnId, id)).orderBy(desc(procGRNAuditLogsTable.createdAt)),
    db.select().from(grnCommentsTable).where(eq(grnCommentsTable.grnId, id)).orderBy(grnCommentsTable.createdAt),
  ]);
  res.json(fmtGRN(grn, items, auditLogs, comments));
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post("/proc-grns", async (req, res): Promise<void> => {
  const { poId, items: itemsBody = [], userName = "System", userId, userRole,
    warehouseId, warehouseName, storageLocation, ...body } = req.body;

  const [po] = await db.select().from(procurementPOsTable).where(eq(procurementPOsTable.id, Number(poId)));
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }

  const ALLOWED_GRN_STATUSES = ["Issued", "Acknowledged", "PartiallyReceived"];
  if (!ALLOWED_GRN_STATUSES.includes(po.status)) {
    const fullyReceivedMsg = po.status === "FullyReceived"
      ? "All items on this PO are already fully delivered."
      : `Allowed statuses: ${ALLOWED_GRN_STATUSES.join(", ")}.`;
    res.status(400).json({
      error: `Cannot create a GRN against PO ${po.poNumber} because it is ${po.status}. ${fullyReceivedMsg}`,
    });
    return;
  }

  const poItems = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, Number(poId))).orderBy(procPOItemsTable.lineNo);

  if (poItems.length > 0 && poItems.every(p => Number(p.deliveredQty) >= Number(p.qty))) {
    res.status(400).json({
      error: `All line items on PO ${po.poNumber} are already fully delivered. No additional GRN can be created.`,
    });
    return;
  }

  for (const item of itemsBody) {
    if (!item.poItemId) continue;
    const poItem = poItems.find(p => p.id === Number(item.poItemId));
    if (!poItem) continue;
    const alreadyDelivered = Number(poItem.deliveredQty) || 0;
    const remaining = Number(poItem.qty) - alreadyDelivered;
    const accepting = Number(item.acceptedQty) || 0;
    if (accepting > remaining + 0.001) {
      res.status(400).json({
        error: `Over-delivery not allowed for "${poItem.materialName}": ordered ${poItem.qty}, already delivered ${alreadyDelivered}, attempting to accept ${accepting} (remaining allowance: ${remaining.toFixed(3)}).`,
      });
      return;
    }
  }

  const year = new Date().getFullYear();
  const grnNumber = `GRN-${year}-${String(grnCounter++).padStart(4, "0")}`;
  const now = new Date();

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
    totalOrdered += orderedQty; totalReceived += receivedQty;
    totalAccepted += acceptedQty; totalRejected += rejectedQty;
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
    warehouseId: warehouseId ? Number(warehouseId) : undefined,
    warehouseName: warehouseName ?? undefined,
    storageLocation: storageLocation ?? undefined,
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
        batchNumber: item.batchNumber ?? null, serialNumbers: item.serialNumbers ?? null,
        expiryDate: item.expiryDate ?? null, barcodeData: item.barcodeData ?? null,
        storageLocation: item.storageLocation ?? null,
        unitPrice: item.unitPrice, acceptedValue: item.acceptedValue,
      }))
    ).returning();
  }

  await logGRNAudit(grn.id, "Created", userName, userId, `GRN ${grnNumber} created for PO ${po.poNumber}`);
  res.status(201).json(fmtGRN(grn, insertedItems, []));
});

// ── SUBMIT FOR INSPECTION ─────────────────────────────────────────────────────
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
  // Notify approvers
  notifyAdminsAndApprovers(
    `GRN ${existing.grnNumber} Submitted`,
    `GRN ${existing.grnNumber} from ${existing.vendorName} has been submitted for inspection by ${userName}.`,
    existing.grnNumber, id, `/procurement/grns/${id}`, "approval"
  );
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

  const totalOrdered = Number(existing.totalOrderedQty) || 0;
  const totalAccepted = Number(existing.totalAcceptedQty) || 0;
  const newStatus: "Accepted" | "PartiallyAccepted" | "Rejected" =
    totalAccepted === 0 ? "Rejected" :
    totalAccepted >= totalOrdered ? "Accepted" : "PartiallyAccepted";

  const shouldLock = newStatus !== "Rejected";

  const [grn] = await db.update(procGRNsTable).set({
    status: newStatus,
    isLocked: shouldLock,
    approvedAt: new Date(), approvedBy: userId, approvedByName: userName,
    approvalRemarks: remarks, updatedAt: new Date(),
  }).where(eq(procGRNsTable.id, id)).returning();

  const grnItems = await db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, id));

  if (newStatus !== "Rejected") {
    const today = new Date().toISOString().slice(0, 10);
    const warehouseId = existing.warehouseId ?? 1; // fallback warehouse

    for (const item of grnItems) {
      // Update PO item deliveredQty
      if (item.poItemId) {
        const [poItem] = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.id, item.poItemId));
        if (poItem) {
          const newDelivered = (Number(poItem.deliveredQty) || 0) + (Number(item.acceptedQty) || 0);
          await db.update(procPOItemsTable).set({ deliveredQty: newDelivered.toString() }).where(eq(procPOItemsTable.id, item.poItemId));
        }
      }

      // Write stock ledger Inward entry if accepted qty > 0
      const acceptedQty = Number(item.acceptedQty) || 0;
      if (acceptedQty > 0) {
        // Get current balance for this item in this warehouse
        const balRows = await db.select({ bal: sql<string>`COALESCE(SUM(CASE WHEN txn_type='Inward' THEN qty WHEN txn_type='Outward' THEN -qty ELSE 0 END),0)` })
          .from(stockLedgerTable)
          .where(and(eq(stockLedgerTable.warehouseId, warehouseId), eq(stockLedgerTable.itemName, item.materialName)));
        const currentBalance = Number(balRows[0]?.bal) || 0;
        const newBalance = currentBalance + acceptedQty;
        await db.insert(stockLedgerTable).values({
          warehouseId,
          itemId: item.materialId ?? undefined,
          itemName: item.materialName,
          txnType: "Inward",
          qty: acceptedQty.toString(),
          balanceQty: newBalance.toString(),
          refDocType: "GRN",
          refDocId: id,
          date: today,
        });
      }
    }

    // Update PO status
    const poItems = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, existing.poId));
    const allFull = poItems.every(i => Number(i.deliveredQty) >= Number(i.qty));
    const anyDelivered = poItems.some(i => Number(i.deliveredQty) > 0);
    const newPOStatus = allFull ? "FullyReceived" : anyDelivered ? "PartiallyReceived" : undefined;
    if (newPOStatus) {
      await db.update(procurementPOsTable).set({ status: newPOStatus, updatedAt: new Date() }).where(eq(procurementPOsTable.id, existing.poId));
      await logPOAudit(existing.poId, newPOStatus, userName, userId, `Updated via GRN ${existing.grnNumber} approval`);
    }
  }

  await logGRNAudit(id, `Approved (${newStatus})`, userName, userId, remarks, { status: existing.status }, { status: newStatus });

  // Notify GRN creator
  if (existing.createdBy) {
    notifyUser(existing.createdBy,
      `GRN ${existing.grnNumber} ${newStatus}`,
      `GRN ${existing.grnNumber} has been ${newStatus.toLowerCase()} by ${userName}. ${remarks}`,
      existing.grnNumber, id, `/procurement/grns/${id}`,
      newStatus === "Rejected" ? "error" : "success"
    );
  }

  const [items, auditLogs, comments] = await Promise.all([
    db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, id)).orderBy(procGRNItemsTable.lineNo),
    db.select().from(procGRNAuditLogsTable).where(eq(procGRNAuditLogsTable.grnId, id)).orderBy(desc(procGRNAuditLogsTable.createdAt)),
    db.select().from(grnCommentsTable).where(eq(grnCommentsTable.grnId, id)).orderBy(grnCommentsTable.createdAt),
  ]);
  res.json(fmtGRN(grn, items, auditLogs, comments));
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

  if (existing.createdBy) {
    notifyUser(existing.createdBy,
      `GRN ${existing.grnNumber} Rejected`,
      `GRN ${existing.grnNumber} has been rejected by ${userName}. Reason: ${remarks}`,
      existing.grnNumber, id, `/procurement/grns/${id}`, "error"
    );
  }

  const [items, auditLogs] = await Promise.all([
    db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, id)).orderBy(procGRNItemsTable.lineNo),
    db.select().from(procGRNAuditLogsTable).where(eq(procGRNAuditLogsTable.grnId, id)).orderBy(desc(procGRNAuditLogsTable.createdAt)),
  ]);
  res.json(fmtGRN(grn, items, auditLogs));
});

// ── CANCEL ────────────────────────────────────────────────────────────────────
router.post("/proc-grns/:id/cancel", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, reason } = req.body;
  if (!reason) { res.status(400).json({ error: "Cancellation reason is required" }); return; }
  const [existing] = await db.select().from(procGRNsTable).where(eq(procGRNsTable.id, id));
  if (!existing) { res.status(404).json({ error: "GRN not found" }); return; }
  if (!["Draft", "Submitted"].includes(existing.status)) {
    res.status(400).json({ error: `Cannot cancel a GRN in ${existing.status} status. Only Draft or Submitted GRNs can be cancelled.` }); return;
  }
  const [grn] = await db.update(procGRNsTable).set({
    status: "Cancelled",
    cancelledAt: new Date(), cancelledBy: userId, cancelledByName: userName,
    cancellationReason: reason, updatedAt: new Date(),
  }).where(eq(procGRNsTable.id, id)).returning();
  await logGRNAudit(id, "Cancelled", userName, userId, reason, { status: existing.status }, { status: "Cancelled" });

  notifyAdminsAndApprovers(
    `GRN ${existing.grnNumber} Cancelled`,
    `GRN ${existing.grnNumber} has been cancelled by ${userName}. Reason: ${reason}`,
    existing.grnNumber, id, `/procurement/grns/${id}`, "warning"
  );

  const [items, auditLogs] = await Promise.all([
    db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, id)).orderBy(procGRNItemsTable.lineNo),
    db.select().from(procGRNAuditLogsTable).where(eq(procGRNAuditLogsTable.grnId, id)).orderBy(desc(procGRNAuditLogsTable.createdAt)),
  ]);
  res.json(fmtGRN(grn, items, auditLogs));
});

// ── REVERSE ───────────────────────────────────────────────────────────────────
// Reverses an Accepted/PartiallyAccepted GRN: undoes PO delivery quantities
// and writes Outward stock ledger entries.
router.post("/proc-grns/:id/reverse", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userName = "System", userId, reason } = req.body;
  if (!reason) { res.status(400).json({ error: "Reversal reason is required" }); return; }
  const [existing] = await db.select().from(procGRNsTable).where(eq(procGRNsTable.id, id));
  if (!existing) { res.status(404).json({ error: "GRN not found" }); return; }
  if (!["Accepted", "PartiallyAccepted"].includes(existing.status)) {
    res.status(400).json({ error: `Cannot reverse a GRN in ${existing.status} status. Only Accepted or PartiallyAccepted GRNs can be reversed.` }); return;
  }

  const grnItems = await db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, id));
  const today = new Date().toISOString().slice(0, 10);
  const warehouseId = existing.warehouseId ?? 1;

  // Undo PO item deliveredQty and write Outward stock ledger
  for (const item of grnItems) {
    const acceptedQty = Number(item.acceptedQty) || 0;
    if (item.poItemId && acceptedQty > 0) {
      const [poItem] = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.id, item.poItemId));
      if (poItem) {
        const newDelivered = Math.max(0, (Number(poItem.deliveredQty) || 0) - acceptedQty);
        await db.update(procPOItemsTable).set({ deliveredQty: newDelivered.toString() }).where(eq(procPOItemsTable.id, item.poItemId));
      }
      // Stock ledger Outward
      const balRows = await db.select({ bal: sql<string>`COALESCE(SUM(CASE WHEN txn_type='Inward' THEN qty WHEN txn_type='Outward' THEN -qty ELSE 0 END),0)` })
        .from(stockLedgerTable)
        .where(and(eq(stockLedgerTable.warehouseId, warehouseId), eq(stockLedgerTable.itemName, item.materialName)));
      const currentBalance = Number(balRows[0]?.bal) || 0;
      const newBalance = Math.max(0, currentBalance - acceptedQty);
      await db.insert(stockLedgerTable).values({
        warehouseId, itemId: item.materialId ?? undefined, itemName: item.materialName,
        txnType: "Outward", qty: acceptedQty.toString(), balanceQty: newBalance.toString(),
        refDocType: "GRN_REVERSAL", refDocId: id, date: today,
      });
    }
  }

  // Reset PO status to PartiallyReceived/Issued based on remaining deliveries
  const poItems = await db.select().from(procPOItemsTable).where(eq(procPOItemsTable.poId, existing.poId));
  const anyDelivered = poItems.some(i => Number(i.deliveredQty) > 0);
  const newPOStatus = anyDelivered ? "PartiallyReceived" : "Issued";
  await db.update(procurementPOsTable).set({ status: newPOStatus, updatedAt: new Date() }).where(eq(procurementPOsTable.id, existing.poId));
  await logPOAudit(existing.poId, newPOStatus, userName, userId, `PO delivery reversed via GRN ${existing.grnNumber} reversal`);

  const [grn] = await db.update(procGRNsTable).set({
    status: "Reversed", isLocked: false,
    reversedAt: new Date(), reversedBy: userId, reversedByName: userName,
    reversalReason: reason, updatedAt: new Date(),
  }).where(eq(procGRNsTable.id, id)).returning();
  await logGRNAudit(id, "Reversed", userName, userId, reason, { status: existing.status }, { status: "Reversed" });

  notifyAdminsAndApprovers(
    `GRN ${existing.grnNumber} Reversed`,
    `GRN ${existing.grnNumber} has been reversed by ${userName}. Stock quantities have been unwound. Reason: ${reason}`,
    existing.grnNumber, id, `/procurement/grns/${id}`, "warning"
  );

  const [items, auditLogs, comments] = await Promise.all([
    db.select().from(procGRNItemsTable).where(eq(procGRNItemsTable.grnId, id)).orderBy(procGRNItemsTable.lineNo),
    db.select().from(procGRNAuditLogsTable).where(eq(procGRNAuditLogsTable.grnId, id)).orderBy(desc(procGRNAuditLogsTable.createdAt)),
    db.select().from(grnCommentsTable).where(eq(grnCommentsTable.grnId, id)).orderBy(grnCommentsTable.createdAt),
  ]);
  res.json(fmtGRN(grn, items, auditLogs, comments));
});

// ── COMMENTS ──────────────────────────────────────────────────────────────────
router.get("/proc-grns/:id/comments", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const comments = await db.select().from(grnCommentsTable).where(eq(grnCommentsTable.grnId, id)).orderBy(grnCommentsTable.createdAt);
  res.json(comments.map(c => ({
    id: c.id, grnId: c.grnId, parentId: c.parentId,
    userId: c.userId, userName: c.userName, userRole: c.userRole,
    body: c.body, attachmentUrl: c.attachmentUrl, attachmentName: c.attachmentName,
    createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
  })));
});

router.post("/proc-grns/:id/comments", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userId, userName, userRole, body, parentId } = req.body;
  if (!body?.trim()) { res.status(400).json({ error: "Comment body is required" }); return; }
  const [existing] = await db.select().from(procGRNsTable).where(eq(procGRNsTable.id, id));
  if (!existing) { res.status(404).json({ error: "GRN not found" }); return; }
  const [comment] = await db.insert(grnCommentsTable).values({
    grnId: id, userId, userName, userRole,
    body: body.trim(), parentId: parentId ?? null,
  }).returning();
  // Notify GRN creator if someone else comments
  if (existing.createdBy && existing.createdBy !== userId) {
    notifyUser(existing.createdBy,
      `New comment on ${existing.grnNumber}`,
      `${userName ?? "Someone"} commented on GRN ${existing.grnNumber}: "${body.trim().slice(0, 80)}"`,
      existing.grnNumber, id, `/procurement/grns/${id}`, "info"
    );
  }
  res.status(201).json({
    id: comment.id, grnId: comment.grnId, parentId: comment.parentId,
    userId: comment.userId, userName: comment.userName, userRole: comment.userRole,
    body: comment.body, attachmentUrl: comment.attachmentUrl, attachmentName: comment.attachmentName,
    createdAt: comment.createdAt.toISOString(), updatedAt: comment.updatedAt.toISOString(),
  });
});

router.delete("/proc-grns/:id/comments/:commentId", async (req, res): Promise<void> => {
  const grnId = Number(req.params.id);
  const commentId = Number(req.params.commentId);
  const [comment] = await db.select().from(grnCommentsTable).where(
    and(eq(grnCommentsTable.id, commentId), eq(grnCommentsTable.grnId, grnId))
  );
  if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }
  await db.delete(grnCommentsTable).where(eq(grnCommentsTable.id, commentId));
  res.json({ success: true });
});

export default router;
