import { Router, type IRouter } from "express";
import {
  db, stockTransfersTable, stockTransferItemsTable,
  warehousesTable, stockLedgerTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

let txCounter = 1;
(async () => {
  const r = await db.select().from(stockTransfersTable).orderBy(desc(stockTransfersTable.id)).limit(1);
  if (r.length > 0) txCounter = r[0].id + 1;
})();

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

function fmt(t: typeof stockTransfersTable.$inferSelect, items: any[] = []) {
  return {
    id: t.id, transferNumber: t.transferNumber,
    fromWarehouseId: t.fromWarehouseId, fromWarehouseName: t.fromWarehouseName,
    toWarehouseId: t.toWarehouseId, toWarehouseName: t.toWarehouseName,
    status: t.status, reason: t.reason, transferDate: t.transferDate,
    completedDate: t.completedDate, remarks: t.remarks, totalItems: t.totalItems,
    initiatedBy: t.initiatedBy, initiatedByName: t.initiatedByName,
    approvedBy: t.approvedBy, approvedByName: t.approvedByName,
    approvedAt: t.approvedAt?.toISOString(),
    completedBy: t.completedBy, completedByName: t.completedByName,
    completedAt: t.completedAt?.toISOString(),
    createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    items: items.map(i => ({
      id: i.id, transferId: i.transferId, lineNo: i.lineNo,
      materialId: i.materialId, materialCode: i.materialCode, materialName: i.materialName,
      uom: i.uom, qty: n(i.qty), fromBin: i.fromBin, toBin: i.toBin, remarks: i.remarks,
    })),
  };
}

// GET /stock-transfers
router.get("/stock-transfers", async (req, res): Promise<void> => {
  try {
    const { status } = req.query;
    let query = db.select().from(stockTransfersTable).orderBy(desc(stockTransfersTable.createdAt)).$dynamic();
    if (status && status !== "All") query = query.where(eq(stockTransfersTable.status, status as any));
    const rows = await query;
    res.json(rows.map(r => fmt(r)));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// GET /stock-transfers/:id
router.get("/stock-transfers/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [t] = await db.select().from(stockTransfersTable).where(eq(stockTransfersTable.id, id));
    if (!t) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(stockTransferItemsTable).where(eq(stockTransferItemsTable.transferId, id));
    res.json(fmt(t, items));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// POST /stock-transfers — create
router.post("/stock-transfers", async (req, res): Promise<void> => {
  try {
    const { fromWarehouseId, toWarehouseId, reason, transferDate, remarks, items = [],
      userName = "System", userId } = req.body;
    if (!fromWarehouseId || !toWarehouseId) { res.status(400).json({ error: "fromWarehouseId, toWarehouseId required" }); return; }
    if (fromWarehouseId === toWarehouseId) { res.status(400).json({ error: "Source and destination must differ" }); return; }

    const [fromWH] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, Number(fromWarehouseId)));
    const [toWH] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, Number(toWarehouseId)));
    if (!fromWH || !toWH) { res.status(404).json({ error: "Warehouse not found" }); return; }

    const transferNumber = `STR-${String(txCounter).padStart(4, "0")}`; txCounter++;

    const [transfer] = await db.insert(stockTransfersTable).values({
      transferNumber, fromWarehouseId: Number(fromWarehouseId), fromWarehouseName: fromWH.name,
      toWarehouseId: Number(toWarehouseId), toWarehouseName: toWH.name,
      reason, transferDate, remarks, totalItems: items.length,
      initiatedBy: userId, initiatedByName: userName,
    }).returning();

    if (items.length > 0) {
      await db.insert(stockTransferItemsTable).values(
        items.map((i: any, idx: number) => ({
          transferId: transfer.id, lineNo: idx + 1,
          materialId: i.materialId, materialCode: i.materialCode, materialName: i.materialName,
          uom: i.uom || "Nos", qty: String(i.qty || 0),
          fromBin: i.fromBin, toBin: i.toBin, remarks: i.remarks,
        }))
      );
    }

    res.status(201).json(fmt(transfer));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /stock-transfers/:id/approve
router.patch("/stock-transfers/:id/approve", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { userName = "System", userId } = req.body;
    const [t] = await db.select().from(stockTransfersTable).where(eq(stockTransfersTable.id, id));
    if (!t || t.status !== "Draft") { res.status(400).json({ error: "Only Draft transfers can be approved" }); return; }
    await db.update(stockTransfersTable).set({ status: "Approved", approvedBy: userId, approvedByName: userName, approvedAt: new Date(), updatedAt: new Date() }).where(eq(stockTransfersTable.id, id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /stock-transfers/:id/complete — mark InTransit then Completed, update stock ledger
router.patch("/stock-transfers/:id/complete", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { userName = "System", userId, completedDate } = req.body;
    const [t] = await db.select().from(stockTransfersTable).where(eq(stockTransfersTable.id, id));
    if (!t || !["Approved", "InTransit"].includes(t.status)) { res.status(400).json({ error: "Cannot complete transfer in current status" }); return; }

    const items = await db.select().from(stockTransferItemsTable).where(eq(stockTransferItemsTable.transferId, id));
    const today = completedDate || new Date().toISOString().slice(0, 10);

    // Update stock ledger: Outward from source, Inward to destination
    for (const item of items) {
      const qty = n(item.qty) ?? 0;
      if (qty <= 0) continue;
      await db.insert(stockLedgerTable).values({
        warehouseId: t.fromWarehouseId, itemId: item.materialId ?? undefined,
        itemName: item.materialName, txnType: "Transfer",
        qty: String(-qty), balanceQty: "0",
        refDocType: "stock_transfer", refDocId: id, date: today,
      });
      await db.insert(stockLedgerTable).values({
        warehouseId: t.toWarehouseId, itemId: item.materialId ?? undefined,
        itemName: item.materialName, txnType: "Transfer",
        qty: String(qty), balanceQty: "0",
        refDocType: "stock_transfer", refDocId: id, date: today,
      });
    }

    await db.update(stockTransfersTable).set({
      status: "Completed", completedBy: userId, completedByName: userName,
      completedAt: new Date(), completedDate, updatedAt: new Date(),
    }).where(eq(stockTransfersTable.id, id));

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /stock-transfers/:id/cancel
router.patch("/stock-transfers/:id/cancel", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { userName = "System", userId } = req.body;
    await db.update(stockTransfersTable).set({ status: "Cancelled", updatedAt: new Date() }).where(eq(stockTransfersTable.id, id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
