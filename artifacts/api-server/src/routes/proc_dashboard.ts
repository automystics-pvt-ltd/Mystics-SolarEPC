import { Router, type IRouter } from "express";
import { db, procurementPOsTable, procGRNsTable, procInvoicesTable, procPOItemsTable } from "@workspace/db";
import { desc, sql, and, lt, notInArray } from "drizzle-orm";

const router: IRouter = Router();

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

router.get("/procurement-dashboard", async (_req, res): Promise<void> => {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Fetch all POs and classify
  const allPOs = await db.select().from(procurementPOsTable).orderBy(desc(procurementPOsTable.createdAt));
  const activePOStatuses = ["Draft", "Issued", "Acknowledged", "PartiallyReceived"];
  const openPOs = allPOs.filter(p => activePOStatuses.includes(p.status));
  const overduePOs = openPOs.filter(p => {
    const deadline = p.deliveryDeadline || p.expectedDeliveryDate;
    return deadline && deadline < todayStr;
  });

  // PO status counts
  const poByStatus: Record<string, number> = {};
  for (const po of allPOs) {
    poByStatus[po.status] = (poByStatus[po.status] || 0) + 1;
  }

  // Monthly spend (from fully received + closed POs, current year)
  const yearStart = `${today.getFullYear()}-01-01`;
  const monthlySpend: { month: string; amount: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthStr = `${today.getFullYear()}-${String(m).padStart(2, "0")}`;
    const monthPOs = allPOs.filter(p =>
      ["FullyReceived", "Closed"].includes(p.status) &&
      p.createdAt.toISOString().startsWith(monthStr)
    );
    monthlySpend.push({
      month: monthStr,
      amount: monthPOs.reduce((sum, p) => sum + (n(p.totalAmount) ?? 0), 0),
    });
  }

  // Pending GRNs
  const pendingGRNs = await db.select().from(procGRNsTable)
    .where(sql`${procGRNsTable.status} IN ('Draft', 'Submitted')`)
    .orderBy(desc(procGRNsTable.createdAt))
    .limit(20);

  // Pending invoices
  const pendingInvoices = await db.select().from(procInvoicesTable)
    .where(sql`${procInvoicesTable.status} IN ('Draft', 'PendingApproval', 'OnHold')`)
    .orderBy(desc(procInvoicesTable.createdAt))
    .limit(20);

  // Recent activity (last 30 days)
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Total spend YTD
  const ytdSpend = allPOs
    .filter(p => ["FullyReceived", "Closed"].includes(p.status) && p.createdAt >= new Date(yearStart))
    .reduce((sum, p) => sum + (n(p.totalAmount) ?? 0), 0);

  res.json({
    summary: {
      totalPOs: allPOs.length,
      openPOs: openPOs.length,
      overduePOs: overduePOs.length,
      pendingGRNs: pendingGRNs.length,
      pendingInvoices: pendingInvoices.length,
      ytdSpend,
      poByStatus,
    },
    overduePOs: overduePOs.map(p => ({
      id: p.id, poNumber: p.poNumber, vendorName: p.vendorName,
      status: p.status, deliveryDeadline: p.deliveryDeadline ?? p.expectedDeliveryDate,
      daysOverdue: p.deliveryDeadline
        ? Math.floor((today.getTime() - new Date(p.deliveryDeadline).getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      totalAmount: n(p.totalAmount),
    })),
    pendingGRNs: pendingGRNs.map(g => ({
      id: g.id, grnNumber: g.grnNumber, poId: g.poId,
      vendorName: g.vendorName, status: g.status, createdAt: g.createdAt.toISOString(),
    })),
    pendingInvoices: pendingInvoices.map(i => ({
      id: i.id, invoiceNumber: i.invoiceNumber, poId: i.poId,
      vendorName: i.vendorName, status: i.status, matchStatus: i.matchStatus,
      totalAmount: n(i.totalAmount), createdAt: i.createdAt.toISOString(),
    })),
    monthlySpend,
  });
});

export default router;
