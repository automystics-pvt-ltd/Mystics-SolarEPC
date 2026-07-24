/**
 * PO list vendor filter – correctness tests
 *
 * Regression guard for: https://github.com/mystics-erp/issues/110
 *
 * The PO list accepts two vendor-filter query params:
 *   ?vendorId=<number>  – exact match on the vendorId FK column
 *   ?vendor=<string>    – case-insensitive LIKE match on vendorName
 *
 * Bug: when a navigation link passed a vendor *name* as `?vendor=<name>`,
 * the frontend tried Number(name) → NaN → undefined, silently returning
 * all POs instead of filtering. This suite confirms both filter paths work
 * end-to-end at the HTTP layer.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import app from "../app.js";
import { db, procurementPOsTable, vendorsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const api = supertest(app);

const RUN = Date.now();
const VENDOR_A_NAME = `VendorAlpha-${RUN}`;
const VENDOR_B_NAME = `VendorBeta-${RUN}`;

const insertedPoIds: number[] = [];
const insertedVendorIds: number[] = [];
let vendorAId: number;
let vendorBId: number;
let seqNo = 0;

async function insertPO(
  overrides: Partial<typeof procurementPOsTable.$inferInsert> = {},
): Promise<typeof procurementPOsTable.$inferSelect> {
  seqNo += 1;
  const [po] = await db
    .insert(procurementPOsTable)
    .values({
      poNumber:    `VF${RUN}${seqNo}`.slice(0, 30),
      vendorName:  VENDOR_A_NAME,
      status:      "Issued",
      totalAmount: "1000",
      ...overrides,
    })
    .returning();
  insertedPoIds.push(po.id);
  return po;
}

beforeAll(async () => {
  // Insert real vendor records to satisfy the FK constraint
  const [vA] = await db.insert(vendorsTable).values({ name: VENDOR_A_NAME, status: "Active" }).returning();
  const [vB] = await db.insert(vendorsTable).values({ name: VENDOR_B_NAME, status: "Active" }).returning();
  vendorAId = vA.id;
  vendorBId = vB.id;
  insertedVendorIds.push(vA.id, vB.id);

  // Two POs for vendor A (linked via vendorId)
  await insertPO({ vendorId: vendorAId, vendorName: VENDOR_A_NAME });
  await insertPO({ vendorId: vendorAId, vendorName: VENDOR_A_NAME, status: "Draft" });
  // One PO for vendor B (linked via vendorId)
  await insertPO({ vendorId: vendorBId, vendorName: VENDOR_B_NAME });
  // One PO with vendor A name but no vendorId FK (unlinked — simulates legacy data)
  await insertPO({ vendorId: null as any, vendorName: VENDOR_A_NAME });
});

afterAll(async () => {
  if (insertedPoIds.length) {
    await db.delete(procurementPOsTable).where(inArray(procurementPOsTable.id, insertedPoIds));
  }
  if (insertedVendorIds.length) {
    await db.delete(vendorsTable).where(inArray(vendorsTable.id, insertedVendorIds));
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PO list – ?vendorId filter", () => {
  it("returns only POs whose vendorId matches the given numeric ID", async () => {
    const res = await api.get(`/api/procurement-pos?vendorId=${vendorAId}`);
    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);
    // Must include both vendor-A POs that have the FK set
    expect(ids).toContain(insertedPoIds[0]);
    expect(ids).toContain(insertedPoIds[1]);
    // Must NOT include vendor B's PO
    expect(ids).not.toContain(insertedPoIds[2]);
  });

  it("returns an empty list when no POs exist for the given vendorId", async () => {
    const res = await api.get(`/api/procurement-pos?vendorId=999999999`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("filtering by vendor A excludes vendor B's POs entirely", async () => {
    const res = await api.get(`/api/procurement-pos?vendorId=${vendorAId}`);
    expect(res.status).toBe(200);
    for (const po of res.body) {
      expect(po.vendorId).toBe(vendorAId);
    }
  });
});

describe("PO list – ?vendor (name) filter", () => {
  it("returns POs whose vendorName contains the search string (case-insensitive partial match)", async () => {
    // VendorAlpha-<RUN> is unique; search on "VendorAlpha" substring
    const res = await api.get(`/api/procurement-pos?vendor=${encodeURIComponent("VendorAlpha")}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    for (const po of res.body) {
      expect(po.vendorName?.toLowerCase()).toContain("vendoralpha");
    }
  });

  it("name filter does NOT silently return all POs (regression guard for NaN → undefined path)", async () => {
    // This simulates the exact bug: a vendor name string that was being passed
    // where a numeric ID was expected, causing Number(name) → NaN → no filter.
    // If the filter works correctly, results must be fewer than the total PO count.
    const [allRes, filteredRes] = await Promise.all([
      api.get("/api/procurement-pos"),
      api.get(`/api/procurement-pos?vendor=${encodeURIComponent(VENDOR_A_NAME)}`),
    ]);
    expect(allRes.status).toBe(200);
    expect(filteredRes.status).toBe(200);

    // Filtered results must be a strict subset of all results (vendor A < all vendors)
    expect(filteredRes.body.length).toBeGreaterThan(0);
    expect(filteredRes.body.length).toBeLessThan(allRes.body.length);

    // Every returned PO must actually match vendor A
    for (const po of filteredRes.body) {
      expect(po.vendorName?.toLowerCase()).toContain(VENDOR_A_NAME.toLowerCase());
    }
  });

  it("name filter returns POs regardless of whether vendorId FK is set (covers unlinked vendors)", async () => {
    // The 4th inserted PO has vendorName=VENDOR_A_NAME but no vendorId FK.
    // A name filter must still find it; a vendorId filter would miss it.
    const res = await api.get(`/api/procurement-pos?vendor=${encodeURIComponent(VENDOR_A_NAME)}`);
    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);
    // insertedPoIds[3] is the unlinked PO (no vendorId) — must still appear in name results
    expect(ids).toContain(insertedPoIds[3]);
  });

  it("name filter excludes POs from a different vendor", async () => {
    const res = await api.get(`/api/procurement-pos?vendor=${encodeURIComponent(VENDOR_A_NAME)}`);
    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);
    // Vendor B's PO must not appear in a vendor A filter
    expect(ids).not.toContain(insertedPoIds[2]);
  });
});
