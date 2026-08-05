/**
 * Platform Admin migration
 * - Creates super_admin user (superadmin@automystics.com)
 * - Creates system_settings table (key/value store)
 * - Creates module_config table (per-module feature flags)
 * - Creates notification_templates table
 *
 * Auto-runs on every server boot (idempotent — all DDL uses IF NOT EXISTS
 * and INSERTs use ON CONFLICT DO NOTHING).
 *
 * Manual run: npx tsx src/migrations/create_platform_admin.ts
 */
import pg from "pg";

/**
 * Idempotent setup of all platform-admin DB objects.
 * Called once on server boot from index.ts.
 */
export async function runPlatformAdminMigration(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    /* ── system_settings ─────────────────────────────────────────────── */
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key         TEXT PRIMARY KEY,
        value       JSONB NOT NULL DEFAULT 'null',
        description TEXT,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by  INTEGER REFERENCES users(id)
      );
    `);

    /* ── module_config ───────────────────────────────────────────────── */
    await client.query(`
      CREATE TABLE IF NOT EXISTS module_config (
        module      TEXT PRIMARY KEY,
        enabled     BOOLEAN NOT NULL DEFAULT TRUE,
        settings    JSONB NOT NULL DEFAULT '{}',
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by  INTEGER REFERENCES users(id)
      );
    `);

    /* ── notification_templates ──────────────────────────────────────── */
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_templates (
        type        TEXT PRIMARY KEY,
        subject     TEXT NOT NULL DEFAULT '',
        body        TEXT NOT NULL DEFAULT '',
        enabled     BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by  INTEGER REFERENCES users(id)
      );
    `);

    /* ── Seed default system_settings rows ───────────────────────────── */
    await client.query(`
      INSERT INTO system_settings (key, value, description) VALUES
        ('app_name',          '"Mystics ERP"',                    'Application display name'),
        ('company_name',      '"Automystics Pvt. Ltd."',          'Company legal name'),
        ('default_currency',  '"INR"',                            'Default currency code'),
        ('session_timeout',   '480',                              'Session timeout in minutes'),
        ('max_login_attempts','5',                                'Max failed login attempts before lock'),
        ('mfa_required',      'false',                            'Require MFA for all users'),
        ('maintenance_mode',  'false',                            'Put app in maintenance mode'),
        ('log_level',         '"info"',                           'Server log level (debug/info/warn/error)'),
        ('smtp_host',         '"smtp.automystics.com"',           'Outbound SMTP server'),
        ('smtp_port',         '587',                              'Outbound SMTP port')
      ON CONFLICT (key) DO NOTHING;
    `);

    /* ── Seed default module_config rows ─────────────────────────────── */
    const modules = [
      "dashboard","crm","procurement","materials","vendors",
      "projects","inventory","engineering","commissioning",
      "oam","finance","reports","admin","approvals",
    ];
    for (const mod of modules) {
      await client.query(
        `INSERT INTO module_config (module, enabled, settings)
         VALUES ($1, TRUE, '{}') ON CONFLICT (module) DO NOTHING`,
        [mod]
      );
    }

    /* ── Seed default notification_templates ─────────────────────────── */
    await client.query(`
      INSERT INTO notification_templates (type, subject, body) VALUES
        ('approval_request',  'Action Required: {{title}}',      'Hi {{name}},\n\nA new approval request "{{title}}" requires your action.\n\nPlease log in to review it.\n\nRegards,\nMystics ERP'),
        ('approval_approved', '✓ Approved: {{title}}',           'Hi {{name}},\n\n"{{title}}" has been approved.\n\nRegards,\nMystics ERP'),
        ('approval_rejected', '✗ Rejected: {{title}}',           'Hi {{name}},\n\n"{{title}}" was rejected.\n\nRegards,\nMystics ERP'),
        ('po_issued',         'Purchase Order #{{ref}} Issued',  'Dear {{vendor}},\n\nPO #{{ref}} has been issued. Please confirm receipt.\n\nRegards,\nProcurement Team'),
        ('grn_created',       'GRN #{{ref}} Created',            'Hi {{name}},\n\nA new GRN #{{ref}} has been logged.\n\nRegards,\nMystics ERP'),
        ('invoice_due',       'Invoice #{{ref}} Due Soon',       'Hi {{name}},\n\nInvoice #{{ref}} is due on {{date}}. Please arrange payment.\n\nRegards,\nFinance Team')
      ON CONFLICT (type) DO NOTHING;
    `);

    /* ── Super admin user ─────────────────────────────────────────────── */
    // Production: supply SUPER_ADMIN_PASSWORD env variable.
    // Development: fall back to a well-known dev password ("superadmin123")
    //              so the quick-access button on the login page works.
    //              Never use this default in production.
    const rawPassword = process.env.SUPER_ADMIN_PASSWORD;
    const devPassword = "superadmin123";

    if (rawPassword) {
      // Production / explicit password — hash it.
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.default.hash(rawPassword, 12);
      await client.query(`
        INSERT INTO users (name, email, role, password_hash)
        VALUES ('Super Admin', 'superadmin@automystics.com', 'super_admin', $1)
        ON CONFLICT (email) DO UPDATE
          SET role = 'super_admin', password_hash = $1;
      `, [hash]);
    } else if (process.env.NODE_ENV !== "production") {
      // Dev / non-production: use plain-text dev password (auth route supports plain-text).
      // This also resets any bcrypt hash that may have been created by a prior migration run,
      // ensuring the quick-access login button always works in local dev.
      await client.query(`
        INSERT INTO users (name, email, role, password_hash)
        VALUES ('Super Admin', 'superadmin@automystics.com', 'super_admin', $1)
        ON CONFLICT (email) DO UPDATE
          SET role = 'super_admin', password_hash = $1;
      `, [devPassword]);
    } else {
      // Production but no password set — skip to avoid an insecure default.
      console.warn(
        "⚠ SUPER_ADMIN_PASSWORD not set in production — skipping super_admin upsert. " +
        "Set the env variable to create or update the account."
      );
    }

    console.log("[platform_admin] migration: OK");
  } finally {
    await client.end().catch(() => {});
  }
}

// ── Direct execution ──────────────────────────────────────────────────────────
// To run manually: npx tsx -e "import('./src/migrations/create_platform_admin.ts').then(m => m.runPlatformAdminMigration().then(() => process.exit(0)))"
// This file is auto-run on every server boot via index.ts.
