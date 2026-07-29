import { Router, type IRouter } from "express";
import { requireAuth, requirePermission } from "../lib/rbac";
import { db, projectsTable, activitiesTable, budgetsTable, dprsTable, paymentMilestonesTable, expensesTable, crmInvoicesTable, clientPOsTable, escalationsTable, materialRequestsTable, purchaseOrdersTable, snagLogsTable, usersTable } from "@workspace/db";
import { z } from "zod";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  CreateProjectBody, GetProjectParams, UpdateProjectParams, UpdateProjectBody,
  CreateActivityBody, UpdateActivityParams, UpdateActivityBody,
  CreateBudgetBody, CreateExpenseBody, ApproveExpenseParams, ApproveExpenseBody,
  CreatePaymentMilestoneParams, CreatePaymentMilestoneBody, TriggerPaymentMilestoneParams,
  CreateDPRBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
router.use(requireAuth());

function fmtProject(p: typeof projectsTable.$inferSelect, pmOwnerName: string | null = null) {
  return { id: p.id, clientPoId: p.clientPoId, name: p.name, siteLocation: p.siteLocation, pmOwnerId: p.pmOwnerId, pmOwnerName, startDate: p.startDate, plannedEnd: p.plannedEnd, status: p.status, parentProjectId: p.parentProjectId, contractValue: p.contractValue ? Number(p.contractValue) : null, percentComplete: p.percentComplete, createdAt: p.createdAt.toISOString() };
}

function fmtActivity(a: typeof activitiesTable.$inferSelect) {
  return { id: a.id, projectId: a.projectId, wbsCode: a.wbsCode, name: a.name, plannedStart: a.plannedStart, plannedEnd: a.plannedEnd, actualStart: a.actualStart, actualEnd: a.actualEnd, dependencyIds: a.dependencyIds ?? [], percentComplete: a.percentComplete ?? 0, status: a.status };
}

function fmtDPR(d: typeof dprsTable.$inferSelect) {
  return { id: d.id, projectId: d.projectId, reportDate: d.reportDate, submittedBy: d.submittedBy, submittedByName: null, workSummary: d.workSummary, manpowerCount: d.manpowerCount, weather: d.weather, percentComplete: d.percentComplete, photos: d.photos ?? [], createdAt: d.createdAt.toISOString() };
}

function fmtMilestone(m: typeof paymentMilestonesTable.$inferSelect) {
  return { id: m.id, projectId: m.projectId, milestoneName: m.milestoneName, triggerCondition: m.triggerCondition, amount: Number(m.amount), dueDate: m.dueDate, status: m.status, invoiceRef: m.invoiceRef };
}

function fmtExpense(e: typeof expensesTable.$inferSelect) {
  return { id: e.id, projectId: e.projectId, category: e.category, amount: Number(e.amount), incurredBy: e.incurredBy, incurredByName: null, date: e.date, receiptUrl: e.receiptUrl, approvalStatus: e.approvalStatus, notes: e.notes, createdAt: e.createdAt.toISOString() };
}

function fmtBudget(b: typeof budgetsTable.$inferSelect) {
  return { id: b.id, projectId: b.projectId, costHead: b.costHead, budgetedAmount: Number(b.budgetedAmount), committedAmount: Number(b.committedAmount), actualAmount: Number(b.actualAmount), revisionNo: b.revisionNo };
}

// ── PROJECTS ──────────────────────────────────────────────────────────────────
router.get("/projects/portfolio-summary", async (req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable);
  res.json({
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === "Active").length,
    completedProjects: projects.filter(p => p.status === "Completed").length,
    totalBudget: projects.reduce((s, p) => s + Number(p.contractValue ?? 0), 0),
    totalActualSpend: 0,
    onTrackCount: projects.filter(p => p.status === "Active").length,
    delayedCount: 0,
  });
});

router.get("/projects", async (req, res): Promise<void> => {
  let query = db.select({ project: projectsTable, pmName: usersTable.name })
    .from(projectsTable)
    .leftJoin(usersTable, eq(projectsTable.pmOwnerId, usersTable.id))
    .orderBy(desc(projectsTable.createdAt))
    .$dynamic();
  if (req.query.status) query = query.where(eq(projectsTable.status, req.query.status as string));
  const rows = await query;
  res.json(rows.map(r => fmtProject(r.project, r.pmName ?? null)));
});

router.post("/projects", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(projectsTable).values({ ...parsed.data, contractValue: parsed.data.contractValue?.toString() }).returning();
  let pmOwnerName: string | null = null;
  if (row.pmOwnerId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, row.pmOwnerId));
    pmOwnerName = u?.name ?? null;
  }
  res.status(201).json(fmtProject(row, pmOwnerName));
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [result] = await db.select({ project: projectsTable, pmName: usersTable.name })
    .from(projectsTable)
    .leftJoin(usersTable, eq(projectsTable.pmOwnerId, usersTable.id))
    .where(eq(projectsTable.id, params.data.id));
  if (!result) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(fmtProject(result.project, result.pmName ?? null));
});

router.patch("/projects/:id", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const update: Record<string, unknown> = { ...parsed.data };
  const [row] = await db.update(projectsTable).set(update).where(eq(projectsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Project not found" }); return; }
  let pmOwnerName: string | null = null;
  if (row.pmOwnerId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, row.pmOwnerId));
    pmOwnerName = u?.name ?? null;
  }
  res.json(fmtProject(row, pmOwnerName));
});

router.get("/projects/:id/dashboard", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [projectResult] = await db.select({ project: projectsTable, pmName: usersTable.name })
    .from(projectsTable)
    .leftJoin(usersTable, eq(projectsTable.pmOwnerId, usersTable.id))
    .where(eq(projectsTable.id, params.data.id));
  if (!projectResult) { res.status(404).json({ error: "Project not found" }); return; }
  const project = projectResult.project;
  const pmOwnerName = projectResult.pmName ?? null;

  const budgets = await db.select().from(budgetsTable).where(eq(budgetsTable.projectId, params.data.id));
  const [activitiesCount] = await db.select({ count: sql<number>`count(*)` }).from(activitiesTable).where(eq(activitiesTable.projectId, params.data.id));
  const [openMRsCount] = await db.select({ count: sql<number>`count(*)` }).from(materialRequestsTable).where(and(eq(materialRequestsTable.projectId, params.data.id), eq(materialRequestsTable.status, "Open")));
  const [pendingPOsCount] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrdersTable).where(and(eq(purchaseOrdersTable.projectId, params.data.id), eq(purchaseOrdersTable.status, "Open")));
  const [openEscalationsCount] = await db.select({ count: sql<number>`count(*)` }).from(escalationsTable).where(and(eq(escalationsTable.projectId, params.data.id), eq(escalationsTable.status, "Pending")));
  const [lastDPR] = await db.select().from(dprsTable).where(eq(dprsTable.projectId, params.data.id)).orderBy(desc(dprsTable.reportDate)).limit(1);
  const upcomingMilestones = await db.select().from(paymentMilestonesTable).where(and(eq(paymentMilestonesTable.projectId, params.data.id), eq(paymentMilestonesTable.status, "Pending"))).limit(5);

  const totalBudgeted = budgets.reduce((s, b) => s + Number(b.budgetedAmount), 0);
  const totalActual = budgets.reduce((s, b) => s + Number(b.actualAmount), 0);

  res.json({
    project: fmtProject(project, pmOwnerName),
    budgetSummary: { projectId: params.data.id, lines: budgets.map(b => ({ costHead: b.costHead, budgeted: Number(b.budgetedAmount), committed: Number(b.committedAmount), actual: Number(b.actualAmount), variance: Number(b.budgetedAmount) - Number(b.actualAmount) })), totalBudgeted, totalCommitted: budgets.reduce((s, b) => s + Number(b.committedAmount), 0), totalActual, totalVariance: totalBudgeted - totalActual },
    activitiesCount: Number(activitiesCount?.count ?? 0),
    openMRsCount: Number(openMRsCount?.count ?? 0),
    pendingPOsCount: Number(pendingPOsCount?.count ?? 0),
    openEscalationsCount: Number(openEscalationsCount?.count ?? 0),
    lastDPR: lastDPR ? fmtDPR(lastDPR) : null,
    upcomingMilestones: upcomingMilestones.map(fmtMilestone),
  });
});

router.get("/projects/:id/budget-vs-actual", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const lines = await db.select().from(budgetsTable).where(eq(budgetsTable.projectId, params.data.id));
  const totalBudgeted = lines.reduce((s, b) => s + Number(b.budgetedAmount), 0);
  const totalCommitted = lines.reduce((s, b) => s + Number(b.committedAmount), 0);
  const totalActual = lines.reduce((s, b) => s + Number(b.actualAmount), 0);
  res.json({
    projectId: params.data.id,
    lines: lines.map(b => ({ costHead: b.costHead, budgeted: Number(b.budgetedAmount), committed: Number(b.committedAmount), actual: Number(b.actualAmount), variance: Number(b.budgetedAmount) - Number(b.actualAmount) })),
    totalBudgeted, totalCommitted, totalActual, totalVariance: totalBudgeted - totalActual,
  });
});

// ── ACTIVITIES ────────────────────────────────────────────────────────────────
router.get("/projects/:id/activities", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const rows = await db.select().from(activitiesTable).where(eq(activitiesTable.projectId, id));
  res.json(rows.map(fmtActivity));
});

router.post("/projects/:id/activities", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);
  const parsed = CreateActivityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(activitiesTable).values({ ...parsed.data, projectId, dependencyIds: parsed.data.dependencyIds ?? [] }).returning();
  res.status(201).json(fmtActivity(row));
});

router.patch("/activities/:id", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const params = UpdateActivityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateActivityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(activitiesTable).set(parsed.data).where(eq(activitiesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Activity not found" }); return; }
  res.json(fmtActivity(row));
});

// ── DPRs ──────────────────────────────────────────────────────────────────────
router.get("/dprs", async (req, res): Promise<void> => {
  if (!req.query.projectId) { res.status(400).json({ error: "projectId is required" }); return; }
  const rows = await db.select().from(dprsTable).where(eq(dprsTable.projectId, Number(req.query.projectId))).orderBy(desc(dprsTable.reportDate));
  res.json(rows.map(fmtDPR));
});

router.post("/dprs", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const parsed = CreateDPRBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(dprsTable).values({ ...parsed.data, photos: parsed.data.photos ?? [] }).returning();
  res.status(201).json(fmtDPR(row));
});

// ── PAYMENT MILESTONES ────────────────────────────────────────────────────────
router.get("/projects/:id/payment-milestones", async (req, res): Promise<void> => {
  const params = CreatePaymentMilestoneParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await db.select().from(paymentMilestonesTable).where(eq(paymentMilestonesTable.projectId, params.data.id));
  res.json(rows.map(fmtMilestone));
});

router.post("/projects/:id/payment-milestones", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const params = CreatePaymentMilestoneParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreatePaymentMilestoneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(paymentMilestonesTable).values({ ...parsed.data, projectId: params.data.id, amount: parsed.data.amount.toString() }).returning();
  res.status(201).json(fmtMilestone(row));
});

router.post("/payment-milestones/:id/trigger", requirePermission("projects", "approve"), async (req, res): Promise<void> => {
  const params = TriggerPaymentMilestoneParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [milestone] = await db.select().from(paymentMilestonesTable).where(eq(paymentMilestonesTable.id, params.data.id));
  if (!milestone) { res.status(404).json({ error: "Milestone not found" }); return; }
  // Create a CRM invoice
  const [invoice] = await db.insert(crmInvoicesTable).values({ clientPoId: 1, projectId: milestone.projectId, type: "Tax", amount: milestone.amount, paymentStatus: "Unpaid" }).returning();
  const [row] = await db.update(paymentMilestonesTable).set({ status: "Triggered", invoiceRef: invoice.id }).where(eq(paymentMilestonesTable.id, params.data.id)).returning();
  res.json(fmtMilestone(row));
});

// ── EXPENSES ──────────────────────────────────────────────────────────────────
router.get("/expenses", async (req, res): Promise<void> => {
  let query = db.select().from(expensesTable).orderBy(desc(expensesTable.createdAt)).$dynamic();
  if (req.query.projectId) query = query.where(eq(expensesTable.projectId, Number(req.query.projectId)));
  if (req.query.status) query = query.where(eq(expensesTable.approvalStatus, req.query.status as string));
  const rows = await query;
  res.json(rows.map(fmtExpense));
});

router.post("/expenses", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(expensesTable).values({ ...parsed.data, amount: parsed.data.amount.toString() }).returning();
  res.status(201).json(fmtExpense(row));
});

router.post("/expenses/:id/approve", requirePermission("projects", "approve"), async (req, res): Promise<void> => {
  const params = ApproveExpenseParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ApproveExpenseBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const status = body.data.action === "approve" ? "Approved" : "Rejected";
  const [row] = await db.update(expensesTable).set({ approvalStatus: status }).where(eq(expensesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Expense not found" }); return; }
  res.json(fmtExpense(row));
});

// ── BUDGETS ───────────────────────────────────────────────────────────────────
router.get("/budgets", async (req, res): Promise<void> => {
  if (!req.query.projectId) { res.status(400).json({ error: "projectId is required" }); return; }
  const rows = await db.select().from(budgetsTable).where(eq(budgetsTable.projectId, Number(req.query.projectId)));
  res.json(rows.map(fmtBudget));
});

router.post("/budgets", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const parsed = CreateBudgetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(budgetsTable).values({ ...parsed.data, budgetedAmount: parsed.data.budgetedAmount.toString() }).returning();
  res.status(201).json(fmtBudget(row));
});

// ── SNAG LOGS ─────────────────────────────────────────────────────────────────
const CreateSnagBody = z.object({
  zone: z.string().optional(),
  category: z.string().optional(),
  description: z.string(),
  reportedBy: z.number().optional(),
  photoUrl: z.string().optional(),
  severity: z.string().optional(),
  assignedTo: z.number().optional(),
});

const ResolveSnagBody = z.object({
  resolution: z.string(),
});

function fmtSnag(s: typeof snagLogsTable.$inferSelect) {
  return { id: s.id, projectId: s.projectId, zone: s.zone, category: s.category, description: s.description, reportedBy: s.reportedBy, photoUrl: s.photoUrl, severity: s.severity, status: s.status, assignedTo: s.assignedTo, resolvedAt: s.resolvedAt?.toISOString() ?? null, resolution: s.resolution, createdAt: s.createdAt.toISOString() };
}

router.get("/projects/:id/snags", async (req, res): Promise<void> => {
  const projectId = Number(req.params.id);
  const rows = await db.select().from(snagLogsTable).where(eq(snagLogsTable.projectId, projectId)).orderBy(desc(snagLogsTable.createdAt));
  res.json(rows.map(fmtSnag));
});

router.post("/projects/:id/snags", requirePermission("projects", "create"), async (req, res): Promise<void> => {
  const projectId = Number(req.params.id);
  const parsed = CreateSnagBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(snagLogsTable).values({ ...parsed.data, projectId }).returning();
  res.status(201).json(fmtSnag(row));
});

router.patch("/snags/:id/resolve", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const parsed = ResolveSnagBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [updated] = await db.update(snagLogsTable).set({ status: "Resolved", resolvedAt: new Date(), resolution: parsed.data.resolution }).where(eq(snagLogsTable.id, Number(req.params.id))).returning();
  if (!updated) { res.status(404).json({ error: "Snag not found" }); return; }
  res.json(fmtSnag(updated));
});

router.patch("/snags/:id", requirePermission("projects", "edit"), async (req, res): Promise<void> => {
  const [updated] = await db.update(snagLogsTable).set(req.body).where(eq(snagLogsTable.id, Number(req.params.id))).returning();
  if (!updated) { res.status(404).json({ error: "Snag not found" }); return; }
  res.json(fmtSnag(updated));
});

export default router;
