import { Router, type IRouter } from "express";
import { requireAuth, requirePermission } from "../lib/rbac";
import { db, commissioningChecklistsTable, commissioningItemsTable, complianceDocumentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();
router.use(requireAuth());

const CreateChecklistBody = z.object({
  projectId: z.number(),
  commissionedOn: z.string().optional(),
  commissionedBy: z.number().optional(),
  remarks: z.string().optional(),
});

const CreateItemBody = z.object({
  category: z.string().optional(),
  description: z.string(),
  sortOrder: z.number().optional(),
});

const ToggleItemBody = z.object({
  isDone: z.boolean(),
  doneBy: z.number().optional(),
  remarks: z.string().optional(),
});

const ClientSignoffBody = z.object({
  clientSignatoryName: z.string(),
});

const CreateComplianceDocBody = z.object({
  projectId: z.number(),
  docType: z.string().optional(),
  title: z.string(),
  fileUrl: z.string().optional(),
  submittedBy: z.number().optional(),
  submissionDate: z.string().optional(),
  status: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

function fmtCL(c: typeof commissioningChecklistsTable.$inferSelect) {
  return { id: c.id, projectId: c.projectId, status: c.status, commissionedOn: c.commissionedOn, commissionedBy: c.commissionedBy, clientSignatoryName: c.clientSignatoryName, clientSignedAt: c.clientSignedAt?.toISOString() ?? null, remarks: c.remarks, createdAt: c.createdAt.toISOString() };
}

function fmtItem(i: typeof commissioningItemsTable.$inferSelect) {
  return { id: i.id, checklistId: i.checklistId, category: i.category, description: i.description, isDone: i.isDone, doneBy: i.doneBy, doneAt: i.doneAt?.toISOString() ?? null, remarks: i.remarks, sortOrder: i.sortOrder };
}

function fmtDoc(d: typeof complianceDocumentsTable.$inferSelect) {
  return { id: d.id, projectId: d.projectId, docType: d.docType, title: d.title, fileUrl: d.fileUrl, submittedBy: d.submittedBy, submissionDate: d.submissionDate, status: d.status, expiryDate: d.expiryDate, notes: d.notes, createdAt: d.createdAt.toISOString() };
}

// Default checklist items for a new solar commissioning
const DEFAULT_ITEMS = [
  { category: "Electrical", description: "String voltage and polarity check", sortOrder: 1 },
  { category: "Electrical", description: "Earth continuity and resistance test", sortOrder: 2 },
  { category: "Electrical", description: "Insulation resistance test (IR test)", sortOrder: 3 },
  { category: "Electrical", description: "Inverter commissioning and startup", sortOrder: 4 },
  { category: "Electrical", description: "AC/DC wiring inspection", sortOrder: 5 },
  { category: "Safety", description: "Fire safety equipment check", sortOrder: 6 },
  { category: "Safety", description: "Earthing and lightning protection verification", sortOrder: 7 },
  { category: "Safety", description: "Signage and safety labels installed", sortOrder: 8 },
  { category: "NetMetering", description: "Net meter installation and verification", sortOrder: 9 },
  { category: "NetMetering", description: "DISCOM synchronization check", sortOrder: 10 },
  { category: "Civil", description: "Module mounting structure integrity check", sortOrder: 11 },
  { category: "Civil", description: "Cable tray and conduit inspection", sortOrder: 12 },
  { category: "Documentation", description: "As-built drawings submitted", sortOrder: 13 },
  { category: "Documentation", description: "Operation & maintenance manual handed over", sortOrder: 14 },
  { category: "Documentation", description: "Warranty certificates collected", sortOrder: 15 },
];

// List checklists
router.get("/commissioning-checklists", async (req, res): Promise<void> => {
  let query = db.select().from(commissioningChecklistsTable).orderBy(desc(commissioningChecklistsTable.createdAt)).$dynamic();
  if (req.query.projectId) {
    query = query.where(eq(commissioningChecklistsTable.projectId, Number(req.query.projectId)));
  }
  const rows = await query;
  res.json(rows.map(fmtCL));
});

// Create checklist (auto-populates default items)
router.post("/commissioning-checklists", requirePermission("commissioning", "create"), async (req, res): Promise<void> => {
  const parsed = CreateChecklistBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [cl] = await db.insert(commissioningChecklistsTable).values({ ...parsed.data, status: "InProgress" }).returning();
  // seed default items
  await db.insert(commissioningItemsTable).values(DEFAULT_ITEMS.map(i => ({ ...i, checklistId: cl.id })));
  res.status(201).json(fmtCL(cl));
});

// Get checklist with items
router.get("/commissioning-checklists/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [cl] = await db.select().from(commissioningChecklistsTable).where(eq(commissioningChecklistsTable.id, id));
  if (!cl) { res.status(404).json({ error: "Not found" }); return; }
  const items = await db.select().from(commissioningItemsTable).where(eq(commissioningItemsTable.checklistId, id)).orderBy(commissioningItemsTable.sortOrder);
  res.json({ ...fmtCL(cl), items: items.map(fmtItem) });
});

// Add checklist item
router.post("/commissioning-checklists/:id/items", requirePermission("commissioning", "create"), async (req, res): Promise<void> => {
  const checklistId = Number(req.params.id);
  const parsed = CreateItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [item] = await db.insert(commissioningItemsTable).values({ ...parsed.data, checklistId }).returning();
  res.status(201).json(fmtItem(item));
});

// Toggle checklist item done/undone
router.patch("/commissioning-items/:itemId", requirePermission("commissioning", "edit"), async (req, res): Promise<void> => {
  const itemId = Number(req.params.itemId);
  const parsed = ToggleItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [updated] = await db.update(commissioningItemsTable)
    .set({ isDone: parsed.data.isDone, doneBy: parsed.data.doneBy, doneAt: parsed.data.isDone ? new Date() : null, remarks: parsed.data.remarks })
    .where(eq(commissioningItemsTable.id, itemId))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  // update checklist status based on completion
  const allItems = await db.select().from(commissioningItemsTable).where(eq(commissioningItemsTable.checklistId, updated.checklistId));
  const allDone = allItems.every(i => i.isDone);
  if (allDone) {
    await db.update(commissioningChecklistsTable).set({ status: "PendingClientSignoff" }).where(eq(commissioningChecklistsTable.id, updated.checklistId));
  }
  res.json(fmtItem(updated));
});

// Client sign-off
router.post("/commissioning-checklists/:id/signoff", requirePermission("commissioning", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = ClientSignoffBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [updated] = await db.update(commissioningChecklistsTable)
    .set({ status: "Completed", clientSignatoryName: parsed.data.clientSignatoryName, clientSignedAt: new Date() })
    .where(eq(commissioningChecklistsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmtCL(updated));
});

// Compliance docs
router.get("/compliance-documents", async (req, res): Promise<void> => {
  let query = db.select().from(complianceDocumentsTable).orderBy(desc(complianceDocumentsTable.createdAt)).$dynamic();
  if (req.query.projectId) {
    query = query.where(eq(complianceDocumentsTable.projectId, Number(req.query.projectId)));
  }
  res.json((await query).map(fmtDoc));
});

router.post("/compliance-documents", requirePermission("commissioning", "create"), async (req, res): Promise<void> => {
  const parsed = CreateComplianceDocBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [row] = await db.insert(complianceDocumentsTable).values(parsed.data).returning();
  res.status(201).json(fmtDoc(row));
});

router.patch("/compliance-documents/:id", requirePermission("commissioning", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [updated] = await db.update(complianceDocumentsTable).set(req.body).where(eq(complianceDocumentsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmtDoc(updated));
});

export default router;
