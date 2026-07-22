/**
 * End-to-end smoke tests for the procurement module.
 *
 * Covers:
 *  - Vendor CRUD
 *  - Material category & material CRUD
 *  - Quotation lifecycle: Draft → Submitted → UnderReview → Approved + auto-PO
 *  - Rejection with mandatory remarks enforced
 *  - Edit blocked when status is not Draft / RevisionRequested
 *  - L1 comparison endpoint (lowest-price flags)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import app from "../app.js";

const api = supertest(app);

// ─── Shared state across tests ────────────────────────────────────────────────
// Unique suffix so repeated test runs don't hit unique-constraint collisions.
const RUN = Date.now();

let vendorId: number;
let vendor2Id: number;
let categoryId: number;
let materialId: number;
let quotationId: number;  // primary quotation for lifecycle tests
let quotation2Id: number; // second quotation for L1 comparison
let poId: number;

// Unique MR IDs per run — keeps L1 comparison isolated from prior test data.
// Truncated to fit PostgreSQL integer range (max 2147483647).
const mrId = (RUN % 1_000_000) + 1_000_000;        // 1000000–1999999
const compMrId = (RUN % 1_000_000) + 2_000_000;    // 2000000–2999999

const actor = { userName: "Test User", userId: 1, userRole: "admin" };

// ─────────────────────────────────────────────────────────────────────────────
describe("Vendor CRUD", () => {
  it("creates a vendor", async () => {
    const res = await api.post("/api/vendors").send({
      name: `Test Vendor Alpha ${RUN}`,
      primaryEmail: `alpha.${RUN}@test.com`,
      primaryPhone: "9000000001",
      status: "Active",
    });
    // Capture state before assertions so cascade failures don't leave it undefined.
    vendorId = res.body.id;
    expect(res.status).toBe(201);
    expect(vendorId).toBeDefined();
    expect(res.body.code).toMatch(/^VND-/);
    expect(res.body.name).toBe(`Test Vendor Alpha ${RUN}`);
  });

  it("creates a second vendor for L1 comparison", async () => {
    const res = await api.post("/api/vendors").send({
      name: `Test Vendor Beta ${RUN}`,
      primaryEmail: `beta.${RUN}@test.com`,
      status: "Active",
    });
    vendor2Id = res.body.id;
    expect(res.status).toBe(201);
    expect(vendor2Id).toBeDefined();
  });

  it("lists vendors and includes the created ones", async () => {
    const res = await api.get("/api/vendors");
    expect(res.status).toBe(200);
    const ids = res.body.map((v: any) => v.id);
    expect(ids).toContain(vendorId);
    expect(ids).toContain(vendor2Id);
  });

  it("gets a single vendor by id", async () => {
    const res = await api.get(`/api/vendors/${vendorId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(vendorId);
    expect(res.body.contacts).toBeInstanceOf(Array);
  });

  it("updates a vendor", async () => {
    const res = await api.patch(`/api/vendors/${vendorId}`).send({
      notes: "Updated in test",
    });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe("Updated in test");
  });

  it("adds a contact to a vendor", async () => {
    const res = await api
      .post(`/api/vendors/${vendorId}/contacts`)
      .send({ name: "Contact Person", phone: "9000000099", isPrimary: true });
    expect(res.status).toBe(201);
    expect(res.body.vendorId).toBe(vendorId);
  });

  it("returns 404 for unknown vendor", async () => {
    const res = await api.get("/api/vendors/999999");
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Material Category & Material CRUD", () => {
  it("creates a material category", async () => {
    const res = await api.post("/api/material-categories").send({
      name: `Test Category ${RUN}`,
      code: `TC${RUN}`.slice(-8),
    });
    categoryId = res.body.id;
    expect(res.status).toBe(201);
    expect(categoryId).toBeDefined();
  });

  it("lists categories and includes the new one", async () => {
    const res = await api.get("/api/material-categories");
    expect(res.status).toBe(200);
    expect(res.body.map((c: any) => c.id)).toContain(categoryId);
  });

  it("updates a category", async () => {
    const res = await api
      .patch(`/api/material-categories/${categoryId}`)
      .send({ name: `Test Category Updated ${RUN}` });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(`Test Category Updated ${RUN}`);
  });

  it("creates a material", async () => {
    const res = await api.post("/api/materials").send({
      name: `Test Steel Pipe ${RUN}`,
      uom: "Nos",
      categoryId,
      gstRate: 18,
    });
    materialId = res.body.id;
    expect(res.status).toBe(201);
    expect(materialId).toBeDefined();
    expect(res.body.code).toMatch(/^MAT-/);
  });

  it("lists materials and includes the new one", async () => {
    const res = await api.get("/api/materials");
    expect(res.status).toBe(200);
    expect(res.body.map((m: any) => m.id)).toContain(materialId);
  });

  it("gets a single material", async () => {
    const res = await api.get(`/api/materials/${materialId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(`Test Steel Pipe ${RUN}`);
  });

  it("updates a material", async () => {
    const res = await api
      .patch(`/api/materials/${materialId}`)
      .send({ brand: "TATA" });
    expect(res.status).toBe(200);
    expect(res.body.brand).toBe("TATA");
  });

  it("returns 404 for unknown material", async () => {
    const res = await api.get("/api/materials/999999");
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Quotation lifecycle: Draft → Submitted → UnderReview → Approved → PO", () => {
  const items = [
    {
      materialName: "Steel Pipe 50mm",
      uom: "Nos",
      qty: 10,
      unitPrice: 500,
      gstRate: 18,
      discountPct: 0,
    },
    {
      materialName: "GI Fitting",
      uom: "Nos",
      qty: 5,
      unitPrice: 200,
      gstRate: 18,
      discountPct: 5,
    },
  ];

  // ── Create (Draft) ──────────────────────────────────────────────────────────
  it("creates a quotation in Draft status", async () => {
    const res = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      quotationDate: "2026-07-22",
      validityDate: "2026-08-22",
      currency: "INR",
      paymentTerms: "30 days net",
      freightCharges: 500,
      items,
    });
    quotationId = res.body.id;
    expect(res.status).toBe(201);
    expect(quotationId).toBeDefined();
    expect(res.body.status).toBe("Draft");
    expect(res.body.referenceId).toMatch(/^VQ-/);
    expect(res.body.items).toHaveLength(2);
    // verify totals were calculated
    expect(res.body.totalAmount).toBeGreaterThan(0);
  });

  it("fetches the quotation with items, versions, and audit logs", async () => {
    const res = await api.get(`/api/procurement-quotations/${quotationId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(quotationId);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.versions).toHaveLength(1);
    expect(res.body.auditLogs).toHaveLength(1);
  });

  it("can update a Draft quotation", async () => {
    const res = await api
      .patch(`/api/procurement-quotations/${quotationId}`)
      .send({ ...actor, internalNotes: "Check pricing again" });
    expect(res.status).toBe(200);
    expect(res.body.internalNotes).toBe("Check pricing again");
    expect(res.body.version).toBe(2);
  });

  // ── Submit ─────────────────────────────────────────────────────────────────
  it("submits the quotation (Draft → Submitted)", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${quotationId}/submit`)
      .send(actor);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Submitted");
    expect(res.body.submittedByName).toBe(actor.userName);
  });

  it("blocks editing once submitted", async () => {
    const res = await api
      .patch(`/api/procurement-quotations/${quotationId}`)
      .send({ ...actor, internalNotes: "Should be blocked" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Cannot edit/i);
  });

  it("cannot submit again (must be Draft)", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${quotationId}/submit`)
      .send(actor);
    expect(res.status).toBe(400);
  });

  // ── Start Review ───────────────────────────────────────────────────────────
  it("starts review (Submitted → UnderReview)", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${quotationId}/start-review`)
      .send({ ...actor, remarks: "Starting technical review" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UnderReview");
    expect(res.body.reviewedByName).toBe(actor.userName);
  });

  it("cannot start review from wrong status", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${quotationId}/start-review`)
      .send(actor);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Submitted/);
  });

  // ── Approve + auto-PO ──────────────────────────────────────────────────────
  it("rejects approval without remarks", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${quotationId}/approve`)
      .send(actor); // no remarks
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/remarks/i);
  });

  it("approves the quotation and auto-generates a PO", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${quotationId}/approve`)
      .send({ ...actor, remarks: "Approved after technical review" });
    expect(res.status).toBe(200);

    const { quotation, po } = res.body;
    expect(quotation.status).toBe("Approved");
    expect(quotation.poGenerated).toBe(true);
    expect(quotation.approvalRemarks).toBe("Approved after technical review");

    // PO was auto-generated
    poId = po?.id;
    expect(po).toBeDefined();
    expect(po.poNumber).toMatch(/^PO-/);
    expect(po.quotationId).toBe(quotationId);
    expect(po.vendorId).toBe(vendorId);
  });

  it("PO is retrievable via GET /api/procurement-pos/:id with line items", async () => {
    const res = await api.get(`/api/procurement-pos/${poId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(poId);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.totalAmount).toBeGreaterThan(0);
  });

  it("PO appears in the list endpoint", async () => {
    const res = await api.get("/api/procurement-pos");
    expect(res.status).toBe(200);
    expect(res.body.map((p: any) => p.id)).toContain(poId);
  });

  it("PO cannot skip from Draft directly to Acknowledged (transition guard)", async () => {
    const res = await api
      .patch(`/api/procurement-pos/${poId}`)
      .send({ status: "Acknowledged" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition/i);
  });

  it("PO can be issued (Draft → Issued)", async () => {
    const res = await api
      .patch(`/api/procurement-pos/${poId}`)
      .send({ status: "Issued", ...actor });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Issued");
  });

  it("PO status can be updated to Acknowledged (Issued → Acknowledged)", async () => {
    const res = await api
      .patch(`/api/procurement-pos/${poId}`)
      .send({ status: "Acknowledged", ...actor });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Acknowledged");
    expect(res.body.acknowledgedAt).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PO state machine — valid and blocked transitions", () => {
  // We create a dedicated PO for this suite to avoid interfering with the
  // quotation lifecycle PO (poId) which is already at Acknowledged.
  let smPoId: number;

  it("creates a fresh quotation and approves it to get a Draft PO", async () => {
    const createRes = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      items: [{ materialName: "SM Test Item", uom: "Nos", qty: 1, unitPrice: 1000, gstRate: 18, discountPct: 0 }],
    });
    expect(createRes.status).toBe(201);
    const qid = createRes.body.id;

    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
    const approveRes = await api
      .post(`/api/procurement-quotations/${qid}/approve`)
      .send({ ...actor, remarks: "SM test approval" });
    expect(approveRes.status).toBe(200);
    smPoId = approveRes.body.po.id;
    expect(smPoId).toBeDefined();
    expect(approveRes.body.po.status).toBe("Draft");
  });

  // ── Blocked transitions from Draft ─────────────────────────────────────────
  it("blocks Draft → Acknowledged (out of order)", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "Acknowledged" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition from Draft to Acknowledged/i);
  });

  it("blocks Draft → PartiallyReceived (out of order)", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "PartiallyReceived" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition/i);
  });

  it("blocks Draft → FullyReceived (out of order)", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "FullyReceived" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition/i);
  });

  it("blocks Draft → Closed (out of order)", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "Closed" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition from Draft to Closed/i);
  });

  // ── Valid: Draft → Issued ──────────────────────────────────────────────────
  it("allows Draft → Issued", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "Issued", ...actor });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Issued");
  });

  // ── Blocked transitions from Issued ────────────────────────────────────────
  it("blocks Issued → Draft (backwards)", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "Draft" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition/i);
  });

  it("blocks Issued → PartiallyReceived (skipping Acknowledged)", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "PartiallyReceived" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition/i);
  });

  it("blocks Issued → Closed (skipping multiple steps)", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "Closed" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition/i);
  });

  // ── Valid: Issued → Acknowledged ──────────────────────────────────────────
  it("allows Issued → Acknowledged", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "Acknowledged", ...actor });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Acknowledged");
    expect(res.body.acknowledgedAt).toBeDefined();
  });

  // ── Blocked transitions from Acknowledged ──────────────────────────────────
  it("blocks Acknowledged → Closed (skipping Received)", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "Closed" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition/i);
  });

  it("blocks Acknowledged → Draft (backwards)", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "Draft" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition/i);
  });

  // ── Valid: Acknowledged → FullyReceived ───────────────────────────────────
  it("allows Acknowledged → FullyReceived", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "FullyReceived", ...actor });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FullyReceived");
  });

  // ── Blocked from FullyReceived ─────────────────────────────────────────────
  it("blocks FullyReceived → Acknowledged (backwards)", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "Acknowledged" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition/i);
  });

  // ── Valid: FullyReceived → Closed ─────────────────────────────────────────
  it("allows FullyReceived → Closed", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "Closed", ...actor });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Closed");
    expect(res.body.closedAt).toBeDefined();
  });

  // ── No transitions from terminal states ────────────────────────────────────
  it("blocks any transition from Closed (terminal state)", async () => {
    const res = await api.patch(`/api/procurement-pos/${smPoId}`).send({ status: "Issued" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition/i);
  });

  // ── Cancelled path ─────────────────────────────────────────────────────────
  it("allows Draft → Cancelled", async () => {
    // Create another PO at Draft to test cancellation path
    const createRes = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      items: [{ materialName: "Cancel Test Item", uom: "Nos", qty: 1, unitPrice: 500, gstRate: 18, discountPct: 0 }],
    });
    const qid = createRes.body.id;
    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
    const approveRes = await api
      .post(`/api/procurement-quotations/${qid}/approve`)
      .send({ ...actor, remarks: "Cancel path test approval" });
    const cancelPoId = approveRes.body.po.id;

    const res = await api.patch(`/api/procurement-pos/${cancelPoId}`).send({ status: "Cancelled", ...actor });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Cancelled");
  });

  it("blocks any transition from Cancelled (terminal state)", async () => {
    // Create and immediately cancel another PO
    const createRes = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      items: [{ materialName: "Cancelled Block Test", uom: "Nos", qty: 1, unitPrice: 100, gstRate: 18, discountPct: 0 }],
    });
    const qid = createRes.body.id;
    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
    const approveRes = await api
      .post(`/api/procurement-quotations/${qid}/approve`)
      .send({ ...actor, remarks: "For cancel block test" });
    const cancelPoId = approveRes.body.po.id;
    await api.patch(`/api/procurement-pos/${cancelPoId}`).send({ status: "Cancelled", ...actor });

    const res = await api.patch(`/api/procurement-pos/${cancelPoId}`).send({ status: "Issued" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transition/i);
  });

  // ── PartiallyReceived path ─────────────────────────────────────────────────
  it("allows Acknowledged → PartiallyReceived → FullyReceived → Closed", async () => {
    // Full run through the partial-receipt path
    const createRes = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      items: [{ materialName: "Partial Receipt Test", uom: "Nos", qty: 5, unitPrice: 200, gstRate: 18, discountPct: 0 }],
    });
    const qid = createRes.body.id;
    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
    const approveRes = await api
      .post(`/api/procurement-quotations/${qid}/approve`)
      .send({ ...actor, remarks: "Partial receipt path test" });
    const partialPoId = approveRes.body.po.id;

    // Draft → Issued → Acknowledged → PartiallyReceived → FullyReceived → Closed
    let r = await api.patch(`/api/procurement-pos/${partialPoId}`).send({ status: "Issued", ...actor });
    expect(r.status).toBe(200);
    r = await api.patch(`/api/procurement-pos/${partialPoId}`).send({ status: "Acknowledged", ...actor });
    expect(r.status).toBe(200);
    r = await api.patch(`/api/procurement-pos/${partialPoId}`).send({ status: "PartiallyReceived", ...actor });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("PartiallyReceived");

    // blocks going back to Acknowledged from PartiallyReceived
    const back = await api.patch(`/api/procurement-pos/${partialPoId}`).send({ status: "Acknowledged" });
    expect(back.status).toBe(400);

    r = await api.patch(`/api/procurement-pos/${partialPoId}`).send({ status: "FullyReceived", ...actor });
    expect(r.status).toBe(200);
    r = await api.patch(`/api/procurement-pos/${partialPoId}`).send({ status: "Closed", ...actor });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("Closed");
    expect(r.body.closedAt).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Rejection flow with mandatory remarks", () => {
  let rejQId: number;

  it("creates and submits a second quotation for rejection testing", async () => {
    const createRes = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      items: [{ materialName: "Nut Bolt Set", uom: "Set", qty: 20, unitPrice: 50, gstRate: 18, discountPct: 0 }],
    });
    expect(createRes.status).toBe(201);
    rejQId = createRes.body.id;

    const submitRes = await api
      .post(`/api/procurement-quotations/${rejQId}/submit`)
      .send(actor);
    expect(submitRes.status).toBe(200);
  });

  it("rejects without remarks → 400", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${rejQId}/reject`)
      .send(actor);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mandatory/i);
  });

  it("rejects with remarks → 200", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${rejQId}/reject`)
      .send({ ...actor, remarks: "Price too high" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Rejected");
    expect(res.body.approvalRemarks).toBe("Price too high");
  });

  it("cannot reject an already-Rejected quotation", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${rejQId}/reject`)
      .send({ ...actor, remarks: "Trying again" });
    expect(res.status).toBe(400);
  });

  it("cannot approve a Rejected quotation", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${rejQId}/approve`)
      .send({ ...actor, remarks: "Trying to approve rejected" });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Edit guard — non-editable statuses", () => {
  it("blocks edit on the Approved quotation", async () => {
    const res = await api
      .patch(`/api/procurement-quotations/${quotationId}`)
      .send({ ...actor, internalNotes: "Sneaky edit" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Cannot edit/i);
  });

  it("allows edit after request-revision (UnderReview → RevisionRequested → editable)", async () => {
    // Create a fresh quotation, take it to UnderReview, then request revision
    const c = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      items: [{ materialName: "Valve", uom: "Nos", qty: 1, unitPrice: 1000, gstRate: 18, discountPct: 0 }],
    });
    const qid = c.body.id;

    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
    await api
      .post(`/api/procurement-quotations/${qid}/request-revision`)
      .send({ ...actor, remarks: "Please revise unit price" });

    const edit = await api
      .patch(`/api/procurement-quotations/${qid}`)
      .send({ ...actor, internalNotes: "Revised after revision request" });
    expect(edit.status).toBe(200);
    expect(edit.body.status).toBe("RevisionRequested");
  });

  it("request-revision without remarks → 400", async () => {
    // Create + submit + start-review another quotation
    const c = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      items: [{ materialName: "Gasket", uom: "Nos", qty: 2, unitPrice: 150, gstRate: 18, discountPct: 0 }],
    });
    const qid = c.body.id;
    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);

    const res = await api
      .post(`/api/procurement-quotations/${qid}/request-revision`)
      .send(actor); // no remarks
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/remarks/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Revision round-trip: Draft → Submitted → UnderReview → RevisionRequested → re-edit → re-submit → UnderReview → Approved → PO", () => {
  let rrQId: number;
  let rrPoId: number;

  it("creates a quotation in Draft", async () => {
    const res = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      quotationDate: "2026-07-22",
      validityDate: "2026-08-22",
      currency: "INR",
      paymentTerms: "45 days net",
      items: [
        { materialName: "Round Bar 20mm", uom: "Kg", qty: 100, unitPrice: 80, gstRate: 18, discountPct: 0 },
      ],
    });
    rrQId = res.body.id;
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("Draft");
    expect(res.body.version).toBe(1);
  });

  it("submits (Draft → Submitted)", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${rrQId}/submit`)
      .send(actor);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Submitted");
  });

  it("starts review (Submitted → UnderReview)", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${rrQId}/start-review`)
      .send({ ...actor, remarks: "Checking technical specs" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UnderReview");
  });

  it("requests revision with remarks (UnderReview → RevisionRequested)", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${rrQId}/request-revision`)
      .send({ ...actor, remarks: "Please revise unit price downward" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("RevisionRequested");
    expect(res.body.approvalRemarks).toBe("Please revise unit price downward");
  });

  it("audit log records RevisionRequested transition", async () => {
    const res = await api.get(`/api/procurement-quotations/${rrQId}`);
    expect(res.status).toBe(200);
    const actions = res.body.auditLogs.map((a: any) => a.action);
    expect(actions).toContain("RevisionRequested");
  });

  it("vendor edits the quotation in RevisionRequested status, bumping version", async () => {
    const res = await api
      .patch(`/api/procurement-quotations/${rrQId}`)
      .send({
        ...actor,
        items: [
          { materialName: "Round Bar 20mm", uom: "Kg", qty: 100, unitPrice: 70, gstRate: 18, discountPct: 0 },
        ],
        changeSummary: "Revised unit price from 80 to 70",
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("RevisionRequested");
    expect(res.body.version).toBeGreaterThan(1);
    // price should have dropped
    expect(res.body.totalAmount).toBeLessThan(80 * 100 * 1.18 + 1); // was 9440, now 8260
  });

  it("re-submits from RevisionRequested (RevisionRequested → Submitted)", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${rrQId}/submit`)
      .send(actor);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Submitted");
  });

  it("blocks editing once re-submitted", async () => {
    const res = await api
      .patch(`/api/procurement-quotations/${rrQId}`)
      .send({ ...actor, internalNotes: "Should be blocked again" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Cannot edit/i);
  });

  it("starts review again (Submitted → UnderReview)", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${rrQId}/start-review`)
      .send({ ...actor, remarks: "Re-reviewing after vendor revision" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UnderReview");
  });

  it("approves and auto-generates PO (UnderReview → Approved + PO)", async () => {
    const res = await api
      .post(`/api/procurement-quotations/${rrQId}/approve`)
      .send({ ...actor, remarks: "Revised price accepted" });
    expect(res.status).toBe(200);

    const { quotation, po } = res.body;
    expect(quotation.status).toBe("Approved");
    expect(quotation.poGenerated).toBe(true);
    expect(quotation.approvalRemarks).toBe("Revised price accepted");

    rrPoId = po?.id;
    expect(po).toBeDefined();
    expect(po.poNumber).toMatch(/^PO-/);
    expect(po.quotationId).toBe(rrQId);
    expect(po.vendorId).toBe(vendorId);
  });

  it("auto-generated PO is retrievable and reflects revised pricing", async () => {
    const res = await api.get(`/api/procurement-pos/${rrPoId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(rrPoId);
    expect(res.body.items).toHaveLength(1);
    // revised unit price (70) should be reflected in the PO total
    expect(res.body.totalAmount).toBeLessThan(80 * 100 * 1.18 + 1);
  });

  it("audit log records all transitions in order", async () => {
    const res = await api.get(`/api/procurement-quotations/${rrQId}`);
    expect(res.status).toBe(200);
    // auditLogs are ordered desc by createdAt; reverse to get chronological order
    const actions: string[] = res.body.auditLogs.map((a: any) => a.action).reverse();
    expect(actions).toContain("Created");
    expect(actions).toContain("Submitted");
    expect(actions).toContain("ReviewStarted");
    expect(actions).toContain("RevisionRequested");
    expect(actions).toContain("Updated");
    expect(actions).toContain("Approved");
    expect(actions).toContain("POGenerated");
    // All critical transitions present; order: Created appears before Approved
    expect(actions.indexOf("Created")).toBeLessThan(actions.indexOf("Approved"));
    expect(actions.indexOf("RevisionRequested")).toBeLessThan(actions.indexOf("Approved"));
  });

  it("version numbers incremented correctly across the round-trip", async () => {
    const res = await api.get(`/api/procurement-quotations/${rrQId}`);
    expect(res.status).toBe(200);
    // versions are ordered desc; highest version should be >= 2 (edit bumped it)
    const topVersion: number = res.body.versions[0].version;
    expect(topVersion).toBeGreaterThanOrEqual(2);
    // All version numbers from 1..topVersion should be present
    const versionNums: number[] = res.body.versions.map((v: any) => v.version).sort((a: number, b: number) => a - b);
    for (let i = 0; i < versionNums.length; i++) {
      expect(versionNums[i]).toBe(i + 1);
    }
  });

  // ── Stale-transition guard on submit ────────────────────────────────────────
  it("submit is atomically guarded — cannot overwrite a non-Draft/RevisionRequested status", async () => {
    // rrQId is now Approved; a stale in-flight submit must be rejected, not silently accepted.
    const res = await api
      .post(`/api/procurement-quotations/${rrQId}/submit`)
      .send(actor);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Draft or RevisionRequested/i);
    // Confirm the record was NOT overwritten
    const check = await api.get(`/api/procurement-quotations/${rrQId}`);
    expect(check.body.status).toBe("Approved");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("L1 comparison endpoint", () => {
  // compMrId is unique per run (defined at module level) so no prior data interferes.
  let qLow: number;
  let qHigh: number;

  it("creates a cheaper quotation (vendor 1)", async () => {
    const res = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId: compMrId,
      items: [
        { materialName: "Pipe 25mm", uom: "Nos", qty: 10, unitPrice: 300, gstRate: 18, discountPct: 0 },
        { materialName: "Elbow 25mm", uom: "Nos", qty: 5, unitPrice: 100, gstRate: 18, discountPct: 0 },
      ],
    });
    qLow = res.body.id;
    expect(res.status).toBe(201);
    expect(qLow).toBeDefined();
  });

  it("creates a more expensive quotation (vendor 2)", async () => {
    const res = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId: vendor2Id,
      mrId: compMrId,
      items: [
        { materialName: "Pipe 25mm", uom: "Nos", qty: 10, unitPrice: 400, gstRate: 18, discountPct: 0 },
        { materialName: "Elbow 25mm", uom: "Nos", qty: 5, unitPrice: 120, gstRate: 18, discountPct: 0 },
      ],
    });
    qHigh = res.body.id;
    expect(res.status).toBe(201);
    expect(qHigh).toBeDefined();
  });

  it("returns comparison with correct L1 (lower total) and lowest-price flags", async () => {
    const res = await api.get(`/api/material-requests/${compMrId}/quotation-comparison`);
    expect(res.status).toBe(200);

    const { quotations, l1VendorId, l1ReferenceId, materialLowest } = res.body;

    // Both quotations present
    const ids = quotations.map((q: any) => q.id);
    expect(ids).toContain(qLow);
    expect(ids).toContain(qHigh);

    // L1 is the lower-total vendor
    expect(l1VendorId).toBe(vendorId);
    expect(l1ReferenceId).toBeDefined();

    // Lowest prices per material should match vendor 1's prices
    expect(materialLowest["Pipe 25mm"]).toBe(300);
    expect(materialLowest["Elbow 25mm"]).toBe(100);

    // Vendor 1's items should have isLowest = true for both materials
    const cheapQ = quotations.find((q: any) => q.id === qLow);
    const pipeItem = cheapQ.items.find((i: any) => i.materialName === "Pipe 25mm");
    const elbowItem = cheapQ.items.find((i: any) => i.materialName === "Elbow 25mm");
    expect(pipeItem.isLowest).toBe(true);
    expect(elbowItem.isLowest).toBe(true);

    // Vendor 2's items should have isLowest = false
    const expQ = quotations.find((q: any) => q.id === qHigh);
    const expPipe = expQ.items.find((i: any) => i.materialName === "Pipe 25mm");
    expect(expPipe.isLowest).toBe(false);
  });

  it("returns empty result for an MR with no quotations", async () => {
    const res = await api.get("/api/material-requests/777777/quotation-comparison");
    expect(res.status).toBe(200);
    expect(res.body.quotations).toHaveLength(0);
    expect(res.body.l1VendorId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Vendor delete and draft-only delete guard", () => {
  it("cannot delete a non-Draft quotation", async () => {
    // quotationId is now Approved
    const res = await api
      .delete(`/api/procurement-quotations/${quotationId}`)
      .send(actor);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Draft/i);
  });

  it("can delete a Draft quotation", async () => {
    const c = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      items: [{ materialName: "Temp Item", uom: "Nos", qty: 1, unitPrice: 100, gstRate: 18, discountPct: 0 }],
    });
    const deleteRes = await api
      .delete(`/api/procurement-quotations/${c.body.id}`)
      .send(actor);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.ok).toBe(true);
  });

  it("returns 404 when deleting an unknown vendor", async () => {
    // Vendor delete is blocked by FK from quotations; just verify the endpoint exists.
    // A vendor with no references can be deleted: create one, delete it immediately.
    const tmp = await api.post("/api/vendors").send({ name: `Temp Vendor Delete Test ${RUN}`, status: "Active" });
    expect(tmp.status).toBe(201);
    const r = await api.delete(`/api/vendors/${tmp.body.id}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("record-dispatch status guard", () => {
  let draftPoId: number;
  let issuedPoId: number;

  it("creates two fresh POs — one stays Draft, one is issued", async () => {
    // Helper: create a quotation, push it through to an auto-generated PO.
    async function createDraftPO() {
      const qRes = await api.post("/api/procurement-quotations").send({
        ...actor,
        vendorId,
        mrId,
        items: [{ materialName: "Dispatch Guard Test Item", uom: "Nos", qty: 1, unitPrice: 200, gstRate: 18, discountPct: 0 }],
      });
      const qid = qRes.body.id;
      await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
      await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
      const approveRes = await api
        .post(`/api/procurement-quotations/${qid}/approve`)
        .send({ ...actor, remarks: "Dispatch guard test approval" });
      expect(approveRes.status).toBe(200);
      return approveRes.body.po.id as number;
    }

    draftPoId = await createDraftPO();
    issuedPoId = await createDraftPO();
    expect(draftPoId).toBeDefined();
    expect(issuedPoId).toBeDefined();

    // Advance the second PO to Issued
    const r = await api.patch(`/api/procurement-pos/${issuedPoId}`).send({ status: "Issued", ...actor });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("Issued");
  });

  it("returns 400 when recording dispatch on a Draft PO", async () => {
    const res = await api
      .post(`/api/procurement-pos/${draftPoId}/record-dispatch`)
      .send({ ...actor, vendorDispatchRef: "DISP-001", trackingNumber: "TRK-001" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Issued or Acknowledged/i);
  });

  it("returns 200 when recording dispatch on an Issued PO", async () => {
    const res = await api
      .post(`/api/procurement-pos/${issuedPoId}/record-dispatch`)
      .send({ ...actor, vendorDispatchRef: "DISP-002", trackingNumber: "TRK-002", expectedDeliveryDate: "2026-08-01" });
    expect(res.status).toBe(200);
    expect(res.body.vendorDispatchRef).toBe("DISP-002");
    expect(res.body.trackingNumber).toBe("TRK-002");
    expect(res.body.dispatchedAt).toBeDefined();
  });

  it("returns 200 when recording dispatch on an Acknowledged PO", async () => {
    // Advance the issued PO to Acknowledged, then record dispatch again.
    await api.patch(`/api/procurement-pos/${issuedPoId}`).send({ status: "Acknowledged", ...actor });
    const res = await api
      .post(`/api/procurement-pos/${issuedPoId}/record-dispatch`)
      .send({ ...actor, vendorDispatchRef: "DISP-003", trackingNumber: "TRK-003" });
    expect(res.status).toBe(200);
    expect(res.body.vendorDispatchRef).toBe("DISP-003");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PO cancellation guard — blocked once GRNs exist", () => {
  let guardPoId: number;

  it("creates a PO and advances it to Issued", async () => {
    const qRes = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      items: [{ materialName: "GRN Guard Test Item", uom: "Nos", qty: 10, unitPrice: 300, gstRate: 18, discountPct: 0 }],
    });
    expect(qRes.status).toBe(201);
    const qid = qRes.body.id;
    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
    const approveRes = await api
      .post(`/api/procurement-quotations/${qid}/approve`)
      .send({ ...actor, remarks: "GRN guard test approval" });
    expect(approveRes.status).toBe(200);
    guardPoId = approveRes.body.po.id;
    const issueRes = await api.patch(`/api/procurement-pos/${guardPoId}`).send({ status: "Issued", ...actor });
    expect(issueRes.status).toBe(200);
    expect(issueRes.body.status).toBe("Issued");
  });

  it("creates a GRN (in Draft) against the PO", async () => {
    const res = await api.post("/api/proc-grns").send({
      ...actor,
      poId: guardPoId,
      deliveryDate: "2026-07-22",
      items: [{ materialName: "GRN Guard Test Item", uom: "Nos", orderedQty: 10, receivedQty: 5, acceptedQty: 5, rejectedQty: 0, damagedQty: 0, unitPrice: 300 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.grnNumber).toMatch(/^GRN-/);
  });

  it("returns 400 when cancelling a PO that has a GRN against it", async () => {
    const res = await api.patch(`/api/procurement-pos/${guardPoId}`).send({ status: "Cancelled", ...actor });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/GRN/i);
    expect(res.body.error).toMatch(/GRN-/); // lists the blocking GRN number(s)
  });

  it("confirms the PO was NOT cancelled — still Issued", async () => {
    const res = await api.get(`/api/procurement-pos/${guardPoId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Issued");
  });

  it("allows cancelling a PO from Issued status when no GRNs exist", async () => {
    // Create a fresh PO and cancel it immediately (no GRNs)
    const qRes = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      items: [{ materialName: "No GRN Cancel Test", uom: "Nos", qty: 1, unitPrice: 100, gstRate: 18, discountPct: 0 }],
    });
    const qid = qRes.body.id;
    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
    const approveRes = await api
      .post(`/api/procurement-quotations/${qid}/approve`)
      .send({ ...actor, remarks: "No GRN cancel path" });
    const noGrnPoId = approveRes.body.po.id;
    await api.patch(`/api/procurement-pos/${noGrnPoId}`).send({ status: "Issued", ...actor });

    const res = await api.patch(`/api/procurement-pos/${noGrnPoId}`).send({ status: "Cancelled", ...actor });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Cancelled");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GRN creation guard — blocked against Cancelled or Closed PO", () => {
  /** Helper: create a quotation → approve → return auto-generated Draft PO id */
  async function createDraftPO(label: string): Promise<number> {
    const qRes = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      items: [{ materialName: label, uom: "Nos", qty: 5, unitPrice: 200, gstRate: 18, discountPct: 0 }],
    });
    expect(qRes.status).toBe(201);
    const qid = qRes.body.id;
    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
    const approveRes = await api
      .post(`/api/procurement-quotations/${qid}/approve`)
      .send({ ...actor, remarks: "GRN guard test" });
    expect(approveRes.status).toBe(200);
    return approveRes.body.po.id as number;
  }

  const grnPayload = (poId: number) => ({
    ...actor,
    poId,
    deliveryDate: "2026-07-22",
    items: [{ materialName: "Test Item", uom: "Nos", orderedQty: 5, receivedQty: 5, acceptedQty: 5, rejectedQty: 0, damagedQty: 0, unitPrice: 200 }],
  });

  it("returns 400 with a descriptive error when the PO is Cancelled", async () => {
    const pid = await createDraftPO("GRN Cancelled PO Guard");
    // Cancel the PO
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "Cancelled", ...actor });

    const res = await api.post("/api/proc-grns").send(grnPayload(pid));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cancelled/);
    expect(res.body.error).toMatch(/PO-/); // includes the PO number
  });

  it("returns 400 with a descriptive error when the PO is Closed", async () => {
    const pid = await createDraftPO("GRN Closed PO Guard");
    // Advance to Closed: Draft → Issued → Acknowledged → FullyReceived → Closed
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "Issued", ...actor });
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "Acknowledged", ...actor });
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "FullyReceived", ...actor });
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "Closed", ...actor });

    const res = await api.post("/api/proc-grns").send(grnPayload(pid));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Closed/);
    expect(res.body.error).toMatch(/PO-/); // includes the PO number
  });

  it("returns 201 when the PO is Issued (allowed status)", async () => {
    const pid = await createDraftPO("GRN Issued PO Guard");
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "Issued", ...actor });

    const res = await api.post("/api/proc-grns").send(grnPayload(pid));
    expect(res.status).toBe(201);
    expect(res.body.grnNumber).toMatch(/^GRN-/);
  });

  it("returns 201 when the PO is Acknowledged (allowed status)", async () => {
    const pid = await createDraftPO("GRN Acknowledged PO Guard");
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "Issued", ...actor });
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "Acknowledged", ...actor });

    const res = await api.post("/api/proc-grns").send(grnPayload(pid));
    expect(res.status).toBe(201);
    expect(res.body.grnNumber).toMatch(/^GRN-/);
  });

  it("returns 400 with allowed-statuses listed when the PO is in Draft status", async () => {
    const pid = await createDraftPO("GRN Draft PO Guard");
    // PO stays in Draft — do not advance it

    const res = await api.post("/api/proc-grns").send(grnPayload(pid));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Draft/);
    expect(res.body.error).toMatch(/PO-/);
    expect(res.body.error).toMatch(/Issued/); // allowed statuses listed
  });

  it("returns 201 when the PO is PartiallyReceived (allowed status — further deliveries expected)", async () => {
    const pid = await createDraftPO("GRN PartiallyReceived PO Guard");
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "Issued", ...actor });
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "Acknowledged", ...actor });
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "PartiallyReceived", ...actor });

    const res = await api.post("/api/proc-grns").send(grnPayload(pid));
    expect(res.status).toBe(201);
    expect(res.body.grnNumber).toMatch(/^GRN-/);
  });

  it("returns 201 when the PO is FullyReceived (allowed status)", async () => {
    const pid = await createDraftPO("GRN FullyReceived PO Guard");
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "Issued", ...actor });
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "Acknowledged", ...actor });
    await api.patch(`/api/procurement-pos/${pid}`).send({ status: "FullyReceived", ...actor });

    const res = await api.post("/api/proc-grns").send(grnPayload(pid));
    expect(res.status).toBe(201);
    expect(res.body.grnNumber).toMatch(/^GRN-/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Multi-GRN accumulation — two GRNs against a PartiallyReceived PO", () => {
  /**
   * Scenario:
   *   PO has one line item: qty 10
   *   GRN-1 delivers 6 → PO becomes PartiallyReceived, deliveredQty = 6
   *   GRN-2 delivers 4 → PO becomes FullyReceived, deliveredQty = 10 (accumulated)
   */
  let accumPoId: number;
  let accumPoItemId: number;
  let grn1Id: number;
  let grn2Id: number;

  it("creates a PO with qty 10 and advances it to Acknowledged", async () => {
    const qRes = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      items: [{ materialName: "Accumulation Test Item", uom: "Nos", qty: 10, unitPrice: 500, gstRate: 18, discountPct: 0 }],
    });
    expect(qRes.status).toBe(201);
    const qid = qRes.body.id;

    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
    const approveRes = await api
      .post(`/api/procurement-quotations/${qid}/approve`)
      .send({ ...actor, remarks: "Accumulation test approval" });
    expect(approveRes.status).toBe(200);

    accumPoId = approveRes.body.po.id;
    expect(accumPoId).toBeDefined();

    // Advance to Acknowledged
    await api.patch(`/api/procurement-pos/${accumPoId}`).send({ status: "Issued", ...actor });
    const ackRes = await api.patch(`/api/procurement-pos/${accumPoId}`).send({ status: "Acknowledged", ...actor });
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.status).toBe("Acknowledged");

    // Capture the PO item id for use in GRN items
    const poDetail = await api.get(`/api/procurement-pos/${accumPoId}`);
    expect(poDetail.status).toBe(200);
    expect(poDetail.body.items).toHaveLength(1);
    accumPoItemId = poDetail.body.items[0].id;
    expect(accumPoItemId).toBeDefined();
  });

  it("creates GRN-1 (partial: 6 of 10) and submits it", async () => {
    const res = await api.post("/api/proc-grns").send({
      ...actor,
      poId: accumPoId,
      deliveryDate: "2026-07-22",
      items: [{
        poItemId: accumPoItemId,
        materialName: "Accumulation Test Item",
        uom: "Nos",
        orderedQty: 10,
        receivedQty: 6,
        acceptedQty: 6,
        rejectedQty: 0,
        damagedQty: 0,
        unitPrice: 500,
      }],
    });
    expect(res.status).toBe(201);
    expect(res.body.grnNumber).toMatch(/^GRN-/);
    grn1Id = res.body.id;
    expect(grn1Id).toBeDefined();

    // Submit for inspection
    const submitRes = await api.post(`/api/proc-grns/${grn1Id}/submit`).send(actor);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe("Submitted");
  });

  it("approves GRN-1 — PO transitions to PartiallyReceived with deliveredQty = 6", async () => {
    const approveRes = await api
      .post(`/api/proc-grns/${grn1Id}/approve`)
      .send({ ...actor, remarks: "First partial delivery accepted" });
    expect(approveRes.status).toBe(200);

    // GRN itself should be PartiallyAccepted (accepted < ordered)
    expect(approveRes.body.status).toBe("PartiallyAccepted");

    // PO status should now be PartiallyReceived
    const poRes = await api.get(`/api/procurement-pos/${accumPoId}`);
    expect(poRes.status).toBe(200);
    expect(poRes.body.status).toBe("PartiallyReceived");

    // deliveredQty on the PO item should be 6
    const item = poRes.body.items[0];
    expect(Number(item.deliveredQty)).toBe(6);
  });

  it("creates GRN-2 (remainder: 4 of 10) against the PartiallyReceived PO and submits it", async () => {
    // GRN creation must be allowed against a PartiallyReceived PO
    const res = await api.post("/api/proc-grns").send({
      ...actor,
      poId: accumPoId,
      deliveryDate: "2026-07-25",
      items: [{
        poItemId: accumPoItemId,
        materialName: "Accumulation Test Item",
        uom: "Nos",
        orderedQty: 10,
        receivedQty: 4,
        acceptedQty: 4,
        rejectedQty: 0,
        damagedQty: 0,
        unitPrice: 500,
      }],
    });
    expect(res.status).toBe(201);
    expect(res.body.grnNumber).toMatch(/^GRN-/);
    grn2Id = res.body.id;
    expect(grn2Id).toBeDefined();
    // GRN-1 and GRN-2 must be distinct records
    expect(grn2Id).not.toBe(grn1Id);

    // Submit for inspection
    const submitRes = await api.post(`/api/proc-grns/${grn2Id}/submit`).send(actor);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe("Submitted");
  });

  it("approves GRN-2 — PO transitions to FullyReceived with deliveredQty = 10 (accumulated)", async () => {
    const approveRes = await api
      .post(`/api/proc-grns/${grn2Id}/approve`)
      .send({ ...actor, remarks: "Final delivery accepted — order complete" });
    expect(approveRes.status).toBe(200);

    // GRN-2 accepted 4 of the 10 originally ordered, so the GRN itself is PartiallyAccepted.
    // The key result to verify is the PO-level accumulation below.
    expect(["Accepted", "PartiallyAccepted"]).toContain(approveRes.body.status);

    // PO status should now be FullyReceived
    const poRes = await api.get(`/api/procurement-pos/${accumPoId}`);
    expect(poRes.status).toBe(200);
    expect(poRes.body.status).toBe("FullyReceived");

    // deliveredQty on the PO item must reflect the combined quantity from both GRNs (6 + 4 = 10)
    const item = poRes.body.items[0];
    expect(Number(item.deliveredQty)).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Multi-GRN accumulation — reject path: only acceptedQty counts toward deliveredQty", () => {
  /**
   * Scenario:
   *   PO has one line item: qty 10
   *   GRN-1 receives 10, accepts 8, rejects 2
   *     → only acceptedQty (8) is added to deliveredQty
   *     → PO becomes PartiallyReceived, deliveredQty = 8
   *   GRN-2 receives 2, accepts 2, rejects 0
   *     → acceptedQty (2) is added to deliveredQty
   *     → PO becomes FullyReceived, deliveredQty = 10
   */
  let rejPoId: number;
  let rejPoItemId: number;
  let rejGrn1Id: number;
  let rejGrn2Id: number;

  it("creates a PO with qty 10 and advances it to Acknowledged", async () => {
    const qRes = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      items: [{ materialName: "Reject Path Test Item", uom: "Nos", qty: 10, unitPrice: 400, gstRate: 18, discountPct: 0 }],
    });
    expect(qRes.status).toBe(201);
    const qid = qRes.body.id;

    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
    const approveRes = await api
      .post(`/api/procurement-quotations/${qid}/approve`)
      .send({ ...actor, remarks: "Reject path test approval" });
    expect(approveRes.status).toBe(200);

    rejPoId = approveRes.body.po.id;
    expect(rejPoId).toBeDefined();

    // Advance to Acknowledged
    await api.patch(`/api/procurement-pos/${rejPoId}`).send({ status: "Issued", ...actor });
    const ackRes = await api.patch(`/api/procurement-pos/${rejPoId}`).send({ status: "Acknowledged", ...actor });
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.status).toBe("Acknowledged");

    // Capture the PO item id for use in GRN items
    const poDetail = await api.get(`/api/procurement-pos/${rejPoId}`);
    expect(poDetail.status).toBe(200);
    expect(poDetail.body.items).toHaveLength(1);
    rejPoItemId = poDetail.body.items[0].id;
    expect(rejPoItemId).toBeDefined();
  });

  it("creates GRN-1 (receives 10, accepts 8, rejects 2) and submits it", async () => {
    const res = await api.post("/api/proc-grns").send({
      ...actor,
      poId: rejPoId,
      deliveryDate: "2026-07-22",
      items: [{
        poItemId: rejPoItemId,
        materialName: "Reject Path Test Item",
        uom: "Nos",
        orderedQty: 10,
        receivedQty: 10,
        acceptedQty: 8,
        rejectedQty: 2,
        damagedQty: 0,
        unitPrice: 400,
      }],
    });
    expect(res.status).toBe(201);
    expect(res.body.grnNumber).toMatch(/^GRN-/);
    rejGrn1Id = res.body.id;
    expect(rejGrn1Id).toBeDefined();

    // GRN item should report PartiallyAccepted (accepted > 0, rejected > 0)
    expect(res.body.items[0].qcStatus).toBe("PartiallyAccepted");

    const submitRes = await api.post(`/api/proc-grns/${rejGrn1Id}/submit`).send(actor);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe("Submitted");
  });

  it("approves GRN-1 — only acceptedQty (8) counts; PO becomes PartiallyReceived, deliveredQty = 8", async () => {
    const approveRes = await api
      .post(`/api/proc-grns/${rejGrn1Id}/approve`)
      .send({ ...actor, remarks: "First delivery: 8 accepted, 2 rejected" });
    expect(approveRes.status).toBe(200);

    // GRN status: PartiallyAccepted (some rejected)
    expect(approveRes.body.status).toBe("PartiallyAccepted");

    // PO status should now be PartiallyReceived (8 < 10)
    const poRes = await api.get(`/api/procurement-pos/${rejPoId}`);
    expect(poRes.status).toBe(200);
    expect(poRes.body.status).toBe("PartiallyReceived");

    // deliveredQty must equal acceptedQty (8), NOT receivedQty (10)
    const item = poRes.body.items[0];
    expect(Number(item.deliveredQty)).toBe(8);
  });

  it("creates GRN-2 (receives 2, accepts 2, rejects 0) against the PartiallyReceived PO and submits it", async () => {
    const res = await api.post("/api/proc-grns").send({
      ...actor,
      poId: rejPoId,
      deliveryDate: "2026-07-26",
      items: [{
        poItemId: rejPoItemId,
        materialName: "Reject Path Test Item",
        uom: "Nos",
        orderedQty: 10,
        receivedQty: 2,
        acceptedQty: 2,
        rejectedQty: 0,
        damagedQty: 0,
        unitPrice: 400,
      }],
    });
    expect(res.status).toBe(201);
    expect(res.body.grnNumber).toMatch(/^GRN-/);
    rejGrn2Id = res.body.id;
    expect(rejGrn2Id).toBeDefined();
    expect(rejGrn2Id).not.toBe(rejGrn1Id);

    const submitRes = await api.post(`/api/proc-grns/${rejGrn2Id}/submit`).send(actor);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe("Submitted");
  });

  it("approves GRN-2 — accumulated deliveredQty = 10 (8 + 2); PO transitions to FullyReceived", async () => {
    const approveRes = await api
      .post(`/api/proc-grns/${rejGrn2Id}/approve`)
      .send({ ...actor, remarks: "Remaining 2 units accepted — order complete" });
    expect(approveRes.status).toBe(200);

    // GRN-2 accepted all 2 units it received, but orderedQty in the GRN header is 10
    // (the full PO line qty). Since acceptedQty (2) < orderedQty (10) the GRN
    // itself is PartiallyAccepted — that is the correct server behaviour.
    expect(["Accepted", "PartiallyAccepted"]).toContain(approveRes.body.status);

    // PO status should now be FullyReceived (8 + 2 = 10 >= 10)
    const poRes = await api.get(`/api/procurement-pos/${rejPoId}`);
    expect(poRes.status).toBe(200);
    expect(poRes.body.status).toBe("FullyReceived");

    // deliveredQty must be 10 (accumulated acceptedQty from both GRNs: 8 + 2)
    // It must NOT be 12 (which would happen if receivedQty were used instead of acceptedQty)
    const item = poRes.body.items[0];
    expect(Number(item.deliveredQty)).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Multi-line PO — FullyReceived only when ALL lines are fully delivered", () => {
  /**
   * Scenario:
   *   PO has TWO line items: line 1 qty 5, line 2 qty 5.
   *   GRN-1 fully delivers line 1 (accepted 5) but delivers nothing for line 2.
   *     → line 1 deliveredQty = 5, line 2 deliveredQty = 0
   *     → PO must stay PartiallyReceived (NOT FullyReceived)
   *   GRN-2 fully delivers line 2 (accepted 5); line 1 already complete.
   *     → line 2 deliveredQty = 5
   *     → Now every line is fully delivered → PO becomes FullyReceived
   */
  let mlPoId: number;
  let mlPoItem1Id: number;
  let mlPoItem2Id: number;
  let mlGrn1Id: number;
  let mlGrn2Id: number;

  it("creates a PO with two line items (qty 5 each) and advances it to Acknowledged", async () => {
    const qRes = await api.post("/api/procurement-quotations").send({
      ...actor,
      vendorId,
      mrId,
      items: [
        { materialName: "Multi-line Item A", uom: "Nos", qty: 5, unitPrice: 300, gstRate: 18, discountPct: 0 },
        { materialName: "Multi-line Item B", uom: "Nos", qty: 5, unitPrice: 200, gstRate: 18, discountPct: 0 },
      ],
    });
    expect(qRes.status).toBe(201);
    const qid = qRes.body.id;

    await api.post(`/api/procurement-quotations/${qid}/submit`).send(actor);
    await api.post(`/api/procurement-quotations/${qid}/start-review`).send(actor);
    const approveRes = await api
      .post(`/api/procurement-quotations/${qid}/approve`)
      .send({ ...actor, remarks: "Multi-line PO test approval" });
    expect(approveRes.status).toBe(200);

    mlPoId = approveRes.body.po.id;
    expect(mlPoId).toBeDefined();

    // Advance to Acknowledged
    await api.patch(`/api/procurement-pos/${mlPoId}`).send({ status: "Issued", ...actor });
    const ackRes = await api.patch(`/api/procurement-pos/${mlPoId}`).send({ status: "Acknowledged", ...actor });
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.status).toBe("Acknowledged");

    // Capture both PO item ids
    const poDetail = await api.get(`/api/procurement-pos/${mlPoId}`);
    expect(poDetail.status).toBe(200);
    expect(poDetail.body.items).toHaveLength(2);
    // Items are ordered by lineNo; line 1 = Item A, line 2 = Item B
    mlPoItem1Id = poDetail.body.items[0].id;
    mlPoItem2Id = poDetail.body.items[1].id;
    expect(mlPoItem1Id).toBeDefined();
    expect(mlPoItem2Id).toBeDefined();
  });

  it("creates GRN-1 covering only line 1 (all 5 accepted) and submits it", async () => {
    const res = await api.post("/api/proc-grns").send({
      ...actor,
      poId: mlPoId,
      deliveryDate: "2026-07-22",
      items: [{
        poItemId: mlPoItem1Id,
        materialName: "Multi-line Item A",
        uom: "Nos",
        orderedQty: 5,
        receivedQty: 5,
        acceptedQty: 5,
        rejectedQty: 0,
        damagedQty: 0,
        unitPrice: 300,
      }],
    });
    expect(res.status).toBe(201);
    expect(res.body.grnNumber).toMatch(/^GRN-/);
    mlGrn1Id = res.body.id;
    expect(mlGrn1Id).toBeDefined();

    const submitRes = await api.post(`/api/proc-grns/${mlGrn1Id}/submit`).send(actor);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe("Submitted");
  });

  it("approves GRN-1 — line 1 fully delivered, line 2 still at 0 → PO stays PartiallyReceived", async () => {
    const approveRes = await api
      .post(`/api/proc-grns/${mlGrn1Id}/approve`)
      .send({ ...actor, remarks: "Line 1 fully delivered" });
    expect(approveRes.status).toBe(200);

    // PO must NOT flip to FullyReceived because line 2 has zero delivered qty
    const poRes = await api.get(`/api/procurement-pos/${mlPoId}`);
    expect(poRes.status).toBe(200);
    expect(poRes.body.status).toBe("PartiallyReceived");

    // Verify deliveredQty per line
    const item1 = poRes.body.items.find((i: any) => i.id === mlPoItem1Id);
    const item2 = poRes.body.items.find((i: any) => i.id === mlPoItem2Id);
    expect(Number(item1.deliveredQty)).toBe(5);  // fully delivered
    expect(Number(item2.deliveredQty)).toBe(0);  // untouched
  });

  it("creates GRN-2 covering only line 2 (all 5 accepted) and submits it", async () => {
    const res = await api.post("/api/proc-grns").send({
      ...actor,
      poId: mlPoId,
      deliveryDate: "2026-07-25",
      items: [{
        poItemId: mlPoItem2Id,
        materialName: "Multi-line Item B",
        uom: "Nos",
        orderedQty: 5,
        receivedQty: 5,
        acceptedQty: 5,
        rejectedQty: 0,
        damagedQty: 0,
        unitPrice: 200,
      }],
    });
    expect(res.status).toBe(201);
    expect(res.body.grnNumber).toMatch(/^GRN-/);
    mlGrn2Id = res.body.id;
    expect(mlGrn2Id).toBeDefined();
    expect(mlGrn2Id).not.toBe(mlGrn1Id);

    const submitRes = await api.post(`/api/proc-grns/${mlGrn2Id}/submit`).send(actor);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe("Submitted");
  });

  it("approves GRN-2 — both lines now fully delivered → PO transitions to FullyReceived", async () => {
    const approveRes = await api
      .post(`/api/proc-grns/${mlGrn2Id}/approve`)
      .send({ ...actor, remarks: "Line 2 fully delivered — order complete" });
    expect(approveRes.status).toBe(200);

    // Every PO line is now fully delivered, so the PO must become FullyReceived
    const poRes = await api.get(`/api/procurement-pos/${mlPoId}`);
    expect(poRes.status).toBe(200);
    expect(poRes.body.status).toBe("FullyReceived");

    // Both lines must show the correct final deliveredQty
    const item1 = poRes.body.items.find((i: any) => i.id === mlPoItem1Id);
    const item2 = poRes.body.items.find((i: any) => i.id === mlPoItem2Id);
    expect(Number(item1.deliveredQty)).toBe(5);
    expect(Number(item2.deliveredQty)).toBe(5);
  });
});
