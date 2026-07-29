import { Router, type IRouter } from "express";
import { requireAuth, requirePermission } from "../lib/rbac";
import { db, quotationsTable, clientPOsTable, projectsTable, leadsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import pg from "pg";
import { CreateQuotationBody, GetQuotationParams, UpdateQuotationParams, UpdateQuotationBody, ApproveQuotationParams, ApproveQuotationBody, LogClientPOParams, LogClientPOBody } from "@workspace/api-zod";

const router: IRouter = Router();
router.use(requireAuth());

function fmt(q: typeof quotationsTable.$inferSelect) {
  return { id: q.id, leadId: q.leadId, boqItems: q.boqItems ?? [], version: q.version, markupPct: q.markupPct ? Number(q.markupPct) : 0, totalAmount: q.totalAmount ? Number(q.totalAmount) : null, approvalStatus: q.approvalStatus, validTill: q.validTill, notes: q.notes, createdAt: q.createdAt.toISOString() };
}

function fmtPO(p: typeof clientPOsTable.$inferSelect) {
  return { id: p.id, quotationId: p.quotationId, clientPoNumber: p.clientPoNumber, clientPoFileUrl: p.clientPoFileUrl, contractValue: Number(p.contractValue), paymentTerms: p.paymentTerms, status: p.status, projectId: p.projectId, createdAt: p.createdAt.toISOString() };
}

router.get("/quotations", async (req, res): Promise<void> => {
  let query = db.select().from(quotationsTable).orderBy(desc(quotationsTable.createdAt)).$dynamic();
  if (req.query.leadId) query = query.where(eq(quotationsTable.leadId, Number(req.query.leadId)));
  const rows = await query;
  res.json(rows.map(fmt));
});

router.post("/quotations", requirePermission("crm", "create"), async (req, res): Promise<void> => {
  const parsed = CreateQuotationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const items = parsed.data.boqItems ?? [];
  const total = items.reduce((s, i) => s + (i.amount ?? i.qty * i.unitPrice), 0);
  const [row] = await db.insert(quotationsTable).values({
    leadId: parsed.data.leadId,
    boqItems: items.map(i => ({ ...i, amount: i.amount ?? i.qty * i.unitPrice })),
    markupPct: parsed.data.markupPct?.toString(),
    totalAmount: (total * (1 + (parsed.data.markupPct ?? 0) / 100)).toString(),
    validTill: parsed.data.validTill,
    notes: parsed.data.notes,
  }).returning();
  res.status(201).json(fmt(row));
});

router.get("/quotations/:id", async (req, res): Promise<void> => {
  const params = GetQuotationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Quotation not found" }); return; }
  res.json(fmt(row));
});

router.patch("/quotations/:id", requirePermission("crm", "edit"), async (req, res): Promise<void> => {
  const params = UpdateQuotationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateQuotationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const update: Record<string, unknown> = {};
  if (parsed.data.boqItems !== undefined) update.boqItems = parsed.data.boqItems;
  if (parsed.data.markupPct !== undefined) update.markupPct = parsed.data.markupPct?.toString();
  if (parsed.data.validTill !== undefined) update.validTill = parsed.data.validTill;
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
  const [row] = await db.update(quotationsTable).set(update).where(eq(quotationsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Quotation not found" }); return; }
  res.json(fmt(row));
});

router.post("/quotations/:id/approve", requirePermission("crm", "approve"), async (req, res): Promise<void> => {
  const params = ApproveQuotationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ApproveQuotationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const status = body.data.action === "approve" ? "Approved" : "Rejected";
  const [row] = await db.update(quotationsTable).set({ approvalStatus: status }).where(eq(quotationsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Quotation not found" }); return; }
  res.json(fmt(row));
});

router.post("/quotations/:id/log-client-po", requirePermission("crm", "create"), async (req, res): Promise<void> => {
  const params = LogClientPOParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = LogClientPOBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [quotation] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, params.data.id));
  if (!quotation) { res.status(404).json({ error: "Quotation not found" }); return; }

  // Create project first
  const [project] = await db.insert(projectsTable).values({
    name: `Project — ${body.data.clientPoNumber}`,
    contractValue: body.data.contractValue.toString(),
    status: "Planning",
  }).returning();

  // Create client PO
  const [clientPO] = await db.insert(clientPOsTable).values({
    quotationId: params.data.id,
    clientPoNumber: body.data.clientPoNumber,
    clientPoFileUrl: body.data.clientPoFileUrl,
    contractValue: body.data.contractValue.toString(),
    paymentTerms: body.data.paymentTerms,
    projectId: project.id,
  }).returning();

  // Update the project with the clientPoId
  await db.update(projectsTable).set({ clientPoId: clientPO.id }).where(eq(projectsTable.id, project.id));

  res.status(201).json({
    clientPO: fmtPO(clientPO),
    project: { id: project.id, clientPoId: clientPO.id, name: project.name, siteLocation: null, pmOwnerId: null, pmOwnerName: null, startDate: null, plannedEnd: null, status: project.status, parentProjectId: null, contractValue: Number(body.data.contractValue), percentComplete: 0, createdAt: project.createdAt.toISOString() },
  });
});

/** Create a Solar Project directly from an approved CRM quotation */
router.post("/quotations/:id/create-project", requirePermission("crm", "create"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [quotation] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!quotation) { res.status(404).json({ error: "Quotation not found" }); return; }
  if (quotation.approvalStatus !== "Approved") {
    res.status(400).json({ error: "Only approved quotations can create a project" });
    return;
  }

  // Read lead for client name / site info
  const [lead] = quotation.leadId
    ? await db.select().from(leadsTable).where(eq(leadsTable.id, quotation.leadId))
    : [null];

  const { projectName, siteLocation } = req.body;
  const name = projectName || (lead ? `${lead.companyName} — Solar Project` : `Solar Project QTN-${String(id).padStart(4, "0")}`);
  const site = siteLocation || null;

  // Use a single pg.Client transaction for the whole operation (atomic)
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");

    // Insert project inside the transaction
    const { rows: [project] } = await client.query(
      `INSERT INTO projects (name, site_location, contract_value, status)
       VALUES ($1, $2, $3, 'Planning') RETURNING id, name`,
      [name, site, quotation.totalAmount?.toString() ?? null]
    );

    const PHASE_ORDER = [
      "SiteSurvey","Planning","BOQ","Budgeting","ResourceAllocation",
      "Procurement","Installation","QualityInspection","TestingCommissioning",
      "Handover","Warranty","Closure",
    ];
    for (const phase of PHASE_ORDER) {
      await client.query(
        `INSERT INTO project_phases (project_id, phase, status)
         VALUES ($1, $2, 'NotStarted') ON CONFLICT DO NOTHING`,
        [project.id, phase]
      );
    }

    const boqItems = (quotation.boqItems ?? []) as Array<{
      description: string; qty: number; unit?: string; unitPrice: number; amount?: number;
    }>;
    let lineNo = 1;
    for (const item of boqItems) {
      const qty = Number(item.qty) || 1;
      const rate = Number(item.unitPrice) || 0;
      await client.query(
        `INSERT INTO project_boq_items
           (project_id, description, category, unit, quantity, unit_rate, sourced_from, status)
         VALUES ($1,$2,'Material',$3,$4,$5,'Procurement','Draft')`,
        [project.id, item.description || `Item ${lineNo}`, item.unit || "Nos", qty, rate]
      );
      lineNo++;
    }

    await client.query("COMMIT");

    res.status(201).json({
      projectId: project.id,
      projectName: project.name,
      boqItemsCreated: boqItems.length,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
});

/**
 * Single-shot quotation conversion: creates one project (with phases + BOQ seeded) and
 * one client PO linked to that same project. The project gets clientPoId set so it
 * appears in /leads/:id/projects (which joins via client_pos).
 */
router.post("/quotations/:id/convert", requirePermission("crm", "create"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [quotation] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!quotation) { res.status(404).json({ error: "Quotation not found" }); return; }
  if (quotation.approvalStatus !== "Approved") {
    res.status(400).json({ error: "Only approved quotations can be converted to a project" });
    return;
  }

  const [lead] = quotation.leadId
    ? await db.select().from(leadsTable).where(eq(leadsTable.id, quotation.leadId))
    : [null];

  const { projectName, clientPoNumber, contractValue, startDate, siteLocation } = req.body;
  if (!clientPoNumber) { res.status(400).json({ error: "clientPoNumber is required" }); return; }
  if (contractValue == null || isNaN(Number(contractValue))) { res.status(400).json({ error: "contractValue is required" }); return; }

  const name = projectName?.trim() || (lead ? `${lead.companyName} — Solar Project` : `Solar Project QTN-${String(id).padStart(4, "0")}`);
  const site = siteLocation || null;
  const value = Number(contractValue);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");

    // 1. Create the project
    const { rows: [project] } = await client.query(
      `INSERT INTO projects (name, site_location, contract_value, start_date, status)
       VALUES ($1, $2, $3, $4, 'Planning') RETURNING id, name`,
      [name, site, value.toString(), startDate || null]
    );

    // 2. Seed standard EPC phases
    const PHASE_ORDER = [
      "SiteSurvey","Planning","BOQ","Budgeting","ResourceAllocation",
      "Procurement","Installation","QualityInspection","TestingCommissioning",
      "Handover","Warranty","Closure",
    ];
    for (const phase of PHASE_ORDER) {
      await client.query(
        `INSERT INTO project_phases (project_id, phase, status)
         VALUES ($1, $2, 'NotStarted') ON CONFLICT DO NOTHING`,
        [project.id, phase]
      );
    }

    // 3. Seed BOQ items from the quotation
    const boqItems = (quotation.boqItems ?? []) as Array<{
      description: string; qty: number; unit?: string; unitPrice: number; amount?: number;
    }>;
    let lineNo = 1;
    for (const item of boqItems) {
      const qty = Number(item.qty) || 1;
      const rate = Number(item.unitPrice) || 0;
      await client.query(
        `INSERT INTO project_boq_items
           (project_id, description, category, unit, quantity, unit_rate, sourced_from, status)
         VALUES ($1,$2,'Material',$3,$4,$5,'Procurement','Draft')`,
        [project.id, item.description || `Item ${lineNo}`, item.unit || "Nos", qty, rate]
      );
      lineNo++;
    }

    // 4. Create the client PO linked to this project
    const { rows: [clientPO] } = await client.query(
      `INSERT INTO client_pos (quotation_id, client_po_number, contract_value, project_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [id, clientPoNumber, value.toString(), project.id]
    );

    // 5. Back-link the project to the client PO (so /leads/:id/projects resolves it)
    await client.query(
      `UPDATE projects SET client_po_id = $1 WHERE id = $2`,
      [clientPO.id, project.id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      projectId: project.id,
      projectName: project.name,
      clientPoId: clientPO.id,
      boqItemsCreated: boqItems.length,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
});

router.get("/client-pos", async (req, res): Promise<void> => {
  const rows = await db.select().from(clientPOsTable).orderBy(desc(clientPOsTable.createdAt));
  res.json(rows.map(fmtPO));
});

router.get("/client-pos/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(clientPOsTable).where(eq(clientPOsTable.id, id));
  if (!row) { res.status(404).json({ error: "Client PO not found" }); return; }
  res.json(fmtPO(row));
});

// ── PROJECTS LINKED TO A LEAD ─────────────────────────────────────────────────
// Traverses: lead → quotation → clientPO → project (SSOT: no data duplication)
router.get("/leads/:id/projects", async (req, res): Promise<void> => {
  const leadId = Number(req.params.id);
  const rows = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      status: projectsTable.status,
      percentComplete: projectsTable.percentComplete,
      contractValue: projectsTable.contractValue,
    })
    .from(projectsTable)
    .innerJoin(clientPOsTable, eq(clientPOsTable.id, projectsTable.clientPoId))
    .innerJoin(quotationsTable, eq(quotationsTable.id, clientPOsTable.quotationId))
    .where(eq(quotationsTable.leadId, leadId));
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    percentComplete: Number(r.percentComplete ?? 0),
    contractValue: r.contractValue ? Number(r.contractValue) : null,
  })));
});

export default router;
