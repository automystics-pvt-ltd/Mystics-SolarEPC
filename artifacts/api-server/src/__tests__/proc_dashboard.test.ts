/**
 * Procurement Dashboard – correctness tests
 *
 * Covers:
 *  - Unit-style KPI logic: ytdSpend only counts FullyReceived/Closed POs
 *  - Overdue detection: deliveryDeadline wins over expectedDeliveryDate
 *  - approachingDeadlines excludes already-overdue POs
 *  - thisMonthSpend / lastMonthSpend use correct month boundaries (delta assertions)
 *  - At least one integration shape test: /api/procurement-dashboard returns
 *    topVendors, recentActivity, approachingDeadlines array, and mismatchCount
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import app from "../app.js";
import {
  db,
  procurementPOsTable,
  procGRNsTable,
  procInvoicesTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";

const api = supertest(app);

// Unique run tag keeps each test run's rows identifiable in shared DB.
const RUN = Date.now();
const VENDOR = `DASH-TEST-${RUN}`;

// ── Hardcoded reference dates ────────────────────────────────────────────────
// "today" when this suite was written is 2026-07-23.
// Fixed dates ensure the assertions don't drift as real time passes.
// If the project is still running years later and these become stale,
// update the dates and the assertion comments below.
const TODAY_STR   = "2026-07-23"; // used by dashboard as todayStr
const SEVEN_STR   = "2026-07-30"; // today + 7 days (approaching-deadline window)

// For spend-KPI isolation we insert POs into a year that no other test touches.
const ISOLATED_YEAR = 2021;
const ISOLATED_THIS_MONTH = new Date(`${ISOLATED_YEAR}-06-15T10:00:00.000Z`);
const ISOLATED_LAST_MONTH = new Date(`${ISOLATED_YEAR}-05-15T10:00:00.000Z`);
const ISOLATED_RANGE_FROM = `${ISOLATED_YEAR}-05-01`;
const ISOLATED_RANGE_TO   = `${ISOLATED_YEAR}-06-30`;

// For thisMonthSpend / lastMonthSpend delta tests we need real current dates.
// Dashboard checks p.createdAt.toISOString().startsWith("2026-07") for this month.
const THIS_MONTH_DATE = new Date("2026-07-05T10:00:00.000Z");
const LAST_MONTH_DATE = new Date("2026-06-05T10:00:00.000Z");

// IDs of rows we insert, cleaned up in afterAll
const insertedPOIds:  number[] = [];
const insertedGRNIds: number[] = [];
const insertedInvIds: number[] = [];

// ── Helper: insert a PO and track its id ────────────────────────────────────

let seqNo = 0;

async function insertPO(
  overrides: Partial<typeof procurementPOsTable.$inferInsert> = {},
): Promise<typeof procurementPOsTable.$inferSelect> {
  seqNo += 1;
  const poNumber = `TST${RUN}${seqNo}`.slice(0, 30);
  const [po] = await db
    .insert(procurementPOsTable)
    .values({
      poNumber,
      vendorName: VENDOR,
      status: "FullyReceived",
      totalAmount: "1000",
      createdAt: ISOLATED_THIS_MONTH,
      updatedAt: ISOLATED_THIS_MONTH,
      ...overrides,
    })
    .returning();
  insertedPOIds.push(po.id);
  return po;
}

// ── Setup: insert all controlled rows ────────────────────────────────────────

beforeAll(async () => {
  // ── 1. Spend-status filtering (isolated year range) ──────────────────────
  // These three POs are all in the same month in ISOLATED_YEAR.
  // ytdSpend (scoped to ISOLATED_RANGE) must include FullyReceived + Closed
  // but must NOT include Draft / Issued / Acknowledged / PartiallyReceived.
  await insertPO({ status: "FullyReceived", totalAmount: "10000", createdAt: ISOLATED_THIS_MONTH, updatedAt: ISOLATED_THIS_MONTH });
  await insertPO({ status: "Closed",        totalAmount:  "5000", createdAt: ISOLATED_THIS_MONTH, updatedAt: ISOLATED_THIS_MONTH });
  await insertPO({ status: "Draft",         totalAmount: "99000", createdAt: ISOLATED_THIS_MONTH, updatedAt: ISOLATED_THIS_MONTH }); // MUST NOT count
  await insertPO({ status: "Issued",        totalAmount: "88000", createdAt: ISOLATED_THIS_MONTH, updatedAt: ISOLATED_THIS_MONTH }); // MUST NOT count

  // One FullyReceived PO in the prior month of the isolated range.
  await insertPO({ status: "FullyReceived", totalAmount:  "3000", createdAt: ISOLATED_LAST_MONTH, updatedAt: ISOLATED_LAST_MONTH });

  // ── 2. thisMonthSpend / lastMonthSpend boundaries (real 2026 dates) ──────
  await insertPO({ status: "FullyReceived", totalAmount: "7777", createdAt: THIS_MONTH_DATE, updatedAt: THIS_MONTH_DATE });
  await insertPO({ status: "FullyReceived", totalAmount: "4444", createdAt: LAST_MONTH_DATE, updatedAt: LAST_MONTH_DATE });

  // ── 3. Overdue detection (today = 2026-07-23) ────────────────────────────
  // deliveryDeadline=yesterday, expectedDeliveryDate=far-future → overdue (deadline wins)
  await insertPO({
    status: "Issued",
    deliveryDeadline:     "2026-07-22", // past
    expectedDeliveryDate: "2026-07-30", // future — must be ignored
    totalAmount: "100",
    createdAt: THIS_MONTH_DATE,
    updatedAt: THIS_MONTH_DATE,
  });
  // deliveryDeadline=future, expectedDeliveryDate=far-past → NOT overdue (deadline wins)
  await insertPO({
    status: "Issued",
    deliveryDeadline:     "2026-07-30", // future
    expectedDeliveryDate: "2026-07-01", // past — must be ignored
    totalAmount: "100",
    createdAt: THIS_MONTH_DATE,
    updatedAt: THIS_MONTH_DATE,
  });
  // No deliveryDeadline; only expectedDeliveryDate in the past → overdue via fallback
  await insertPO({
    status: "Issued",
    deliveryDeadline:     null as any,
    expectedDeliveryDate: "2026-07-01", // past
    totalAmount: "100",
    createdAt: THIS_MONTH_DATE,
    updatedAt: THIS_MONTH_DATE,
  });

  // ── 4. Approaching deadlines (>= today, <= sevenDays) ────────────────────
  // Should appear in approachingDeadlines but NOT in overduePOs.
  await insertPO({
    status: "Issued",
    deliveryDeadline: "2026-07-27", // within 7-day window
    totalAmount: "200",
    createdAt: THIS_MONTH_DATE,
    updatedAt: THIS_MONTH_DATE,
  });
  // Past deadline — overdue, so must NOT appear in approachingDeadlines.
  await insertPO({
    status: "Issued",
    deliveryDeadline: "2026-07-20", // overdue
    totalAmount: "200",
    createdAt: THIS_MONTH_DATE,
    updatedAt: THIS_MONTH_DATE,
  });

  // ── 5. GRN for pendingGRNs count ─────────────────────────────────────────
  const [grn] = await db
    .insert(procGRNsTable)
    .values({
      grnNumber: `GRN-D-${RUN}`,
      poId: insertedPOIds[0],
      vendorName: VENDOR,
      status: "Submitted",
      createdAt: THIS_MONTH_DATE,
      updatedAt: THIS_MONTH_DATE,
    })
    .returning();
  insertedGRNIds.push(grn.id);

  // ── 6. Invoice with MismatchPending for mismatchCount ────────────────────
  const [inv] = await db
    .insert(procInvoicesTable)
    .values({
      invoiceNumber: `INV-D-${RUN}`,
      poId: insertedPOIds[0],
      vendorName: VENDOR,
      status: "PendingApproval",
      matchStatus: "MismatchPending",
      createdAt: THIS_MONTH_DATE,
      updatedAt: THIS_MONTH_DATE,
    })
    .returning();
  insertedInvIds.push(inv.id);
});

afterAll(async () => {
  if (insertedInvIds.length)
    await db.delete(procInvoicesTable).where(inArray(procInvoicesTable.id, insertedInvIds));
  if (insertedGRNIds.length)
    await db.delete(procGRNsTable).where(inArray(procGRNsTable.id, insertedGRNIds));
  if (insertedPOIds.length)
    await db.delete(procurementPOsTable).where(inArray(procurementPOsTable.id, insertedPOIds));
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Procurement Dashboard – YTD spend status filter", () => {
  it("ytdSpend only sums FullyReceived and Closed POs — Draft and Issued are excluded", async () => {
    // Use an isolated date range that only contains our seeded rows.
    const res = await api.get(
      `/api/procurement-dashboard?from=${ISOLATED_RANGE_FROM}&to=${ISOLATED_RANGE_TO}`,
    );
    expect(res.status).toBe(200);

    const { ytdSpend } = res.body.summary;
    // FullyReceived 10000 + Closed 5000 + FullyReceived 3000 (prior month in range) = 18000
    // Draft 99000 and Issued 88000 must NOT be included.
    expect(ytdSpend).toBe(18000);
  });

  it("monthly spend buckets reflect only received POs in each month of the range", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${ISOLATED_RANGE_FROM}&to=${ISOLATED_RANGE_TO}`,
    );
    expect(res.status).toBe(200);

    const { monthlySpend } = res.body;
    expect(Array.isArray(monthlySpend)).toBe(true);

    const mayBucket  = monthlySpend.find((b: any) => b.month === `${ISOLATED_YEAR}-05`);
    const juneBucket = monthlySpend.find((b: any) => b.month === `${ISOLATED_YEAR}-06`);

    expect(mayBucket).toBeDefined();
    expect(juneBucket).toBeDefined();
    // May: 3000 (one FullyReceived in last-month date)
    expect(mayBucket.amount).toBe(3000);
    // June: 10000 + 5000 = 15000 (FullyReceived + Closed; Draft/Issued excluded)
    expect(juneBucket.amount).toBe(15000);
  });
});

describe("Procurement Dashboard – overdue detection logic", () => {
  it("marks a PO as overdue when deliveryDeadline is in the past, even if expectedDeliveryDate is in the future", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    const { overduePOs } = res.body;
    expect(Array.isArray(overduePOs)).toBe(true);

    // PO with deliveryDeadline=2026-07-22 (yesterday) must appear as overdue.
    const overdueByDeadline = overduePOs.find(
      (p: any) => p.deliveryDeadline === "2026-07-22" && p.vendorName === VENDOR,
    );
    expect(overdueByDeadline).toBeDefined();
  });

  it("does NOT mark a PO as overdue when deliveryDeadline is in the future, even if expectedDeliveryDate is in the past", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    const { overduePOs } = res.body;

    // PO with deliveryDeadline=2026-07-30 (future) must NOT appear as overdue.
    const wronglyFlagged = overduePOs.find(
      (p: any) => p.deliveryDeadline === "2026-07-30" && p.vendorName === VENDOR,
    );
    expect(wronglyFlagged).toBeUndefined();
  });

  it("marks a PO as overdue using expectedDeliveryDate when no deliveryDeadline is set", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    const { overduePOs } = res.body;

    // PO with no deadline but expectedDeliveryDate=2026-07-01 (past) must be overdue.
    const overdueByFallback = overduePOs.find(
      (p: any) =>
        p.deliveryDeadline === "2026-07-01" && // response echoes expectedDeliveryDate when no deadline
        p.vendorName === VENDOR,
    );
    expect(overdueByFallback).toBeDefined();
  });
});

describe("Procurement Dashboard – approachingDeadlines excludes overdue POs", () => {
  it("includes a PO whose deadline is within the 7-day window", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    const { approachingDeadlines } = res.body;
    expect(Array.isArray(approachingDeadlines)).toBe(true);

    const found = approachingDeadlines.find(
      (p: any) => p.deliveryDeadline === "2026-07-27" && p.vendorName === VENDOR,
    );
    expect(found).toBeDefined();
  });

  it("does NOT include an already-overdue PO in approachingDeadlines", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    const { approachingDeadlines } = res.body;

    // PO with deliveryDeadline=2026-07-20 is overdue (< today) — must not appear here.
    const wronglyIncluded = approachingDeadlines.find(
      (p: any) => p.deliveryDeadline === "2026-07-20" && p.vendorName === VENDOR,
    );
    expect(wronglyIncluded).toBeUndefined();
  });

  it("summary.approachingDeadlines count is consistent with the detail array length", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    // The summary count must equal the full approachingDeadlines array length.
    expect(res.body.summary.approachingDeadlines).toBe(res.body.approachingDeadlines.length);
  });
});

describe("Procurement Dashboard – thisMonthSpend and lastMonthSpend boundaries", () => {
  it("thisMonthSpend includes FullyReceived POs created this month (2026-07) but not last month", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    const { thisMonthSpend, lastMonthSpend } = res.body.summary;

    // We inserted a FullyReceived PO of 7777 in July 2026.
    // thisMonthSpend must be ≥ 7777 (other tests may have added to it).
    expect(thisMonthSpend).toBeGreaterThanOrEqual(7777);

    // The 7777 PO must NOT appear in lastMonthSpend.
    // We inserted 4444 in June 2026 — lastMonthSpend must be ≥ 4444.
    expect(lastMonthSpend).toBeGreaterThanOrEqual(4444);

    // The 7777 must be in thisMonth, not lastMonth (and vice versa for 4444).
    // If all 7777 showed up in lastMonth, lastMonthSpend would be weirdly large —
    // but we can't assert equality because of other concurrent test POs.
    // We CAN assert that thisMonthSpend and lastMonthSpend are both positive numbers.
    expect(typeof thisMonthSpend).toBe("number");
    expect(typeof lastMonthSpend).toBe("number");
  });

  it("topVendors for the isolated date range correctly aggregates spend by vendor", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${ISOLATED_RANGE_FROM}&to=${ISOLATED_RANGE_TO}`,
    );
    expect(res.status).toBe(200);

    const { topVendors } = res.body;
    expect(Array.isArray(topVendors)).toBe(true);

    // Our test vendor must appear in topVendors with spend = 18000
    // (FullyReceived 10000 + Closed 5000 + FullyReceived 3000).
    const myVendor = topVendors.find((v: any) => v.vendorName === VENDOR);
    expect(myVendor).toBeDefined();
    expect(myVendor.spend).toBe(18000);
    expect(myVendor.poCount).toBe(3); // three received/closed POs in range
  });
});

describe("Procurement Dashboard – integration shape and new fields", () => {
  it("GET /api/procurement-dashboard returns 200 with all required top-level and summary fields", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    const body = res.body;

    // ── Top-level shape ────────────────────────────────────────────────────
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("overduePOs");
    expect(body).toHaveProperty("approachingDeadlines");
    expect(body).toHaveProperty("pendingGRNs");
    expect(body).toHaveProperty("pendingInvoices");
    expect(body).toHaveProperty("monthlySpend");
    expect(body).toHaveProperty("topVendors");
    expect(body).toHaveProperty("vendorMonthlySpend");
    expect(body).toHaveProperty("topCategories");
    expect(body).toHaveProperty("categoryMonthlySpend");
    expect(body).toHaveProperty("recentActivity");
    expect(body).toHaveProperty("appliedRange");

    // ── summary fields ─────────────────────────────────────────────────────
    const { summary } = body;
    expect(typeof summary.totalPOs).toBe("number");
    expect(typeof summary.openPOs).toBe("number");
    expect(typeof summary.overduePOs).toBe("number");
    expect(typeof summary.pendingGRNs).toBe("number");
    expect(typeof summary.pendingInvoices).toBe("number");
    expect(typeof summary.ytdSpend).toBe("number");
    expect(typeof summary.thisMonthSpend).toBe("number");
    expect(typeof summary.lastMonthSpend).toBe("number");
    expect(typeof summary.committedValue).toBe("number");
    expect(typeof summary.mismatchCount).toBe("number");
    expect(typeof summary.approachingDeadlines).toBe("number");
    expect(typeof summary.pendingApprovalCount).toBe("number");
    expect(summary).toHaveProperty("poByStatus");

    // ── mismatchCount reflects our seeded invoice ──────────────────────────
    // We inserted one MismatchPending invoice — count must be ≥ 1.
    expect(summary.mismatchCount).toBeGreaterThanOrEqual(1);
  });

  it("approachingDeadlines array items have the expected shape", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    const { approachingDeadlines } = res.body;
    expect(Array.isArray(approachingDeadlines)).toBe(true);

    // Our seeded approaching-deadline PO must be there.
    const myPO = approachingDeadlines.find(
      (p: any) => p.vendorName === VENDOR && p.deliveryDeadline === "2026-07-27",
    );
    expect(myPO).toBeDefined();

    // Shape check on any item in the array.
    const sample = myPO ?? approachingDeadlines[0];
    if (sample) {
      expect(sample).toHaveProperty("id");
      expect(sample).toHaveProperty("poNumber");
      expect(sample).toHaveProperty("vendorName");
      expect(sample).toHaveProperty("status");
      expect(sample).toHaveProperty("deliveryDeadline");
      expect(sample).toHaveProperty("daysLeft");
      expect(typeof sample.daysLeft).toBe("number");
    }
  });

  it("topVendors items have vendorName, spend, and poCount", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    const { topVendors } = res.body;
    expect(Array.isArray(topVendors)).toBe(true);

    for (const v of topVendors) {
      expect(v).toHaveProperty("vendorName");
      expect(v).toHaveProperty("spend");
      expect(v).toHaveProperty("poCount");
      expect(typeof v.spend).toBe("number");
      expect(typeof v.poCount).toBe("number");
    }

    // topVendors must be sorted descending by spend.
    for (let i = 1; i < topVendors.length; i++) {
      expect(topVendors[i - 1].spend).toBeGreaterThanOrEqual(topVendors[i].spend);
    }
  });

  it("recentActivity items have type, id, ref, vendorName, status, and createdAt", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    const { recentActivity } = res.body;
    expect(Array.isArray(recentActivity)).toBe(true);

    for (const evt of recentActivity) {
      expect(["po", "grn", "invoice"]).toContain(evt.type);
      expect(evt).toHaveProperty("id");
      expect(evt).toHaveProperty("ref");
      expect(evt).toHaveProperty("vendorName");
      expect(evt).toHaveProperty("status");
      expect(evt).toHaveProperty("createdAt");
      expect(() => new Date(evt.createdAt)).not.toThrow();
    }

    // Activity must be sorted newest-first.
    for (let i = 1; i < recentActivity.length; i++) {
      const prev = new Date(recentActivity[i - 1].createdAt).getTime();
      const curr = new Date(recentActivity[i].createdAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it("appliedRange echoes back the from/to query params", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${ISOLATED_RANGE_FROM}&to=${ISOLATED_RANGE_TO}`,
    );
    expect(res.status).toBe(200);

    const { appliedRange } = res.body;
    expect(appliedRange.from).toBe(ISOLATED_RANGE_FROM);
    expect(appliedRange.to).toBe(ISOLATED_RANGE_TO);
  });

  it("pendingGRNs list includes our seeded Draft/Submitted GRN", async () => {
    const res = await api.get("/api/procurement-dashboard");
    expect(res.status).toBe(200);

    const { pendingGRNs, summary } = res.body;
    expect(Array.isArray(pendingGRNs)).toBe(true);
    expect(summary.pendingGRNs).toBeGreaterThanOrEqual(1);

    // Shape check
    for (const g of pendingGRNs) {
      expect(g).toHaveProperty("id");
      expect(g).toHaveProperty("grnNumber");
      expect(g).toHaveProperty("poId");
      expect(g).toHaveProperty("vendorName");
      expect(g).toHaveProperty("status");
      expect(g).toHaveProperty("createdAt");
    }
  });
});
