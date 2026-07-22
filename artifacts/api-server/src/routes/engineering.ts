import { Router, type IRouter } from "express";
import { db, designDocumentsTable, designRevisionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const CreateDesignDocBody = z.object({
  projectId: z.number(),
  docType: z.string().optional(),
  title: z.string(),
  version: z.string().optional(),
  fileUrl: z.string().optional(),
  uploadedBy: z.number().optional(),
  description: z.string().optional(),
});

const ApproveDesignDocBody = z.object({
  approvalType: z.enum(["internal", "client"]),
  approvedBy: z.union([z.number(), z.string()]).optional(),
  rejectionReason: z.string().optional(),
});

const CreateRevisionBody = z.object({
  version: z.string(),
  fileUrl: z.string().optional(),
  changeNotes: z.string().optional(),
  revisedBy: z.number().optional(),
});

function fmt(d: typeof designDocumentsTable.$inferSelect) {
  return {
    id: d.id, projectId: d.projectId, docType: d.docType, title: d.title,
    version: d.version, fileUrl: d.fileUrl, uploadedBy: d.uploadedBy,
    description: d.description, internalStatus: d.internalStatus,
    internalApprovedBy: d.internalApprovedBy,
    internalApprovedAt: d.internalApprovedAt?.toISOString() ?? null,
    clientApprovedAt: d.clientApprovedAt?.toISOString() ?? null,
    clientApprovedBy: d.clientApprovedBy,
    rejectionReason: d.rejectionReason,
    createdAt: d.createdAt.toISOString(),
  };
}

function fmtRev(r: typeof designRevisionsTable.$inferSelect) {
  return { id: r.id, docId: r.docId, version: r.version, fileUrl: r.fileUrl, changeNotes: r.changeNotes, revisedBy: r.revisedBy, createdAt: r.createdAt.toISOString() };
}

// List design documents
router.get("/design-documents", async (req, res): Promise<void> => {
  let query = db.select().from(designDocumentsTable).orderBy(desc(designDocumentsTable.createdAt)).$dynamic();
  if (req.query.projectId) {
    query = query.where(eq(designDocumentsTable.projectId, Number(req.query.projectId)));
  }
  const rows = await query;
  res.json(rows.map(fmt));
});

// Create design document
router.post("/design-documents", async (req, res): Promise<void> => {
  const parsed = CreateDesignDocBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [row] = await db.insert(designDocumentsTable).values(parsed.data).returning();
  res.status(201).json(fmt(row));
});

// Get single design document
router.get("/design-documents/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [doc] = await db.select().from(designDocumentsTable).where(eq(designDocumentsTable.id, id));
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  const revisions = await db.select().from(designRevisionsTable).where(eq(designRevisionsTable.docId, id)).orderBy(desc(designRevisionsTable.createdAt));
  res.json({ ...fmt(doc), revisions: revisions.map(fmtRev) });
});

// Approve / reject design document
router.post("/design-documents/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = ApproveDesignDocBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const { approvalType, approvedBy, rejectionReason } = parsed.data;
  let update: Partial<typeof designDocumentsTable.$inferInsert> = {};
  if (rejectionReason) {
    update = { internalStatus: "Rejected", rejectionReason };
  } else if (approvalType === "internal") {
    update = { internalStatus: "InternalApproved", internalApprovedBy: typeof approvedBy === "number" ? approvedBy : null, internalApprovedAt: new Date() };
  } else {
    update = { internalStatus: "ClientApproved", clientApprovedBy: approvedBy?.toString(), clientApprovedAt: new Date() };
  }
  const [updated] = await db.update(designDocumentsTable).set(update).where(eq(designDocumentsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(updated));
});

// Add revision
router.post("/design-documents/:id/revisions", async (req, res): Promise<void> => {
  const docId = Number(req.params.id);
  const parsed = CreateRevisionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [rev] = await db.insert(designRevisionsTable).values({ ...parsed.data, docId }).returning();
  // also update document version + reset status to Draft
  await db.update(designDocumentsTable).set({ version: parsed.data.version, internalStatus: "Draft" }).where(eq(designDocumentsTable.id, docId));
  res.status(201).json(fmtRev(rev));
});

export default router;
