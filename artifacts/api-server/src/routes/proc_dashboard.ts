/**
 * Procurement Dashboard API — performance-optimised rewrite
 *
 * Key changes vs previous version:
 *  • All heavy aggregations are done in SQL (SUM, COUNT, GROUP BY) — no more loading
 *    the entire POs table into Node memory.
 *  • All independent queries run in a single Promise.all — zero sequential awaits.
 *  • Category items are fetched via an INNER JOIN instead of a two-step ID → items dance.
 *  • Active-PO list is capped at 500 rows (plenty for overdue/approaching calc).
 *  • Vendor/category monthly drill-down data is computed from the small rangeReceived
 *    result set using pre-built Maps — O(n) not O(n²).
 */
import { Router, type IRouter } from "express";
import {
  db,
  procurementPOsTable, procGRNsTable, procInvoicesTable, procPOItemsTable,
} from "@workspace/db";
import { desc, sql, inArray, gte, lte, and, eq } from "drizzle-orm";
import { deriveCategory } from "../lib/category-rules";

const router: IRouter = Router();

function n(v: unknown): number { return v !== null && v !== undefined ? Number(v) : 0; }

/** Fill every YYYY-MM in [fromStr..toStr] with a value from the SQL result map. */
function monthsBetween(fromStr: string, toStr: string): string[] {
  const out: string[] = [];
  let [y, m] = fromStr.split("-").map(Number) as [number, number];
  const [ty, tm] = toStr.split("-").map(Number) as [number, number];
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

/* ── Active PO statuses shared across the handler ──────────────────────── */
const ACTIVE_STATUSES  = ["Draft", "Issued", "Acknowledged", "PartiallyReceived"] as const;
const RECEIVED_STATUSES = ["FullyReceived", "Closed"] as const;

/* ════════════════════════════════════════════════════════════════════════
   GET /procurement-dashboard
════════════════════════════════════════════════════════════════════════ */
router.get("/procurement-dashboard", async (req, res): Promise<void> => {
  const today    = new Date();
  const todayStr = today.toISOString().split("T")[0]!;
  const thisYear = today.getFullYear();
  const thisMonth = today.getMonth(); // 0-based

  const thisMonthStr  = `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
  const lastMonthStr  = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);
  const sevenDaysStr = sevenDaysLater.toISOString().split("T")[0]!;

  /* ── Date range bounds ──────────────────────────────────────────────── */
  const yearStart = `${thisYear}-01-01`;
  const fromStr   = (typeof req.query.from === "string" && req.query.from) || yearStart;
  const toStr     = (typeof req.query.to   === "string" && req.query.to)   || todayStr;

  const fromDate  = new Date(`${fromStr}T00:00:00.000Z`);
  const toDate    = new Date(`${toStr}T23:59:59.999Z`);
  const fromMonthStr = fromStr.slice(0, 7);
  const toMonthStr   = toStr.slice(0, 7);

  /* Month boundaries for fixed KPI numbers */
  const thisMonthStart = new Date(`${thisMonthStr}-01T00:00:00.000Z`);
  const lastMonthStart = new Date(`${lastMonthStr}-01T00:00:00.000Z`);
  const lastMonthEnd   = new Date(thisMonthStart.getTime() - 1);

  /* ── All 15 queries run in parallel — zero sequential awaits ─────────── */
  const [
    /* 0 */ statusCountsRaw,
    /* 1 */ [periodSpendRow],
    /* 2 */ [thisMonthRow],
    /* 3 */ [lastMonthRow],
    /* 4 */ [committedRow],
    /* 5 */ monthlySpendRaw,
    /* 6 */ topVendorsRaw,
    /* 7 */ activePOsRaw,
    /* 8 */ pendingGRNsRaw,
    /* 9 */ pendingInvoicesRaw,
    /* 10 */ activityGRNs,
    /* 11 */ activityInvoices,
    /* 12 */ activityPOs,
    /* 13 */ vendorMonthlyRaw,
    /* 14 */ categoryMonthlyRaw,
  ] = await Promise.all([

    /* 0: Pipeline — status distribution */
    db.select({
      status: procurementPOsTable.status,
      count:  sql<number>`count(*)::int`,
    }).from(procurementPOsTable)
      .groupBy(procurementPOsTable.status),

    /* 1: Period spend (YTD / range) */
    db.select({
      total: sql<string>`coalesce(sum(${procurementPOsTable.totalAmount}::numeric), 0)`,
    }).from(procurementPOsTable)
      .where(and(
        inArray(procurementPOsTable.status, [...RECEIVED_STATUSES]),
        gte(procurementPOsTable.createdAt, fromDate),
        lte(procurementPOsTable.createdAt, toDate),
      )),

    /* 2: This-month spend (always calendar month — independent of date range) */
    db.select({
      total: sql<string>`coalesce(sum(${procurementPOsTable.totalAmount}::numeric), 0)`,
    }).from(procurementPOsTable)
      .where(and(
        inArray(procurementPOsTable.status, [...RECEIVED_STATUSES]),
        gte(procurementPOsTable.createdAt, thisMonthStart),
        lte(procurementPOsTable.createdAt, toDate),
      )),

    /* 3: Last-month spend */
    db.select({
      total: sql<string>`coalesce(sum(${procurementPOsTable.totalAmount}::numeric), 0)`,
    }).from(procurementPOsTable)
      .where(and(
        inArray(procurementPOsTable.status, [...RECEIVED_STATUSES]),
        gte(procurementPOsTable.createdAt, lastMonthStart),
        lte(procurementPOsTable.createdAt, lastMonthEnd),
      )),

    /* 4: Committed value (all open/active POs) */
    db.select({
      total: sql<string>`coalesce(sum(${procurementPOsTable.totalAmount}::numeric), 0)`,
    }).from(procurementPOsTable)
      .where(inArray(procurementPOsTable.status, [...ACTIVE_STATUSES])),

    /* 5: Monthly spend chart — SQL GROUP BY month */
    db.select({
      month:  sql<string>`to_char(${procurementPOsTable.createdAt}, 'YYYY-MM')`,
      amount: sql<string>`coalesce(sum(${procurementPOsTable.totalAmount}::numeric), 0)`,
    }).from(procurementPOsTable)
      .where(and(
        inArray(procurementPOsTable.status, [...RECEIVED_STATUSES]),
        gte(procurementPOsTable.createdAt, fromDate),
        lte(procurementPOsTable.createdAt, toDate),
      ))
      .groupBy(sql`to_char(${procurementPOsTable.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${procurementPOsTable.createdAt}, 'YYYY-MM')`),

    /* 6: Top 5 vendors by spend (period-scoped).
       Group by COALESCE(vendor_id::text, vendor_name) so the same physical vendor
       is merged into one row even when POs were created under slightly different
       name strings — as long as the PO is linked to a vendor record via vendorId. */
    db.select({
      groupKey:   sql<string>`coalesce(${procurementPOsTable.vendorId}::text, ${procurementPOsTable.vendorName})`,
      vendorName: sql<string>`max(${procurementPOsTable.vendorName})`,
      spend:      sql<string>`sum(${procurementPOsTable.totalAmount}::numeric)`,
      poCount:    sql<number>`count(*)::int`,
    }).from(procurementPOsTable)
      .where(and(
        inArray(procurementPOsTable.status, [...RECEIVED_STATUSES]),
        gte(procurementPOsTable.createdAt, fromDate),
        lte(procurementPOsTable.createdAt, toDate),
      ))
      .groupBy(sql`coalesce(${procurementPOsTable.vendorId}::text, ${procurementPOsTable.vendorName})`)
      .orderBy(sql`sum(${procurementPOsTable.totalAmount}::numeric) desc`)
      .limit(5),

    /* 7: Active POs for overdue/approaching deadlines (small set — rarely >200) */
    db.select({
      id:                   procurementPOsTable.id,
      poNumber:             procurementPOsTable.poNumber,
      vendorName:           procurementPOsTable.vendorName,
      status:               procurementPOsTable.status,
      deliveryDeadline:     procurementPOsTable.deliveryDeadline,
      expectedDeliveryDate: procurementPOsTable.expectedDeliveryDate,
      totalAmount:          procurementPOsTable.totalAmount,
    }).from(procurementPOsTable)
      .where(inArray(procurementPOsTable.status, [...ACTIVE_STATUSES]))
      .limit(500),

    /* 8: Pending GRNs */
    db.select().from(procGRNsTable)
      .where(inArray(procGRNsTable.status, ["Draft", "Submitted"]))
      .orderBy(desc(procGRNsTable.createdAt))
      .limit(200),

    /* 9: Pending invoices */
    db.select().from(procInvoicesTable)
      .where(inArray(procInvoicesTable.status, ["Draft", "PendingApproval", "OnHold"]))
      .orderBy(desc(procInvoicesTable.createdAt))
      .limit(200),

    /* 10: Recent GRNs (date-scoped activity feed) */
    db.select().from(procGRNsTable)
      .where(and(
        gte(procGRNsTable.createdAt, fromDate),
        lte(procGRNsTable.createdAt, toDate),
      ))
      .orderBy(desc(procGRNsTable.createdAt))
      .limit(10),

    /* 11: Recent invoices (date-scoped activity feed) */
    db.select().from(procInvoicesTable)
      .where(and(
        gte(procInvoicesTable.createdAt, fromDate),
        lte(procInvoicesTable.createdAt, toDate),
      ))
      .orderBy(desc(procInvoicesTable.createdAt))
      .limit(10),

    /* 12: Recent POs (date-scoped activity feed — minimal columns) */
    db.select({
      id:          procurementPOsTable.id,
      poNumber:    procurementPOsTable.poNumber,
      vendorName:  procurementPOsTable.vendorName,
      status:      procurementPOsTable.status,
      totalAmount: procurementPOsTable.totalAmount,
      createdAt:   procurementPOsTable.createdAt,
    }).from(procurementPOsTable)
      .where(and(
        gte(procurementPOsTable.createdAt, fromDate),
        lte(procurementPOsTable.createdAt, toDate),
      ))
      .orderBy(desc(procurementPOsTable.createdAt))
      .limit(10),

    /* 13: Vendor monthly spend — SQL-aggregated by (vendor_key, month).
       Returns at most top-5-vendors × months rows instead of raw PO rows.
       Uses the same coalesce(vendorId::text, vendorName) key as the top-vendors
       query so drill-down data aligns exactly. */
    db.select({
      groupKey:   sql<string>`coalesce(${procurementPOsTable.vendorId}::text, ${procurementPOsTable.vendorName})`,
      vendorName: sql<string>`max(${procurementPOsTable.vendorName})`,
      month:      sql<string>`to_char(${procurementPOsTable.createdAt}, 'YYYY-MM')`,
      amount:     sql<string>`sum(${procurementPOsTable.totalAmount}::numeric)`,
    }).from(procurementPOsTable)
      .where(and(
        inArray(procurementPOsTable.status, [...RECEIVED_STATUSES]),
        gte(procurementPOsTable.createdAt, fromDate),
        lte(procurementPOsTable.createdAt, toDate),
      ))
      .groupBy(
        sql`coalesce(${procurementPOsTable.vendorId}::text, ${procurementPOsTable.vendorName})`,
        sql`to_char(${procurementPOsTable.createdAt}, 'YYYY-MM')`,
      ),

    /* 14: Category spend — SQL-aggregated by (material_name, month).
       Returns at most unique_materials × months rows instead of every line item.
       Category derivation runs on unique material names in Node, not on raw rows. */
    db.select({
      materialName: procPOItemsTable.materialName,
      month:        sql<string>`to_char(${procurementPOsTable.createdAt}, 'YYYY-MM')`,
      totalAmount:  sql<string>`sum(${procPOItemsTable.lineTotal}::numeric)`,
    }).from(procPOItemsTable)
      .innerJoin(
        procurementPOsTable,
        eq(procPOItemsTable.poId, procurementPOsTable.id),
      )
      .where(and(
        inArray(procurementPOsTable.status, [...RECEIVED_STATUSES]),
        gte(procurementPOsTable.createdAt, fromDate),
        lte(procurementPOsTable.createdAt, toDate),
      ))
      .groupBy(
        procPOItemsTable.materialName,
        sql`to_char(${procurementPOsTable.createdAt}, 'YYYY-MM')`,
      ),
  ] as const);

  /* ── Derived counts from status map ────────────────────────────────── */
  const poByStatus: Record<string, number> = {};
  let totalPOs = 0;
  for (const r of statusCountsRaw) {
    poByStatus[r.status] = r.count;
    totalPOs += r.count;
  }
  const openPOCount = (ACTIVE_STATUSES as readonly string[])
    .reduce((s, st) => s + (poByStatus[st] ?? 0), 0);

  /* ── Spend KPIs ─────────────────────────────────────────────────────── */
  const ytdSpend       = n(periodSpendRow?.total);
  const thisMonthSpend = n(thisMonthRow?.total);
  const lastMonthSpend = n(lastMonthRow?.total);
  const committedValue = n(committedRow?.total);

  /* ── Overdue / Approaching (from small active PO list) ──────────────── */
  const overduePOs     = activePOsRaw.filter(p => {
    const dl = p.deliveryDeadline ?? p.expectedDeliveryDate;
    return dl && dl < todayStr;
  });
  const approachingDLs = activePOsRaw.filter(p => {
    const dl = p.deliveryDeadline ?? p.expectedDeliveryDate;
    return dl && dl >= todayStr && dl <= sevenDaysStr;
  });

  /* ── Pending invoice derived counts ─────────────────────────────────── */
  const mismatchCount        = pendingInvoicesRaw.filter(i => i.matchStatus === "MismatchPending").length;
  const pendingApprovalCount = pendingInvoicesRaw.filter(i => i.status === "PendingApproval").length;

  /* ── Monthly spend chart — fill zero months ──────────────────────────── */
  const spendByMonth = new Map<string, number>();
  for (const r of monthlySpendRaw) spendByMonth.set(r.month, n(r.amount));
  const rangeMonths  = monthsBetween(fromMonthStr, toMonthStr);
  const monthlySpend = rangeMonths.map(m => ({ month: m, amount: spendByMonth.get(m) ?? 0 }));

  /* ── Top vendors ────────────────────────────────────────────────────── */
  // topVendorsRaw is already SQL-grouped by coalesce(vendorId::text, vendorName),
  // so same-vendor POs with slightly different name strings are merged at the DB level.
  // groupKey is carried through to match rangeReceivedPOs for the monthly drill-down.
  const topVendorBuckets = topVendorsRaw.map(v => ({
    groupKey:   v.groupKey,
    vendorName: v.vendorName ?? "Unknown",
    spend:      n(v.spend),
    poCount:    v.poCount,
  }));
  const topVendors = topVendorBuckets.map(({ groupKey, vendorName, spend, poCount }) => ({
    vendorId: /^\d+$/.test(groupKey ?? "") ? Number(groupKey) : null,
    vendorName,
    spend,
    poCount,
  }));

  /* ── Vendor monthly spend — SQL-pre-aggregated, O(rows) mapping ─────── */
  // vendorMonthlyRaw already has one row per (groupKey, month) — no further grouping needed.
  const vendorMonthAmounts = new Map<string, Map<string, number>>();
  for (const row of vendorMonthlyRaw) {
    const mm = vendorMonthAmounts.get(row.groupKey) ?? new Map<string, number>();
    mm.set(row.month, n(row.amount));
    vendorMonthAmounts.set(row.groupKey, mm);
  }
  const vendorMonthlySpend: Record<string, { month: string; amount: number }[]> = {};
  for (const { vendorName, groupKey } of topVendorBuckets) {
    const mm = vendorMonthAmounts.get(groupKey) ?? new Map<string, number>();
    vendorMonthlySpend[vendorName] = rangeMonths.map(m => ({ month: m, amount: mm.get(m) ?? 0 }));
  }

  /* ── Category spend — SQL-pre-aggregated by (material_name, month) ───── */
  // categoryMonthlyRaw has one row per unique material+month.
  // deriveCategory() runs on unique material names, not raw line items.
  const categorySpend  = new Map<string, number>();
  const categoryPOsSet = new Map<string, Set<string>>();
  const catMonthMap    = new Map<string, Map<string, number>>();
  for (const row of categoryMonthlyRaw) {
    const cat = deriveCategory(row.materialName);
    const lt  = n(row.totalAmount);
    categorySpend.set(cat, (categorySpend.get(cat) ?? 0) + lt);
    const ps = categoryPOsSet.get(cat) ?? new Set<string>();
    ps.add(row.month); categoryPOsSet.set(cat, ps);
    const cm = catMonthMap.get(cat) ?? new Map<string, number>();
    cm.set(row.month, (cm.get(row.month) ?? 0) + lt);
    catMonthMap.set(cat, cm);
  }
  const topCategories = [...categorySpend.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, spend]) => ({
      category,
      spend,
      poCount: categoryPOsSet.get(category)?.size ?? 0,
    }));
  const categoryMonthlySpend: Record<string, { month: string; amount: number }[]> = {};
  for (const { category } of topCategories) {
    const cm = catMonthMap.get(category) ?? new Map<string, number>();
    categoryMonthlySpend[category] = rangeMonths.map(m => ({ month: m, amount: cm.get(m) ?? 0 }));
  }

  /* ── Recent activity ─────────────────────────────────────────────────── */
  const recentActivity = [
    ...activityPOs.map(p => ({
      type: "po" as const, id: p.id, ref: p.poNumber, vendorName: p.vendorName ?? "",
      status: p.status, amount: n(p.totalAmount), createdAt: p.createdAt.toISOString(),
    })),
    ...activityGRNs.map(g => ({
      type: "grn" as const, id: g.id, ref: g.grnNumber, vendorName: g.vendorName ?? "",
      status: g.status, amount: null as null, createdAt: g.createdAt.toISOString(),
    })),
    ...activityInvoices.map(i => ({
      type: "invoice" as const, id: i.id, ref: i.invoiceNumber, vendorName: i.vendorName ?? "",
      status: i.status, amount: n(i.totalAmount), createdAt: i.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12);

  /* ── HTTP caching — private (user data), fresh 2 min, stale-while-revalidate 60 s ── */
  res.set("Cache-Control", "private, max-age=120, stale-while-revalidate=60");

  /* ── Response ────────────────────────────────────────────────────────── */
  res.json({
    summary: {
      totalPOs, openPOs: openPOCount,
      overduePOs: overduePOs.length,
      pendingGRNs: pendingGRNsRaw.length,
      pendingInvoices: pendingInvoicesRaw.length,
      ytdSpend, thisMonthSpend, lastMonthSpend, committedValue,
      mismatchCount, approachingDeadlines: approachingDLs.length,
      pendingApprovalCount, poByStatus,
    },
    overduePOs: overduePOs.slice(0, 20).map(p => ({
      id: p.id, poNumber: p.poNumber, vendorName: p.vendorName, status: p.status,
      deliveryDeadline: p.deliveryDeadline ?? p.expectedDeliveryDate,
      daysOverdue: p.deliveryDeadline
        ? Math.max(0, Math.floor((today.getTime() - new Date(p.deliveryDeadline).getTime()) / 86_400_000))
        : 0,
      totalAmount: n(p.totalAmount),
    })),
    approachingDeadlines: approachingDLs.slice(0, 10).map(p => ({
      id: p.id, poNumber: p.poNumber, vendorName: p.vendorName, status: p.status,
      deliveryDeadline: p.deliveryDeadline ?? p.expectedDeliveryDate,
      daysLeft: p.deliveryDeadline
        ? Math.max(0, Math.floor((new Date(p.deliveryDeadline).getTime() - today.getTime()) / 86_400_000))
        : 7,
      totalAmount: n(p.totalAmount),
    })),
    pendingGRNs: pendingGRNsRaw.slice(0, 8).map(g => ({
      id: g.id, grnNumber: g.grnNumber, poId: g.poId,
      vendorName: g.vendorName, status: g.status, createdAt: g.createdAt.toISOString(),
    })),
    pendingInvoices: pendingInvoicesRaw.slice(0, 8).map(i => ({
      id: i.id, invoiceNumber: i.invoiceNumber, poId: i.poId, vendorName: i.vendorName,
      status: i.status, matchStatus: i.matchStatus,
      totalAmount: n(i.totalAmount), createdAt: i.createdAt.toISOString(),
    })),
    monthlySpend, topVendors, vendorMonthlySpend,
    topCategories, categoryMonthlySpend, recentActivity,
    appliedRange: { from: fromStr, to: toStr },
  });
});

/* ── Badge counts (two lightweight COUNT queries) ───────────────────────── */
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
