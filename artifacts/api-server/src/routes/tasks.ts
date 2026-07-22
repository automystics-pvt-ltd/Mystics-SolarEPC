import { Router, type IRouter } from "express";
import { db, tasksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateTaskBody, UpdateTaskParams, UpdateTaskBody } from "@workspace/api-zod";

const router: IRouter = Router();

function fmt(t: typeof tasksTable.$inferSelect) {
  return { id: t.id, sourceModule: t.sourceModule, sourceRefId: t.sourceRefId, title: t.title, ownerId: t.ownerId, ownerName: null, priority: t.priority, dueDate: t.dueDate, status: t.status, createdAt: t.createdAt.toISOString() };
}

router.get("/tasks", async (req, res): Promise<void> => {
  let query = db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt)).$dynamic();
  if (req.query.status) query = query.where(eq(tasksTable.status, req.query.status as string));
  if (req.query.module) query = query.where(eq(tasksTable.sourceModule, req.query.module as string));
  const rows = await query;
  res.json(rows.map(fmt));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(tasksTable).values(parsed.data).returning();
  res.status(201).json(fmt(row));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(tasksTable).set(parsed.data).where(eq(tasksTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(fmt(row));
});

export default router;
