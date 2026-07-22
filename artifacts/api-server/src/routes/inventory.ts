import { Router, type IRouter } from "express";
import { db, warehousesTable, warehouseLocationsTable, grnsTable, qcChecksTable, deliveryChallansTable, stockLedgerTable, stockValuationTable, inventoryAuditsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import {
  CreateWarehouseBody, GetWarehouseLocationsParams, CreateWarehouseLocationParams, CreateWarehouseLocationBody,
  GetWarehouseStockSummaryParams,
  CreateGRNBody, GetGRNParams, CreateQCCheckParams, CreateQCCheckBody,
  CreateDeliveryChallanBody,
  CreateInventoryAuditBody, ReconcileInventoryAuditParams, ReconcileInventoryAuditBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

let grnCounter = 1;
let challanCounter = 1;

function fmtWH(w: typeof warehousesTable.$inferSelect) {
  return { id: w.id, name: w.name, projectId: w.projectId, location: w.location, custodianId: w.custodianId, capacity: w.capacity, type: w.type };
}

function fmtGRN(g: typeof grnsTable.$inferSelect) {
  return { id: g.id, poId: g.poId, warehouseId: g.warehouseId, grnNumber: g.grnNumber, receivedDate: g.receivedDate, lineItems: g.lineItems ?? [], qcStatus: g.qcStatus, notes: g.notes };
}

function fmtSL(s: typeof stockLedgerTable.$inferSelect) {
  return { id: s.id, warehouseId: s.warehouseId, itemId: s.itemId, itemName: s.itemName, txnType: s.txnType, qty: Number(s.qty), balanceQty: Number(s.balanceQty), refDocType: s.refDocType, refDocId: s.refDocId, date: s.date };
}

// ── WAREHOUSES ────────────────────────────────────────────────────────────────
router.get("/warehouses", async (req, res): Promise<void> => {
  let query = db.select().from(warehousesTable).orderBy(warehousesTable.name).$dynamic();
  if (req.query.projectId) query = query.where(eq(warehousesTable.projectId, Number(req.query.projectId)));
  const rows = await query;
  res.json(rows.map(fmtWH));
});

router.post("/warehouses", async (req, res): Promise<void> => {
  const parsed = CreateWarehouseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(warehousesTable).values(parsed.data).returning();
  res.status(201).json(fmtWH(row));
});

router.get("/warehouses/:id/locations", async (req, res): Promise<void> => {
  const params = GetWarehouseLocationsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await db.select().from(warehouseLocationsTable).where(eq(warehouseLocationsTable.warehouseId, params.data.id));
  res.json(rows.map(l => ({ id: l.id, warehouseId: l.warehouseId, zone: l.zone, rack: l.rack, bin: l.bin, currentItemId: l.currentItemId, currentItemName: l.currentItemName })));
});

router.post("/warehouses/:id/locations", async (req, res): Promise<void> => {
  const params = CreateWarehouseLocationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = CreateWarehouseLocationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [row] = await db.insert(warehouseLocationsTable).values({ ...body.data, warehouseId: params.data.id }).returning();
  res.status(201).json({ id: row.id, warehouseId: row.warehouseId, zone: row.zone, rack: row.rack, bin: row.bin, currentItemId: row.currentItemId, currentItemName: row.currentItemName });
});

router.get("/warehouses/:id/stock-summary", async (req, res): Promise<void> => {
  const params = GetWarehouseStockSummaryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const entries = await db.select().from(stockLedgerTable).where(eq(stockLedgerTable.warehouseId, params.data.id));
  const itemMap: Record<string, { itemName: string; balanceQty: number; unitValue: number }> = {};
  for (const e of entries) {
    if (!itemMap[e.itemName]) itemMap[e.itemName] = { itemName: e.itemName, balanceQty: 0, unitValue: 100 };
    itemMap[e.itemName].balanceQty = Number(e.balanceQty);
  }
  const items = Object.entries(itemMap).map(([_, v], i) => ({ itemId: i + 1, itemName: v.itemName, balanceQty: v.balanceQty, unit: "pcs", unitValue: v.unitValue, totalValue: v.balanceQty * v.unitValue }));
  res.json({ warehouseId: params.data.id, items, totalValue: items.reduce((s, x) => s + x.totalValue, 0) });
});

// ── GRNs ──────────────────────────────────────────────────────────────────────
router.get("/grns", async (req, res): Promise<void> => {
  let query = db.select().from(grnsTable).orderBy(desc(grnsTable.createdAt)).$dynamic();
  if (req.query.poId) query = query.where(eq(grnsTable.poId, Number(req.query.poId)));
  if (req.query.warehouseId) query = query.where(eq(grnsTable.warehouseId, Number(req.query.warehouseId)));
  const rows = await query;
  res.json(rows.map(fmtGRN));
});

router.post("/grns", async (req, res): Promise<void> => {
  const parsed = CreateGRNBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const grnNumber = `GRN-${String(++grnCounter).padStart(4, "0")}`;
  const [row] = await db.insert(grnsTable).values({ ...parsed.data, grnNumber, lineItems: parsed.data.lineItems ?? [] }).returning();
  // Post stock ledger entries
  for (const li of parsed.data.lineItems ?? []) {
    const [last] = await db.select().from(stockLedgerTable).where(and(eq(stockLedgerTable.warehouseId, parsed.data.warehouseId), eq(stockLedgerTable.itemName, li.itemName))).orderBy(desc(stockLedgerTable.createdAt)).limit(1);
    const prev = Number(last?.balanceQty ?? 0);
    await db.insert(stockLedgerTable).values({ warehouseId: parsed.data.warehouseId, itemName: li.itemName, txnType: "Inward", qty: li.receivedQty.toString(), balanceQty: (prev + li.receivedQty).toString(), refDocType: "GRN", refDocId: row.id, date: parsed.data.receivedDate });
  }
  res.status(201).json(fmtGRN(row));
});

router.get("/grns/:id", async (req, res): Promise<void> => {
  const params = GetGRNParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(grnsTable).where(eq(grnsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "GRN not found" }); return; }
  res.json(fmtGRN(row));
});

router.post("/grns/:id/qc-check", async (req, res): Promise<void> => {
  const params = CreateQCCheckParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = CreateQCCheckBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [row] = await db.insert(qcChecksTable).values({ ...body.data, grnId: params.data.id, acceptedQty: body.data.acceptedQty.toString(), rejectedQty: body.data.rejectedQty.toString() }).returning();
  await db.update(grnsTable).set({ qcStatus: body.data.status }).where(eq(grnsTable.id, params.data.id));
  res.status(201).json({ id: row.id, grnId: row.grnId, inspectedBy: row.inspectedBy, acceptedQty: Number(row.acceptedQty), rejectedQty: Number(row.rejectedQty), rejectionReason: row.rejectionReason, status: row.status });
});

// ── DELIVERY CHALLANS ──────────────────────────────────────────────────────────
router.get("/delivery-challans", async (req, res): Promise<void> => {
  let query = db.select().from(deliveryChallansTable).orderBy(desc(deliveryChallansTable.createdAt)).$dynamic();
  if (req.query.warehouseId) query = query.where(eq(deliveryChallansTable.warehouseId, Number(req.query.warehouseId)));
  if (req.query.projectId) query = query.where(eq(deliveryChallansTable.projectId, Number(req.query.projectId)));
  const rows = await query;
  res.json(rows.map(c => ({ id: c.id, warehouseId: c.warehouseId, projectId: c.projectId, challanNumber: c.challanNumber, issuedTo: c.issuedTo, lineItems: c.lineItems ?? [], issuedDate: c.issuedDate, purpose: c.purpose, referenceDoc: c.referenceDoc })));
});

router.post("/delivery-challans", async (req, res): Promise<void> => {
  const parsed = CreateDeliveryChallanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const challanNumber = `DC-${String(++challanCounter).padStart(4, "0")}`;
  const [row] = await db.insert(deliveryChallansTable).values({ ...parsed.data, challanNumber, lineItems: parsed.data.lineItems ?? [] }).returning();
  // Post outward stock ledger entries
  for (const li of parsed.data.lineItems ?? []) {
    const [last] = await db.select().from(stockLedgerTable).where(and(eq(stockLedgerTable.warehouseId, parsed.data.warehouseId), eq(stockLedgerTable.itemName, li.itemName))).orderBy(desc(stockLedgerTable.createdAt)).limit(1);
    const prev = Number(last?.balanceQty ?? 0);
    await db.insert(stockLedgerTable).values({ warehouseId: parsed.data.warehouseId, itemName: li.itemName, txnType: "Outward", qty: li.qty.toString(), balanceQty: Math.max(0, prev - li.qty).toString(), refDocType: "Challan", refDocId: row.id, date: parsed.data.issuedDate });
  }
  res.status(201).json({ id: row.id, warehouseId: row.warehouseId, projectId: row.projectId, challanNumber: row.challanNumber, issuedTo: row.issuedTo, lineItems: row.lineItems ?? [], issuedDate: row.issuedDate, purpose: row.purpose, referenceDoc: row.referenceDoc });
});

// ── STOCK ──────────────────────────────────────────────────────────────────────
router.get("/stock-ledger", async (req, res): Promise<void> => {
  let query = db.select().from(stockLedgerTable).orderBy(desc(stockLedgerTable.date)).$dynamic();
  if (req.query.warehouseId) query = query.where(eq(stockLedgerTable.warehouseId, Number(req.query.warehouseId)));
  if (req.query.itemId) query = query.where(eq(stockLedgerTable.itemId, Number(req.query.itemId)));
  const rows = await query;
  res.json(rows.map(fmtSL));
});

router.get("/stock-valuation", async (req, res): Promise<void> => {
  let query = db.select().from(stockValuationTable).orderBy(desc(stockValuationTable.asOfDate)).$dynamic();
  if (req.query.warehouseId) query = query.where(eq(stockValuationTable.warehouseId, Number(req.query.warehouseId)));
  const rows = await query;
  res.json(rows.map(s => ({ warehouseId: s.warehouseId, itemId: s.itemId, itemName: s.itemName, valuationMethod: s.valuationMethod, unitValue: Number(s.unitValue), totalValue: Number(s.totalValue), balanceQty: Number(s.balanceQty), asOfDate: s.asOfDate })));
});

// ── INVENTORY AUDITS ───────────────────────────────────────────────────────────
router.get("/inventory-audits", async (req, res): Promise<void> => {
  let query = db.select().from(inventoryAuditsTable).orderBy(desc(inventoryAuditsTable.createdAt)).$dynamic();
  if (req.query.warehouseId) query = query.where(eq(inventoryAuditsTable.warehouseId, Number(req.query.warehouseId)));
  const rows = await query;
  res.json(rows.map(a => ({ id: a.id, warehouseId: a.warehouseId, auditDate: a.auditDate, auditorId: a.auditorId, systemQty: a.systemQty ? Number(a.systemQty) : null, physicalQty: a.physicalQty ? Number(a.physicalQty) : null, varianceQty: a.varianceQty ? Number(a.varianceQty) : null, varianceValue: a.varianceValue ? Number(a.varianceValue) : null, status: a.status, notes: a.notes })));
});

router.post("/inventory-audits", async (req, res): Promise<void> => {
  const parsed = CreateInventoryAuditBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(inventoryAuditsTable).values({ ...parsed.data, systemQty: parsed.data.systemQty?.toString(), physicalQty: parsed.data.physicalQty?.toString() }).returning();
  res.status(201).json({ id: row.id, warehouseId: row.warehouseId, auditDate: row.auditDate, auditorId: row.auditorId, systemQty: row.systemQty ? Number(row.systemQty) : null, physicalQty: row.physicalQty ? Number(row.physicalQty) : null, varianceQty: null, varianceValue: null, status: row.status, notes: row.notes });
});

router.post("/inventory-audits/:id/reconcile", async (req, res): Promise<void> => {
  const params = ReconcileInventoryAuditParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ReconcileInventoryAuditBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [existing] = await db.select().from(inventoryAuditsTable).where(eq(inventoryAuditsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Audit not found" }); return; }
  const systemQty = Number(existing.systemQty ?? 0);
  const varianceQty = body.data.physicalQty - systemQty;
  const [row] = await db.update(inventoryAuditsTable).set({
    physicalQty: body.data.physicalQty.toString(), varianceQty: varianceQty.toString(),
    varianceValue: (varianceQty * 100).toString(), status: "Reconciled", notes: body.data.notes,
  }).where(eq(inventoryAuditsTable.id, params.data.id)).returning();
  res.json({ id: row.id, warehouseId: row.warehouseId, auditDate: row.auditDate, auditorId: row.auditorId, systemQty: row.systemQty ? Number(row.systemQty) : null, physicalQty: row.physicalQty ? Number(row.physicalQty) : null, varianceQty: row.varianceQty ? Number(row.varianceQty) : null, varianceValue: row.varianceValue ? Number(row.varianceValue) : null, status: row.status, notes: row.notes });
});

export default router;
