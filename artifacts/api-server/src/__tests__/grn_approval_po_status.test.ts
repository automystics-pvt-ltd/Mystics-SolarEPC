/**
 * Integration tests: GRN approval → PO delivery quantity & status
 *
 * Covers:
 *  - Approving a GRN for a partial delivery sets PO → PartiallyReceived
 *    and correctly increments each PO item's deliveredQty
 *  - Approving a second GRN that completes the remaining quantity sets
 *    PO → FullyReceived
 *  - deliveredQty on each PO line item reflects cumulative accepted quantities
 *    across multiple GRNs
 *  - A new GRN is rejected once the PO is FullyReceived
 *
 * Setup: a PO in "Issued" status is inserted directly into the DB (bypassing
 * the full quotation → approval workflow) so the test stays focused on the
 * GRN approval logic. GRN lifecycle (create → submit → approve) goes through
 * the real HTTP API.
 *
 * Auth: JWT tokens are generated with the dev-fallback secret — same approach
 * as rbac-smoke.test.ts. No real DB user record is required.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import { inArray } from "drizzle-orm";
import app from "../app.js";
import {
  db,
  procurementPOsTable,
  procPOItemsTable,
  procGRNsTable,
  vendorsTable,
} from "@workspace/db";

const api = supertest(app);
const RUN = Date.now();

// ── Auth helpers ─────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

function makeToken(role: string, userId = 5): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "1h" });
}

const adminToken = makeToken("admin", 5);

/** Attach the admin Bearer token to any supertest request chain */
function withAuth<T extends { set: (k: string, v: string) => T }>(req: T): T {
  return req.set("Authorization", `Bearer ${adminToken}`);
}

// ── Cleanup tracking ─────────────────────────────────────────────────────────
const insertedVendorIds: number[] = [];
const insertedPOIds:     number[] = [];

// ── Shared state ─────────────────────────────────────────────────────────────
let poId: number;
let poItem1Id: number; // Steel Rod – qty 10
let poItem2Id: number; // MS Pipe   – qty 5
let grn1Id: number;
let grn2Id: number;

// ── Setup: insert a PO in "Issued" status directly (skip approval workflow) ──
beforeAll(async () => {
  // 1. Vendor
  // Use last 6 digits of RUN to stay within varchar(20) for vendor code
  const runSuffix = String(RUN).slice(-6);
  const [vendor] = await db
    .insert(vendorsTable)
    .values({
      code: `VG-${runSuffix}`,          // max 9 chars — well within varchar(20)
      name: `GRN Test Vendor ${RUN}`,
      primaryEmail: `grn.test.${RUN}@example.com`,
      status: "Active",
    })
    .returning();
  insertedVendorIds.push(vendor.id);

  // 2. PO in Issued status — GRNs can be created against Issued POs
  const [po] = await db
    .insert(procurementPOsTable)
    .values({
      poNumber: `PO-G-${runSuffix}`,    // stays within varchar(30)
      vendorId: vendor.id,
      vendorName: vendor.name,
      status: "Issued",
      totalAmount: "8500",
      deliveryDeadline: "2026-09-30",
    } as any)
    .returning();
  poId = po.id;
  insertedPOIds.push(po.id);

  // 3. Two PO line items
  //    Item 1: Steel Rod – qty 10 @ ₹300
  //    Item 2: MS Pipe   – qty  5 @ ₹500
  const [item1] = await db
    .insert(procPOItemsTable)
    .values({
      poId: po.id,
      lineNo: 1,
      materialName: `Steel Rod ${RUN}`,
      uom: "Nos",
      qty: "10",
      unitPrice: "300",
      gstRate: "18",
      deliveredQty: "0",
    })
    .returning();
  poItem1Id = item1.id;

  const [item2] = await db
    .insert(procPOItemsTable)
    .values({
      poId: po.id,
      lineNo: 2,
      materialName: `MS Pipe ${RUN}`,
      uom: "Nos",
      qty: "5",
      unitPrice: "500",
      gstRate: "18",
      deliveredQty: "0",
    })
    .returning();
  poItem2Id = item2.id;
});

// ── Teardown: remove only the rows this suite created ────────────────────────
afterAll(async () => {
  if (grn1Id || grn2Id) {
    const ids = [grn1Id, grn2Id].filter(Boolean);
    await db.delete(procGRNsTable).where(inArray(procGRNsTable.id, ids));
  }
  if (insertedPOIds.length) {
    await db.delete(procurementPOsTable).where(inArray(procurementPOsTable.id, insertedPOIds));
  }
  if (insertedVendorIds.length) {
    await db.delete(vendorsTable).where(inArray(vendorsTable.id, insertedVendorIds));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GRN approval → PO delivery quantities and status", () => {
  // ── Partial delivery ────────────────────────────────────────────────────────

  it("creates a GRN for partial delivery (5 of 10 Steel Rods, 0 MS Pipes)", async () => {
    const res = await withAuth(api.post("/api/proc-grns")).send({
      userName: "GRN Test User",
      userId: 5,
      userRole: "admin",
      poId,
      warehouseId: 1,
      warehouseName: "Main Warehouse",
      deliveryDate: "2026-08-05",
      items: [
        {
          poItemId: poItem1Id,
          materialName: `Steel Rod ${RUN}`,
          uom: "Nos",
          orderedQty: 10,
          receivedQty: 5,
          acceptedQty: 5,
          rejectedQty: 0,
          unitPrice: 300,
        },
        // MS Pipe: not delivered in this shipment
      ],
    });
    expect(res.status).toBe(201);
    grn1Id = res.body.id;
    expect(grn1Id).toBeDefined();
    expect(res.body.status).toBe("Draft");
    expect(res.body.totalAcceptedQty).toBe(5);
  });

  it("submits GRN 1 for inspection (Draft → Submitted)", async () => {
    const res = await withAuth(api.post(`/api/proc-grns/${grn1Id}/submit`)).send({
      userName: "GRN Test User",
      userId: 5,
      remarks: "Submitted for partial delivery inspection",
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Submitted");
  });

  it("approving GRN 1 sets PO → PartiallyReceived and Steel Rod deliveredQty to 5", async () => {
    const res = await withAuth(api.post(`/api/proc-grns/${grn1Id}/approve`)).send({
      userName: "GRN Test User",
      userId: 5,
      remarks: "Partial delivery accepted",
    });
    expect(res.status).toBe(200);
    // GRN accepts 5 of 10 ordered → PartiallyAccepted (orderedQty reflects full PO line)
    expect(res.body.status).toBe("PartiallyAccepted");

    // Verify PO state via the PO detail endpoint
    const poRes = await withAuth(api.get(`/api/procurement-pos/${poId}`));
    expect(poRes.status).toBe(200);

    // PO: some items partially delivered → PartiallyReceived
    expect(poRes.body.status).toBe("PartiallyReceived");

    // Steel Rod (item 1): 5 of 10 delivered
    const item1 = poRes.body.items.find((i: any) => i.id === poItem1Id);
    expect(item1).toBeDefined();
    expect(Number(item1.deliveredQty)).toBe(5);

    // MS Pipe (item 2): still 0 delivered
    const item2 = poRes.body.items.find((i: any) => i.id === poItem2Id);
    expect(item2).toBeDefined();
    expect(Number(item2.deliveredQty)).toBe(0);
  });

  // ── Full (completing) delivery ───────────────────────────────────────────────

  it("creates a second GRN for remaining quantities (5 Steel Rods + 5 MS Pipes)", async () => {
    const res = await withAuth(api.post("/api/proc-grns")).send({
      userName: "GRN Test User",
      userId: 5,
      userRole: "admin",
      poId,
      warehouseId: 1,
      warehouseName: "Main Warehouse",
      deliveryDate: "2026-08-10",
      items: [
        {
          poItemId: poItem1Id,
          materialName: `Steel Rod ${RUN}`,
          uom: "Nos",
          // orderedQty reflects remaining balance (10 total - 5 already delivered)
          orderedQty: 5,
          receivedQty: 5,
          acceptedQty: 5,
          rejectedQty: 0,
          unitPrice: 300,
        },
        {
          poItemId: poItem2Id,
          materialName: `MS Pipe ${RUN}`,
          uom: "Nos",
          // orderedQty reflects remaining balance (5 total - 0 already delivered)
          orderedQty: 5,
          receivedQty: 5,
          acceptedQty: 5,
          rejectedQty: 0,
          unitPrice: 500,
        },
      ],
    });
    expect(res.status).toBe(201);
    grn2Id = res.body.id;
    expect(grn2Id).toBeDefined();
    expect(res.body.status).toBe("Draft");
    expect(res.body.totalAcceptedQty).toBe(10);
  });

  it("submits GRN 2 for inspection (Draft → Submitted)", async () => {
    const res = await withAuth(api.post(`/api/proc-grns/${grn2Id}/submit`)).send({
      userName: "GRN Test User",
      userId: 5,
      remarks: "Final delivery submitted for inspection",
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Submitted");
  });

  it("approving GRN 2 sets PO → FullyReceived with all deliveredQty matching ordered qty", async () => {
    const res = await withAuth(api.post(`/api/proc-grns/${grn2Id}/approve`)).send({
      userName: "GRN Test User",
      userId: 5,
      remarks: "Final delivery accepted — PO fully received",
    });
    expect(res.status).toBe(200);
    // orderedQty=5+5=10, acceptedQty=5+5=10 → fully accepted → Accepted
    expect(res.body.status).toBe("Accepted");

    // Verify PO state via the PO detail endpoint
    const poRes = await withAuth(api.get(`/api/procurement-pos/${poId}`));
    expect(poRes.status).toBe(200);

    // All PO line items fully delivered → FullyReceived
    expect(poRes.body.status).toBe("FullyReceived");

    // Steel Rod: cumulative 5 (GRN-1) + 5 (GRN-2) = 10, matches ordered qty 10
    const item1 = poRes.body.items.find((i: any) => i.id === poItem1Id);
    expect(item1).toBeDefined();
    expect(Number(item1.deliveredQty)).toBe(10);

    // MS Pipe: 5 (GRN-2), matches ordered qty 5
    const item2 = poRes.body.items.find((i: any) => i.id === poItem2Id);
    expect(item2).toBeDefined();
    expect(Number(item2.deliveredQty)).toBe(5);
  });

  // ── Guard: no new GRN against a FullyReceived PO ────────────────────────────

  it("rejects a new GRN against a FullyReceived PO", async () => {
    const res = await withAuth(api.post("/api/proc-grns")).send({
      userName: "GRN Test User",
      userId: 5,
      userRole: "admin",
      poId,
      warehouseId: 1,
      items: [
        {
          poItemId: poItem1Id,
          materialName: `Steel Rod ${RUN}`,
          uom: "Nos",
          orderedQty: 10,
          receivedQty: 1,
          acceptedQty: 1,
          rejectedQty: 0,
          unitPrice: 300,
        },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/FullyReceived|fully delivered/i);
  });
});
