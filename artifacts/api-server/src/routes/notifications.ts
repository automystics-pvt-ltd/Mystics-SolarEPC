import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

// GET /notifications — current user's notifications
router.get("/notifications", async (req, res): Promise<void> => {
  try {
    const userId = Number(req.query.userId);
    if (!userId) { res.status(400).json({ error: "userId required" }); return; }
    const limit = Number(req.query.limit ?? 50);
    const rows = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// GET /notifications/unread-count
router.get("/notifications/unread-count", async (req, res): Promise<void> => {
  try {
    const userId = Number(req.query.userId);
    if (!userId) { res.json({ count: 0 }); return; }
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));
    res.json({ count: row?.count ?? 0 });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /notifications/:id/read
router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// POST /notifications/read-all
router.post("/notifications/read-all", async (req, res): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ error: "userId required" }); return; }
    await db.update(notificationsTable).set({ isRead: true })
      .where(and(eq(notificationsTable.userId, Number(userId)), eq(notificationsTable.isRead, false)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// POST /notifications — create (internal use)
router.post("/notifications", async (req, res): Promise<void> => {
  try {
    const { userId, type = "info", title, message, entityType, entityId, entityRef, actionUrl } = req.body;
    if (!userId || !title || !message) { res.status(400).json({ error: "userId, title, message required" }); return; }
    const [row] = await db.insert(notificationsTable).values({
      userId: Number(userId), type, title, message,
      entityType, entityId: entityId ? Number(entityId) : undefined,
      entityRef, actionUrl,
    }).returning();
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
