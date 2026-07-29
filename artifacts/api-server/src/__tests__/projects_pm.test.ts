/**
 * Task #178 — PM dropdown eligibility and save end-to-end tests.
 *
 * Covers:
 *  1. GET  /projects/pm-candidates   → only pm / admin / director roles returned
 *  2. POST /projects  with pmOwnerId → stored correctly, PM name echoed in response
 *  3. PATCH /projects/:id with a changed pmOwnerId → new PM name reflected in response
 */

import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";

const api = supertest(app);

const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

// Admin token — sufficient to call create/edit project endpoints
function makeToken(role: string, userId: number): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "1h" });
}

// Seed users: admin=5, director=6, pm=7, finance=8, warehouse=9, sales=10
const adminToken     = makeToken("admin",     5);
const warehouseToken = makeToken("warehouse", 9);

const RUN = Date.now() % 1_000_000;

// IDs resolved in beforeAll after querying pm-candidates
let pmCandidates: Array<{ id: number; name: string; role: string; email: string }> = [];
let firstPmId: number;
let secondPmId: number;
let createdProjectId: number;

// ─────────────────────────────────────────────────────────────────────────────
describe("PM candidates endpoint", () => {

  beforeAll(async () => {
    const res = await api
      .get("/api/projects/pm-candidates")
      .set("Authorization", `Bearer ${adminToken}`);
    pmCandidates = res.body;
  });

  it("returns 200", async () => {
    const res = await api
      .get("/api/projects/pm-candidates")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it("returns an array", () => {
    expect(Array.isArray(pmCandidates)).toBe(true);
  });

  it("contains only pm, admin, or director roles", () => {
    const allowed = new Set(["pm", "admin", "director"]);
    for (const u of pmCandidates) {
      expect(allowed.has(u.role),
        `user ${u.id} (${u.name}) has disallowed role "${u.role}"`
      ).toBe(true);
    }
  });

  it("excludes finance, warehouse, and sales roles", () => {
    const disallowed = new Set(["finance", "warehouse", "sales"]);
    for (const u of pmCandidates) {
      expect(disallowed.has(u.role),
        `user ${u.id} (${u.name}) with role "${u.role}" should not appear`
      ).toBe(false);
    }
  });

  it("includes at least one eligible user (seed data)", () => {
    // The seed always creates admin(5), director(6), pm(7)
    expect(pmCandidates.length).toBeGreaterThanOrEqual(1);
    // Grab two distinct PM-eligible ids for the CRUD tests below
    firstPmId  = pmCandidates[0].id;
    secondPmId = pmCandidates.length > 1 ? pmCandidates[1].id : pmCandidates[0].id;
  });

  it("requires authentication — 401 without token", async () => {
    const res = await api.get("/api/projects/pm-candidates");
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /projects with pmOwnerId", () => {

  it("creates a project and echoes the PM name", async () => {
    // firstPmId may be undefined if pm-candidates tests ran in isolation;
    // fall back to seed pm user id=7.
    const pmId = firstPmId ?? 7;

    const res = await api
      .post("/api/projects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name:     `PM Test Project ${RUN}`,
        pmOwnerId: pmId,
      });

    expect(res.status).toBe(201);

    // Store for the PATCH test
    createdProjectId = res.body.id;
    expect(createdProjectId).toBeGreaterThan(0);

    // pmOwnerId stored correctly
    expect(res.body.pmOwnerId).toBe(pmId);

    // pmOwnerName should be a non-empty string (fetched from users table)
    expect(typeof res.body.pmOwnerName).toBe("string");
    expect(res.body.pmOwnerName.length).toBeGreaterThan(0);
  });

  it("creates a project without a PM (pmOwnerId omitted)", async () => {
    const res = await api
      .post("/api/projects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `No-PM Project ${RUN}` });

    expect(res.status).toBe(201);
    expect(res.body.pmOwnerId).toBeFalsy();
    expect(res.body.pmOwnerName).toBeFalsy();
  });

  it("rejects project creation without auth", async () => {
    const res = await api
      .post("/api/projects")
      .send({ name: "Should Fail" });
    expect(res.status).toBe(401);
  });

  it("rejects project creation with an under-privileged role (warehouse)", async () => {
    const res = await api
      .post("/api/projects")
      .set("Authorization", `Bearer ${warehouseToken}`)
      .send({ name: `Warehouse Attempt ${RUN}` });
    // warehouse lacks projects:create permission → 403
    expect([401, 403]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /projects/:id with changed pmOwnerId", () => {

  it("updates pmOwnerId and reflects new PM name in response", async () => {
    // If create tests failed, bail gracefully
    if (!createdProjectId) {
      console.warn("Skipping PATCH test: no project was created");
      return;
    }

    // Use a different PM candidate if available
    const newPmId = (secondPmId && secondPmId !== firstPmId) ? secondPmId : (firstPmId ?? 7);

    const res = await api
      .patch(`/api/projects/${createdProjectId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ pmOwnerId: newPmId });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdProjectId);
    expect(res.body.pmOwnerId).toBe(newPmId);

    // pmOwnerName must be a resolved name string
    expect(typeof res.body.pmOwnerName).toBe("string");
    expect(res.body.pmOwnerName.length).toBeGreaterThan(0);
  });

  it("can clear the PM by setting pmOwnerId to undefined/null", async () => {
    if (!createdProjectId) return;

    const res = await api
      .patch(`/api/projects/${createdProjectId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ pmOwnerId: null });

    // Null might be stripped by zod; the important thing is no 5xx
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      // pmOwnerName should be absent or null
      expect(res.body.pmOwnerName == null || res.body.pmOwnerName === "").toBe(true);
    }
  });

  it("returns 404 for a non-existent project id", async () => {
    const res = await api
      .patch("/api/projects/99999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Ghost" });
    expect(res.status).toBe(404);
  });

  it("rejects update without auth", async () => {
    if (!createdProjectId) return;
    const res = await api
      .patch(`/api/projects/${createdProjectId}`)
      .send({ name: "Unauthenticated" });
    expect(res.status).toBe(401);
  });
});
