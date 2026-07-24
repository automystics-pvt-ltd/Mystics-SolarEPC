/**
 * PO list projectId filter – correctness tests
 *
 * The PO list accepts a `?projectId=<number>` query param that restricts
 * results to POs whose project_id column matches.  This suite confirms the
 * filter works end-to-end at the HTTP layer.
 *
 * Relevant route: GET /api/procurement-pos (artifacts/api-server/src/routes/proc_pos.ts, ~line 325)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import pg from "pg";
import app from "../app.js";
import { db, procurementPOsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const api = supertest(app);

const RUN = Date.now();

const insertedPoIds: number[] = [];
const insertedProjectIds: number[] = [];
let seqNo = 0;

let projectAId: number;
let projectBId: number;

async function insertProject(name: string): Promise<number> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO projects (name, status) VALUES ($1, 'Planning') RETURNING id`,
      [name],
    );
    const id = rows[0]!.id;
    insertedProjectIds.push(id);
    return id;
  } finally {
    await client.end();
  }
}

async function insertPO(
  overrides: Partial<typeof procurementPOsTable.$inferInsert> = {},
): Promise<typeof procurementPOsTable.$inferSelect> {
  seqNo += 1;
  const [po] = await db
    .insert(procurementPOsTable)
    .values({
      poNumber:    `PF${RUN}${seqNo}`.slice(0, 30),
      vendorName:  `TestVendor-${RUN}`,
      status:      "Issued",
      totalAmount: "5000",
      ...overrides,
    })
    .returning();
  insertedPoIds.push(po.id);
  return po;
}

let poA1Id: number;
let poA2Id: number;
let poBId: number;
let poNoProjectId: number;

beforeAll(async () => {
  // Create real project rows to satisfy the FK constraint
  projectAId = await insertProject(`Project Alpha ${RUN}`);
  projectBId = await insertProject(`Project Beta ${RUN}`);

  // Two POs for project A
  const poA1 = await insertPO({ projectId: projectAId });
  const poA2 = await insertPO({ projectId: projectAId, status: "Draft" });
  // One PO for project B
  const poB  = await insertPO({ projectId: projectBId });
  // One PO with no project linkage
  const poNone = await insertPO({ projectId: null });

  poA1Id        = poA1.id;
  poA2Id        = poA2.id;
  poBId         = poB.id;
  poNoProjectId = poNone.id;
});

afterAll(async () => {
  if (insertedPoIds.length) {
    await db.delete(procurementPOsTable).where(inArray(procurementPOsTable.id, insertedPoIds));
  }
  // Delete projects after POs (FK order)
  if (insertedProjectIds.length) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query(
        `DELETE FROM projects WHERE id = ANY($1::int[])`,
        [insertedProjectIds],
      );
    } finally {
      await client.end();
    }
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PO list – ?projectId filter", () => {
  it("returns only POs whose projectId matches the given numeric ID", async () => {
    const res = await api.get(`/api/procurement-pos?projectId=${projectAId}`);
    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);
    // Both project-A POs must appear
    expect(ids).toContain(poA1Id);
    expect(ids).toContain(poA2Id);
    // Project-B and unlinked PO must not appear
    expect(ids).not.toContain(poBId);
    expect(ids).not.toContain(poNoProjectId);
  });

  it("every returned PO carries the requested projectId value", async () => {
    const res = await api.get(`/api/procurement-pos?projectId=${projectAId}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    for (const po of res.body) {
      expect(po.projectId).toBe(projectAId);
    }
  });

  it("returns an empty list when no POs exist for the given projectId", async () => {
    const res = await api.get(`/api/procurement-pos?projectId=999999999`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("does not include POs with no projectId when filtering by a specific project", async () => {
    const res = await api.get(`/api/procurement-pos?projectId=${projectAId}`);
    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);
    expect(ids).not.toContain(poNoProjectId);
  });

  it("filtering by project does not silently return all POs (regression guard)", async () => {
    const [allRes, filteredRes] = await Promise.all([
      api.get("/api/procurement-pos"),
      api.get(`/api/procurement-pos?projectId=${projectAId}`),
    ]);
    expect(allRes.status).toBe(200);
    expect(filteredRes.status).toBe(200);

    // Filtered set must be a strict subset of all POs
    expect(filteredRes.body.length).toBeGreaterThan(0);
    expect(filteredRes.body.length).toBeLessThan(allRes.body.length);
  });
});
