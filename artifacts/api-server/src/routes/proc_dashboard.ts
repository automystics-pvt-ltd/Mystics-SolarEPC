import { Router, type IRouter } from "express";
import { db, procurementPOsTable, procGRNsTable, procInvoicesTable, procPOItemsTable } from "@workspace/db";
import { desc, sql, inArray, gte, lte, and } from "drizzle-orm";

import { deriveCategory } from "../lib/category-rules";

const router: IRouter = Router();

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

/** Generate an array of YYYY-MM strings for every month from fromDate to toDate (inclusive). */
function monthsBetween(fromStr: string, toStr: string): string[] {
  const months: string[] = [];
  const [fy, fm] = fromStr.split("-").map(Number);
  const [ty, tm] = toStr.split("-").map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

router.get("/procurement-dashboard", async (req, res): Promise<void> => {
  const today      = new Date();
  const todayStr   = today.toISOString().split("T")[0];
  const thisYear   = today.getFullYear();
  const thisMonth  = today.getMonth();

  const thisMonthStr  = `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
  const lastMonthStr  = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);
  const sevenDaysStr = sevenDaysFromNow.toISOString().split("T")[0];

  // ── Date range (from / to) ─────────────────────────────────────────────────
  const yearStart = `${thisYear}-01-01`;
  const fromStr   = (typeof req.query.from === "string" && req.query.from) || yearStart;
  const toStr     = (typeof req.query.to   === "string" && req.query.to)   || todayStr;

  const fromDate = new Date(`${fromStr}T00:00:00.000Z`);
  const toDate   = new Date(`${toStr}T23:59:59.999Z`);

  const fromMonthStr = fromStr.slice(0, 7); // YYYY-MM
  const toMonthStr   = toStr.slice(0, 7);

  // Fetch all POs (needed for pipeline / overdue / approaching / spend aggregations).
  // For GRNs and invoices we need two separate passes:
  //   1. Pending-actions pass – status-based only, recent 200 records, no date filter.
  //   2. Activity pass – date-filtered so historical ranges don't silently return empty.
  const [allPOs, pendingGRNsRaw, pendingInvoicesRaw, activityGRNs, activityInvoices] = await Promise.all([
    db.select().from(procurementPOsTable).orderBy(desc(procurementPOsTable.createdAt)),
    db.select().from(procGRNsTable)
      .where(inArray(procGRNsTable.status, ["Draft", "Submitted"]))
      .orderBy(desc(procGRNsTable.createdAt))
      .limit(200),
    db.select().from(procInvoicesTable)
      .where(inArray(procInvoicesTable.status, ["Draft", "PendingApproval", "OnHold"]))
      .orderBy(desc(procInvoicesTable.createdAt))
      .limit(200),
    db.select().from(procGRNsTable)
      .where(and(gte(procGRNsTable.createdAt, fromDate), lte(procGRNsTable.createdAt, toDate)))
      .orderBy(desc(procGRNsTable.createdAt))
      .limit(50),
    db.select().from(procInvoicesTable)
      .where(and(gte(procInvoicesTable.createdAt, fromDate), lte(procInvoicesTable.createdAt, toDate)))
      .orderBy(desc(procInvoicesTable.createdAt))
      .limit(50),
  ]);

  const activePOStatuses = ["Draft", "Issued", "Acknowledged", "PartiallyReceived"];
  const openPOs    = allPOs.filter(p => activePOStatuses.includes(p.status));
  const overduePOs = openPOs.filter(p => {
    const deadline = p.deliveryDeadline || p.expectedDeliveryDate;
    return deadline && deadline < todayStr;
  });
  const approachingDLs = openPOs.filter(p => {
    const deadline = p.deliveryDeadline || p.expectedDeliveryDate;
    return deadline && deadline >= todayStr && deadline <= sevenDaysStr;
  });

  const poByStatus: Record<string, number> = {};
  for (const po of allPOs) {
    poByStatus[po.status] = (poByStatus[po.status] || 0) + 1;
  }

  // ── Range-scoped received POs ──────────────────────────────────────────────
  const receivedPOs    = allPOs.filter(p => ["FullyReceived", "Closed"].includes(p.status));
  const rangeReceivedPOs = receivedPOs.filter(p => {
    const d = p.createdAt;
    return d >= fromDate && d <= toDate;
  });

  // ── Monthly spend (for months in range) ────────────────────────────────────
  const rangeMonths = monthsBetween(fromMonthStr, toMonthStr);
  const monthlySpend: { month: string; amount: number }[] = rangeMonths.map(monthStr => {
    const monthPOs = rangeReceivedPOs.filter(p =>
      p.createdAt.toISOString().startsWith(monthStr)
    );
    return { month: monthStr, amount: monthPOs.reduce((s, p) => s + (n(p.totalAmount) ?? 0), 0) };
  });

  // ── KPI spend numbers ──────────────────────────────────────────────────────
  const ytdSpend       = rangeReceivedPOs.reduce((s, p) => s + (n(p.totalAmount) ?? 0), 0);
  const thisMonthSpend = receivedPOs.filter(p => p.createdAt.toISOString().startsWith(thisMonthStr))
                           .reduce((s, p) => s + (n(p.totalAmount) ?? 0), 0);
  const lastMonthSpend = receivedPOs.filter(p => p.createdAt.toISOString().startsWith(lastMonthStr))
                           .reduce((s, p) => s + (n(p.totalAmount) ?? 0), 0);
  const committedValue = openPOs.reduce((s, p) => s + (n(p.totalAmount) ?? 0), 0);

  const pendingGRNs             = pendingGRNsRaw;
  const pendingInvoices         = pendingInvoicesRaw;
  // Mismatch/approval counts need all pending invoices regardless of date range
  const mismatchInvoices        = pendingInvoicesRaw.filter(i => i.matchStatus === "MismatchPending");
  const pendingApprovalInvoices = pendingInvoicesRaw.filter(i => i.status === "PendingApproval");

  // ── Top vendors (range-scoped) ─────────────────────────────────────────────
  const vendorMap = new Map<string, { spend: number; poCount: number }>();
  for (const po of rangeReceivedPOs) {
    const name = po.vendorName ?? "Unknown";
    const cur  = vendorMap.get(name) ?? { spend: 0, poCount: 0 };
    vendorMap.set(name, { spend: cur.spend + (n(po.totalAmount) ?? 0), poCount: cur.poCount + 1 });
  }
  const topVendors = [...vendorMap.entries()]
    .sort((a, b) => b[1].spend - a[1].spend)
    .slice(0, 5)
    .map(([vendorName, v]) => ({ vendorName, spend: v.spend, poCount: v.poCount }));

  // Per-vendor monthly spend for chart drill-down
  const vendorMonthlySpend: Record<string, { month: string; amount: number }[]> = {};
  for (const { vendorName } of topVendors) {
    vendorMonthlySpend[vendorName] = rangeMonths.map(monthStr => {
      const monthPOs = rangeReceivedPOs.filter(p =>
        (p.vendorName ?? "Unknown") === vendorName &&
        p.createdAt.toISOString().startsWith(monthStr)
      );
      return { month: monthStr, amount: monthPOs.reduce((s, p) => s + (n(p.totalAmount) ?? 0), 0) };
    });
  }

  // ── Category spend aggregation (range-scoped) ──────────────────────────────
  const rangeReceivedPOIds = rangeReceivedPOs.map(p => p.id);
  const allItems = rangeReceivedPOIds.length > 0
    ? await db.select().from(procPOItemsTable).where(inArray(procPOItemsTable.poId, rangeReceivedPOIds))
    : [];

  const poCreatedAt = new Map<number, string>(rangeReceivedPOs.map(p => [p.id, p.createdAt.toISOString()]));

  const categoryMap = new Map<string, { spend: number; poCount: Set<number> }>();
  for (const item of allItems) {
    const cat = deriveCategory(item.materialName);
    const cur = categoryMap.get(cat) ?? { spend: 0, poCount: new Set<number>() };
    cur.spend += n(item.lineTotal) ?? 0;
    cur.poCount.add(item.poId);
    categoryMap.set(cat, cur);
  }

  const topCategories = [...categoryMap.entries()]
    .sort((a, b) => b[1].spend - a[1].spend)
    .map(([category, v]) => ({ category, spend: v.spend, poCount: v.poCount.size }));

  // Per-category monthly spend
  const categoryMonthlySpend: Record<string, { month: string; amount: number }[]> = {};
  for (const { category } of topCategories) {
    categoryMonthlySpend[category] = rangeMonths.map(monthStr => ({
      month: monthStr,
      amount: allItems
        .filter(item => {
          const itemCreatedAt = poCreatedAt.get(item.poId) ?? "";
          return deriveCategory(item.materialName) === category && itemCreatedAt.startsWith(monthStr);
        })
        .reduce((s, item) => s + (n(item.lineTotal) ?? 0), 0),
    }));
  }

  // ── Recent activity (date-filtered at DB level — no artificial 100-row cap) ─
  const activityPOs  = allPOs.filter(p => p.createdAt >= fromDate && p.createdAt <= toDate).slice(0, 10);
  const activityGRNsSlice  = activityGRNs.slice(0, 10);
  const activityInvsSlice  = activityInvoices.slice(0, 10);

  const poEvents  = activityPOs.map(p => ({
    type: "po" as const, id: p.id, ref: p.poNumber, vendorName: p.vendorName ?? "",
    status: p.status, amount: n(p.totalAmount), createdAt: p.createdAt.toISOString(),
  }));
  const grnEvents = activityGRNsSlice.map(g => ({
    type: "grn" as const, id: g.id, ref: g.grnNumber, vendorName: g.vendorName ?? "",
    status: g.status, amount: null as null, createdAt: g.createdAt.toISOString(),
  }));
  const invEvents = activityInvsSlice.map(i => ({
    type: "invoice" as const, id: i.id, ref: i.invoiceNumber, vendorName: i.vendorName ?? "",
    status: i.status, amount: n(i.totalAmount), createdAt: i.createdAt.toISOString(),
  }));
  const recentActivity = [...poEvents, ...grnEvents, ...invEvents]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12);

  res.json({
    summary: {
      totalPOs: allPOs.length, openPOs: openPOs.length,
      overduePOs: overduePOs.length, pendingGRNs: pendingGRNs.length,
      pendingInvoices: pendingInvoices.length, ytdSpend,
      thisMonthSpend, lastMonthSpend,
      mismatchCount: mismatchInvoices.length,
      approachingDeadlines: approachingDLs.length,
      pendingApprovalCount: pendingApprovalInvoices.length,
      committedValue, poByStatus,
    },
    overduePOs: overduePOs.map(p => ({
      id: p.id, poNumber: p.poNumber, vendorName: p.vendorName, status: p.status,
      deliveryDeadline: p.deliveryDeadline ?? p.expectedDeliveryDate,
      daysOverdue: p.deliveryDeadline
        ? Math.max(0, Math.floor((today.getTime() - new Date(p.deliveryDeadline).getTime()) / 86_400_000)) : 0,
      totalAmount: n(p.totalAmount),
    })),
    approachingDeadlines: approachingDLs.map(p => ({
      id: p.id, poNumber: p.poNumber, vendorName: p.vendorName, status: p.status,
      deliveryDeadline: p.deliveryDeadline ?? p.expectedDeliveryDate,
      daysLeft: p.deliveryDeadline
        ? Math.max(0, Math.floor((new Date(p.deliveryDeadline).getTime() - today.getTime()) / 86_400_000)) : 7,
      totalAmount: n(p.totalAmount),
    })),
    pendingGRNs: pendingGRNs.slice(0, 8).map(g => ({
      id: g.id, grnNumber: g.grnNumber, poId: g.poId,
      vendorName: g.vendorName, status: g.status, createdAt: g.createdAt.toISOString(),
    })),
    pendingInvoices: pendingInvoices.slice(0, 8).map(i => ({
      id: i.id, invoiceNumber: i.invoiceNumber, poId: i.poId, vendorName: i.vendorName,
      status: i.status, matchStatus: i.matchStatus,
      totalAmount: n(i.totalAmount), createdAt: i.createdAt.toISOString(),
    })),
    monthlySpend, topVendors, vendorMonthlySpend,
    topCategories, categoryMonthlySpend, recentActivity,
    // Echo back the applied range so the client can display it
    appliedRange: { from: fromStr, to: toStr },
  });
});

/* ── Badge counts for sidebar ─────────────────────────────────────────────── */
router.get("/procurement/badge-counts", async (_req, res): Promise<void> => {
  const [draftPOs, pendingInvoices] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(procurementPOsTable)
      .where(sql`${procurementPOsTable.status} = 'Draft'`),
    db.select({ count: sql<number>`count(*)::int` })
      .from(procInvoicesTable)
      .where(sql`${procInvoicesTable.status} IN ('Draft', 'PendingApproval')`),
  ]);
  res.json({ draftPOs: draftPOs[0]?.count ?? 0, pendingInvoices: pendingInvoices[0]?.count ?? 0 });
});

export default router;
