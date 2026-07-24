/**
 * RBAC — Role-Based Access Control middleware and permission cache.
 *
 * Architecture:
 *  • Permissions stored in `role_permissions` DB table.
 *  • In-memory cache keyed by "role:module" → Set<action>.
 *  • Cache TTL: 5 min, force-invalidated on any PATCH to permissions.
 *  • `admin` role always granted — no DB lookup.
 *  • Graceful fallback to nav-derived defaults if DB is empty on first boot.
 */
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, rolePermissionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

/* ── Permission cache ──────────────────────────────────────────────────── */
let _cache: Map<string, Set<string>> = new Map();
let _cacheExpiry = 0;
let _cacheEmpty  = false; // true if DB table has no rows (use fallback)

export async function loadPermissionCache(): Promise<void> {
  const rows = await db.select().from(rolePermissionsTable)
    .where(eq(rolePermissionsTable.allowed, true));

  _cache     = new Map();
  _cacheEmpty = rows.length === 0;
  _cacheExpiry = Date.now() + 5 * 60_000;

  for (const row of rows) {
    const key = `${row.role}:${row.module}`;
    if (!_cache.has(key)) _cache.set(key, new Set());
    _cache.get(key)!.add(row.action);
  }
}

export function invalidateCache(): void {
  _cacheExpiry = 0;
}

async function ensureCache(): Promise<void> {
  if (Date.now() >= _cacheExpiry) await loadPermissionCache();
}

/* ── Fallback defaults — mirrors NavRail roles for zero-config boot ─────── */
const FALLBACK: Record<string, Record<string, string[]>> = {
  admin:     { "*": ["view","create","edit","delete","approve","export","import","admin"] },
  director:  {
    dashboard:     ["view","export"],
    crm:           ["view","create","edit","approve","export"],
    procurement:   ["view","approve","export","edit"],
    materials:     ["view","export"],
    vendors:       ["view","export"],
    projects:      ["view","approve","export"],
    inventory:     ["view","export"],
    engineering:   ["view","approve","export"],
    commissioning: ["view","approve"],
    oam:           ["view","export"],
    finance:       ["view","approve","export"],
    reports:       ["view","export"],
    admin:         ["view"],
    approvals:     ["view","approve","export"],
  },
  pm: {
    dashboard:     ["view"],
    crm:           ["view","create","edit"],
    procurement:   ["view","create","edit","export"],
    materials:     ["view","create","edit","export","import"],
    vendors:       ["view","create","edit"],
    projects:      ["view","create","edit","approve","export"],
    inventory:     ["view","create","edit"],
    engineering:   ["view","create","edit","approve","export"],
    commissioning: ["view","create","edit","approve"],
    oam:           ["view","create","edit"],
    finance:       ["view"],
    reports:       ["view","export"],
    approvals:     ["view","approve","create"],
  },
  finance: {
    dashboard:   ["view"],
    procurement: ["view","approve","export"],
    vendors:     ["view"],
    materials:   ["view"],
    projects:    ["view"],
    inventory:   ["view"],
    finance:     ["view","create","edit","approve","export"],
    reports:     ["view","export"],
    approvals:   ["view","approve"],
  },
  warehouse: {
    dashboard:   ["view"],
    procurement: ["view","create"],
    materials:   ["view"],
    vendors:     ["view"],
    projects:    ["view"],
    inventory:   ["view","create","edit","export"],
    oam:         ["view","create"],
    reports:     ["view"],
    approvals:   ["view"],
  },
  sales: {
    dashboard: ["view"],
    crm:       ["view","create","edit","delete","export"],
    projects:  ["view","create"],
    reports:   ["view"],
    approvals: ["view"],
  },
};

function hasFallback(role: string, module: string, action: string): boolean {
  if (role === "admin") return true;
  const roleMap = FALLBACK[role];
  if (!roleMap) return false;
  return (roleMap[module] ?? []).includes(action);
}

/* ── Core permission check ──────────────────────────────────────────────── */
export async function checkPermission(role: string, module: string, action: string): Promise<boolean> {
  if (role === "admin") return true;
  await ensureCache();
  if (_cacheEmpty) return hasFallback(role, module, action);
  return _cache.get(`${role}:${module}`)?.has(action) ?? false;
}

/* ── Returns all permissions for a role as nested map ──────────────────── */
export async function getPermissionsForRole(role: string): Promise<Record<string, Record<string, boolean>>> {
  const MODULES = [
    "dashboard","crm","procurement","materials","vendors",
    "projects","inventory","engineering","commissioning",
    "oam","finance","reports","admin","approvals",
  ];
  const ACTIONS = ["view","create","edit","delete","approve","export","import","admin"];
  const result: Record<string, Record<string, boolean>> = {};

  for (const mod of MODULES) {
    result[mod] = {};
    for (const act of ACTIONS) {
      result[mod][act] = await checkPermission(role, mod, act);
    }
  }
  return result;
}

/* ── Express middleware factory ─────────────────────────────────────────── */
export function requirePermission(module: string, action: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
      const allowed = await checkPermission(decoded.role, module, action);
      if (!allowed) {
        res.status(403).json({ error: "Forbidden", module, action, role: decoded.role });
        return;
      }
      (req as any).actor = decoded;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };
}

/* ── Require authenticated (no permission check — just auth) ────────────── */
export function requireAuth(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
      (req as any).actor = decoded;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };
}

/* ── Require admin role ─────────────────────────────────────────────────── */
export function requireAdmin() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
      if (decoded.role !== "admin" && decoded.role !== "director") {
        res.status(403).json({ error: "Admin access required" }); return;
      }
      (req as any).actor = decoded;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };
}

export const MODULES = [
  "dashboard","crm","procurement","materials","vendors",
  "projects","inventory","engineering","commissioning",
  "oam","finance","reports","admin","approvals",
] as const;

export const ACTIONS = [
  "view","create","edit","delete","approve","export","import","admin",
] as const;

export const ROLES = ["admin","director","pm","finance","warehouse","sales"] as const;
