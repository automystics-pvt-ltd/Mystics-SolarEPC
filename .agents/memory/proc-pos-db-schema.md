---
name: Procurement PO DB schema gaps
description: Tables and columns the Drizzle proc_pos schema expects that don't auto-create and must be added via raw SQL.
---

## Missing tables (must CREATE manually via psql)

`po_comments` and `po_versions` — defined in `lib/db/src/schema/proc_pos.ts` but never created by drizzle-push. Run:

```sql
CREATE TABLE IF NOT EXISTS po_comments (
  id serial PRIMARY KEY, po_id integer NOT NULL REFERENCES procurement_pos(id) ON DELETE CASCADE,
  user_id integer, user_name text, body text NOT NULL, parent_id integer,
  attachment_url text, attachment_name text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS po_comment_po_id_idx ON po_comments(po_id);

CREATE TABLE IF NOT EXISTS po_versions (
  id serial PRIMARY KEY, po_id integer NOT NULL REFERENCES procurement_pos(id) ON DELETE CASCADE,
  revision_number integer NOT NULL, snapshot jsonb NOT NULL,
  changed_by integer, changed_by_name text, changed_at timestamp NOT NULL DEFAULT now(), change_summary text
);
CREATE INDEX IF NOT EXISTS po_version_po_id_idx ON po_versions(po_id);
```

## Missing columns on procurement_pos (must ALTER TABLE manually)

The approval workflow columns and project_id:

```sql
ALTER TABLE procurement_pos
  ADD COLUMN IF NOT EXISTS project_id integer REFERENCES projects(id),
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_request_id integer,
  ADD COLUMN IF NOT EXISTS sla_deadline timestamp,
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS submitted_at timestamp,
  ADD COLUMN IF NOT EXISTS submitted_by integer,
  ADD COLUMN IF NOT EXISTS submitted_by_name text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamp,
  ADD COLUMN IF NOT EXISTS rejected_by integer,
  ADD COLUMN IF NOT EXISTS rejected_by_name text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS on_hold_at timestamp,
  ADD COLUMN IF NOT EXISTS on_hold_by integer,
  ADD COLUMN IF NOT EXISTS on_hold_reason text;
CREATE INDEX IF NOT EXISTS idx_proc_pos_project_id ON procurement_pos(project_id) WHERE project_id IS NOT NULL;
```

**Why:** drizzle push requires TTY (not available in this env); all schema additions must be applied manually via psql. The `loadFullPO` function selects all Drizzle schema columns, so any missing column causes a 500 error.

**How to apply:** On any new DB or after a fresh clone, run these SQL statements before starting the API server.

## Key architectural clarification

There are TWO distinct PO tables:
1. `procurement_pos` — vendor procurement POs (advanced module: proc_pos.ts, proc_grns.ts, proc_invoices.ts). NOW has project_id.
2. `purchase_orders` — material-request-based POs (simpler procurement.ts). Always had project_id.

The `lib/db` package exports raw TypeScript source (no build step needed at runtime), but uses TypeScript project references with `composite: true` and a `dist/` output. When the API server bundles via esbuild, it reads the source directly. When running `tsc --noEmit` on the api-server, the lib/db `dist/` declarations must be up-to-date — run `cd lib/db && npx tsc -p tsconfig.json` first.
