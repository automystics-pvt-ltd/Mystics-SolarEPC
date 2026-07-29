/**
 * Platform Admin migration
 * - Creates super_admin user (superadmin@automystics.com / SuperAdmin@123)
 * - Creates system_settings table (key/value store)
 * - Creates module_config table (per-module feature flags)
 * - Creates notification_templates table
 *
 * Run: npx tsx src/migrations/create_platform_admin.ts
 */
import pg from "pg";
import bcrypt from "bcryptjs";

async function run() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    console.log("Running platform_admin migration…");

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
    console.log("✓ system_settings");

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
    console.log("✓ module_config");

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
    console.log("✓ notification_templates");

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
    console.log("✓ system_settings defaults seeded");

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
    console.log("✓ module_config defaults seeded");

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
    console.log("✓ notification_templates seeded");

    /* ── Super admin user ─────────────────────────────────────────────── */
    // Password must be provided via SUPER_ADMIN_PASSWORD env variable.
    // If the variable is absent and the user already exists, we skip.
    // Never falls back to a hardcoded default.
    const rawPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (!rawPassword) {
      const exists = await client.query(
        "SELECT id FROM users WHERE email = 'superadmin@automystics.com'"
      );
      if (exists.rowCount === 0) {
        console.warn(
          "⚠ SUPER_ADMIN_PASSWORD not set — skipping super_admin creation. " +
          "Set the env variable and re-run this migration to create the account."
        );
      } else {
        console.log("✓ super_admin user already exists — skipping (no password change)");
      }
    } else {
      const hash = await bcrypt.hash(rawPassword, 12);
      await client.query(`
        INSERT INTO users (name, email, role, password_hash)
        VALUES ('Super Admin', 'superadmin@automystics.com', 'super_admin', $1)
        ON CONFLICT (email) DO UPDATE
          SET role = 'super_admin', password_hash = $1;
      `, [hash]);
      console.log("✓ super_admin user upserted (password from SUPER_ADMIN_PASSWORD)");
    }

    console.log("\nMigration complete ✓");
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
