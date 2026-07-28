/**
 * Idempotent migration: creates the audit_logs table and its indexes
 * if they do not already exist.
 *
 * Called once on server boot from index.ts.
 * Uses a dedicated pg.Client (per Drizzle pool-pitfall rule) so it
 * never interferes with the main connection pool.
 */

import pg from "pg";
import { logger } from "../lib/logger";

export async function runAuditLogsMigration(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER,
        user_name     TEXT,
        user_role     TEXT,
        action        TEXT        NOT NULL,
        module        TEXT        NOT NULL,
        entity_type   TEXT,
        entity_id     TEXT,
        entity_label  TEXT,
        description   TEXT,
        old_values    JSONB,
        new_values    JSONB,
        ip_address    TEXT,
        user_agent    TEXT,
        status        TEXT        NOT NULL DEFAULT 'success',
        error_message TEXT,
        duration_ms   INTEGER,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_created
        ON audit_logs (created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_audit_user_id
        ON audit_logs (user_id);

      CREATE INDEX IF NOT EXISTS idx_audit_module
        ON audit_logs (module);

      CREATE INDEX IF NOT EXISTS idx_audit_action
        ON audit_logs (action);

      CREATE INDEX IF NOT EXISTS idx_audit_status
        ON audit_logs (status);
    `);

    logger.info("audit_logs migration: OK");
  } catch (err) {
    // Log but do not crash the server — the table may already exist
    // from a previous boot or a manual migration run.
    logger.error({ err }, "audit_logs migration failed");
  } finally {
    await client.end();
  }
}
