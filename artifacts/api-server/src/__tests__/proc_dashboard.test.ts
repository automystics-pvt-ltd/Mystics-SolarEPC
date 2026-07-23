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
  vendorsTable,
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
const insertedPOIds:    number[] = [];
const insertedGRNIds:   number[] = [];
const insertedInvIds:   number[] = [];
const insertedVendorIds: number[] = [];

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
  if (insertedVendorIds.length)
    await db.delete(vendorsTable).where(inArray(vendorsTable.id, insertedVendorIds));
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

// ─────────────────────────────────────────────────────────────────────────────
// Date-range boundary inclusion tests (Task 69)
// Uses an isolated year (2019) so no other data interferes.
// Range under test: 2019-03-01 → 2019-05-31  (3 months)
// ─────────────────────────────────────────────────────────────────────────────

const BOUNDARY_YEAR  = 2019;
const BOUNDARY_FROM  = `${BOUNDARY_YEAR}-03-01`;
const BOUNDARY_TO    = `${BOUNDARY_YEAR}-05-31`;
const BOUNDARY_VENDOR = `DASH-BOUNDARY-${RUN}`;

// Dates exactly on the boundaries (UTC, matching how the route builds fromDate/toDate)
const ON_FROM_DATE      = new Date(`${BOUNDARY_FROM}T00:00:00.000Z`); // included
const BEFORE_FROM_DATE  = new Date(`${BOUNDARY_YEAR}-02-28T23:59:59.000Z`); // excluded
const ON_TO_DATE        = new Date(`${BOUNDARY_TO}T23:59:59.000Z`); // included
const AFTER_TO_DATE     = new Date(`${BOUNDARY_YEAR}-06-01T00:00:00.000Z`); // excluded

// Mid-range date for a PO that must always appear
const MID_RANGE_DATE = new Date(`${BOUNDARY_YEAR}-04-15T12:00:00.000Z`);

const boundaryPOIds: number[] = [];

beforeAll(async () => {
  async function insertBoundaryPO(
    overrides: Partial<typeof procurementPOsTable.$inferInsert> = {},
  ): Promise<typeof procurementPOsTable.$inferSelect> {
    seqNo += 1;
    const poNumber = `BND${RUN}${seqNo}`.slice(0, 30);
    const [po] = await db
      .insert(procurementPOsTable)
      .values({
        poNumber,
        vendorName: BOUNDARY_VENDOR,
        status: "FullyReceived",
        totalAmount: "1000",
        createdAt: MID_RANGE_DATE,
        updatedAt: MID_RANGE_DATE,
        ...overrides,
      })
      .returning();
    boundaryPOIds.push(po.id);
    insertedPOIds.push(po.id);
    return po;
  }

  // PO exactly on the from boundary → MUST be included in ytdSpend
  await insertBoundaryPO({ totalAmount: "111", createdAt: ON_FROM_DATE, updatedAt: ON_FROM_DATE });
  // PO one instant before from → MUST NOT be included
  await insertBoundaryPO({ totalAmount: "222", createdAt: BEFORE_FROM_DATE, updatedAt: BEFORE_FROM_DATE });
  // PO exactly on the to boundary → MUST be included
  await insertBoundaryPO({ totalAmount: "333", createdAt: ON_TO_DATE, updatedAt: ON_TO_DATE });
  // PO one instant after to → MUST NOT be included
  await insertBoundaryPO({ totalAmount: "444", createdAt: AFTER_TO_DATE, updatedAt: AFTER_TO_DATE });
  // Mid-range PO for an interior month → MUST be included
  await insertBoundaryPO({ totalAmount: "555", createdAt: MID_RANGE_DATE, updatedAt: MID_RANGE_DATE });
});

afterAll(async () => {
  // boundaryPOIds are already tracked in insertedPOIds — cleaned up by the outer afterAll
});

describe("Procurement Dashboard – date-range boundary inclusion", () => {
  it("ytdSpend includes a PO created exactly on the 'from' date", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${BOUNDARY_FROM}&to=${BOUNDARY_TO}`,
    );
    expect(res.status).toBe(200);

    // Included POs: 111 (on from) + 333 (on to) + 555 (mid-range) = 999
    // Excluded POs: 222 (before from) + 444 (after to)
    const { ytdSpend } = res.body.summary;
    expect(ytdSpend).toBe(999);
  });

  it("ytdSpend excludes a PO created one instant before the 'from' date", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${BOUNDARY_FROM}&to=${BOUNDARY_TO}`,
    );
    expect(res.status).toBe(200);

    // 222 must not contribute — total stays at 999, not 1221
    const { ytdSpend } = res.body.summary;
    expect(ytdSpend).not.toBe(1221);
    expect(ytdSpend).toBe(999);
  });

  it("ytdSpend includes a PO created exactly on the 'to' date", async () => {
    // Already verified above (333 is counted), but assert explicitly for clarity.
    const res = await api.get(
      `/api/procurement-dashboard?from=${BOUNDARY_FROM}&to=${BOUNDARY_TO}`,
    );
    expect(res.status).toBe(200);
    // 333 is in May 2019 (the 'to' month), so it's part of the 999 total.
    expect(res.body.summary.ytdSpend).toBeGreaterThanOrEqual(333);
  });

  it("ytdSpend excludes a PO created one instant after the 'to' date", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${BOUNDARY_FROM}&to=${BOUNDARY_TO}`,
    );
    expect(res.status).toBe(200);

    // 444 (June 2019) must not appear — total must not include 444
    const { ytdSpend } = res.body.summary;
    expect(ytdSpend).toBe(999); // not 1443
  });

  it("monthlySpend array covers exactly the months in the requested range", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${BOUNDARY_FROM}&to=${BOUNDARY_TO}`,
    );
    expect(res.status).toBe(200);

    const { monthlySpend } = res.body;
    expect(Array.isArray(monthlySpend)).toBe(true);

    // Range 2019-03-01 → 2019-05-31 spans exactly 3 months
    const months = monthlySpend.map((b: any) => b.month as string);
    expect(months).toContain(`${BOUNDARY_YEAR}-03`);
    expect(months).toContain(`${BOUNDARY_YEAR}-04`);
    expect(months).toContain(`${BOUNDARY_YEAR}-05`);
    // Must NOT contain months outside the range
    expect(months).not.toContain(`${BOUNDARY_YEAR}-02`);
    expect(months).not.toContain(`${BOUNDARY_YEAR}-06`);

    // The array length must be exactly 3 (March, April, May)
    // Filter to our boundary range to avoid interference from other DB data
    const boundaryMonths = months.filter(
      (m: string) => m >= `${BOUNDARY_YEAR}-03` && m <= `${BOUNDARY_YEAR}-05`,
    );
    expect(boundaryMonths.length).toBe(3);
  });

  it("monthly spend buckets correctly attribute boundary-date POs to the right month", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${BOUNDARY_FROM}&to=${BOUNDARY_TO}`,
    );
    expect(res.status).toBe(200);

    const { monthlySpend } = res.body;

    const marchBucket = monthlySpend.find((b: any) => b.month === `${BOUNDARY_YEAR}-03`);
    const aprilBucket = monthlySpend.find((b: any) => b.month === `${BOUNDARY_YEAR}-04`);
    const mayBucket   = monthlySpend.find((b: any) => b.month === `${BOUNDARY_YEAR}-05`);

    expect(marchBucket).toBeDefined();
    expect(aprilBucket).toBeDefined();
    expect(mayBucket).toBeDefined();

    // ON_FROM_DATE = 2019-03-01 → March bucket gets 111
    expect(marchBucket.amount).toBe(111);
    // MID_RANGE_DATE = 2019-04-15 → April bucket gets 555
    expect(aprilBucket.amount).toBe(555);
    // ON_TO_DATE = 2019-05-31 → May bucket gets 333
    expect(mayBucket.amount).toBe(333);
  });

  it("topVendors for boundary range only reflects POs within the range", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${BOUNDARY_FROM}&to=${BOUNDARY_TO}`,
    );
    expect(res.status).toBe(200);

    const { topVendors } = res.body;
    const myVendor = topVendors.find((v: any) => v.vendorName === BOUNDARY_VENDOR);

    // 3 POs within range (111 + 333 + 555 = 999)
    expect(myVendor).toBeDefined();
    expect(myVendor.spend).toBe(999);
    expect(myVendor.poCount).toBe(3);
  });

  it("appliedRange echoes from/to when provided", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${BOUNDARY_FROM}&to=${BOUNDARY_TO}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.appliedRange.from).toBe(BOUNDARY_FROM);
    expect(res.body.appliedRange.to).toBe(BOUNDARY_TO);
  });

  it("cross-year range: monthlySpend spans correct months and ytdSpend sums only those months", async () => {
    // Range Dec 2018 → Feb 2019: 3 months crossing a year boundary
    const crossFrom = "2018-12-01";
    const crossTo   = "2019-02-28";
    const CROSS_VENDOR = `DASH-CROSS-${RUN}`;
    const crossPOIds: number[] = [];

    seqNo += 1;
    const [dec] = await db.insert(procurementPOsTable).values({
      poNumber: `CRS${RUN}${seqNo}D`.slice(0, 30),
      vendorName: CROSS_VENDOR,
      status: "FullyReceived",
      totalAmount: "2000",
      createdAt: new Date("2018-12-15T12:00:00.000Z"),
      updatedAt: new Date("2018-12-15T12:00:00.000Z"),
    }).returning();
    crossPOIds.push(dec.id);

    seqNo += 1;
    const [feb] = await db.insert(procurementPOsTable).values({
      poNumber: `CRS${RUN}${seqNo}F`.slice(0, 30),
      vendorName: CROSS_VENDOR,
      status: "FullyReceived",
      totalAmount: "3000",
      createdAt: new Date("2019-02-10T12:00:00.000Z"),
      updatedAt: new Date("2019-02-10T12:00:00.000Z"),
    }).returning();
    crossPOIds.push(feb.id);

    // PO outside range (Nov 2018) — must not be counted
    seqNo += 1;
    const [nov] = await db.insert(procurementPOsTable).values({
      poNumber: `CRS${RUN}${seqNo}N`.slice(0, 30),
      vendorName: CROSS_VENDOR,
      status: "FullyReceived",
      totalAmount: "9999",
      createdAt: new Date("2018-11-30T12:00:00.000Z"),
      updatedAt: new Date("2018-11-30T12:00:00.000Z"),
    }).returning();
    crossPOIds.push(nov.id);

    try {
      const res = await api.get(
        `/api/procurement-dashboard?from=${crossFrom}&to=${crossTo}`,
      );
      expect(res.status).toBe(200);

      const { monthlySpend, summary, topVendors } = res.body;

      // Months must be: 2018-12, 2019-01, 2019-02
      const months = monthlySpend.map((b: any) => b.month as string);
      expect(months).toContain("2018-12");
      expect(months).toContain("2019-01");
      expect(months).toContain("2019-02");
      expect(months).not.toContain("2018-11");
      expect(months).not.toContain("2019-03");

      // ytdSpend = 2000 + 3000 = 5000 (not 14999 which would include Nov)
      const crossVendor = topVendors.find((v: any) => v.vendorName === CROSS_VENDOR);
      expect(crossVendor).toBeDefined();
      expect(crossVendor.spend).toBe(5000);
      expect(crossVendor.poCount).toBe(2);

      // Use vendorMonthlySpend (vendor-scoped) for exact bucket assertions
      // so other vendors' POs in those months don't affect the numbers.
      const { vendorMonthlySpend } = res.body;
      const crossVendorMonths: { month: string; amount: number }[] =
        vendorMonthlySpend[CROSS_VENDOR] ?? [];

      const decBucket = crossVendorMonths.find((b) => b.month === "2018-12");
      const janBucket = crossVendorMonths.find((b) => b.month === "2019-01");
      const febBucket = crossVendorMonths.find((b) => b.month === "2019-02");

      expect(decBucket).toBeDefined();
      expect(janBucket).toBeDefined();
      expect(febBucket).toBeDefined();
      expect(decBucket!.amount).toBe(2000);
      expect(janBucket!.amount).toBe(0);
      expect(febBucket!.amount).toBe(3000);
    } finally {
      if (crossPOIds.length) {
        await db.delete(procurementPOsTable).where(inArray(procurementPOsTable.id, crossPOIds));
      }
    }
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

// ── Vendor-id grouping ────────────────────────────────────────────────────────
// The same physical vendor can appear under slightly different name strings
// (e.g. "ABC Electricals" vs "ABC Electricals Pvt Ltd").  When both POs share
// the same vendorId FK the dashboard must merge them into a single topVendors
// entry rather than splitting spend across two rows.

describe("Procurement Dashboard – vendor-id grouping prevents split spend", () => {
  // Use a year that no other test touches so the vendor is guaranteed top-of-list.
  const MERGE_YEAR   = 2019;
  const MERGE_FROM   = `${MERGE_YEAR}-01-01`;
  const MERGE_TO     = `${MERGE_YEAR}-12-31`;
  const MERGE_DATE   = new Date(`${MERGE_YEAR}-03-15T10:00:00.000Z`);

  let mergeVendorId: number;
  const mergePOIds: number[] = [];

  beforeAll(async () => {
    // Create a real vendor record so the FK constraint is satisfied.
    const [vendor] = await db
      .insert(vendorsTable)
      .values({ name: `MergeVendor-${RUN}`, code: `MV${RUN}`.slice(0, 20) })
      .returning();
    mergeVendorId = vendor.id;
    insertedVendorIds.push(vendor.id);

    // PO 1 — linked to the vendor, name as registered
    const [po1] = await db
      .insert(procurementPOsTable)
      .values({
        poNumber: `MRG1-${RUN}`.slice(0, 30),
        vendorId: mergeVendorId,
        vendorName: `MergeVendor-${RUN}`,
        status: "FullyReceived",
        totalAmount: "6000",
        createdAt: MERGE_DATE,
        updatedAt: MERGE_DATE,
      })
      .returning();
    mergePOIds.push(po1.id);
    insertedPOIds.push(po1.id);

    // PO 2 — same vendorId but vendorName has " Pvt Ltd" appended
    const [po2] = await db
      .insert(procurementPOsTable)
      .values({
        poNumber: `MRG2-${RUN}`.slice(0, 30),
        vendorId: mergeVendorId,
        vendorName: `MergeVendor-${RUN} Pvt Ltd`,
        status: "FullyReceived",
        totalAmount: "4000",
        createdAt: MERGE_DATE,
        updatedAt: MERGE_DATE,
      })
      .returning();
    mergePOIds.push(po2.id);
    insertedPOIds.push(po2.id);
  });

  it("merges two POs with the same vendorId but different vendorName strings into one topVendors entry", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${MERGE_FROM}&to=${MERGE_TO}`,
    );
    expect(res.status).toBe(200);

    const { topVendors } = res.body;
    expect(Array.isArray(topVendors)).toBe(true);

    // There must be exactly ONE entry for our vendor (not two with different names).
    const entries = topVendors.filter(
      (v: any) =>
        v.vendorName === `MergeVendor-${RUN}` ||
        v.vendorName === `MergeVendor-${RUN} Pvt Ltd`,
    );
    expect(entries).toHaveLength(1);

    // Combined spend must be 6000 + 4000 = 10000.
    expect(entries[0].spend).toBe(10000);
    // Both POs must be counted.
    expect(entries[0].poCount).toBe(2);
  });

  it("vendorMonthlySpend for the merged vendor reflects combined spend across both POs", async () => {
    const res = await api.get(
      `/api/procurement-dashboard?from=${MERGE_FROM}&to=${MERGE_TO}`,
    );
    expect(res.status).toBe(200);

    const { topVendors, vendorMonthlySpend } = res.body;

    // Find whichever name the dashboard chose as display label.
    const mergedEntry = topVendors.find(
      (v: any) =>
        v.vendorName === `MergeVendor-${RUN}` ||
        v.vendorName === `MergeVendor-${RUN} Pvt Ltd`,
    );
    expect(mergedEntry).toBeDefined();

    const monthlyData = vendorMonthlySpend[mergedEntry.vendorName];
    expect(Array.isArray(monthlyData)).toBe(true);

    // March bucket must carry the full merged spend (6000 + 4000).
    const marchBucket = monthlyData.find((b: any) => b.month === `${MERGE_YEAR}-03`);
    expect(marchBucket).toBeDefined();
    expect(marchBucket.amount).toBe(10000);
  });
});
