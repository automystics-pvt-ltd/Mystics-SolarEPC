import { Router, type IRouter } from "express";
import { db, leadsTable } from "@workspace/db";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";
import { CreateLeadBody, UpdateLeadBody, GetLeadParams, UpdateLeadParams, DeleteLeadParams, AssignLeadParams, AssignLeadBody } from "@workspace/api-zod";

const router: IRouter = Router();

function fmt(l: typeof leadsTable.$inferSelect) {
  return { id: l.id, source: l.source, ownerId: l.ownerId, ownerName: null, territory: l.territory, companyName: l.companyName, contactName: l.contactName, contactPhone: l.contactPhone, contactEmail: l.contactEmail, productInterest: l.productInterest, estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : null, score: l.score, status: l.status, notes: l.notes, createdAt: l.createdAt.toISOString() };
}

router.get("/leads", async (req, res): Promise<void> => {
  let query = db.select().from(leadsTable).orderBy(desc(leadsTable.createdAt)).$dynamic();
  if (req.query.stage) query = query.where(eq(leadsTable.status, req.query.stage as string));
  const rows = await query;
  res.json(rows.map(fmt));
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(leadsTable).values({ ...parsed.data, estimatedValue: parsed.data.estimatedValue?.toString() }).returning();
  res.status(201).json(fmt(row));
});

router.get("/leads/pipeline-summary", async (req, res): Promise<void> => {
  const leads = await db.select().from(leadsTable);
  const stageMap: Record<string, { count: number; value: number }> = {};
  for (const l of leads) {
    if (!stageMap[l.status]) stageMap[l.status] = { count: 0, value: 0 };
    stageMap[l.status].count++;
    stageMap[l.status].value += Number(l.estimatedValue ?? 0);
  }
  const stages = Object.entries(stageMap).map(([stage, v]) => ({ stage, count: v.count, value: v.value }));
  res.json({ stages, totalLeads: leads.length, totalValue: stages.reduce((s, x) => s + x.value, 0) });
});

router.get("/leads/:id", async (req, res): Promise<void> => {
  const params = GetLeadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Lead not found" }); return; }
  res.json(fmt(row));
});

router.patch("/leads/:id", async (req, res): Promise<void> => {
  const params = UpdateLeadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.estimatedValue !== undefined) update.estimatedValue = parsed.data.estimatedValue?.toString();
  const [row] = await db.update(leadsTable).set(update).where(eq(leadsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Lead not found" }); return; }
  res.json(fmt(row));
});

router.delete("/leads/:id", async (req, res): Promise<void> => {
  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(leadsTable).where(eq(leadsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Lead not found" }); return; }
  res.json({ success: true });
});

router.post("/leads/:id/assign", async (req, res): Promise<void> => {
  const params = AssignLeadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = AssignLeadBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [row] = await db.update(leadsTable).set({ ownerId: body.data.ownerId, score: 75 }).where(eq(leadsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Lead not found" }); return; }
  res.json(fmt(row));
});

export default router;
