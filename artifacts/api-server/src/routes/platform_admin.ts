/**
 * Platform Admin Router
 * Mounted at /platform-admin — protected by requireSuperAdmin().
 * Uses raw pg.Client (not Drizzle) per project pool pitfall rule.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdmin } from "../lib/rbac";
import jwt from "jsonwebtoken";
import pg from "pg";
import type { NextFunction } from "express";
import { invalidateModuleCache } from "../lib/moduleCache";

/** Modules that must never be disabled — they control access to admin tooling itself. */
const PROTECTED_MODULES = new Set(["admin", "approvals"]);

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

/** Only super_admin (or admin) can access platform-admin routes */
function requireSuperAdmin() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
      if (decoded.role !== "super_admin" && decoded.role !== "admin") {
        res.status(403).json({ error: "Super-admin access required" }); return;
      }
      (req as any).actor = decoded;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };
}

router.use("/platform-admin", requireSuperAdmin());

// ── System Settings ───────────────────────────────────────────────────────────

router.get("/platform-admin/settings", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await withClient(c =>
      c.query("SELECT key, value, description, updated_at FROM system_settings ORDER BY key")
    );
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/platform-admin/settings", async (req: Request, res: Response): Promise<void> => {
  const { key, value, description } = req.body ?? {};
  if (!key) { res.status(400).json({ error: "key required" }); return; }
  try {
    const actor = (req as any).actor;
    await withClient(c => c.query(
      `INSERT INTO system_settings (key, value, description, updated_at, updated_by)
       VALUES ($1, $2::jsonb, $3, NOW(), $4)
       ON CONFLICT (key) DO UPDATE
         SET value = $2::jsonb, description = $3, updated_at = NOW(), updated_by = $4`,
      [key, JSON.stringify(value), description ?? null, actor?.userId ?? null]
    ));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Module Config ─────────────────────────────────────────────────────────────

router.get("/platform-admin/modules", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await withClient(c =>
      c.query("SELECT module, enabled, settings, updated_at FROM module_config ORDER BY module")
    );
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/platform-admin/modules", async (req: Request, res: Response): Promise<void> => {
  const { module, enabled, settings } = req.body ?? {};
  if (!module) { res.status(400).json({ error: "module required" }); return; }

  // Safety guard: admin and approvals modules can never be disabled.
  if (PROTECTED_MODULES.has(module) && enabled === false) {
    res.status(400).json({
      error: `The '${module}' module cannot be disabled — it controls critical system access.`,
    });
    return;
  }

  try {
    const actor = (req as any).actor;
    await withClient(c => c.query(
      `INSERT INTO module_config (module, enabled, settings, updated_at, updated_by)
       VALUES ($1, $2, $3::jsonb, NOW(), $4)
       ON CONFLICT (module) DO UPDATE
         SET enabled = $2, settings = $3::jsonb, updated_at = NOW(), updated_by = $4`,
      [module, enabled ?? true, JSON.stringify(settings ?? {}), actor?.userId ?? null]
    ));
    // Invalidate the in-process cache so the enforcement middleware picks up
    // the new value on the very next request (within the same server process).
    invalidateModuleCache();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Notification Templates ────────────────────────────────────────────────────

router.get("/platform-admin/notification-templates", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await withClient(c =>
      c.query("SELECT type, subject, body, enabled, updated_at FROM notification_templates ORDER BY type")
    );
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/platform-admin/notification-templates/:type", async (req: Request, res: Response): Promise<void> => {
  const { type } = req.params;
  const { subject, body, enabled } = req.body ?? {};
  if (!type) { res.status(400).json({ error: "type required" }); return; }
  try {
    const actor = (req as any).actor;
    await withClient(c => c.query(
      `INSERT INTO notification_templates (type, subject, body, enabled, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (type) DO UPDATE
         SET subject = $2, body = $3, enabled = $4, updated_at = NOW(), updated_by = $5`,
      [type, subject ?? "", body ?? "", enabled ?? true, actor?.userId ?? null]
    ));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Health & System ───────────────────────────────────────────────────────────

router.get("/platform-admin/health", async (_req: Request, res: Response): Promise<void> => {
  const start = Date.now();
  try {
    await withClient(c => c.query("SELECT 1"));
    const dbLatency = Date.now() - start;
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: { status: "ok", latencyMs: dbLatency },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      env: process.env.NODE_ENV ?? "development",
    });
  } catch (e: any) {
    res.json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      db: { status: "error", error: e.message },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      env: process.env.NODE_ENV ?? "development",
    });
  }
});

// ── User Stats (for overview) ─────────────────────────────────────────────────

router.get("/platform-admin/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await withClient(async c => {
      // users table has: id, name, email, role, password_hash, org_id, created_at
      // There is no is_active column — all stored users are considered active
      const [users, roles, auditToday] = await Promise.all([
        c.query("SELECT COUNT(*) AS total FROM users"),
        c.query("SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY count DESC"),
        c.query(`
          SELECT COUNT(*) AS count FROM audit_logs
          WHERE created_at >= CURRENT_DATE
        `),
      ]);
      const total = Number(users.rows[0]?.total ?? 0);
      return {
        users: { total, active: total },
        roles: roles.rows.map((r: any) => ({ role: r.role, count: Number(r.count) })),
        auditToday: Number(auditToday.rows[0]?.count ?? 0),
      };
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Security — Failed Logins (from audit_logs) ────────────────────────────────
// Failed logins are written with action='login' AND status='failure'
// audit_logs columns: user_id, user_name, user_role, action, module, entity_label,
//                     description, ip_address, status, error_message, created_at

router.get("/platform-admin/security/failed-logins", async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  try {
    const rows = await withClient(c => c.query(
      `SELECT
         entity_label  AS email,
         ip_address,
         description,
         error_message,
         created_at
       FROM audit_logs
       WHERE action = 'login'
         AND status = 'failure'
         AND module = 'auth'
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    ));
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Active Sessions — per-user latest activity with IP / device ───────────────
router.get("/platform-admin/sessions", async (_req: Request, res: Response): Promise<void> => {
  try {
    // Most-recent action per user (last 8 h), enriched with latest IP + UA
    const sessions = await withClient(c => c.query(`
      SELECT DISTINCT ON (user_id)
        user_id,
        user_name,
        user_role,
        ip_address,
        user_agent,
        created_at AS last_seen
      FROM audit_logs
      WHERE created_at > NOW() - INTERVAL '8 hours'
        AND user_id IS NOT NULL
      ORDER BY user_id, created_at DESC
      LIMIT 100
    `));

    // Detect multi-IP activity (same user, different IPs in last 8 h)
    const multiIp = await withClient(c => c.query(`
      SELECT
        user_id,
        COUNT(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL AND ip_address <> 'unknown') AS ip_count,
        array_agg(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL AND ip_address <> 'unknown') AS ip_list
      FROM audit_logs
      WHERE created_at > NOW() - INTERVAL '8 hours'
        AND user_id IS NOT NULL
      GROUP BY user_id
      HAVING COUNT(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL AND ip_address <> 'unknown') > 1
    `));

    const suspectIds = new Set(multiIp.rows.map((r: any) => r.user_id));
    const ipListMap  = new Map(multiIp.rows.map((r: any) => [r.user_id, r.ip_list]));

    const enriched = sessions.rows.map((r: any) => ({
      ...r,
      suspicious:     suspectIds.has(r.user_id),
      all_ips:        suspectIds.has(r.user_id) ? ipListMap.get(r.user_id) : [r.ip_address],
    }));

    res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── User Activity — recent actions for a single user ──────────────────────────
router.get("/platform-admin/sessions/:userId/activity", async (req: Request, res: Response): Promise<void> => {
  const userId = Number(req.params.userId);
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }
  try {
    const rows = await withClient(c => c.query(`
      SELECT
        id, action, module, entity_type, entity_label, description,
        ip_address, user_agent, status, created_at
      FROM audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [userId]));
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── User Management (platform-admin full control) ─────────────────────────────

// GET /platform-admin/users — list all users with last-seen from audit_logs
router.get("/platform-admin/users", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await withClient(c => c.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.created_at,
        al.last_seen,
        al.last_ip
      FROM users u
      LEFT JOIN (
        SELECT DISTINCT ON (user_id)
          user_id,
          created_at AS last_seen,
          ip_address AS last_ip
        FROM audit_logs
        WHERE user_id IS NOT NULL
        ORDER BY user_id, created_at DESC
      ) al ON al.user_id = u.id
      ORDER BY u.id
    `));
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /platform-admin/users — create user
router.post("/platform-admin/users", async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, role = "sales" } = req.body ?? {};
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, password required" }); return;
  }
  try {
    // Check duplicate email
    const existing = await withClient(c => c.query("SELECT id FROM users WHERE email = $1", [email]));
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "Email already exists" }); return;
    }
    // Hash password using Node built-in crypto as bcrypt fallback
    let passwordHash: string;
    try {
      const bcrypt = await import("bcryptjs");
      passwordHash = await bcrypt.hash(password, 10);
    } catch {
      const { createHash } = await import("crypto");
      passwordHash = createHash("sha256").update(password).digest("hex");
    }
    const result = await withClient(c => c.query(
      `INSERT INTO users (name, email, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash, role]
    ));
    // Audit log
    const actor = (req as any).actor;
    await withClient(c => c.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, module, entity_type, entity_label, description, status, created_at)
       VALUES ($1, $2, $3, 'create', 'admin', 'user', $4, $5, 'success', NOW())`,
      [actor?.userId, actor?.email ?? "platform-admin", actor?.role, email, `Created user ${name} (${role})`]
    )).catch(() => {});
    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /platform-admin/users/:id — update name and/or role
router.patch("/platform-admin/users/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "id required" }); return; }
  const { name, role } = req.body ?? {};
  if (!name && !role) { res.status(400).json({ error: "name or role required" }); return; }
  try {
    const setParts: string[] = [];
    const vals: any[] = [];
    if (name) { setParts.push(`name = $${vals.length + 1}`); vals.push(name); }
    if (role) { setParts.push(`role = $${vals.length + 1}`); vals.push(role); }
    vals.push(id);
    const result = await withClient(c => c.query(
      `UPDATE users SET ${setParts.join(", ")} WHERE id = $${vals.length} RETURNING id, name, email, role`,
      vals
    ));
    if (result.rows.length === 0) { res.status(404).json({ error: "User not found" }); return; }
    const actor = (req as any).actor;
    await withClient(c => c.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, module, entity_type, entity_label, description, status, created_at)
       VALUES ($1, $2, $3, 'update', 'admin', 'user', $4, $5, 'success', NOW())`,
      [actor?.userId, actor?.email ?? "platform-admin", actor?.role, result.rows[0].email, `Updated user ${result.rows[0].name}: ${Object.entries({name, role}).filter(([,v])=>v).map(([k,v])=>`${k}→${v}`).join(", ")}`]
    )).catch(() => {});
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /platform-admin/users/:id/reset-password
router.patch("/platform-admin/users/:id/reset-password", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const { password } = req.body ?? {};
  if (!id || !password) { res.status(400).json({ error: "id and password required" }); return; }
  try {
    let passwordHash: string;
    try {
      const bcrypt = await import("bcryptjs");
      passwordHash = await bcrypt.hash(password, 10);
    } catch {
      const { createHash } = await import("crypto");
      passwordHash = createHash("sha256").update(password).digest("hex");
    }
    const result = await withClient(c => c.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, name, email`,
      [passwordHash, id]
    ));
    if (result.rows.length === 0) { res.status(404).json({ error: "User not found" }); return; }
    const actor = (req as any).actor;
    await withClient(c => c.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, module, entity_type, entity_label, description, status, created_at)
       VALUES ($1, $2, $3, 'update', 'admin', 'user', $4, 'Password reset by platform admin', 'success', NOW())`,
      [actor?.userId, actor?.email ?? "platform-admin", actor?.role, result.rows[0].email]
    )).catch(() => {});
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /platform-admin/users/:id — permanently delete user (cannot delete super_admin)
router.delete("/platform-admin/users/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "id required" }); return; }
  const actor = (req as any).actor;
  // Prevent self-deletion
  if (actor?.userId === id) { res.status(400).json({ error: "Cannot delete your own account" }); return; }
  try {
    // Check if target is super_admin
    const check = await withClient(c => c.query("SELECT id, name, email, role FROM users WHERE id = $1", [id]));
    if (check.rows.length === 0) { res.status(404).json({ error: "User not found" }); return; }
    const target = check.rows[0];
    if (target.role === "super_admin" && actor?.role !== "super_admin") {
      res.status(403).json({ error: "Only a super_admin can delete another super_admin" }); return;
    }
    await withClient(c => c.query("DELETE FROM users WHERE id = $1", [id]));
    await withClient(c => c.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, module, entity_type, entity_label, description, status, created_at)
       VALUES ($1, $2, $3, 'delete', 'admin', 'user', $4, $5, 'success', NOW())`,
      [actor?.userId, actor?.email ?? "platform-admin", actor?.role, target.email, `Deleted user ${target.name} (${target.role})`]
    )).catch(() => {});
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
