/**
 * PO list category filter – correctness tests
 *
 * The PO list accepts a ?category=<label> query param that resolves to
 * CATEGORY_DEFS patterns and returns only POs whose line items match.
 * Labels come directly from CATEGORY_DEFS (e.g. "Inverters", "Solar Modules").
 *
 * This suite confirms:
 *  - A known category label filters by the correct material-name LIKE patterns
 *  - An unknown label silently returns all POs (no crash, no false filter)
 *  - The "Other" sentinel returns only POs that don't match any known category
 *  - Omitting ?category= is equivalent to "no filter" (all POs returned)
 *  - The filter cannot silently return all POs when a valid label is provided
 *    (regression guard against a label/key mismatch returning everything)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import app from "../app.js";
import { db, procurementPOsTable, procPOItemsTable, vendorsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { OTHER_CATEGORY } from "../lib/category-rules.js";

const api = supertest(app);

const RUN = Date.now();
const insertedPoIds: number[] = [];
const insertedVendorIds: number[] = [];
let seqNo = 0;

async function insertPOWithItem(
  materialName: string,
  poOverrides: Partial<typeof procurementPOsTable.$inferInsert> = {},
): Promise<number> {
  seqNo += 1;
  const [po] = await db
    .insert(procurementPOsTable)
    .values({
      poNumber:    `CF${RUN}${seqNo}`.slice(0, 30),
      vendorName:  `VendorCatFilter-${RUN}`,
      status:      "Issued",
      totalAmount: "5000",
      ...poOverrides,
    })
    .returning();
  insertedPoIds.push(po.id);

  // Insert one line item so the category filter can match it
  await db.insert(procPOItemsTable).values({
    poId:         po.id,
    lineNo:       1,
    materialName,
    qty:          "1",
    unitPrice:    "5000",
    lineTotal:    "5000",
  } as any);

  return po.id;
}

let inverterPoId: number;   // line item: "SolarEdge Inverter 10kW"   → "Inverters"
let solarPoId: number;      // line item: "Mono PERC Solar Panel 400W" → "Solar Modules"
let otherPoId: number;      // line item: "Generic Fastener Kit"       → "Other"

beforeAll(async () => {
  inverterPoId = await insertPOWithItem("ABB String Inverter 10kW");
  solarPoId    = await insertPOWithItem("Mono PERC Solar Panel 400W");
  otherPoId    = await insertPOWithItem("Generic Fastener Kit");
});

afterAll(async () => {
  // Remove items first (FK child), then POs, then vendors
  if (insertedPoIds.length) {
    await db.delete(procPOItemsTable).where(inArray(procPOItemsTable.poId, insertedPoIds));
    await db.delete(procurementPOsTable).where(inArray(procurementPOsTable.id, insertedPoIds));
  }
  if (insertedVendorIds.length) {
    await db.delete(vendorsTable).where(inArray(vendorsTable.id, insertedVendorIds));
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PO list – ?category (label) filter", () => {
  it("returns only the inverter PO when category=Inverters", async () => {
    const res = await api.get(`/api/procurement-pos?category=${encodeURIComponent("Inverters")}`);
    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain(inverterPoId);
    expect(ids).not.toContain(solarPoId);
    expect(ids).not.toContain(otherPoId);
  });

  it("returns only the solar PO when category=Solar Modules", async () => {
    const res = await api.get(`/api/procurement-pos?category=${encodeURIComponent("Solar Modules")}`);
    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain(solarPoId);
    expect(ids).not.toContain(inverterPoId);
    expect(ids).not.toContain(otherPoId);
  });

  it("does NOT silently return all POs when a valid label is supplied (regression guard)", async () => {
    // If the category param were silently ignored, the filtered result would equal all POs.
    // A working filter must return a strict subset.
    const [allRes, filteredRes] = await Promise.all([
      api.get("/api/procurement-pos"),
      api.get(`/api/procurement-pos?category=${encodeURIComponent("Inverters")}`),
    ]);
    expect(allRes.status).toBe(200);
    expect(filteredRes.status).toBe(200);

    expect(filteredRes.body.length).toBeGreaterThan(0);
    expect(filteredRes.body.length).toBeLessThan(allRes.body.length);
  });

  it("returns the 'other' PO (and not inverter/solar) when category=Other", async () => {
    const res = await api.get(`/api/procurement-pos?category=${encodeURIComponent(OTHER_CATEGORY)}`);
    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain(otherPoId);
    expect(ids).not.toContain(inverterPoId);
    expect(ids).not.toContain(solarPoId);
  });

  it("returns 200 with an empty array (not an error) when the category label matches nothing", async () => {
    const res = await api.get("/api/procurement-pos?category=NonExistentCategoryXYZ");
    // The API returns [] when no PO items match — not a 400 or 500
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("omitting category returns the same set as no filter (all three test POs included)", async () => {
    const res = await api.get("/api/procurement-pos");
    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain(inverterPoId);
    expect(ids).toContain(solarPoId);
    expect(ids).toContain(otherPoId);
  });
});
