/**
 * GET /api/audit-logs        — paginated, filtered list (admin + director only)
 * GET /api/audit-logs/stats  — today's summary counts
 * GET /api/audit-logs/users  — distinct user_name values for filter dropdown
 */

import { Router, type IRouter } from "express";
import { requireAdmin } from "../lib/rbac";
import pg from "pg";

const router: IRouter = Router();

const _pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

// ── Stats ────────────────────────────────────────────────────────────────────
router.get("/audit-logs/stats", requireAdmin(), async (_req, res): Promise<void> => {
  const r = await _pool.query<{
    total_today: string;
    unique_users: string;
    failures: string;
  }>(`
    SELECT
      COUNT(*)                                             AS total_today,
      COUNT(DISTINCT user_id)                              AS unique_users,
      COUNT(*) FILTER (WHERE status IN ('failure','error')) AS failures
    FROM audit_logs
    WHERE created_at >= CURRENT_DATE
  `);
  const row = r.rows[0] ?? { total_today: "0", unique_users: "0", failures: "0" };
  res.json({
    todayCount:   Number(row.total_today),
    uniqueUsers:  Number(row.unique_users),
    failures:     Number(row.failures),
  });
});

// ── Distinct users (for filter dropdown) ─────────────────────────────────────
router.get("/audit-logs/users", requireAdmin(), async (_req, res): Promise<void> => {
  const r = await _pool.query<{ user_name: string; user_id: number }>(
    `SELECT DISTINCT user_name, user_id
     FROM audit_logs
     WHERE user_name IS NOT NULL
     ORDER BY user_name`,
  );
  res.json(r.rows.map(row => ({ label: row.user_name, value: String(row.user_id) })));
});

// ── List ─────────────────────────────────────────────────────────────────────
router.get("/audit-logs", requireAdmin(), async (req, res): Promise<void> => {
  const page   = Math.max(1, Number(req.query.page)  || 1);
  const limit  = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const filterParams: unknown[] = [];

  function addParam(val: unknown): number { filterParams.push(val); return filterParams.length; }

  if (req.query.module)  conditions.push(`module  = $${addParam(req.query.module)}`);
  if (req.query.action)  conditions.push(`action  = $${addParam(req.query.action)}`);
  if (req.query.status)  conditions.push(`status  = $${addParam(req.query.status)}`);
  if (req.query.userId)  conditions.push(`user_id = $${addParam(Number(req.query.userId))}`);

  if (req.query.from) {
    conditions.push(`created_at >= $${addParam(req.query.from)}::date`);
  }
  if (req.query.to) {
    conditions.push(`created_at < ($${addParam(req.query.to)}::date + INTERVAL '1 day')`);
  }
  if (req.query.search) {
    const idx = addParam(`%${req.query.search}%`);
    conditions.push(
      `(user_name ILIKE $${idx} OR entity_label ILIKE $${idx} OR description ILIKE $${idx})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Separate params for data query (adds LIMIT + OFFSET beyond the filter params)
  const n = filterParams.length;
  const dataParams = [...filterParams, limit, offset];

  // Run count and data queries in parallel
  const [countResult, dataResult] = await Promise.all([
    _pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM audit_logs ${where}`,
      filterParams,
    ),
    _pool.query(
      `SELECT * FROM audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${n + 1} OFFSET $${n + 2}`,
      dataParams,
    ),
  ]);

  const total = Number(countResult.rows[0]?.count ?? 0);

  res.json({
    data:       dataResult.rows,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

export default router;
