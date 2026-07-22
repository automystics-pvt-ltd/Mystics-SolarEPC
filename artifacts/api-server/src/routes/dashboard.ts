import { Router, type IRouter } from "express";
import { db, leadsTable, projectsTable, escalationsTable, tasksTable, crmInvoicesTable, paymentMilestonesTable, dprsTable } from "@workspace/db";
import { eq, and, gt, lt, sql, desc, or } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard", async (req, res): Promise<void> => {
  const [leadsCount] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable);
  const [activeProjectsCount] = await db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(eq(projectsTable.status, "Active"));
  const [overdueTasksCount] = await db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(and(eq(tasksTable.status, "Open"), lt(tasksTable.dueDate, new Date().toISOString().split("T")[0])));
  const [openEscalationsCount] = await db.select({ count: sql<number>`count(*)` }).from(escalationsTable).where(or(eq(escalationsTable.status, "Pending"), eq(escalationsTable.status, "InProgress")));

  const recentLeads = await db.select().from(leadsTable).orderBy(desc(leadsTable.createdAt)).limit(5);
  const recentProjects = await db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt)).limit(5);
  const openEscalations = await db.select().from(escalationsTable).where(or(eq(escalationsTable.status, "Pending"), eq(escalationsTable.status, "InProgress"))).orderBy(desc(escalationsTable.createdAt)).limit(5);

  const [invoiceSum] = await db.select({ total: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(crmInvoicesTable).where(or(eq(crmInvoicesTable.paymentStatus, "Unpaid"), eq(crmInvoicesTable.paymentStatus, "Overdue")));
  const [contractSum] = await db.select({ total: sql<number>`coalesce(sum(contract_value::numeric), 0)` }).from(projectsTable);

  res.json({
    role: (req.query.role as string) || "admin",
    leadsCount: Number(leadsCount?.count ?? 0),
    activeProjectsCount: Number(activeProjectsCount?.count ?? 0),
    pendingApprovalsCount: 0,
    overdueTasksCount: Number(overdueTasksCount?.count ?? 0),
    totalContractValue: Number(contractSum?.total ?? 0),
    invoiceOutstanding: Number(invoiceSum?.total ?? 0),
    recentLeads: recentLeads.map(formatLead),
    recentProjects: recentProjects.map(formatProject),
    openEscalations: openEscalations.map(formatEscalation),
  });
});

router.get("/dashboard/combined", async (req, res): Promise<void> => {
  const leads = await db.select().from(leadsTable);
  const stageMap: Record<string, { count: number; value: number }> = {};
  for (const lead of leads) {
    if (!stageMap[lead.status]) stageMap[lead.status] = { count: 0, value: 0 };
    stageMap[lead.status].count++;
    stageMap[lead.status].value += Number(lead.estimatedValue ?? 0);
  }
  const stages = Object.entries(stageMap).map(([stage, v]) => ({ stage, count: v.count, value: v.value }));

  const projects = await db.select().from(projectsTable);
  const totalBudget = 0;
  const totalActual = 0;

  const recentDPRs = await db.select().from(dprsTable).orderBy(desc(dprsTable.createdAt)).limit(5);
  const pendingMilestones = await db.select().from(paymentMilestonesTable).where(eq(paymentMilestonesTable.status, "Pending")).limit(10);
  const openEscalations = await db.select().from(escalationsTable).where(or(eq(escalationsTable.status, "Pending"), eq(escalationsTable.status, "InProgress"))).limit(5);

  res.json({
    pipeline: {
      stages,
      totalLeads: leads.length,
      totalValue: stages.reduce((s, x) => s + x.value, 0),
    },
    portfolioSummary: {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === "Active").length,
      completedProjects: projects.filter(p => p.status === "Completed").length,
      totalBudget,
      totalActualSpend: totalActual,
      onTrackCount: projects.filter(p => p.status === "Active").length,
      delayedCount: 0,
    },
    recentDPRs: recentDPRs.map(d => ({ ...d, percentComplete: d.percentComplete, photos: d.photos ?? [] })),
    pendingMilestones: pendingMilestones.map(m => ({
      id: m.id, projectId: m.projectId, milestoneName: m.milestoneName,
      triggerCondition: m.triggerCondition, amount: String(m.amount), dueDate: m.dueDate,
      status: m.status, invoiceRef: m.invoiceRef,
    })),
    openEscalations: openEscalations.map(formatEscalation),
  });
});

function formatLead(l: typeof leadsTable.$inferSelect) {
  return { id: l.id, source: l.source, ownerId: l.ownerId, ownerName: null, territory: l.territory, companyName: l.companyName, contactName: l.contactName, contactPhone: l.contactPhone, contactEmail: l.contactEmail, productInterest: l.productInterest, estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : null, score: l.score, status: l.status, notes: l.notes, createdAt: l.createdAt.toISOString() };
}

function formatProject(p: typeof projectsTable.$inferSelect) {
  return { id: p.id, clientPoId: p.clientPoId, name: p.name, siteLocation: p.siteLocation, pmOwnerId: p.pmOwnerId, pmOwnerName: null, startDate: p.startDate, plannedEnd: p.plannedEnd, status: p.status, parentProjectId: p.parentProjectId, contractValue: p.contractValue ? Number(p.contractValue) : null, percentComplete: p.percentComplete, createdAt: p.createdAt.toISOString() };
}

function formatEscalation(e: typeof escalationsTable.$inferSelect) {
  return { id: e.id, sourceEntityType: e.sourceEntityType, sourceEntityId: e.sourceEntityId, projectId: e.projectId, module: e.module, raisedBy: e.raisedBy, raisedByName: null, reason: e.reason, severity: e.severity, assignedTo: e.assignedTo, assignedToName: null, status: e.status, resolvedAt: e.resolvedAt?.toISOString() ?? null, createdAt: e.createdAt.toISOString() };
}

export { formatLead, formatProject, formatEscalation };
export default router;
