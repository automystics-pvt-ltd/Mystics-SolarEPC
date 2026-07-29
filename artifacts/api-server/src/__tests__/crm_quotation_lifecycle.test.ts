/**
 * End-to-end tests: CRM workspace quotation lifecycle
 *
 * Covers:
 *  1. Create a lead
 *  2. Submit the inline BOQ form → quotation saved with Draft status
 *  3. Approve the quotation → status becomes Approved
 *  4. Reject a separate pending quotation → status becomes Rejected
 *  5. Zero-item BOQ (no descriptions) → 400 validation error (no silent save)
 *  6. Approved quotation conversion → project + client PO created end-to-end
 *
 * All tests hit the real API server; no mocks.
 */

import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";

const api = supertest(app);

const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

// Seed admin: userId=5 has admin role → short-circuits all permission checks
const adminToken = jwt.sign({ userId: 5, role: "admin" }, JWT_SECRET, { expiresIn: "1h" });

function auth() {
  return { Authorization: `Bearer ${adminToken}` };
}

// Unique suffix per run to avoid unique-constraint collisions across test runs
const RUN = Date.now() % 10_000_000;

// ── Shared state ────────────────────────────────────────────────────────────
let leadId: number;
let quotationId: number;       // used for approve test
let rejectQuotationId: number; // separate quotation for reject test
let convertQuotationId: number;// used for convert-to-project test

const validTill = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

// ── 1. Lead creation ─────────────────────────────────────────────────────────
describe("CRM lead creation", () => {
  it("creates a lead and returns 201 with an id", async () => {
    const res = await api
      .post("/api/leads")
      .set(auth())
      .send({
        source: "Website",
        companyName: `Solar Corp ${RUN}`,
        contactName: "Arjun Mehta",
        contactPhone: "9876543210",
        status: "New",
        estimatedValue: 500000,
      });

    leadId = res.body.id;
    expect(res.status).toBe(201);
    expect(leadId).toBeDefined();
    expect(res.body.companyName).toBe(`Solar Corp ${RUN}`);
    expect(res.body.status).toBe("New");
  });

  it("can retrieve the lead by id", async () => {
    const res = await api
      .get(`/api/leads/${leadId}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(leadId);
    expect(res.body.companyName).toBe(`Solar Corp ${RUN}`);
  });
});

// ── 2. Inline BOQ form — quotation creation ───────────────────────────────
describe("Inline quotation creator — happy path", () => {
  it("saves a quotation with BOQ items and returns 201 with Draft status", async () => {
    const res = await api
      .post("/api/quotations")
      .set(auth())
      .send({
        leadId,
        markupPct: 15,
        validTill,
        boqItems: [
          {
            description: "Solar Panel 400W",
            qty: 10,
            unit: "nos",
            unitPrice: 8000,
            gstPct: 12,
            amount: 80000,
          },
          {
            description: "Mounting Structure",
            qty: 10,
            unit: "set",
            unitPrice: 2500,
            gstPct: 18,
            amount: 25000,
          },
        ],
      });

    quotationId = res.body.id;
    expect(res.status).toBe(201);
    expect(quotationId).toBeDefined();
    expect(res.body.leadId).toBe(leadId);
    expect(res.body.approvalStatus).toBe("Draft");
  });

  it("quotation appears in GET /quotations?leadId with Draft status", async () => {
    const res = await api
      .get(`/api/quotations?leadId=${leadId}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((q: any) => q.id === quotationId);
    expect(found).toBeDefined();
    expect(found.approvalStatus).toBe("Draft");
    expect(found.leadId).toBe(leadId);
    expect(found.boqItems).toBeInstanceOf(Array);
    expect(found.boqItems.length).toBe(2);
  });

  it("quotation total amount is calculated correctly", async () => {
    const res = await api
      .get(`/api/quotations/${quotationId}`)
      .set(auth());

    expect(res.status).toBe(200);
    // base = 80000 + 25000 = 105000; with 15% markup = 120750
    const expectedTotal = 105000 * 1.15;
    expect(Number(res.body.totalAmount)).toBeCloseTo(expectedTotal, 0);
  });
});

// ── 3. Approve quotation ──────────────────────────────────────────────────
describe("Approve quotation", () => {
  it("admin can approve a Draft quotation → status becomes Approved", async () => {
    const res = await api
      .post(`/api/quotations/${quotationId}/approve`)
      .set(auth())
      .send({ action: "approve" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(quotationId);
    expect(res.body.approvalStatus).toBe("Approved");
  });

  it("GET /quotations/:id reflects Approved status after approval", async () => {
    const res = await api
      .get(`/api/quotations/${quotationId}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.approvalStatus).toBe("Approved");
  });
});

// ── 4. Reject quotation ───────────────────────────────────────────────────
describe("Reject quotation", () => {
  beforeAll(async () => {
    // Create a separate quotation to reject so we don't affect the approved one
    const res = await api
      .post("/api/quotations")
      .set(auth())
      .send({
        leadId,
        markupPct: 10,
        validTill,
        boqItems: [
          {
            description: "Inverter 5kW",
            qty: 2,
            unit: "nos",
            unitPrice: 15000,
            gstPct: 18,
            amount: 30000,
          },
        ],
      });
    rejectQuotationId = res.body.id;
  });

  it("admin can reject a Draft quotation → status becomes Rejected", async () => {
    const res = await api
      .post(`/api/quotations/${rejectQuotationId}/approve`)
      .set(auth())
      .send({ action: "reject", remarks: "Price too high" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(rejectQuotationId);
    expect(res.body.approvalStatus).toBe("Rejected");
  });

  it("GET /quotations/:id reflects Rejected status after rejection", async () => {
    const res = await api
      .get(`/api/quotations/${rejectQuotationId}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.approvalStatus).toBe("Rejected");
  });
});

// ── 5. Zero-item BOQ validation ───────────────────────────────────────────
describe("Zero-item BOQ validation — no silent save", () => {
  it("returns 400 when boqItems array is empty", async () => {
    const res = await api
      .post("/api/quotations")
      .set(auth())
      .send({
        leadId,
        markupPct: 15,
        validTill,
        boqItems: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 400 when all boqItem descriptions are blank", async () => {
    const res = await api
      .post("/api/quotations")
      .set(auth())
      .send({
        leadId,
        markupPct: 15,
        validTill,
        boqItems: [
          { description: "   ", qty: 1, unit: "nos", unitPrice: 0 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// ── 6. Convert approved quotation → project + client PO ──────────────────
describe("Convert approved quotation to project (client PO stage)", () => {
  beforeAll(async () => {
    // Create and immediately approve a fresh quotation for conversion
    const createRes = await api
      .post("/api/quotations")
      .set(auth())
      .send({
        leadId,
        markupPct: 12,
        validTill,
        boqItems: [
          {
            description: "Complete Solar System 10kWp",
            qty: 1,
            unit: "kWp",
            unitPrice: 75000,
            gstPct: 12,
            amount: 75000,
          },
        ],
      });
    convertQuotationId = createRes.body.id;

    await api
      .post(`/api/quotations/${convertQuotationId}/approve`)
      .set(auth())
      .send({ action: "approve" });
  });

  it("POST /quotations/:id/convert returns 201 with projectId and clientPoId", async () => {
    const res = await api
      .post(`/api/quotations/${convertQuotationId}/convert`)
      .set(auth())
      .send({
        projectName: `Solar Corp ${RUN} — Solar Project`,
        clientPoNumber: `CPO-${RUN}`,
        contractValue: 84000,
        startDate: new Date().toISOString().slice(0, 10),
      });

    expect(res.status).toBe(201);
    expect(res.body.projectId).toBeDefined();
    expect(res.body.clientPoId).toBeDefined();
    expect(res.body.projectName).toBe(`Solar Corp ${RUN} — Solar Project`);
    expect(typeof res.body.boqItemsCreated).toBe("number");
    expect(res.body.boqItemsCreated).toBeGreaterThan(0);
  });

  it("the created project appears under GET /leads/:id/projects", async () => {
    const res = await api
      .get(`/api/leads/${leadId}/projects`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // At least one project linked to this lead via the converted quotation
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
      status: expect.any(String),
    });
  });

  it("convert endpoint rejects a non-approved quotation with 400", async () => {
    // Create a new quotation but do NOT approve it
    const createRes = await api
      .post("/api/quotations")
      .set(auth())
      .send({
        leadId,
        markupPct: 5,
        validTill,
        boqItems: [
          { description: "Draft item", qty: 1, unit: "nos", unitPrice: 1000 },
        ],
      });

    const draftId = createRes.body.id;
    const res = await api
      .post(`/api/quotations/${draftId}/convert`)
      .set(auth())
      .send({
        clientPoNumber: `CPO-FAIL-${RUN}`,
        contractValue: 1000,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/approved/i);
  });
});
