/**
 * DB Admin API Router
 * Mounted at /db-admin, protected by requireAdmin().
 * Uses raw pg.Client (not Drizzle) per project pool pitfall rule.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdmin } from "../lib/rbac";
import pg from "pg";

const router: IRouter = Router();

// All routes under /db-admin are admin-only
router.use("/db-admin", requireAdmin());

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Express params can be string | string[] — always cast to string */
function param(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };
  const header = columns.join(",");
  const body = rows.map(r => columns.map(c => esc(r[c])).join(",")).join("\n");
  return header + "\n" + body;
}

// ── SQL safety validation (allowlist model) ───────────────────────────────────
/**
 * SQL Console safety guard — ALLOWLIST approach.
 *
 * Only explicitly permitted statement-level verbs are allowed.
 * Any verb not on the list — including indirect DDL vectors such as
 * DO (anonymous code blocks), PREPARE/EXECUTE (deferred execution),
 * COPY (file I/O), VACUUM/REINDEX (maintenance), and any future unknown
 * verb — is rejected by default.
 *
 * Strategy:
 *  1. Strip single-line (--) and block-comment (slash-star) tokens.
 *  2. Split on semicolons to get individual statements.
 *  3. For each non-empty statement, extract the first keyword.
 *  4. If the keyword is NOT in ALLOWED_VERBS, reject the whole request.
 */

/** Statement-level verbs that the SQL Console is permitted to run. */
const ALLOWED_VERBS = new Set([
  // Read
  "select", "table",   // TABLE is PostgreSQL shorthand for SELECT * FROM
  "with",              // CTEs — may precede SELECT/INSERT/UPDATE/DELETE
  "explain",           // query planning (read-only)
  "show",              // show config settings
  // Write (data-only, no schema changes)
  "insert", "update", "delete",
  // Transaction control
  "begin", "start", "commit", "rollback", "savepoint", "release",
  "set", "reset",      // session-level settings only
]);

function stripSqlComments(sql: string): string {
  // Remove -- single-line comments
  let s = sql.replace(/--[^\r\n]*/g, " ");
  // Remove block comments (non-greedy, handles nesting naively)
  // Written as two segments to avoid a raw end-comment token in this source.
  const openComment = "/\\*";
  const closeComment = "\\*\\/";
  s = s.replace(new RegExp(openComment + "[\\s\\S]*?" + closeComment, "g"), " ");
  return s;
}

/**
 * Returns an error string if ANY statement in the payload is not on the
 * allowlist, or null if every statement is permitted.
 */
function validateSql(sql: string): string | null {
  const stripped = stripSqlComments(sql);
  // Split on semicolons; ignore empty/whitespace-only fragments
  const statements = stripped.split(";").map(s => s.trim()).filter(Boolean);
  if (statements.length === 0) return "SQL is empty";
  for (const stmt of statements) {
    const verb = stmt.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (!ALLOWED_VERBS.has(verb)) {
      return (
        `"${verb.toUpperCase()}" is not permitted via the SQL Console. ` +
        `Allowed statement types: SELECT, INSERT, UPDATE, DELETE, WITH, EXPLAIN, SHOW, SET/RESET, BEGIN/COMMIT/ROLLBACK. ` +
        `Use the Maintenance tab for VACUUM/REINDEX and the Danger Zone tab for TRUNCATE.`
      );
    }
  }
  return null;
}

// ── GET /db-admin/tables ─────────────────────────────────────────────────────
router.get("/db-admin/tables", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await withClient(client =>
      client.query<{ table_name: string; row_count: string; size: string }>(`
        SELECT
          t.table_name,
          COALESCE(s.n_live_tup, 0)::text AS row_count,
          pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name))) AS size
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `)
    );
    res.json({
      tables: result.rows.map(r => ({
        name: r.table_name,
        rowCount: parseInt(r.row_count, 10),
        size: r.size,
      })),
      total: result.rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /db-admin/tables/:table/records ──────────────────────────────────────
router.get("/db-admin/tables/:table/records", async (req: Request, res: Response): Promise<void> => {
  const { table: _table } = req.params; const table = param(_table);
  const page     = Math.max(1, parseInt(String(req.query.page  ?? "1"), 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10)));
  const sortCol  = String(req.query.sortCol  ?? "");
  const sortDir  = String(req.query.sortDir  ?? "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
  const filter   = String(req.query.filter   ?? "");

  // Validate table name (alphanumeric + underscore only)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    res.status(400).json({ error: "Invalid table name" });
    return;
  }

  try {
    const result = await withClient(async client => {
      // Get columns
      const colResult = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1
         ORDER BY ordinal_position`,
        [table]
      );
      const columns = colResult.rows.map(r => r.column_name);
      if (columns.length === 0) throw new Error(`Table "${table}" not found`);

      // Get primary key column
      const pkResult = await client.query<{ column_name: string }>(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name
           AND kcu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = 'public'
           AND tc.table_name = $1
         LIMIT 1`,
        [table]
      );
      const pkCol = pkResult.rows[0]?.column_name ?? "id";

      // Build WHERE clause for filter
      let whereClause = "";
      const params: unknown[] = [];
      if (filter) {
        // Simple substring filter across text-ish columns
        const textCols = columns.slice(0, 10); // limit for performance
        const conds = textCols.map((col, i) => {
          params.push(`%${filter}%`);
          return `CAST(${JSON.stringify(col)} AS text) ILIKE $${i + 1}`;
        });
        whereClause = `WHERE ${conds.join(" OR ")}`;
      }

      // Build ORDER BY
      const orderCol = sortCol && columns.includes(sortCol)
        ? `"${sortCol}"` : `"${pkCol}"`;
      const orderClause = `ORDER BY ${orderCol} ${sortDir}`;

      // Count
      const countResult = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM "${table}" ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Paginated rows
      const offset = (page - 1) * pageSize;
      const dataResult = await client.query(
        `SELECT * FROM "${table}" ${whereClause} ${orderClause} LIMIT ${pageSize} OFFSET ${offset}`,
        params
      );

      return { columns, rows: dataResult.rows, total, pkCol };
    });

    res.json({
      columns: result.columns,
      rows: result.rows,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
      pkCol: result.pkCol,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /db-admin/tables/:table/schema ───────────────────────────────────────
router.get("/db-admin/tables/:table/schema", async (req: Request, res: Response): Promise<void> => {
  const { table: _table } = req.params; const table = param(_table);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    res.status(400).json({ error: "Invalid table name" });
    return;
  }

  try {
    const result = await withClient(async client => {
      // Columns
      const colResult = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1
         ORDER BY ordinal_position`,
        [table]
      );

      // Indexes
      const idxResult = await client.query(
        `SELECT i.relname AS index_name,
                ix.indisunique AS is_unique,
                array_agg(a.attname ORDER BY x.n) AS columns
         FROM pg_class t
         JOIN pg_index ix ON ix.indrelid = t.oid
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, n) ON TRUE
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
         WHERE t.relname = $1 AND t.relkind = 'r'
         GROUP BY i.relname, ix.indisunique
         ORDER BY i.relname`,
        [table]
      );

      // Foreign keys (this table references)
      const fkResult = await client.query(
        `SELECT
           kcu.column_name,
           ccu.table_name AS foreign_table,
           ccu.column_name AS foreign_column,
           tc.constraint_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name
           AND kcu.table_schema = tc.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name
           AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = 'public'
           AND tc.table_name = $1`,
        [table]
      );

      // Referenced by (other tables referencing this table)
      const refResult = await client.query(
        `SELECT
           tc.table_name AS source_table,
           kcu.column_name AS source_column,
           ccu.column_name AS target_column,
           tc.constraint_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name
           AND kcu.table_schema = tc.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name
           AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = 'public'
           AND ccu.table_name = $1`,
        [table]
      );

      return {
        columns: colResult.rows,
        indexes: idxResult.rows,
        foreignKeys: fkResult.rows,
        referencedBy: refResult.rows,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── DELETE /db-admin/tables/:table/records/:id ───────────────────────────────
router.delete("/db-admin/tables/:table/records/:id", async (req: Request, res: Response): Promise<void> => {
  const { table: _table, id: _id } = req.params; const table = param(_table); const id = param(_id);
  const pkCol = String(req.query.pkCol ?? "id");

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(pkCol)) {
    res.status(400).json({ error: "Invalid table or column name" });
    return;
  }

  try {
    await withClient(client =>
      client.query(`DELETE FROM "${table}" WHERE "${pkCol}" = $1`, [id])
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /db-admin/sql ───────────────────────────────────────────────────────
router.post("/db-admin/sql", async (req: Request, res: Response): Promise<void> => {
  const { sql } = req.body ?? {};
  if (!sql || typeof sql !== "string") {
    res.status(400).json({ error: "sql is required" });
    return;
  }

  // Validate every statement in the payload — prevents multi-statement bypass
  const validationError = validateSql(sql);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const start = Date.now();
  try {
    const result = await withClient(client => client.query(sql));
    const durationMs = Date.now() - start;
    res.json({
      rows: result.rows ?? [],
      rowCount: result.rowCount ?? 0,
      durationMs,
      fields: (result.fields ?? []).map(f => f.name),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ── GET /db-admin/tables/:table/export ───────────────────────────────────────
router.get("/db-admin/tables/:table/export", async (req: Request, res: Response): Promise<void> => {
  const { table: _table } = req.params; const table = param(_table);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    res.status(400).json({ error: "Invalid table name" });
    return;
  }

  try {
    const result = await withClient(client =>
      client.query(`SELECT * FROM "${table}" LIMIT 10000`)
    );
    const columns = (result.fields ?? []).map(f => f.name);
    const csv = toCsv(columns, result.rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${table}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /db-admin/tables/:table/import ──────────────────────────────────────
router.post("/db-admin/tables/:table/import", async (req: Request, res: Response): Promise<void> => {
  const { table: _table } = req.params; const table = param(_table);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    res.status(400).json({ error: "Invalid table name" });
    return;
  }

  const { rows, dryRun } = req.body ?? {};
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required" });
    return;
  }

  // Validate column names
  const columns = Object.keys(rows[0]);
  if (columns.some(c => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c))) {
    res.status(400).json({ error: "Invalid column names in import data" });
    return;
  }

  if (dryRun) {
    res.json({ dryRun: true, rowCount: rows.length, columns });
    return;
  }

  try {
    let inserted = 0;
    await withClient(async client => {
      for (const row of rows.slice(0, 5000)) {
        const vals = columns.map(c => row[c] ?? null);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
        const colList = columns.map(c => `"${c}"`).join(", ");
        await client.query(
          `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
          vals
        );
        inserted++;
      }
    });
    res.json({ success: true, inserted });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /db-admin/integrity ──────────────────────────────────────────────────
router.get("/db-admin/integrity", async (_req: Request, res: Response): Promise<void> => {
  try {
    const violations = await withClient(async client => {
      // Get all FK constraints
      const fkResult = await client.query<{
        table_name: string;
        column_name: string;
        foreign_table: string;
        foreign_column: string;
        constraint_name: string;
      }>(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column,
          tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        ORDER BY tc.table_name
      `);

      const results: Array<{
        constraintName: string;
        table: string;
        column: string;
        foreignTable: string;
        foreignColumn: string;
        violationCount: number;
        sampleIds: unknown[];
      }> = [];

      // Check each FK for violations (limit scan for performance)
      for (const fk of fkResult.rows) {
        try {
          const vResult = await client.query(`
            SELECT "${fk.column_name}" as val
            FROM "${fk.table_name}"
            WHERE "${fk.column_name}" IS NOT NULL
              AND "${fk.column_name}" NOT IN (
                SELECT "${fk.foreign_column}" FROM "${fk.foreign_table}"
              )
            LIMIT 10
          `);
          if (vResult.rows.length > 0) {
            // Get count
            const cResult = await client.query(`
              SELECT COUNT(*) as cnt
              FROM "${fk.table_name}"
              WHERE "${fk.column_name}" IS NOT NULL
                AND "${fk.column_name}" NOT IN (
                  SELECT "${fk.foreign_column}" FROM "${fk.foreign_table}"
                )
            `);
            results.push({
              constraintName: fk.constraint_name,
              table: fk.table_name,
              column: fk.column_name,
              foreignTable: fk.foreign_table,
              foreignColumn: fk.foreign_column,
              violationCount: parseInt(cResult.rows[0].cnt, 10),
              sampleIds: vResult.rows.map(r => r.val),
            });
          }
        } catch {
          // Skip if table/column is inaccessible
        }
      }

      return results;
    });

    res.json({ violations, scannedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /db-admin/maintenance/stats ─────────────────────────────────────────
router.get("/db-admin/maintenance/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await withClient(client =>
      client.query(`
        SELECT
          relname AS table_name,
          n_live_tup,
          n_dead_tup,
          last_autovacuum,
          last_autoanalyze,
          last_vacuum,
          last_analyze,
          n_mod_since_analyze,
          pg_size_pretty(pg_total_relation_size(quote_ident(relname))) AS total_size
        FROM pg_stat_user_tables
        ORDER BY n_dead_tup DESC, relname
      `)
    );
    res.json({ stats: result.rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /db-admin/maintenance ───────────────────────────────────────────────
router.post("/db-admin/maintenance", async (req: Request, res: Response): Promise<void> => {
  const { operation, table } = req.body ?? {};

  if (!["vacuum_analyze", "vacuum_analyze_all", "reindex", "reindex_all"].includes(operation)) {
    res.status(400).json({ error: "Invalid operation. Use: vacuum_analyze, vacuum_analyze_all, reindex, reindex_all" });
    return;
  }

  if ((operation === "vacuum_analyze" || operation === "reindex") && table) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      res.status(400).json({ error: "Invalid table name" });
      return;
    }
  }

  const start = Date.now();
  try {
    await withClient(async client => {
      switch (operation) {
        case "vacuum_analyze":
          if (table) await client.query(`VACUUM ANALYZE "${table}"`);
          else await client.query(`VACUUM ANALYZE`);
          break;
        case "vacuum_analyze_all":
          await client.query(`VACUUM ANALYZE`);
          break;
        case "reindex":
          if (table) await client.query(`REINDEX TABLE "${table}"`);
          else await client.query(`REINDEX DATABASE CURRENT`);
          break;
        case "reindex_all":
          await client.query(`REINDEX DATABASE CURRENT`);
          break;
      }
    });
    res.json({ success: true, operation, table: table ?? "all", durationMs: Date.now() - start });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /db-admin/tables/:table/truncate ────────────────────────────────────
router.post("/db-admin/tables/:table/truncate", async (req: Request, res: Response): Promise<void> => {
  const { table: _table } = req.params; const table = param(_table);
  const { confirm } = req.body ?? {};

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    res.status(400).json({ error: "Invalid table name" });
    return;
  }

  if (confirm !== table) {
    res.status(400).json({ error: "Confirmation string does not match table name" });
    return;
  }

  try {
    await withClient(client =>
      client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`)
    );
    res.json({ success: true, table });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /db-admin/platform-stats ─────────────────────────────────────────────
router.get("/db-admin/platform-stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await withClient(async client => {
      const [tableCount, rowSum, uptime] = await Promise.all([
        client.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM information_schema.tables
           WHERE table_schema='public' AND table_type='BASE TABLE'`
        ),
        client.query<{ total: string }>(
          `SELECT COALESCE(SUM(n_live_tup), 0)::text AS total FROM pg_stat_user_tables`
        ),
        client.query<{ seconds: string }>(
          `SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::bigint::text AS seconds`
        ),
      ]);
      return {
        tableCount: parseInt(tableCount.rows[0].count, 10),
        totalRows: parseInt(rowSum.rows[0].total, 10),
        dbUptimeSeconds: parseInt(uptime.rows[0].seconds, 10),
        dbStatus: "connected",
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      tableCount: 0,
      totalRows: 0,
      dbUptimeSeconds: 0,
      dbStatus: "error",
      error: (err as Error).message,
    });
  }
});

export default router;
