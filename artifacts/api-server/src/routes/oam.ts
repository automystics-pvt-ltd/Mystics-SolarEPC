import { Router, type IRouter } from "express";
import { requireAuth, requirePermission } from "../lib/rbac";
import { db, amcContractsTable, maintenanceSchedulesTable, serviceTicketsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();
router.use(requireAuth());

let ticketCounter = 1;
let amcCounter = 1;

const CreateAmcBody = z.object({
  projectId: z.number(),
  clientName: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  annualValue: z.number(),
  visitFrequency: z.string().optional(),
  terms: z.string().optional(),
});

const CreateMaintenanceBody = z.object({
  projectId: z.number(),
  amcContractId: z.number().optional(),
  visitType: z.string().optional(),
  scheduledDate: z.string(),
  assignedTechnicianId: z.number().optional(),
  assignedTechnicianName: z.string().optional(),
});

const CompleteMaintenanceBody = z.object({
  completedDate: z.string(),
  workDone: z.string().optional(),
  observations: z.string().optional(),
  nextScheduledDate: z.string().optional(),
});

const CreateTicketBody = z.object({
  projectId: z.number(),
  amcContractId: z.number().optional(),
  raisedBy: z.string().optional(),
  issueCategory: z.string().optional(),
  description: z.string(),
  priority: z.string().optional(),
  assignedTechnicianId: z.number().optional(),
  assignedTechnicianName: z.string().optional(),
  slaHours: z.number().optional(),
});

const ResolveTicketBody = z.object({
  resolution: z.string(),
});

function fmtAmc(a: typeof amcContractsTable.$inferSelect) {
  return { id: a.id, projectId: a.projectId, contractNumber: a.contractNumber, clientName: a.clientName, startDate: a.startDate, endDate: a.endDate, annualValue: Number(a.annualValue), visitFrequency: a.visitFrequency, status: a.status, terms: a.terms, createdAt: a.createdAt.toISOString() };
}

function fmtMs(m: typeof maintenanceSchedulesTable.$inferSelect) {
  return { id: m.id, amcContractId: m.amcContractId, projectId: m.projectId, visitType: m.visitType, scheduledDate: m.scheduledDate, assignedTechnicianId: m.assignedTechnicianId, assignedTechnicianName: m.assignedTechnicianName, status: m.status, completedDate: m.completedDate, workDone: m.workDone, observations: m.observations, nextScheduledDate: m.nextScheduledDate, createdAt: m.createdAt.toISOString() };
}

function fmtTicket(t: typeof serviceTicketsTable.$inferSelect) {
  return { id: t.id, projectId: t.projectId, amcContractId: t.amcContractId, ticketNumber: t.ticketNumber, raisedBy: t.raisedBy, issueCategory: t.issueCategory, description: t.description, priority: t.priority, status: t.status, assignedTechnicianId: t.assignedTechnicianId, assignedTechnicianName: t.assignedTechnicianName, slaHours: t.slaHours, resolvedAt: t.resolvedAt?.toISOString() ?? null, resolution: t.resolution, createdAt: t.createdAt.toISOString() };
}

// ── AMC Contracts ──────────────────────────────────────────────────────────────
router.get("/amc-contracts", async (req, res): Promise<void> => {
  let query = db.select().from(amcContractsTable).orderBy(desc(amcContractsTable.createdAt)).$dynamic();
  if (req.query.projectId) query = query.where(eq(amcContractsTable.projectId, Number(req.query.projectId)));
  res.json((await query).map(fmtAmc));
});

router.post("/amc-contracts", requirePermission("oam", "create"), async (req, res): Promise<void> => {
  const parsed = CreateAmcBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const contractNumber = `AMC-${String(amcCounter++).padStart(4, "0")}`;
  const [row] = await db.insert(amcContractsTable).values({ ...parsed.data, annualValue: String(parsed.data.annualValue), contractNumber }).returning();
  res.status(201).json(fmtAmc(row));
});

router.get("/amc-contracts/:id", async (req, res): Promise<void> => {
  const [row] = await db.select().from(amcContractsTable).where(eq(amcContractsTable.id, Number(req.params.id)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmtAmc(row));
});

router.patch("/amc-contracts/:id", requirePermission("oam", "edit"), async (req, res): Promise<void> => {
  const [updated] = await db.update(amcContractsTable).set(req.body).where(eq(amcContractsTable.id, Number(req.params.id))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmtAmc(updated));
});

// ── Maintenance Schedules ──────────────────────────────────────────────────────
router.get("/maintenance-schedules", async (req, res): Promise<void> => {
  let query = db.select().from(maintenanceSchedulesTable).orderBy(desc(maintenanceSchedulesTable.scheduledDate)).$dynamic();
  if (req.query.projectId) query = query.where(eq(maintenanceSchedulesTable.projectId, Number(req.query.projectId)));
  if (req.query.amcContractId) query = query.where(eq(maintenanceSchedulesTable.amcContractId, Number(req.query.amcContractId)));
  res.json((await query).map(fmtMs));
});

router.post("/maintenance-schedules", requirePermission("oam", "create"), async (req, res): Promise<void> => {
  const parsed = CreateMaintenanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [row] = await db.insert(maintenanceSchedulesTable).values(parsed.data).returning();
  res.status(201).json(fmtMs(row));
});

router.patch("/maintenance-schedules/:id/complete", requirePermission("oam", "edit"), async (req, res): Promise<void> => {
  const parsed = CompleteMaintenanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [updated] = await db.update(maintenanceSchedulesTable).set({ ...parsed.data, status: "Completed" }).where(eq(maintenanceSchedulesTable.id, Number(req.params.id))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmtMs(updated));
});

// ── Service Tickets ────────────────────────────────────────────────────────────
router.get("/service-tickets", async (req, res): Promise<void> => {
  let query = db.select().from(serviceTicketsTable).orderBy(desc(serviceTicketsTable.createdAt)).$dynamic();
  if (req.query.projectId) query = query.where(eq(serviceTicketsTable.projectId, Number(req.query.projectId)));
  if (req.query.status) query = query.where(eq(serviceTicketsTable.status, req.query.status as string));
  res.json((await query).map(fmtTicket));
});

router.post("/service-tickets", requirePermission("oam", "create"), async (req, res): Promise<void> => {
  const parsed = CreateTicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const ticketNumber = `TKT-${String(ticketCounter++).padStart(4, "0")}`;
  const [row] = await db.insert(serviceTicketsTable).values({ ...parsed.data, ticketNumber }).returning();
  res.status(201).json(fmtTicket(row));
});

router.patch("/service-tickets/:id/resolve", requirePermission("oam", "edit"), async (req, res): Promise<void> => {
  const parsed = ResolveTicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [updated] = await db.update(serviceTicketsTable).set({ status: "Resolved", resolvedAt: new Date(), resolution: parsed.data.resolution }).where(eq(serviceTicketsTable.id, Number(req.params.id))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmtTicket(updated));
});

router.patch("/service-tickets/:id", requirePermission("oam", "edit"), async (req, res): Promise<void> => {
  const [updated] = await db.update(serviceTicketsTable).set(req.body).where(eq(serviceTicketsTable.id, Number(req.params.id))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmtTicket(updated));
});

export default router;
