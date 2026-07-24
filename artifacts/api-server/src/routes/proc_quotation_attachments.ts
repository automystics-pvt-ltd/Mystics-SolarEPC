/**
 * Quotation Attachments routes — presigned-URL upload + metadata storage
 * POST   /procurement-quotations/:id/attachments    — request upload URL, save metadata
 * DELETE /procurement-quotations/:id/attachments/:attachmentId
 * Attachments are included in GET /procurement-quotations/:id via fmtQ helper
 */
import { Router, type IRouter, type Request } from "express";
import { db, quotationAttachmentsTable, quotationAuditLogsTable, procurementQuotationsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import jwt from "jsonwebtoken";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

function getActor(req: Request): { userId: number; role: string; name?: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as { userId: number; role: string; name?: string }; }
  catch { return null; }
}

// POST /procurement-quotations/:id/attachments
// Body: { fileName, fileSize, mimeType }   — actor identity derived from JWT
// Returns: { uploadURL, attachment }
router.post("/procurement-quotations/:id/attachments", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }

  const quotationId = Number(req.params.id);
  const { fileName, fileSize, mimeType } = req.body;

  if (!fileName) { res.status(400).json({ error: "fileName is required" }); return; }

  // Reject uploads to a locked (Approved) quotation
  const [existing] = await db.select({ status: procurementQuotationsTable.status })
    .from(procurementQuotationsTable).where(eq(procurementQuotationsTable.id, quotationId));
  if (!existing) { res.status(404).json({ error: "Quotation not found" }); return; }
  if (existing.status === "Approved") {
    res.status(423).json({ error: "Cannot add attachments to a locked quotation. Reopen it first." }); return;
  }

  try {
    // Generate presigned upload URL (GCS signed PUT URL)
    const uploadURL = await storage.getObjectEntityUploadURL();

    // normalizeObjectEntityPath converts the signed URL to a stable /objects/... path
    // that getObjectEntityFile() can resolve back to the GCS object.
    const fileKey = storage.normalizeObjectEntityPath(uploadURL);

    // Insert attachment row — fileKey is stored so downloads can call
    // getObjectEntityFile(fileKey) which maps back to the GCS path.
    const [attachment] = await db.insert(quotationAttachmentsTable).values({
      quotationId,
      fileName,
      fileKey,
      fileSize: fileSize ? Number(fileSize) : null,
      mimeType: mimeType ?? null,
      uploadedBy: actor.userId,
      uploadedByName: (actor as any).name ?? "User",
    }).returning();

    // Audit
    await db.insert(quotationAuditLogsTable).values({
      quotationId, action: "AttachmentUploaded",
      performedBy: actor.userId,
      performedByName: (actor as any).name ?? "User",
      performedByRole: actor.role,
      remarks: `Attached file: ${fileName}`,
    });

    res.status(201).json({ uploadURL, attachment });
  } catch (err: any) {
    console.error("Attachment upload error:", err);
    res.status(500).json({ error: err?.message ?? "Storage error" });
  }
});

// DELETE /procurement-quotations/:id/attachments/:attachmentId
// Actor identity derived from JWT — role checked server-side.
router.delete("/procurement-quotations/:id/attachments/:attachmentId", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }

  const quotationId = Number(req.params.id);
  const attachmentId = Number(req.params.attachmentId);

  const [att] = await db.select().from(quotationAttachmentsTable)
    .where(and(eq(quotationAttachmentsTable.id, attachmentId), eq(quotationAttachmentsTable.quotationId, quotationId)));
  if (!att) { res.status(404).json({ error: "Attachment not found" }); return; }

  // Only the uploader or admin/director/manager may delete
  if (att.uploadedBy !== actor.userId && !["admin", "director", "manager"].includes(actor.role)) {
    res.status(403).json({ error: "Only the uploader or a manager can delete attachments" }); return;
  }

  await db.delete(quotationAttachmentsTable).where(eq(quotationAttachmentsTable.id, attachmentId));
  await db.insert(quotationAuditLogsTable).values({
    quotationId, action: "AttachmentDeleted",
    performedBy: actor.userId,
    performedByName: (actor as any).name ?? "User",
    performedByRole: actor.role,
    remarks: `Removed attachment: ${att.fileName}`,
  });

  res.json({ ok: true });
});

export default router;
