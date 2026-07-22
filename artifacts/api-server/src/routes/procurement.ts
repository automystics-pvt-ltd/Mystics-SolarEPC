import { Router, type IRouter } from "express";
import { db, materialRequestsTable, vendorQuotationsTable, purchaseOrdersTable, vendorInvoicesTable, contractorsTable, grnsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  CreateMaterialRequestBody, GetMaterialRequestParams, AddVendorQuotationParams, AddVendorQuotationBody,
  ReviewVendorQuotationParams, ReviewVendorQuotationBody, ApproveVendorQuotationL1Params, ApproveVendorQuotationL1Body,
  GeneratePOFromQuotationParams, GeneratePOFromQuotationBody,
  GetPurchaseOrderParams, GetPODeliveryStatusParams, AttachVendorInvoiceParams, AttachVendorInvoiceBody,
  CreateContractorBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

let mrCounter = 1;
let poCounter = 1;

function fmtMR(m: typeof materialRequestsTable.$inferSelect, vqs: typeof vendorQuotationsTable.$inferSelect[] = []) {
  return { id: m.id, projectId: m.projectId, activityId: m.activityId, raisedBy: m.raisedBy, raisedByName: null, mrNumber: m.mrNumber, items: m.items ?? [], requiredByDate: m.requiredByDate, status: m.status, vendorQuotations: vqs.map(fmtVQ), createdAt: m.createdAt.toISOString() };
}

function fmtVQ(v: typeof vendorQuotationsTable.$inferSelect) {
  return { id: v.id, mrId: v.mrId, vendorId: v.vendorId, vendorName: v.vendorName, quotationNumber: v.quotationNumber, quotedAmount: Number(v.quotedAmount), itemPriceBreakup: v.itemPriceBreakup ?? [], validityDate: v.validityDate, quotationFileUrl: v.quotationFileUrl, managerRemarks: v.managerRemarks, mdRemarks: v.mdRemarks, isRecommended: v.isRecommended ?? false, l1Status: v.l1Status, status: v.status, createdAt: v.createdAt.toISOString() };
}

function fmtPO(p: typeof purchaseOrdersTable.$inferSelect) {
  return { id: p.id, vendorQuotationId: p.vendorQuotationId, vendorId: p.vendorId, vendorName: p.vendorName, projectId: p.projectId, poNumber: p.poNumber, poDate: p.poDate, expectedDeliveryDate: p.expectedDeliveryDate, amount: Number(p.amount), deliveryTerms: p.deliveryTerms, status: p.status, createdAt: p.createdAt.toISOString() };
}

function fmtVI(v: typeof vendorInvoicesTable.$inferSelect) {
  return { id: v.id, poId: v.poId, invoiceNumber: v.invoiceNumber, scannedFileUrl: v.scannedFileUrl, invoiceAmount: Number(v.invoiceAmount), invoiceDate: v.invoiceDate, dueDate: v.dueDate, approvalStatus: v.approvalStatus, createdAt: v.createdAt.toISOString() };
}

function fmtContractor(c: typeof contractorsTable.$inferSelect) {
  return { id: c.id, name: c.name, trade: c.trade, contractValue: c.contractValue ? Number(c.contractValue) : null, contact: c.contact, rating: c.rating };
}

// ── MATERIAL REQUESTS ──────────────────────────────────────────────────────────
router.get("/material-requests", async (req, res): Promise<void> => {
  let query = db.select().from(materialRequestsTable).orderBy(desc(materialRequestsTable.createdAt)).$dynamic();
  if (req.query.projectId) query = query.where(eq(materialRequestsTable.projectId, Number(req.query.projectId)));
  if (req.query.status) query = query.where(eq(materialRequestsTable.status, req.query.status as string));
  const rows = await query;
  res.json(rows.map(r => fmtMR(r)));
});

router.post("/material-requests", async (req, res): Promise<void> => {
  const parsed = CreateMaterialRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const mrNumber = `MR-${String(++mrCounter).padStart(4, "0")}`;
  const [row] = await db.insert(materialRequestsTable).values({ ...parsed.data, mrNumber, items: parsed.data.items ?? [] }).returning();
  res.status(201).json(fmtMR(row));
});

router.get("/material-requests/:id", async (req, res): Promise<void> => {
  const params = GetMaterialRequestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(materialRequestsTable).where(eq(materialRequestsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Material request not found" }); return; }
  const vqs = await db.select().from(vendorQuotationsTable).where(eq(vendorQuotationsTable.mrId, params.data.id));
  res.json(fmtMR(row, vqs));
});

router.post("/material-requests/:id/vendor-quotations", async (req, res): Promise<void> => {
  const params = AddVendorQuotationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = AddVendorQuotationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [row] = await db.insert(vendorQuotationsTable).values({ ...body.data, mrId: params.data.id, quotedAmount: body.data.quotedAmount.toString(), itemPriceBreakup: body.data.itemPriceBreakup ?? [] }).returning();
  await db.update(materialRequestsTable).set({ status: "QuotationPending" }).where(eq(materialRequestsTable.id, params.data.id));
  res.status(201).json(fmtVQ(row));
});

// ── VENDOR QUOTATIONS ──────────────────────────────────────────────────────────
router.get("/vendor-quotations", async (req, res): Promise<void> => {
  let query = db.select().from(vendorQuotationsTable).orderBy(desc(vendorQuotationsTable.createdAt)).$dynamic();
  if (req.query.mrId) query = query.where(eq(vendorQuotationsTable.mrId, Number(req.query.mrId)));
  const rows = await query;
  res.json(rows.map(fmtVQ));
});

router.post("/vendor-quotations/:id/review", async (req, res): Promise<void> => {
  const params = ReviewVendorQuotationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ReviewVendorQuotationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const update: Record<string, unknown> = {};
  if (body.data.managerRemarks !== undefined) update.managerRemarks = body.data.managerRemarks;
  if (body.data.mdRemarks !== undefined) update.mdRemarks = body.data.mdRemarks;
  if (body.data.isRecommended !== undefined) update.isRecommended = body.data.isRecommended;
  update.status = "UnderReview";
  const [row] = await db.update(vendorQuotationsTable).set(update).where(eq(vendorQuotationsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Vendor quotation not found" }); return; }
  res.json(fmtVQ(row));
});

router.post("/vendor-quotations/:id/approve-l1", async (req, res): Promise<void> => {
  const params = ApproveVendorQuotationL1Params.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ApproveVendorQuotationL1Body.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const l1Status = body.data.action === "approve" ? "Approved" : "Rejected";
  const status = l1Status === "Approved" ? "Approved" : "Rejected";
  const [row] = await db.update(vendorQuotationsTable).set({ l1Status, status }).where(eq(vendorQuotationsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Vendor quotation not found" }); return; }
  if (l1Status === "Approved") {
    await db.update(materialRequestsTable).set({ status: "L1Pending" }).where(eq(materialRequestsTable.id, row.mrId));
  }
  res.json(fmtVQ(row));
});

router.post("/vendor-quotations/:id/generate-po", async (req, res): Promise<void> => {
  const params = GeneratePOFromQuotationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = GeneratePOFromQuotationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [vq] = await db.select().from(vendorQuotationsTable).where(eq(vendorQuotationsTable.id, params.data.id));
  if (!vq) { res.status(404).json({ error: "Vendor quotation not found" }); return; }
  const [mr] = await db.select().from(materialRequestsTable).where(eq(materialRequestsTable.id, vq.mrId));
  const poNumber = `PO-${String(++poCounter).padStart(4, "0")}`;
  const today = new Date().toISOString().split("T")[0];
  const [po] = await db.insert(purchaseOrdersTable).values({
    vendorQuotationId: vq.id, vendorId: vq.vendorId, vendorName: vq.vendorName,
    projectId: mr?.projectId, poNumber, poDate: today,
    expectedDeliveryDate: body.data.expectedDeliveryDate, amount: vq.quotedAmount,
    deliveryTerms: body.data.deliveryTerms, warehouseId: body.data.warehouseId,
  }).returning();
  await db.update(materialRequestsTable).set({ status: "POGenerated" }).where(eq(materialRequestsTable.id, vq.mrId));
  res.status(201).json(fmtPO(po));
});

// ── PURCHASE ORDERS ────────────────────────────────────────────────────────────
router.get("/purchase-orders", async (req, res): Promise<void> => {
  let query = db.select().from(purchaseOrdersTable).orderBy(desc(purchaseOrdersTable.createdAt)).$dynamic();
  if (req.query.projectId) query = query.where(eq(purchaseOrdersTable.projectId, Number(req.query.projectId)));
  if (req.query.status) query = query.where(eq(purchaseOrdersTable.status, req.query.status as string));
  const rows = await query;
  res.json(rows.map(fmtPO));
});

router.get("/purchase-orders/:id", async (req, res): Promise<void> => {
  const params = GetPurchaseOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "PO not found" }); return; }
  res.json(fmtPO(row));
});

router.get("/purchase-orders/:id/delivery-status", async (req, res): Promise<void> => {
  const params = GetPODeliveryStatusParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, params.data.id));
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }
  const grns = await db.select().from(grnsTable).where(eq(grnsTable.poId, params.data.id));
  const [vq] = po.vendorQuotationId ? await db.select().from(vendorQuotationsTable).where(eq(vendorQuotationsTable.id, po.vendorQuotationId)) : [null];
  const items = vq?.itemPriceBreakup ?? [];
  const lines = items.map((item: { itemName: string; qty: number }) => {
    const received = grns.flatMap(g => g.lineItems ?? []).filter((li: { itemName: string }) => li.itemName === item.itemName).reduce((s: number, li: { receivedQty: number }) => s + li.receivedQty, 0);
    return { itemName: item.itemName, orderedQty: item.qty, receivedQty: received, pendingQty: Math.max(0, item.qty - received) };
  });
  res.json({ poId: params.data.id, lines, totalGRNs: grns.length, isFullyReceived: lines.every((l: { pendingQty: number }) => l.pendingQty === 0) });
});

router.post("/purchase-orders/:id/vendor-invoice", async (req, res): Promise<void> => {
  const params = AttachVendorInvoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = AttachVendorInvoiceBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [vi] = await db.insert(vendorInvoicesTable).values({ ...body.data, poId: params.data.id, invoiceAmount: body.data.invoiceAmount.toString() }).returning();
  res.status(201).json(fmtVI(vi));
});

// ── CONTRACTORS ────────────────────────────────────────────────────────────────
router.get("/contractors", async (req, res): Promise<void> => {
  const rows = await db.select().from(contractorsTable).orderBy(contractorsTable.name);
  res.json(rows.map(fmtContractor));
});

router.post("/contractors", async (req, res): Promise<void> => {
  const parsed = CreateContractorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(contractorsTable).values({ ...parsed.data, contractValue: parsed.data.contractValue?.toString() }).returning();
  res.status(201).json(fmtContractor(row));
});

export default router;
