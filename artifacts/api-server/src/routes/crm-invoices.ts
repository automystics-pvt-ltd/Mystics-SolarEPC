import { Router, type IRouter } from "express";
import { db, crmInvoicesTable } from "@workspace/db";
import { eq, desc, lt, or, sql } from "drizzle-orm";
import { CreateCrmInvoiceBody, MarkCrmInvoicePaidParams, MarkCrmInvoicePaidBody } from "@workspace/api-zod";

const router: IRouter = Router();

function fmt(i: typeof crmInvoicesTable.$inferSelect) {
  return { id: i.id, clientPoId: i.clientPoId, projectId: i.projectId, type: i.type, amount: Number(i.amount), taxDetails: i.taxDetails, dueDate: i.dueDate, paymentStatus: i.paymentStatus, createdAt: i.createdAt.toISOString() };
}

router.get("/crm-invoices", async (req, res): Promise<void> => {
  let query = db.select().from(crmInvoicesTable).orderBy(desc(crmInvoicesTable.createdAt)).$dynamic();
  if (req.query.status) query = query.where(eq(crmInvoicesTable.paymentStatus, req.query.status as string));
  const rows = await query;
  res.json(rows.map(fmt));
});

router.post("/crm-invoices", async (req, res): Promise<void> => {
  const parsed = CreateCrmInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(crmInvoicesTable).values({ ...parsed.data, amount: parsed.data.amount.toString() }).returning();
  res.status(201).json(fmt(row));
});

router.post("/crm-invoices/:id/mark-paid", async (req, res): Promise<void> => {
  const params = MarkCrmInvoicePaidParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = MarkCrmInvoicePaidBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [row] = await db.update(crmInvoicesTable).set({ paymentStatus: "Paid", paidAmount: body.data.paidAmount.toString(), paidDate: body.data.paidDate }).where(eq(crmInvoicesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Invoice not found" }); return; }
  res.json(fmt(row));
});

router.get("/crm-invoices/aging-summary", async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const d60 = new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0];
  const d90 = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

  const all = await db.select().from(crmInvoicesTable).where(or(eq(crmInvoicesTable.paymentStatus, "Unpaid"), eq(crmInvoicesTable.paymentStatus, "Overdue")));

  let current = 0, overdue30 = 0, overdue60 = 0, overdue90Plus = 0;
  for (const inv of all) {
    const amt = Number(inv.amount);
    const due = inv.dueDate;
    if (!due || due >= today) current += amt;
    else if (due >= d30) overdue30 += amt;
    else if (due >= d60) overdue60 += amt;
    else overdue90Plus += amt;
  }

  res.json({ current, overdue30, overdue60, overdue90Plus, totalOutstanding: current + overdue30 + overdue60 + overdue90Plus });
});

export default router;
