/**
 * RBAC Smoke Tests — Task #144
 *
 * Verifies that the `requireAuth` + `requirePermission` middleware
 * on every mutating route correctly enforces role-based access:
 *
 *  • No token  → 401 on any protected endpoint
 *  • Invalid token → 401
 *  • Role without permission → 403
 *  • Role with permission → passes RBAC (2xx or 404 on missing record, never 401/403)
 *
 * JWT tokens are generated directly with the dev-fallback secret so the
 * tests never need a real DB user record — auth enforcement is the focus.
 *
 * Correct API paths (all routers are mounted without prefix in routes/index.ts):
 *   /api/material-requests                         ← procurement.ts
 *   /api/vendor-quotations/:id/review              ← procurement.ts
 *   /api/vendor-quotations/:id/approve-l1          ← procurement.ts
 *   /api/contractors                               ← procurement.ts
 *   /api/procurement-quotations                    ← proc_quotations.ts
 *   /api/procurement-quotations/:id/approve        ← proc_quotations.ts
 *   /api/procurement-quotations/:id/start-review   ← proc_quotations.ts
 *   /api/procurement-pos/:id/issue                 ← proc_pos.ts
 *   /api/leads                                     ← leads.ts
 *   /api/vendors                                   ← vendors.ts
 *   /api/projects                                  ← projects.ts
 *
 * DB-backed permission expectations (role_permissions table seeded):
 *   admin      — always allowed (short-circuit, no DB check)
 *   warehouse  — procurement: [view, create];  no CRM, no vendor-write, no approve/edit
 *   sales      — crm: [view,create,edit,delete,export]; no procurement rows → 403 on all
 *   finance    — procurement: [view,approve,export]; no create/edit
 *   pm         — procurement: [view,create,edit,export]; approve=false
 *   director   — procurement: [view,approve,export,edit]; create=false
 */

import { describe, it, expect } from "vitest";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";

const api = supertest(app);

const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

/** Generate a signed JWT for any role without hitting the DB */
function makeToken(role: string, userId = 999): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "1h" });
}

const tokens = {
  admin:     makeToken("admin",     5),
  director:  makeToken("director",  6),
  pm:        makeToken("pm",        7),
  finance:   makeToken("finance",   8),
  warehouse: makeToken("warehouse", 9),
  sales:     makeToken("sales",     10),
};

function auth(role: keyof typeof tokens) {
  return `Bearer ${tokens[role]}`;
}

// ── Minimal valid request bodies ───────────────────────────────────────────────

/** Material request body — projectId 1 may not exist but permission is checked first */
const validMR = {
  projectId: 1,
  items: [{ itemName: "RBAC Test Item", qty: 2, unit: "pcs" }],
};

const validLead = {
  source: "RBAC Test",
  status: "New",
};

const validVendor = {
  name: `RBAC Vendor ${Date.now()}`,
  primaryEmail: `rbac-${Date.now()}@test.com`,
  status: "Active",
};

const validProject = {
  name: `RBAC Project ${Date.now()}`,
  status: "Planning",
};

const validQuotation = {
  vendorId: 1,
  vendorName: "RBAC Test Vendor",
  totalAmount: 10000,
  currency: "INR",
};

// ══════════════════════════════════════════════════════════════════════════════
// 1 — Unauthenticated requests → 401
// ══════════════════════════════════════════════════════════════════════════════
describe("Unauthenticated requests → 401", () => {
  it("POST /api/material-requests — no token", async () => {
    const res = await api.post("/api/material-requests").send(validMR);
    expect(res.status).toBe(401);
  });

  it("POST /api/leads — no token", async () => {
    const res = await api.post("/api/leads").send(validLead);
    expect(res.status).toBe(401);
  });

  it("POST /api/vendors — no token", async () => {
    const res = await api.post("/api/vendors").send(validVendor);
    expect(res.status).toBe(401);
  });

  it("POST /api/projects — no token", async () => {
    const res = await api.post("/api/projects").send(validProject);
    expect(res.status).toBe(401);
  });

  it("POST /api/vendor-quotations/1/approve-l1 — no token", async () => {
    const res = await api
      .post("/api/vendor-quotations/1/approve-l1")
      .send({ action: "approve" });
    expect(res.status).toBe(401);
  });

  it("POST /api/procurement-quotations/:id/approve — no token", async () => {
    const res = await api
      .post("/api/procurement-quotations/999/approve")
      .send({ remarks: "ok" });
    expect(res.status).toBe(401);
  });

  it("POST /api/contractors — no token", async () => {
    const res = await api
      .post("/api/contractors")
      .send({ name: "Test Contractor", trade: "Electrical" });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2 — Invalid / tampered token → 401
// ══════════════════════════════════════════════════════════════════════════════
describe("Invalid token → 401", () => {
  it("POST /api/material-requests — garbage token", async () => {
    const res = await api
      .post("/api/material-requests")
      .set("Authorization", "Bearer not.a.valid.jwt")
      .send(validMR);
    expect(res.status).toBe(401);
  });

  it("POST /api/leads — token signed with wrong secret", async () => {
    const bad = jwt.sign({ userId: 1, role: "admin" }, "wrong-secret");
    const res = await api
      .post("/api/leads")
      .set("Authorization", `Bearer ${bad}`)
      .send(validLead);
    expect(res.status).toBe(401);
  });

  it("GET /api/material-requests — expired token", async () => {
    const expired = jwt.sign({ userId: 1, role: "admin" }, JWT_SECRET, { expiresIn: -1 });
    const res = await api
      .get("/api/material-requests")
      .set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3 — Warehouse role
//   DB: procurement=[view,create]; no crm, no vendors-write, no approve/edit
// ══════════════════════════════════════════════════════════════════════════════
describe("Warehouse role", () => {
  it("GET /api/material-requests — allowed (view)", async () => {
    const res = await api
      .get("/api/material-requests")
      .set("Authorization", auth("warehouse"));
    expect(res.status).toBe(200);
  });

  it("POST /api/material-requests — passes RBAC (procurement create)", async () => {
    const res = await api
      .post("/api/material-requests")
      .set("Authorization", auth("warehouse"))
      .send(validMR);
    // Permission check passes — may be 201 (success) or 4xx (DB/validation) but never 401/403
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/vendor-quotations/1/review — 403 (needs procurement edit)", async () => {
    const res = await api
      .post("/api/vendor-quotations/1/review")
      .set("Authorization", auth("warehouse"))
      .send({ managerRemarks: "test" });
    expect(res.status).toBe(403);
  });

  it("POST /api/vendor-quotations/1/approve-l1 — 403 (needs procurement approve)", async () => {
    const res = await api
      .post("/api/vendor-quotations/1/approve-l1")
      .set("Authorization", auth("warehouse"))
      .send({ action: "approve" });
    expect(res.status).toBe(403);
  });

  it("POST /api/procurement-quotations/999/approve — 403 (needs procurement approve)", async () => {
    const res = await api
      .post("/api/procurement-quotations/999/approve")
      .set("Authorization", auth("warehouse"))
      .send({ remarks: "ok" });
    expect(res.status).toBe(403);
  });

  it("POST /api/procurement-quotations/999/start-review — 403 (needs procurement edit)", async () => {
    const res = await api
      .post("/api/procurement-quotations/999/start-review")
      .set("Authorization", auth("warehouse"))
      .send({});
    expect(res.status).toBe(403);
  });

  it("POST /api/leads — 403 (no CRM access)", async () => {
    const res = await api
      .post("/api/leads")
      .set("Authorization", auth("warehouse"))
      .send(validLead);
    expect(res.status).toBe(403);
  });

  it("POST /api/vendors — 403 (no vendors write)", async () => {
    const res = await api
      .post("/api/vendors")
      .set("Authorization", auth("warehouse"))
      .send(validVendor);
    expect(res.status).toBe(403);
  });

  it("POST /api/projects — 403 (no projects create)", async () => {
    const res = await api
      .post("/api/projects")
      .set("Authorization", auth("warehouse"))
      .send(validProject);
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4 — Sales role
//   DB: crm=[view,create,edit,delete,export]; no procurement rows → all 403
// ══════════════════════════════════════════════════════════════════════════════
describe("Sales role", () => {
  it("POST /api/leads — passes RBAC (crm create)", async () => {
    const res = await api
      .post("/api/leads")
      .set("Authorization", auth("sales"))
      .send(validLead);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/material-requests — 403 (no procurement rows)", async () => {
    const res = await api
      .post("/api/material-requests")
      .set("Authorization", auth("sales"))
      .send(validMR);
    expect(res.status).toBe(403);
  });

  it("POST /api/vendors — 403 (no vendors create)", async () => {
    const res = await api
      .post("/api/vendors")
      .set("Authorization", auth("sales"))
      .send(validVendor);
    expect(res.status).toBe(403);
  });

  it("POST /api/vendor-quotations/1/approve-l1 — 403 (no procurement approve)", async () => {
    const res = await api
      .post("/api/vendor-quotations/1/approve-l1")
      .set("Authorization", auth("sales"))
      .send({ action: "approve" });
    expect(res.status).toBe(403);
  });

  it("POST /api/procurement-quotations — 403 (no procurement create)", async () => {
    const res = await api
      .post("/api/procurement-quotations")
      .set("Authorization", auth("sales"))
      .send(validQuotation);
    expect(res.status).toBe(403);
  });

  it("POST /api/contractors — 403 (no procurement create)", async () => {
    const res = await api
      .post("/api/contractors")
      .set("Authorization", auth("sales"))
      .send({ name: "Sales Contractor", trade: "Civil" });
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5 — Finance role
//   DB: procurement=[view,approve,export]; create=false, edit=false
// ══════════════════════════════════════════════════════════════════════════════
describe("Finance role", () => {
  it("POST /api/material-requests — 403 (procurement create=false)", async () => {
    const res = await api
      .post("/api/material-requests")
      .set("Authorization", auth("finance"))
      .send(validMR);
    expect(res.status).toBe(403);
  });

  it("POST /api/procurement-quotations — 403 (procurement create=false)", async () => {
    const res = await api
      .post("/api/procurement-quotations")
      .set("Authorization", auth("finance"))
      .send(validQuotation);
    expect(res.status).toBe(403);
  });

  it("POST /api/vendor-quotations/1/approve-l1 — passes RBAC (procurement approve=true)", async () => {
    const res = await api
      .post("/api/vendor-quotations/1/approve-l1")
      .set("Authorization", auth("finance"))
      .send({ action: "approve" });
    // May be 404 if quotation 1 doesn't exist; permission check passes
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/procurement-quotations/999/approve — passes RBAC (procurement approve=true)", async () => {
    const res = await api
      .post("/api/procurement-quotations/999/approve")
      .set("Authorization", auth("finance"))
      .send({ remarks: "approved" });
    // 404 because id 999 doesn't exist — but NOT 403
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/vendor-quotations/1/review — 403 (procurement edit=false)", async () => {
    const res = await api
      .post("/api/vendor-quotations/1/review")
      .set("Authorization", auth("finance"))
      .send({ managerRemarks: "looks fine" });
    expect(res.status).toBe(403);
  });

  it("POST /api/leads — 403 (no CRM access)", async () => {
    const res = await api
      .post("/api/leads")
      .set("Authorization", auth("finance"))
      .send(validLead);
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6 — PM role
//   DB: procurement=[view,create,edit,export]; approve=false
// ══════════════════════════════════════════════════════════════════════════════
describe("PM role", () => {
  it("POST /api/material-requests — passes RBAC (procurement create=true)", async () => {
    const res = await api
      .post("/api/material-requests")
      .set("Authorization", auth("pm"))
      .send(validMR);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/vendor-quotations/1/review — passes RBAC (procurement edit=true)", async () => {
    const res = await api
      .post("/api/vendor-quotations/1/review")
      .set("Authorization", auth("pm"))
      .send({ managerRemarks: "looks good" });
    // 404 if quotation doesn't exist — but NOT 403
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/vendor-quotations/1/approve-l1 — 403 (procurement approve=false)", async () => {
    const res = await api
      .post("/api/vendor-quotations/1/approve-l1")
      .set("Authorization", auth("pm"))
      .send({ action: "approve" });
    expect(res.status).toBe(403);
  });

  it("POST /api/procurement-quotations/999/approve — 403 (procurement approve=false)", async () => {
    const res = await api
      .post("/api/procurement-quotations/999/approve")
      .set("Authorization", auth("pm"))
      .send({ remarks: "ok" });
    expect(res.status).toBe(403);
  });

  it("POST /api/projects — passes RBAC (projects create=true)", async () => {
    const res = await api
      .post("/api/projects")
      .set("Authorization", auth("pm"))
      .send(validProject);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7 — Director role
//   DB: procurement=[view,approve,export,edit]; create=false
// ══════════════════════════════════════════════════════════════════════════════
describe("Director role", () => {
  it("POST /api/vendor-quotations/1/approve-l1 — passes RBAC (procurement approve=true)", async () => {
    const res = await api
      .post("/api/vendor-quotations/1/approve-l1")
      .set("Authorization", auth("director"))
      .send({ action: "approve" });
    // May be 404 — but NOT 403
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/procurement-quotations/999/approve — passes RBAC (procurement approve=true)", async () => {
    const res = await api
      .post("/api/procurement-quotations/999/approve")
      .set("Authorization", auth("director"))
      .send({ remarks: "approved" });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/material-requests — 403 (procurement create=false)", async () => {
    const res = await api
      .post("/api/material-requests")
      .set("Authorization", auth("director"))
      .send(validMR);
    expect(res.status).toBe(403);
  });

  it("POST /api/procurement-quotations — 403 (procurement create=false)", async () => {
    const res = await api
      .post("/api/procurement-quotations")
      .set("Authorization", auth("director"))
      .send(validQuotation);
    expect(res.status).toBe(403);
  });

  it("POST /api/leads — passes RBAC (crm create=true)", async () => {
    const res = await api
      .post("/api/leads")
      .set("Authorization", auth("director"))
      .send(validLead);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/vendor-quotations/1/review — passes RBAC (procurement edit=true)", async () => {
    const res = await api
      .post("/api/vendor-quotations/1/review")
      .set("Authorization", auth("director"))
      .send({ managerRemarks: "director review" });
    // 404 if quotation 1 doesn't exist — but NOT 403
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8 — Admin role — always allowed (short-circuit, no DB lookup)
// ══════════════════════════════════════════════════════════════════════════════
describe("Admin role — always allowed through RBAC", () => {
  it("POST /api/material-requests → passes RBAC", async () => {
    const res = await api
      .post("/api/material-requests")
      .set("Authorization", auth("admin"))
      .send(validMR);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/leads → passes RBAC", async () => {
    const res = await api
      .post("/api/leads")
      .set("Authorization", auth("admin"))
      .send(validLead);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/vendors → passes RBAC", async () => {
    const res = await api
      .post("/api/vendors")
      .set("Authorization", auth("admin"))
      .send(validVendor);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/projects → passes RBAC", async () => {
    const res = await api
      .post("/api/projects")
      .set("Authorization", auth("admin"))
      .send(validProject);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/vendor-quotations/1/approve-l1 → passes RBAC (may 404 on missing record)", async () => {
    const res = await api
      .post("/api/vendor-quotations/1/approve-l1")
      .set("Authorization", auth("admin"))
      .send({ action: "approve" });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/procurement-quotations/999/approve → passes RBAC (may 404 on missing record)", async () => {
    const res = await api
      .post("/api/procurement-quotations/999/approve")
      .set("Authorization", auth("admin"))
      .send({ remarks: "admin approved" });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 9 — Contractors endpoint
// ══════════════════════════════════════════════════════════════════════════════
describe("Contractors endpoint RBAC", () => {
  const validContractor = { name: `RBAC Contractor ${Date.now()}`, trade: "Electrical" };

  it("POST /api/contractors — no token → 401", async () => {
    const res = await api.post("/api/contractors").send(validContractor);
    expect(res.status).toBe(401);
  });

  it("POST /api/contractors — sales → 403 (no procurement create)", async () => {
    const res = await api
      .post("/api/contractors")
      .set("Authorization", auth("sales"))
      .send(validContractor);
    expect(res.status).toBe(403);
  });

  it("POST /api/contractors — finance → 403 (procurement create=false)", async () => {
    const res = await api
      .post("/api/contractors")
      .set("Authorization", auth("finance"))
      .send(validContractor);
    expect(res.status).toBe(403);
  });

  it("POST /api/contractors — warehouse → passes RBAC (procurement create=true)", async () => {
    const res = await api
      .post("/api/contractors")
      .set("Authorization", auth("warehouse"))
      .send(validContractor);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/contractors — pm → passes RBAC (procurement create=true)", async () => {
    const res = await api
      .post("/api/contractors")
      .set("Authorization", auth("pm"))
      .send(validContractor);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/contractors — admin → passes RBAC", async () => {
    const res = await api
      .post("/api/contractors")
      .set("Authorization", auth("admin"))
      .send(validContractor);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 10 — PO lifecycle endpoints (proc_pos.ts — edit permission gate)
// ══════════════════════════════════════════════════════════════════════════════
describe("PO lifecycle RBAC (procurement edit guard)", () => {
  it("POST /api/procurement-pos/999/issue — warehouse → 403 (no edit)", async () => {
    const res = await api
      .post("/api/procurement-pos/999/issue")
      .set("Authorization", auth("warehouse"))
      .send({});
    expect(res.status).toBe(403);
  });

  it("POST /api/procurement-pos/999/issue — sales → 403 (no procurement access)", async () => {
    const res = await api
      .post("/api/procurement-pos/999/issue")
      .set("Authorization", auth("sales"))
      .send({});
    expect(res.status).toBe(403);
  });

  it("POST /api/procurement-pos/999/issue — pm → passes RBAC (procurement edit=true)", async () => {
    const res = await api
      .post("/api/procurement-pos/999/issue")
      .set("Authorization", auth("pm"))
      .send({});
    // 404 because PO 999 doesn't exist — but NOT 403
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/procurement-pos/999/issue — no token → 401", async () => {
    const res = await api.post("/api/procurement-pos/999/issue").send({});
    expect(res.status).toBe(401);
  });
});
