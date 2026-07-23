/**
 * RBAC API routes
 *
 * GET  /rbac/my-permissions   → permission map for current user (frontend)
 * GET  /rbac/all              → full role×module×action matrix (admin/director)
 * PATCH /rbac/permission      → set a single role+module+action (admin)
 * POST  /rbac/seed            → seed default permissions (admin)
 * POST  /rbac/reset           → wipe + re-seed to defaults (admin)
 */
import { Router, type IRouter } from "express";
import { db, rolePermissionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  requirePermission, requireAdmin, requireAuth,
  getPermissionsForRole, invalidateCache, loadPermissionCache,
  MODULES, ACTIONS, ROLES,
} from "../lib/rbac";
import jwt from "jsonwebtoken";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

function getRole(req: any): string | null {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return null;
    return (jwt.verify(token, JWT_SECRET) as any).role ?? null;
  } catch { return null; }
}

/* ── GET /rbac/my-permissions ─────────────────────────────────────────── */
router.get("/rbac/my-permissions", requireAuth(), async (req: any, res): Promise<void> => {
  const { role } = req.actor;
  const perms = await getPermissionsForRole(role);
  res.json(perms);
});

/* ── GET /rbac/all ────────────────────────────────────────────────────── */
router.get("/rbac/all", requireAdmin(), async (_req, res): Promise<void> => {
  const rows = await db.select().from(rolePermissionsTable);

  // Build nested map: role → module → action → allowed
  const matrix: Record<string, Record<string, Record<string, boolean>>> = {};
  for (const role of ROLES) {
    matrix[role] = {};
    for (const mod of MODULES) {
      matrix[role][mod] = {};
      for (const act of ACTIONS) {
        matrix[role][mod][act] = role === "admin"; // admin always true
      }
    }
  }
  for (const row of rows) {
    if (!matrix[row.role]?.[row.module]) continue;
    matrix[row.role][row.module][row.action] = row.allowed;
  }
  res.json(matrix);
});

/* ── GET /rbac/roles ──────────────────────────────────────────────────── */
router.get("/rbac/roles", requireAuth(), (_req, res): void => {
  res.json({ roles: [...ROLES], modules: [...MODULES], actions: [...ACTIONS] });
});

/* ── PATCH /rbac/permission ───────────────────────────────────────────── */
router.patch("/rbac/permission", requireAdmin(), async (req: any, res): Promise<void> => {
  const { role, module, action, allowed } = req.body as {
    role: string; module: string; action: string; allowed: boolean;
  };

  if (!role || !module || !action || typeof allowed !== "boolean") {
    res.status(400).json({ error: "role, module, action, allowed required" });
    return;
  }
  if (role === "admin") {
    res.status(400).json({ error: "Cannot restrict admin role" });
    return;
  }

  // Upsert
  const existing = await db.select().from(rolePermissionsTable)
    .where(and(
      eq(rolePermissionsTable.role, role),
      eq(rolePermissionsTable.module, module),
      eq(rolePermissionsTable.action, action),
    ));

  if (existing.length > 0) {
    await db.update(rolePermissionsTable)
      .set({ allowed, updatedAt: new Date(), updatedBy: req.actor.userId })
      .where(eq(rolePermissionsTable.id, existing[0].id));
  } else {
    await db.insert(rolePermissionsTable).values({
      role, module, action, allowed, updatedBy: req.actor.userId,
    });
  }

  invalidateCache();
  res.json({ ok: true, role, module, action, allowed });
});

/* ── POST /rbac/seed ──────────────────────────────────────────────────── */
router.post("/rbac/seed", requireAdmin(), async (req: any, res): Promise<void> => {
  const count = await seedDefaults(req.actor.userId);
  invalidateCache();
  res.json({ ok: true, inserted: count });
});

/* ── POST /rbac/reset ─────────────────────────────────────────────────── */
router.post("/rbac/reset", requireAdmin(), async (req: any, res): Promise<void> => {
  await db.delete(rolePermissionsTable);
  const count = await seedDefaults(req.actor.userId);
  invalidateCache();
  res.json({ ok: true, reset: true, inserted: count });
});

/* ── Seed helper ──────────────────────────────────────────────────────── */
async function seedDefaults(updatedBy: number): Promise<number> {
  // Format: [role, module, ...actions]
  const defaults: [string, string, string[]][] = [
    // DIRECTOR
    ["director","dashboard",     ["view","export"]],
    ["director","crm",           ["view","create","edit","approve","export"]],
    ["director","procurement",   ["view","edit","approve","export"]],
    ["director","materials",     ["view","export"]],
    ["director","vendors",       ["view","export"]],
    ["director","projects",      ["view","approve","export"]],
    ["director","inventory",     ["view","export"]],
    ["director","engineering",   ["view","approve","export"]],
    ["director","commissioning", ["view","approve"]],
    ["director","oam",           ["view","export"]],
    ["director","finance",       ["view","approve","export"]],
    ["director","reports",       ["view","export"]],
    ["director","admin",         ["view"]],
    ["director","approvals",     ["view","approve","export"]],
    // PM
    ["pm","dashboard",     ["view"]],
    ["pm","crm",           ["view","create","edit"]],
    ["pm","procurement",   ["view","create","edit","export"]],
    ["pm","materials",     ["view","create","edit","export","import"]],
    ["pm","vendors",       ["view","create","edit"]],
    ["pm","projects",      ["view","create","edit","approve","export"]],
    ["pm","inventory",     ["view","create","edit"]],
    ["pm","engineering",   ["view","create","edit","approve","export"]],
    ["pm","commissioning", ["view","create","edit","approve"]],
    ["pm","oam",           ["view","create","edit"]],
    ["pm","finance",       ["view"]],
    ["pm","reports",       ["view","export"]],
    ["pm","approvals",     ["view","approve","create"]],
    // FINANCE
    ["finance","dashboard",   ["view"]],
    ["finance","procurement", ["view","approve","export"]],
    ["finance","vendors",     ["view"]],
    ["finance","materials",   ["view"]],
    ["finance","projects",    ["view"]],
    ["finance","inventory",   ["view"]],
    ["finance","finance",     ["view","create","edit","approve","export"]],
    ["finance","reports",     ["view","export"]],
    ["finance","approvals",   ["view","approve"]],
    // WAREHOUSE
    ["warehouse","dashboard",   ["view"]],
    ["warehouse","procurement", ["view","create"]],
    ["warehouse","materials",   ["view"]],
    ["warehouse","vendors",     ["view"]],
    ["warehouse","projects",    ["view"]],
    ["warehouse","inventory",   ["view","create","edit","export"]],
    ["warehouse","oam",         ["view","create"]],
    ["warehouse","reports",     ["view"]],
    ["warehouse","approvals",   ["view"]],
    // SALES
    ["sales","dashboard", ["view"]],
    ["sales","crm",       ["view","create","edit","delete","export"]],
    ["sales","projects",  ["view","create"]],
    ["sales","reports",   ["view"]],
    ["sales","approvals", ["view"]],
  ];

  let count = 0;
  for (const [role, module, actions] of defaults) {
    for (const action of actions) {
      try {
        await db.insert(rolePermissionsTable).values({
          role, module, action, allowed: true, updatedBy,
        }).onConflictDoNothing();
        count++;
      } catch { /* already exists */ }
    }
    // Insert denied records for actions NOT in the list (for explicitness)
    const allActions = ["view","create","edit","delete","approve","export","import","admin"];
    for (const action of allActions) {
      if (!actions.includes(action)) {
        try {
          await db.insert(rolePermissionsTable).values({
            role, module, action, allowed: false, updatedBy,
          }).onConflictDoNothing();
        } catch { /* ignore */ }
      }
    }
  }
  return count;
}

export default router;
