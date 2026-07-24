import { Router, type Request, type IRouter } from "express";
import {
  db, usersTable,
  approvalWorkflowsTable, approvalWorkflowStepsTable,
  approvalRequestsTable, approvalRequestStepsTable,
  approvalActionsTable, approvalDelegatesTable,
  procurementQuotationsTable, procurementPOsTable, notificationsTable,
  procPOAuditLogsTable,
} from "@workspace/db";
import { approveQuotationAndGeneratePO, rejectQuotation } from "../lib/quotationApprovalService";
import { eq, and, or, inArray, desc, sql, ne, gte, lte } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

/* ── Auth helper ─────────────────────────────────────────────────────────── */
function getActor(req: Request): { userId: number; role: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as { userId: number; role: string }; }
  catch { return null; }
}

/* ── Auto-increment ref number ───────────────────────────────────────────── */
async function nextRef(): Promise<string> {
  const r = await db.select({ id: approvalRequestsTable.id })
    .from(approvalRequestsTable).orderBy(desc(approvalRequestsTable.id)).limit(1);
  const n = (r[0]?.id ?? 0) + 1;
  return `APR-${String(n).padStart(5, "0")}`;
}

/* ── Format helpers ──────────────────────────────────────────────────────── */
async function userNames(ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable).where(inArray(usersTable.id, ids));
  return new Map(rows.map(r => [r.id, r.name]));
}

/** Single-request formatter — used for detail endpoints only */
async function fmtRequest(req: typeof approvalRequestsTable.$inferSelect, names: Map<number, string>) {
  const [steps, actions] = await Promise.all([
    db.select().from(approvalRequestStepsTable)
      .where(eq(approvalRequestStepsTable.requestId, req.id))
      .orderBy(approvalRequestStepsTable.stepOrder),
    db.select().from(approvalActionsTable)
      .where(eq(approvalActionsTable.requestId, req.id))
      .orderBy(desc(approvalActionsTable.createdAt)),
  ]);
  const actorIds = [...new Set([
    ...steps.map(s => s.actedById).filter(Boolean) as number[],
    ...actions.map(a => a.actorId).filter(Boolean) as number[],
    ...steps.map(s => s.delegatedToId).filter(Boolean) as number[],
  ])];
  const ns = await userNames(actorIds);
  return fmtRequestWithData(req, names, steps, actions, ns);
}

/** Batch formatter — O(1) queries for a list of requests (no N+1) */
async function fmtRequestsBatch(
  reqs: (typeof approvalRequestsTable.$inferSelect)[],
  requesterNames: Map<number, string>,
) {
  if (!reqs.length) return [];
  const ids = reqs.map(r => r.id);
  const [allSteps, allActions] = await Promise.all([
    db.select().from(approvalRequestStepsTable)
      .where(inArray(approvalRequestStepsTable.requestId, ids))
      .orderBy(approvalRequestStepsTable.requestId, approvalRequestStepsTable.stepOrder),
    db.select().from(approvalActionsTable)
      .where(inArray(approvalActionsTable.requestId, ids))
      .orderBy(approvalActionsTable.requestId, desc(approvalActionsTable.createdAt)),
  ]);
  const stepsByReq  = new Map<number, typeof allSteps>();
  const actionsByReq = new Map<number, typeof allActions>();
  for (const s of allSteps) {
    const arr = stepsByReq.get(s.requestId) ?? [];
    arr.push(s); stepsByReq.set(s.requestId, arr);
  }
  for (const a of allActions) {
    const arr = actionsByReq.get(a.requestId) ?? [];
    arr.push(a); actionsByReq.set(a.requestId, arr);
  }
  // Single batch user-name lookup for all actor/delegatee IDs across all requests
  const actorIds = [...new Set([
    ...allSteps.map(s => s.actedById).filter(Boolean) as number[],
    ...allSteps.map(s => s.delegatedToId).filter(Boolean) as number[],
    ...allActions.map(a => a.actorId).filter(Boolean) as number[],
  ])];
  const ns = await userNames(actorIds);
  return reqs.map(req =>
    fmtRequestWithData(req, requesterNames, stepsByReq.get(req.id) ?? [], actionsByReq.get(req.id) ?? [], ns)
  );
}

/** Pure formatter — no DB access */
function fmtRequestWithData(
  req: typeof approvalRequestsTable.$inferSelect,
  names: Map<number, string>,
  steps: (typeof approvalRequestStepsTable.$inferSelect)[],
  actions: (typeof approvalActionsTable.$inferSelect)[],
  ns: Map<number, string>,
) {
  return {
    ...req,
    slaDeadline: req.slaDeadline?.toISOString() ?? null,
    resolvedAt:  req.resolvedAt?.toISOString()  ?? null,
    createdAt:   req.createdAt.toISOString(),
    updatedAt:   req.updatedAt.toISOString(),
    requesterName: names.get(req.requesterId) ?? "Unknown",
    steps: steps.map(s => ({
      ...s,
      slaDeadline: s.slaDeadline?.toISOString() ?? null,
      actedAt:     s.actedAt?.toISOString()     ?? null,
      escalatedAt: s.escalatedAt?.toISOString() ?? null,
      actedByName:     s.actedById     ? (ns.get(s.actedById)     ?? null) : null,
      delegatedToName: s.delegatedToId ? (ns.get(s.delegatedToId) ?? null) : null,
    })),
    actions: actions.map(a => ({
      ...a,
      createdAt:  a.createdAt.toISOString(),
      actorName:  a.actorId ? (ns.get(a.actorId) ?? null) : null,
    })),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   WORKFLOW CRUD
══════════════════════════════════════════════════════════════════════════ */

router.get("/approval-workflows", async (_req, res): Promise<void> => {
  const wfs = await db.select().from(approvalWorkflowsTable).orderBy(desc(approvalWorkflowsTable.createdAt));
  const ids = wfs.map(w => w.id);
  const steps = ids.length
    ? await db.select().from(approvalWorkflowStepsTable)
        .where(inArray(approvalWorkflowStepsTable.workflowId, ids))
        .orderBy(approvalWorkflowStepsTable.workflowId, approvalWorkflowStepsTable.stepOrder)
    : [];
  const stepsByWf = new Map<number, typeof steps>();
  for (const s of steps) {
    const arr = stepsByWf.get(s.workflowId) ?? [];
    arr.push(s); stepsByWf.set(s.workflowId, arr);
  }
  const creatorIds = [...new Set(wfs.map(w => w.createdById).filter(Boolean) as number[])];
  const names = await userNames(creatorIds);
  res.json(wfs.map(w => ({
    ...w,
    createdAt: w.createdAt.toISOString(), updatedAt: w.updatedAt.toISOString(),
    createdByName: w.createdById ? (names.get(w.createdById) ?? null) : null,
    steps: (stepsByWf.get(w.id) ?? []),
  })));
});

router.post("/approval-workflows", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { steps = [], ...body } = req.body;
  if (!body.name?.trim()) { res.status(400).json({ error: "Workflow name is required" }); return; }
  const [wf] = await db.insert(approvalWorkflowsTable)
    .values({ ...body, name: body.name.trim(), createdById: actor.userId }).returning();
  if (steps.length) {
    await db.insert(approvalWorkflowStepsTable)
      .values(steps.map((s: any, i: number) => ({ ...s, workflowId: wf.id, stepOrder: i + 1 })));
  }
  res.status(201).json(wf);
});

router.get("/approval-workflows/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [wf] = await db.select().from(approvalWorkflowsTable).where(eq(approvalWorkflowsTable.id, id));
  if (!wf) { res.status(404).json({ error: "Workflow not found" }); return; }
  const steps = await db.select().from(approvalWorkflowStepsTable)
    .where(eq(approvalWorkflowStepsTable.workflowId, id))
    .orderBy(approvalWorkflowStepsTable.stepOrder);
  res.json({ ...wf, createdAt: wf.createdAt.toISOString(), updatedAt: wf.updatedAt.toISOString(), steps });
});

router.patch("/approval-workflows/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { steps, ...body } = req.body;
  const [wf] = await db.update(approvalWorkflowsTable)
    .set({ ...body, updatedAt: new Date() }).where(eq(approvalWorkflowsTable.id, id)).returning();
  if (!wf) { res.status(404).json({ error: "Workflow not found" }); return; }
  if (steps !== undefined) {
    await db.delete(approvalWorkflowStepsTable).where(eq(approvalWorkflowStepsTable.workflowId, id));
    if (steps.length) {
      await db.insert(approvalWorkflowStepsTable)
        .values(steps.map((s: any, i: number) => ({ ...s, workflowId: id, stepOrder: i + 1 })));
    }
  }
  res.json(wf);
});

router.delete("/approval-workflows/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(approvalWorkflowsTable).where(eq(approvalWorkflowsTable.id, id));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════════════════════════
   APPROVAL REQUESTS — LIST VIEWS
══════════════════════════════════════════════════════════════════════════ */

router.get("/approvals/my-pending", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Single query: all pending requests whose current step targets this actor
  // Uses a JOIN so we never loop — O(1) round trips regardless of volume.
  const rows = await db
    .selectDistinct({ req: approvalRequestsTable })
    .from(approvalRequestsTable)
    .innerJoin(
      approvalRequestStepsTable,
      and(
        eq(approvalRequestStepsTable.requestId, approvalRequestsTable.id),
        eq(approvalRequestStepsTable.stepOrder,  approvalRequestsTable.currentStep),
        eq(approvalRequestStepsTable.status,     "pending"),
        or(
          eq(approvalRequestStepsTable.approverRole,   actor.role),
          eq(approvalRequestStepsTable.approverUserId, actor.userId),
          eq(approvalRequestStepsTable.delegatedToId,  actor.userId),
        ),
      )
    )
    .where(eq(approvalRequestsTable.status, "pending"))
    .orderBy(approvalRequestsTable.slaDeadline, approvalRequestsTable.createdAt);

  const myReqs = rows.map(r => r.req);
  const names  = await userNames([...new Set(myReqs.map(r => r.requesterId))]);
  res.json(await fmtRequestsBatch(myReqs, names));
});

router.get("/approvals/my-requests", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const reqs = await db.select().from(approvalRequestsTable)
    .where(eq(approvalRequestsTable.requesterId, actor.userId))
    .orderBy(desc(approvalRequestsTable.createdAt));
  const names = await userNames([actor.userId]);
  res.json(await fmtRequestsBatch(reqs, names));
});

router.get("/approvals/queue", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { status, module: mod, priority } = req.query as Record<string, string>;
  // Push all filters into the DB — no JS-side filtering
  let q = db.select().from(approvalRequestsTable)
    .orderBy(desc(approvalRequestsTable.createdAt)).$dynamic();
  if (status)   q = q.where(eq(approvalRequestsTable.status,   status as any));
  if (mod)      q = q.where(eq(approvalRequestsTable.module,   mod));
  if (priority) q = q.where(eq(approvalRequestsTable.priority, priority as any));
  const rows  = await q;
  const names = await userNames([...new Set(rows.map(r => r.requesterId))]);
  res.json(await fmtRequestsBatch(rows, names));
});

router.get("/approvals/history", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const terminal = ["approved", "rejected", "recalled", "cancelled"];
  // Non-admins: filter to own requests + ones they acted on — done in DB
  let q = db.select().from(approvalRequestsTable)
    .where(inArray(approvalRequestsTable.status, terminal))
    .orderBy(desc(approvalRequestsTable.updatedAt)).$dynamic();
  if (!["admin", "director"].includes(actor.role)) {
    // Fetch their action IDs first (small set per user), then use inArray
    const myActions = await db.select({ requestId: approvalActionsTable.requestId })
      .from(approvalActionsTable).where(eq(approvalActionsTable.actorId, actor.userId));
    const myActionIds = myActions.map(a => a.requestId);
    const filterIds = [...new Set(myActionIds)];
    q = filterIds.length
      ? q.where(or(eq(approvalRequestsTable.requesterId, actor.userId), inArray(approvalRequestsTable.id, filterIds)))
      : q.where(eq(approvalRequestsTable.requesterId, actor.userId));
  }
  const rows  = await q;
  const names = await userNames([...new Set(rows.map(r => r.requesterId))]);
  res.json(await fmtRequestsBatch(rows, names));
});

router.get("/approvals/delegated", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  // Requests where any step has been delegated to this user
  const steps = await db.select({ requestId: approvalRequestStepsTable.requestId })
    .from(approvalRequestStepsTable)
    .where(eq(approvalRequestStepsTable.delegatedToId, actor.userId));
  const ids = [...new Set(steps.map(s => s.requestId))];
  if (!ids.length) { res.json([]); return; }
  const rows = await db.select().from(approvalRequestsTable)
    .where(inArray(approvalRequestsTable.id, ids))
    .orderBy(desc(approvalRequestsTable.createdAt));
  const names = await userNames([...new Set(rows.map(r => r.requesterId))]);
  const result = await Promise.all(rows.map(r => fmtRequest(r, names)));
  res.json(result);
});

router.get("/approvals/analytics", async (req, res): Promise<void> => {
  const all = await db.select().from(approvalRequestsTable);
  const terminal = ["approved", "rejected", "recalled", "cancelled"];
  const active = all.filter(r => !terminal.includes(r.status));

  // Resolution times (in hours)
  const resolved = all.filter(r => r.resolvedAt && r.createdAt);
  const avgResolutionHours = resolved.length
    ? resolved.reduce((s, r) =>
        s + (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000, 0) / resolved.length
    : 0;

  // By module
  const byModule: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const r of all) {
    byModule[r.module]     = (byModule[r.module]     ?? 0) + 1;
    byStatus[r.status]     = (byStatus[r.status]     ?? 0) + 1;
    byPriority[r.priority] = (byPriority[r.priority] ?? 0) + 1;
  }

  // Daily volume last 30 days
  const now = new Date();
  const daily: { date: string; count: number }[] = [];
  for (let d = 29; d >= 0; d--) {
    const dt = new Date(now); dt.setDate(now.getDate() - d);
    const dateStr = dt.toISOString().split("T")[0];
    daily.push({ date: dateStr, count: all.filter(r => r.createdAt.toISOString().startsWith(dateStr)).length });
  }

  // SLA compliance
  const now_ = new Date();
  const withSla = all.filter(r => r.slaDeadline);
  const overdue = withSla.filter(r => r.slaDeadline! < now_ && r.status === "pending").length;
  const onTime  = withSla.length - overdue;

  // Pending count by step/approver role (bottleneck analysis)
  const pendingSteps = await db.select().from(approvalRequestStepsTable)
    .where(eq(approvalRequestStepsTable.status, "pending"));
  const byRole: Record<string, number> = {};
  for (const s of pendingSteps) {
    const role = s.approverRole ?? "any";
    byRole[role] = (byRole[role] ?? 0) + 1;
  }

  res.json({
    totals: {
      total: all.length, pending: active.length,
      approved: byStatus["approved"] ?? 0,
      rejected:  byStatus["rejected"]  ?? 0,
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      overdueSla: overdue,
    },
    byModule:   Object.entries(byModule).map(([module, count]) => ({ module, count })),
    byStatus:   Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    byPriority: Object.entries(byPriority).map(([priority, count]) => ({ priority, count })),
    byApproverRole: Object.entries(byRole).map(([role, count]) => ({ role, count })),
    daily,
    sla: { onTime, overdue, total: withSla.length },
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   DELEGATION RULES — GET endpoints (must be above /:id to avoid shadowing)
══════════════════════════════════════════════════════════════════════════ */

// List all users for the delegate picker (any authenticated user)
router.get("/approvals/users-for-delegate", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select({
    id:   usersTable.id,
    name: usersTable.name,
    role: usersTable.role,
  }).from(usersTable);
  res.json(rows);
});

// List current user's delegation rules
router.get("/approvals/my-delegates", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select().from(approvalDelegatesTable)
    .where(eq(approvalDelegatesTable.fromUserId, actor.userId))
    .orderBy(desc(approvalDelegatesTable.createdAt));
  // Enrich with delegate user name
  const toIds = [...new Set(rows.map(r => r.toUserId))];
  const names = await userNames(toIds);
  res.json(rows.map(r => ({
    ...r,
    startDate: r.startDate.toISOString(),
    endDate:   r.endDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    toUserName: names.get(r.toUserId) ?? "Unknown",
  })));
});

/* ── Single request detail ───────────────────────────────────────────────── */
router.get("/approvals/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [r] = await db.select().from(approvalRequestsTable).where(eq(approvalRequestsTable.id, id));
  if (!r) { res.status(404).json({ error: "Request not found" }); return; }
  const names = await userNames([r.requesterId]);
  res.json(await fmtRequest(r, names));
});

/* ══════════════════════════════════════════════════════════════════════════
   SUBMIT NEW REQUEST
══════════════════════════════════════════════════════════════════════════ */
router.post("/approvals", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const body = req.body;
  if (!body.title?.trim()) { res.status(400).json({ error: "Title is required" }); return; }

  // Load workflow steps if workflowId provided
  let wfSteps: typeof approvalWorkflowStepsTable.$inferSelect[] = [];
  if (body.workflowId) {
    wfSteps = await db.select().from(approvalWorkflowStepsTable)
      .where(eq(approvalWorkflowStepsTable.workflowId, Number(body.workflowId)))
      .orderBy(approvalWorkflowStepsTable.stepOrder);
  }
  const totalSteps = wfSteps.length || 1;

  // Compute SLA deadline from first step
  const firstStepSla = wfSteps[0]?.slaHours ?? 24;
  const slaDeadline = new Date(Date.now() + firstStepSla * 3_600_000);

  const ref = await nextRef();
  const [request] = await db.insert(approvalRequestsTable).values({
    workflowId:  body.workflowId ? Number(body.workflowId) : null,
    refNumber:   ref,
    title:       body.title.trim(),
    description: body.description ?? null,
    module:      body.module ?? "other",
    entityType:  body.entityType ?? null,
    entityRef:   body.entityRef  ?? null,
    entityUrl:   body.entityUrl  ?? null,
    requesterId: actor.userId,
    priority:    body.priority ?? "medium",
    status:      "pending",
    currentStep: 1,
    totalSteps,
    slaDeadline,
    notes:       body.notes ?? null,
  }).returning();

  // Create request steps from workflow steps
  if (wfSteps.length) {
    const now = new Date();
    await db.insert(approvalRequestStepsTable).values(
      wfSteps.map((s, i) => ({
        requestId:      request.id,
        stepOrder:      s.stepOrder,
        name:           s.name,
        stepType:       s.stepType,
        approverType:   s.approverType,
        approverRole:   s.approverRole ?? null,
        approverUserId: s.approverUserId ?? null,
        status:         i === 0 ? "pending" : "pending",
        slaDeadline:    new Date(now.getTime() + (s.slaHours ?? 24) * 3_600_000),
      }))
    );
  } else {
    // Ad-hoc request — create a single step for the admin/director to approve
    const targetRole = body.approverRole ?? "director";
    await db.insert(approvalRequestStepsTable).values({
      requestId: request.id, stepOrder: 1, name: "Approval",
      stepType: "sequential", approverType: "role", approverRole: targetRole,
      status: "pending", slaDeadline,
    });
  }

  // Log submission action
  await db.insert(approvalActionsTable).values({
    requestId: request.id, actorId: actor.userId,
    actionType: "submitted", comment: body.notes ?? null,
  });

  res.status(201).json(request);
});

/* ══════════════════════════════════════════════════════════════════════════
   APPROVAL ACTIONS
══════════════════════════════════════════════════════════════════════════ */
async function canAct(requestId: number, actor: { userId: number; role: string }) {
  const [r] = await db.select().from(approvalRequestsTable).where(eq(approvalRequestsTable.id, requestId));
  if (!r || r.status !== "pending") return { ok: false, r: null, steps: [] };
  const steps = await db.select().from(approvalRequestStepsTable)
    .where(and(
      eq(approvalRequestStepsTable.requestId, requestId),
      eq(approvalRequestStepsTable.stepOrder, r.currentStep),
      eq(approvalRequestStepsTable.status, "pending"),
    ));
  const mine = steps.find(s =>
    (s.approverRole && s.approverRole === actor.role) ||
    (s.approverUserId && s.approverUserId === actor.userId) ||
    (s.delegatedToId && s.delegatedToId === actor.userId)
  );
  return { ok: !!mine, r, steps, myStep: mine };
}

router.patch("/approvals/:id/approve", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  const { comment } = req.body;
  const { ok, r, myStep } = await canAct(id, actor);
  if (!ok || !r || !myStep) { res.status(403).json({ error: "Cannot act on this request" }); return; }

  // Mark the step approved
  await db.update(approvalRequestStepsTable)
    .set({ status: "approved", actedById: actor.userId, actedAt: new Date(), comment: comment ?? null })
    .where(eq(approvalRequestStepsTable.id, myStep.id));

  // Check if all steps at current level are approved (for sequential, there's just one)
  const remaining = await db.select().from(approvalRequestStepsTable)
    .where(and(
      eq(approvalRequestStepsTable.requestId, id),
      eq(approvalRequestStepsTable.stepOrder, r.currentStep),
      ne(approvalRequestStepsTable.status, "approved"),
    ));

  let newStatus = r.status;
  let newStep = r.currentStep;

  if (!remaining.length) {
    // Advance to next step or mark fully approved
    if (r.currentStep < r.totalSteps) {
      newStep = r.currentStep + 1;
    } else {
      newStatus = "approved";
    }
  }

  // ── Bidirectional sync for quotation entities — run BEFORE updating approval request ──
  if (newStatus === "approved" && r.entityType === "quotation") {
    const [quot] = await db.select().from(procurementQuotationsTable)
      .where(eq(procurementQuotationsTable.approvalRequestId, id));
    if (quot) {
      try {
        await approveQuotationAndGeneratePO(
          quot.id,
          comment ?? "Approved via Approval Workbench",
          { userId: actor.userId, role: actor.role, name: (actor as any).name ?? "Approver" },
        );
      } catch (syncErr: any) {
        await db.update(approvalRequestStepsTable)
          .set({ status: "pending", actedById: null, actedAt: null, comment: null })
          .where(eq(approvalRequestStepsTable.id, myStep.id));
        console.error("Workbench quotation sync error:", syncErr?.message);
        res.status(500).json({ error: `Approval processing failed: ${syncErr?.message}. Please retry.` });
        return;
      }
    }
  }

  // ── Bidirectional sync for purchase_order entities ─────────────────────────
  if (newStatus === "approved" && r.entityType === "purchase_order") {
    const [po] = await db.select().from(procurementPOsTable)
      .where(eq((procurementPOsTable as any).approvalRequestId, id));
    if (po) {
      const now = new Date();
      await db.update(procurementPOsTable).set({
        status: "Approved",
        approvedAt: now, approvedBy: actor.userId, approvedByName: (actor as any).name ?? "Approver",
        isLocked: true, updatedAt: now,
      } as any).where(eq(procurementPOsTable.id, po.id));
      // Insert audit log
      try {
        await db.insert(procPOAuditLogsTable).values({
          poId: po.id, action: "Approved",
          performedBy: actor.userId, performedByName: (actor as any).name ?? "Approver",
          remarks: comment ?? "Approved via Approval Workbench",
        });
        // Notify submitter
        if ((po as any).submittedBy) {
          await db.insert(notificationsTable).values({
            userId: (po as any).submittedBy, type: "success",
            title: "Purchase Order Approved",
            message: `${po.poNumber} approved via Approval Workbench by ${(actor as any).name ?? "Approver"}.`,
            entityType: "purchase_order", entityId: po.id, entityRef: po.poNumber,
            actionUrl: `/procurement/pos/${po.id}`,
          });
        }
      } catch (e) { console.error("PO approval side-effects:", e); }
    }
  }

  await db.update(approvalRequestsTable)
    .set({ currentStep: newStep, status: newStatus, updatedAt: new Date(),
           resolvedAt: newStatus === "approved" ? new Date() : null })
    .where(eq(approvalRequestsTable.id, id));

  await db.insert(approvalActionsTable).values({
    requestId: id, stepId: myStep.id, actorId: actor.userId,
    actionType: "approved", comment: comment ?? null,
  });

  res.json({ ok: true, status: newStatus });
});

router.patch("/approvals/:id/reject", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  const { comment } = req.body;
  if (!comment?.trim()) { res.status(400).json({ error: "Rejection reason is required" }); return; }
  const { ok, myStep } = await canAct(id, actor);
  if (!ok || !myStep) { res.status(403).json({ error: "Cannot act on this request" }); return; }

  await db.update(approvalRequestStepsTable)
    .set({ status: "rejected", actedById: actor.userId, actedAt: new Date(), comment })
    .where(eq(approvalRequestStepsTable.id, myStep.id));

  const [rFull] = await db.select().from(approvalRequestsTable).where(eq(approvalRequestsTable.id, id));

  await db.update(approvalRequestsTable)
    .set({ status: "rejected", updatedAt: new Date(), resolvedAt: new Date() })
    .where(eq(approvalRequestsTable.id, id));
  await db.insert(approvalActionsTable).values({
    requestId: id, stepId: myStep.id, actorId: actor.userId,
    actionType: "rejected", comment,
  });

  // ── Bidirectional sync: propagate full rejection to quotation ─────────────
  if (rFull?.entityType === "quotation") {
    const [quot] = await db.select().from(procurementQuotationsTable)
      .where(eq(procurementQuotationsTable.approvalRequestId, id));
    if (quot) {
      try {
        await rejectQuotation(
          quot.id,
          comment,
          { userId: actor.userId, role: actor.role, name: (actor as any).name ?? "Approver" },
        );
      } catch (syncErr: any) {
        console.error("Workbench quotation reject sync:", syncErr?.message);
      }
    }
  }

  // ── Bidirectional sync: propagate full rejection to purchase_order ─────────
  if (rFull?.entityType === "purchase_order") {
    const [po] = await db.select().from(procurementPOsTable)
      .where(eq((procurementPOsTable as any).approvalRequestId, id));
    if (po) {
      const now = new Date();
      try {
        await db.update(procurementPOsTable).set({
          status: "Rejected",
          rejectedAt: now,
          rejectedBy: actor.userId,
          rejectedByName: (actor as any).name ?? "Approver",
          rejectionReason: comment,
          updatedAt: now,
        } as any).where(eq(procurementPOsTable.id, po.id));
        // Audit log
        await db.insert(procPOAuditLogsTable as any).values({
          poId: po.id, action: "Rejected",
          performedBy: actor.userId,
          performedByName: (actor as any).name ?? "Approver",
          remarks: comment,
          oldValues: { status: po.status },
          newValues: { status: "Rejected", rejectionReason: comment },
        });
        // Notify submitter
        if ((po as any).submittedBy) {
          await db.insert(notificationsTable).values({
            userId: (po as any).submittedBy,
            type: "error",
            title: "Purchase Order Rejected",
            message: `${po.poNumber} was rejected by ${(actor as any).name ?? "Approver"} via Approval Workbench. Reason: "${comment}". Please revise and resubmit.`,
            entityType: "purchase_order",
            entityId: po.id,
            entityRef: po.poNumber,
            actionUrl: `/procurement/pos/${po.id}`,
          });
        }
      } catch (e) { console.error("PO rejection side-effects:", e); }
    }
  }

  res.json({ ok: true });
});

router.patch("/approvals/:id/recall", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  const [r] = await db.select().from(approvalRequestsTable).where(eq(approvalRequestsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  if (r.requesterId !== actor.userId && !["admin","director"].includes(actor.role))
    { res.status(403).json({ error: "Forbidden" }); return; }
  if (r.status !== "pending") { res.status(400).json({ error: "Only pending requests can be recalled" }); return; }

  await db.update(approvalRequestsTable)
    .set({ status: "recalled", updatedAt: new Date(), resolvedAt: new Date() })
    .where(eq(approvalRequestsTable.id, id));
  await db.update(approvalRequestStepsTable)
    .set({ status: "skipped" })
    .where(and(eq(approvalRequestStepsTable.requestId, id), eq(approvalRequestStepsTable.status, "pending")));
  await db.insert(approvalActionsTable).values({
    requestId: id, actorId: actor.userId, actionType: "recalled",
    comment: req.body.comment ?? null,
  });
  res.json({ ok: true });
});

router.patch("/approvals/:id/delegate", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  const { delegateToId, comment } = req.body;
  if (!delegateToId) { res.status(400).json({ error: "delegateToId required" }); return; }
  const { ok, myStep } = await canAct(id, actor);
  if (!ok || !myStep) { res.status(403).json({ error: "Cannot delegate this request" }); return; }

  await db.update(approvalRequestStepsTable)
    .set({ delegatedToId: Number(delegateToId), status: "delegated" })
    .where(eq(approvalRequestStepsTable.id, myStep.id));
  // Create a new pending step for the delegate
  await db.insert(approvalRequestStepsTable).values({
    requestId: id, stepOrder: myStep.stepOrder, name: `${myStep.name} (Delegated)`,
    stepType: myStep.stepType, approverType: "user",
    approverUserId: Number(delegateToId), status: "pending",
  });
  await db.insert(approvalActionsTable).values({
    requestId: id, stepId: myStep.id, actorId: actor.userId,
    actionType: "delegated", comment: comment ?? null,
    metadata: { delegateToId },
  });
  res.json({ ok: true });
});

router.post("/approvals/:id/comment", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  const { comment } = req.body;
  if (!comment?.trim()) { res.status(400).json({ error: "Comment is required" }); return; }
  await db.insert(approvalActionsTable).values({
    requestId: id, actorId: actor.userId, actionType: "commented", comment,
  });
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════════════════════════
   DELEGATION RULES — write endpoints
══════════════════════════════════════════════════════════════════════════ */

// Create a new profile-level delegation rule
router.post("/approvals/delegate", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { toUserId, module, startDate, endDate } = req.body;
  if (!toUserId) { res.status(400).json({ error: "toUserId required" }); return; }
  const [row] = await db.insert(approvalDelegatesTable).values({
    fromUserId: actor.userId,
    toUserId:   Number(toUserId),
    module:     module ?? null,
    startDate:  startDate  ? new Date(startDate)  : new Date(),
    endDate:    endDate    ? new Date(endDate)     : null,
    isActive:   true,
  }).returning();
  res.status(201).json(row);
});

// Delete a profile-level delegation rule
router.delete("/approvals/delegate/:id", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const delegateId = Number(req.params.id);
  const [row] = await db.select().from(approvalDelegatesTable)
    .where(eq(approvalDelegatesTable.id, delegateId));
  if (!row) { res.status(404).json({ error: "Delegation rule not found" }); return; }
  if (row.fromUserId !== actor.userId && actor.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(approvalDelegatesTable).where(eq(approvalDelegatesTable.id, delegateId));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════════════════════════
   OVERDUE STEPS ENDPOINT
══════════════════════════════════════════════════════════════════════════ */

router.get("/approval-requests/overdue", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!["admin", "director"].includes(actor.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const now = new Date();
  const overdueSteps = await db.select({
    step: approvalRequestStepsTable,
    request: approvalRequestsTable,
  })
    .from(approvalRequestStepsTable)
    .innerJoin(approvalRequestsTable, eq(approvalRequestsTable.id, approvalRequestStepsTable.requestId))
    .where(and(
      eq(approvalRequestStepsTable.status, "pending"),
      eq(approvalRequestStepsTable.isEscalated, false),
      lte(approvalRequestStepsTable.slaDeadline, now),
    ))
    .orderBy(approvalRequestStepsTable.slaDeadline);
  res.json(overdueSteps.map(r => ({
    ...r.step,
    requestTitle:     r.request.title,
    requestRefNumber: r.request.refNumber,
    module:           r.request.module,
    entityType:       r.request.entityType,
    entityRef:        r.request.entityRef,
  })));
});

/* ══════════════════════════════════════════════════════════════════════════
   SEED DEMO DATA
══════════════════════════════════════════════════════════════════════════ */
router.post("/approvals/seed", async (req, res): Promise<void> => {
  const actor = getActor(req);
  if (!actor || !["admin", "director"].includes(actor.role))
    { res.status(403).json({ error: "Admin only" }); return; }

  const existing = await db.select({ id: approvalWorkflowsTable.id }).from(approvalWorkflowsTable).limit(1);
  if (existing.length) { res.json({ ok: true, message: "Already seeded" }); return; }

  const users = await db.select().from(usersTable);
  const admin     = users.find(u => u.role === "admin")     ?? users[0];
  const director  = users.find(u => u.role === "director")  ?? users[0];
  const pm        = users.find(u => u.role === "pm")        ?? users[0];
  const finance   = users.find(u => u.role === "finance")   ?? users[0];
  const warehouse = users.find(u => u.role === "warehouse") ?? users[0];
  const sales     = users.find(u => u.role === "sales")     ?? users[0];

  // Seed workflows
  const wfDefs = [
    { name: "Purchase Order Approval",         module: "procurement", description: "Standard PO approval flow: PM → Director", steps: [{ name: "PM Review", approverRole: "pm", slaHours: 24 }, { name: "Director Sign-off", approverRole: "director", slaHours: 48 }] },
    { name: "Vendor Quotation Approval",       module: "procurement", description: "Vendor quotation review and approval: PM review → Director sign-off → PO generation", steps: [{ name: "PM Review", approverRole: "pm", slaHours: 24 }, { name: "Director Sign-off", approverRole: "director", slaHours: 48 }] },
    { name: "Invoice Payment Approval",        module: "finance",     description: "3-level invoice approval for payments", steps: [{ name: "Finance Check", approverRole: "finance", slaHours: 24 }, { name: "Director Approval", approverRole: "director", slaHours: 48 }, { name: "Admin Release", approverRole: "admin", slaHours: 8 }] },
    { name: "Vendor Onboarding",               module: "procurement", description: "New vendor onboarding approval", steps: [{ name: "PM Verification", approverRole: "pm", slaHours: 48 }, { name: "Admin Sign-off", approverRole: "admin", slaHours: 24 }] },
    { name: "Project Budget Release",          module: "projects",    description: "Capital budget release for projects", steps: [{ name: "PM Submission", approverRole: "pm", slaHours: 24 }, { name: "Director Approval", approverRole: "director", slaHours: 72 }] },
    { name: "Leave/Travel Request",            module: "hr",          description: "Employee leave and travel approval", steps: [{ name: "Manager Approval", approverRole: "director", slaHours: 24 }] },
    { name: "Inventory Write-off",             module: "inventory",   description: "Stock write-off or disposal approval", steps: [{ name: "Warehouse Lead", approverRole: "warehouse", slaHours: 24 }, { name: "Finance Clearance", approverRole: "finance", slaHours: 48 }, { name: "Director Final", approverRole: "director", slaHours: 24 }] },
  ];

  const workflows: typeof approvalWorkflowsTable.$inferSelect[] = [];
  for (const w of wfDefs) {
    const [wf] = await db.insert(approvalWorkflowsTable)
      .values({ name: w.name, module: w.module, description: w.description, createdById: admin?.id }).returning();
    await db.insert(approvalWorkflowStepsTable).values(
      w.steps.map((s, i) => ({ workflowId: wf.id, stepOrder: i + 1, name: s.name, stepType: "sequential", approverType: "role", approverRole: s.approverRole, slaHours: s.slaHours }))
    );
    workflows.push(wf);
  }

  const poWf      = workflows[0]!;
  const invWf     = workflows[1]!;
  const vendorWf  = workflows[2]!;
  const projWf    = workflows[3]!;
  const leaveWf   = workflows[4]!;
  const writeWf   = workflows[5]!;

  // Seed requests with various statuses
  const seedRequests = [
    { wf: poWf,     requester: pm,       priority: "high",     module: "procurement", title: "PO for Solar Panels – Q3 Batch",         step: 1, status: "pending",  entityRef: "PO-0042", offsetDays: -1 },
    { wf: poWf,     requester: pm,       priority: "critical", module: "procurement", title: "Emergency Cable Purchase – Site 7",       step: 1, status: "pending",  entityRef: "PO-0043", offsetDays: -3 },
    { wf: invWf,    requester: finance,  priority: "medium",   module: "finance",     title: "Invoice INV-1122 – Waaree Energies",      step: 2, status: "pending",  entityRef: "INV-1122", offsetDays: -2 },
    { wf: vendorWf, requester: pm,       priority: "low",      module: "procurement", title: "Onboarding: SunTech Solutions Pvt Ltd",   step: 1, status: "pending",  entityRef: "VND-0012", offsetDays: -5 },
    { wf: projWf,   requester: pm,       priority: "high",     module: "projects",    title: "Budget Release – Rajasthan Solar Farm",   step: 1, status: "pending",  entityRef: "PRJ-0018", offsetDays: -1 },
    { wf: leaveWf,  requester: sales,    priority: "medium",   module: "hr",          title: "Annual Leave – 5 days Dec 23-27",         step: 1, status: "pending",  entityRef: null,       offsetDays: -0 },
    { wf: writeWf,  requester: warehouse,priority: "medium",   module: "inventory",   title: "Write-off Request – Damaged Cable Batch", step: 1, status: "pending",  entityRef: "WH-0031", offsetDays: -7 },
    { wf: poWf,     requester: pm,       priority: "high",     module: "procurement", title: "PO for Inverter Units – Batch B",         step: 2, status: "approved", entityRef: "PO-0040", offsetDays: -10 },
    { wf: invWf,    requester: finance,  priority: "medium",   module: "finance",     title: "Invoice INV-1110 – Havells India",         step: 3, status: "approved", entityRef: "INV-1110", offsetDays: -14 },
    { wf: vendorWf, requester: pm,       priority: "low",      module: "procurement", title: "Onboarding: Vikram Solar Pvt Ltd",        step: 2, status: "approved", entityRef: "VND-0010", offsetDays: -21 },
    { wf: poWf,     requester: pm,       priority: "medium",   module: "procurement", title: "PO for Safety Equipment – All Sites",     step: 1, status: "rejected", entityRef: "PO-0038", offsetDays: -8 },
    { wf: projWf,   requester: pm,       priority: "high",     module: "projects",    title: "Budget Release – MP Solar Farm Ph-2",     step: 1, status: "recalled", entityRef: "PRJ-0015", offsetDays: -4 },
  ];

  for (const sr of seedRequests) {
    const createdAt = new Date(Date.now() + sr.offsetDays * 86_400_000);
    const slaHours = 24;
    const slaDeadline = new Date(createdAt.getTime() + slaHours * 3_600_000);
    const ref = await nextRef();
    const terminal = sr.status !== "pending";
    const [req] = await db.insert(approvalRequestsTable).values({
      workflowId:  sr.wf.id,
      refNumber:   ref,
      title:       sr.title,
      module:      sr.module,
      entityRef:   sr.entityRef ?? null,
      requesterId: sr.requester?.id ?? admin!.id,
      priority:    sr.priority,
      status:      sr.status as any,
      currentStep: sr.step,
      totalSteps:  wfDefs.find(w => w.name === sr.wf.name)?.steps.length ?? 1,
      slaDeadline,
      createdAt,
      updatedAt:   createdAt,
      resolvedAt:  terminal ? new Date(createdAt.getTime() + 86_400_000) : null,
    }).returning();

    // Create workflow steps for this request
    const wfSteps = await db.select().from(approvalWorkflowStepsTable)
      .where(eq(approvalWorkflowStepsTable.workflowId, sr.wf.id))
      .orderBy(approvalWorkflowStepsTable.stepOrder);

    for (let i = 0; i < wfSteps.length; i++) {
      const s = wfSteps[i]!;
      let stepStatus = "pending";
      if (sr.status === "rejected" && i === 0) stepStatus = "rejected";
      else if (sr.status === "recalled" && i === 0) stepStatus = "skipped";
      else if (sr.status === "approved")   stepStatus = i < wfSteps.length - 1 ? "approved" : "approved";
      else if (i < sr.step - 1)           stepStatus = "approved";

      const actedBy = stepStatus === "approved" ? director?.id
                    : stepStatus === "rejected"  ? director?.id
                    : null;

      await db.insert(approvalRequestStepsTable).values({
        requestId: req.id, stepOrder: s.stepOrder, name: s.name,
        stepType: s.stepType, approverType: s.approverType, approverRole: s.approverRole ?? null,
        status: stepStatus as any,
        actedById: actedBy ?? null,
        actedAt:   actedBy ? new Date(createdAt.getTime() + 3_600_000) : null,
        slaDeadline: new Date(createdAt.getTime() + (s.slaHours ?? 24) * 3_600_000),
      });
    }

    // Log action
    await db.insert(approvalActionsTable).values({
      requestId: req.id, actorId: sr.requester?.id ?? admin!.id,
      actionType: "submitted", createdAt,
    });
    if (sr.status === "approved") {
      await db.insert(approvalActionsTable).values({
        requestId: req.id, actorId: director?.id,
        actionType: "approved", comment: "Reviewed and approved.",
        createdAt: new Date(createdAt.getTime() + 3_600_000),
      });
    }
    if (sr.status === "rejected") {
      await db.insert(approvalActionsTable).values({
        requestId: req.id, actorId: director?.id,
        actionType: "rejected", comment: "Budget exceeded for this quarter. Please resubmit next cycle.",
        createdAt: new Date(createdAt.getTime() + 7_200_000),
      });
    }
  }

  res.json({ ok: true, workflows: workflows.length, requests: seedRequests.length });
});

export default router;
