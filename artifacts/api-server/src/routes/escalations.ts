import { Router, type IRouter } from "express";
import { requireAuth, requirePermission } from "../lib/rbac";
import { db, escalationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateEscalationBody, ResolveEscalationParams, ResolveEscalationBody } from "@workspace/api-zod";

const router: IRouter = Router();
router.use(requireAuth());

function fmt(e: typeof escalationsTable.$inferSelect) {
  return { id: e.id, sourceEntityType: e.sourceEntityType, sourceEntityId: e.sourceEntityId, projectId: e.projectId, module: e.module, raisedBy: e.raisedBy, raisedByName: null, reason: e.reason, severity: e.severity, assignedTo: e.assignedTo, assignedToName: null, status: e.status, resolvedAt: e.resolvedAt?.toISOString() ?? null, createdAt: e.createdAt.toISOString() };
}

router.get("/escalations", async (req, res): Promise<void> => {
  let query = db.select().from(escalationsTable).orderBy(desc(escalationsTable.createdAt)).$dynamic();
  if (req.query.status) query = query.where(eq(escalationsTable.status, req.query.status as string));
  if (req.query.projectId) query = query.where(eq(escalationsTable.projectId, Number(req.query.projectId)));
  if (req.query.module) query = query.where(eq(escalationsTable.module, req.query.module as string));
  const rows = await query;
  res.json(rows.map(fmt));
});

router.post("/escalations", requirePermission("crm", "create"), async (req, res): Promise<void> => {
  const parsed = CreateEscalationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(escalationsTable).values(parsed.data).returning();
  res.status(201).json(fmt(row));
});

router.post("/escalations/:id/resolve", requirePermission("crm", "edit"), async (req, res): Promise<void> => {
  const params = ResolveEscalationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ResolveEscalationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [row] = await db.update(escalationsTable).set({ status: "Resolved", resolution: body.data.resolution, resolvedAt: new Date() }).where(eq(escalationsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Escalation not found" }); return; }
  res.json(fmt(row));
});

export default router;
