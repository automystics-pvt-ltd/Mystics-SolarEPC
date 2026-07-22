import { Router, type IRouter } from "express";
import {
  db, grnReturnsTable, grnReturnItemsTable, grnReturnAuditLogsTable,
  procGRNsTable, procGRNItemsTable, notificationsTable, usersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

let retCounter = 1;
(async () => {
  const r = await db.select().from(grnReturnsTable).orderBy(desc(grnReturnsTable.id)).limit(1);
  if (r.length > 0) retCounter = r[0].id + 1;
})();

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

async function logAudit(returnId: number, action: string, performedByName: string, performedBy?: number, remarks?: string) {
  await db.insert(grnReturnAuditLogsTable).values({ returnId, action, performedBy, performedByName, remarks });
}

async function notifyAdmins(title: string, message: string, entityRef: string, entityId: number) {
  try {
    const admins = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.role, "admin"));
    const directors = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.role, "director"));
    const targets = [...admins, ...directors];
    for (const u of targets) {
      await db.insert(notificationsTable).values({
        userId: u.id, type: "approval", title, message,
        entityType: "grn_return", entityId, entityRef,
        actionUrl: `/procurement/grn-returns/${entityId}`,
      });
    }
  } catch { /* non-blocking */ }
}

function fmt(r: typeof grnReturnsTable.$inferSelect, items: any[] = [], auditLogs: any[] = []) {
  return {
    id: r.id, returnNumber: r.returnNumber, grnId: r.grnId, poId: r.poId,
    vendorId: r.vendorId, vendorName: r.vendorName, status: r.status,
    returnReason: r.returnReason, returnType: r.returnType,
    returnDate: r.returnDate, dispatchDate: r.dispatchDate,
    creditNoteNumber: r.creditNoteNumber, creditNoteDate: r.creditNoteDate,
    creditNoteAmount: n(r.creditNoteAmount),
    totalReturnQty: n(r.totalReturnQty), totalReturnValue: n(r.totalReturnValue),
    remarks: r.remarks,
    createdBy: r.createdBy, createdByName: r.createdByName,
    submittedBy: r.submittedBy, submittedByName: r.submittedByName,
    submittedAt: r.submittedAt?.toISOString(),
    approvedBy: r.approvedBy, approvedByName: r.approvedByName,
    approvedAt: r.approvedAt?.toISOString(), approvalRemarks: r.approvalRemarks,
    dispatchedBy: r.dispatchedBy, dispatchedByName: r.dispatchedByName,
    dispatchedAt: r.dispatchedAt?.toISOString(),
    closedBy: r.closedBy, closedByName: r.closedByName, closedAt: r.closedAt?.toISOString(),
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    items: items.map(i => ({
      id: i.id, returnId: i.returnId, grnItemId: i.grnItemId, lineNo: i.lineNo,
      materialId: i.materialId, materialCode: i.materialCode, materialName: i.materialName,
      uom: i.uom, returnQty: n(i.returnQty), unitPrice: n(i.unitPrice),
      returnValue: n(i.returnValue), rejectionReason: i.rejectionReason, batchLotNumber: i.batchLotNumber,
    })),
    auditLogs: auditLogs.map(a => ({
      id: a.id, returnId: a.returnId, action: a.action,
      performedBy: a.performedBy, performedByName: a.performedByName,
      remarks: a.remarks, createdAt: a.createdAt.toISOString(),
    })),
  };
}

// GET /grn-returns
router.get("/grn-returns", async (req, res): Promise<void> => {
  try {
    const { status } = req.query;
    let query = db.select().from(grnReturnsTable).orderBy(desc(grnReturnsTable.createdAt)).$dynamic();
    if (status && status !== "All") query = query.where(eq(grnReturnsTable.status, status as any));
    const rows = await query;
    res.json(rows.map(r => fmt(r)));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// GET /grn-returns/:id
router.get("/grn-returns/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [r] = await db.select().from(grnReturnsTable).where(eq(grnReturnsTable.id, id));
    if (!r) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(grnReturnItemsTable).where(eq(grnReturnItemsTable.returnId, id));
    const auditLogs = await db.select().from(grnReturnAuditLogsTable).where(eq(grnReturnAuditLogsTable.returnId, id)).orderBy(desc(grnReturnAuditLogsTable.createdAt));
    res.json(fmt(r, items, auditLogs));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// POST /grn-returns — create
router.post("/grn-returns", async (req, res): Promise<void> => {
  try {
    const { grnId, returnReason, returnType = "Rejection", returnDate, remarks, items = [],
      userName = "System", userId } = req.body;
    if (!grnId || !returnReason) { res.status(400).json({ error: "grnId, returnReason required" }); return; }

    const [grn] = await db.select().from(procGRNsTable).where(eq(procGRNsTable.id, Number(grnId)));
    if (!grn) { res.status(404).json({ error: "GRN not found" }); return; }

    const returnNumber = `RTN-${String(retCounter).padStart(4, "0")}`; retCounter++;
    const totalReturnQty = items.reduce((s: number, i: any) => s + Number(i.returnQty || 0), 0);
    const totalReturnValue = items.reduce((s: number, i: any) => s + (Number(i.returnQty || 0) * Number(i.unitPrice || 0)), 0);

    const [ret] = await db.insert(grnReturnsTable).values({
      returnNumber, grnId: Number(grnId), poId: grn.poId, vendorId: grn.vendorId,
      vendorName: grn.vendorName, returnReason, returnType, returnDate, remarks,
      totalReturnQty: String(totalReturnQty), totalReturnValue: String(totalReturnValue),
      createdBy: userId, createdByName: userName,
    }).returning();

    if (items.length > 0) {
      await db.insert(grnReturnItemsTable).values(
        items.map((i: any, idx: number) => ({
          returnId: ret.id, lineNo: idx + 1,
          grnItemId: i.grnItemId, materialId: i.materialId,
          materialCode: i.materialCode, materialName: i.materialName,
          uom: i.uom || "Nos",
          returnQty: String(i.returnQty || 0),
          unitPrice: String(i.unitPrice || 0),
          returnValue: String((Number(i.returnQty || 0) * Number(i.unitPrice || 0)).toFixed(2)),
          rejectionReason: i.rejectionReason, batchLotNumber: i.batchLotNumber,
        }))
      );
    }

    await logAudit(ret.id, "Created", userName, userId, `Return ${returnNumber} created`);
    await notifyAdmins("New GRN Return Created", `${returnNumber} raised by ${userName} for ${grn.vendorName}`, returnNumber, ret.id);
    res.status(201).json(fmt(ret));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /grn-returns/:id/submit
router.patch("/grn-returns/:id/submit", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { userName = "System", userId, remarks } = req.body;
    const [existing] = await db.select().from(grnReturnsTable).where(eq(grnReturnsTable.id, id));
    if (!existing || existing.status !== "Draft") { res.status(400).json({ error: "Only Draft returns can be submitted" }); return; }
    await db.update(grnReturnsTable).set({ status: "Submitted", submittedBy: userId, submittedByName: userName, submittedAt: new Date(), updatedAt: new Date() }).where(eq(grnReturnsTable.id, id));
    await logAudit(id, "Submitted", userName, userId, remarks);
    await notifyAdmins("GRN Return Awaiting Approval", `${existing.returnNumber} submitted by ${userName}`, existing.returnNumber, id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /grn-returns/:id/approve
router.patch("/grn-returns/:id/approve", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { userName = "System", userId, remarks } = req.body;
    const [existing] = await db.select().from(grnReturnsTable).where(eq(grnReturnsTable.id, id));
    if (!existing || existing.status !== "Submitted") { res.status(400).json({ error: "Only Submitted returns can be approved" }); return; }
    await db.update(grnReturnsTable).set({ status: "Approved", approvedBy: userId, approvedByName: userName, approvedAt: new Date(), approvalRemarks: remarks, updatedAt: new Date() }).where(eq(grnReturnsTable.id, id));
    await logAudit(id, "Approved", userName, userId, remarks);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /grn-returns/:id/dispatch
router.patch("/grn-returns/:id/dispatch", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { userName = "System", userId, dispatchDate, remarks } = req.body;
    const [existing] = await db.select().from(grnReturnsTable).where(eq(grnReturnsTable.id, id));
    if (!existing || existing.status !== "Approved") { res.status(400).json({ error: "Only Approved returns can be dispatched" }); return; }
    await db.update(grnReturnsTable).set({ status: "Dispatched", dispatchedBy: userId, dispatchedByName: userName, dispatchedAt: new Date(), dispatchDate, updatedAt: new Date() }).where(eq(grnReturnsTable.id, id));
    await logAudit(id, "Dispatched", userName, userId, remarks);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /grn-returns/:id/close
router.patch("/grn-returns/:id/close", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { userName = "System", userId, creditNoteNumber, creditNoteDate, creditNoteAmount, remarks } = req.body;
    const [existing] = await db.select().from(grnReturnsTable).where(eq(grnReturnsTable.id, id));
    if (!existing || !["Dispatched", "Approved"].includes(existing.status)) { res.status(400).json({ error: "Cannot close return in current status" }); return; }
    await db.update(grnReturnsTable).set({
      status: "Closed", closedBy: userId, closedByName: userName, closedAt: new Date(),
      creditNoteNumber, creditNoteDate, creditNoteAmount: creditNoteAmount ? String(creditNoteAmount) : undefined,
      updatedAt: new Date()
    }).where(eq(grnReturnsTable.id, id));
    await logAudit(id, "Closed", userName, userId, remarks);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /grn-returns/:id/cancel
router.patch("/grn-returns/:id/cancel", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { userName = "System", userId, remarks } = req.body;
    await db.update(grnReturnsTable).set({ status: "Cancelled", updatedAt: new Date() }).where(eq(grnReturnsTable.id, id));
    await logAudit(id, "Cancelled", userName, userId, remarks);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
