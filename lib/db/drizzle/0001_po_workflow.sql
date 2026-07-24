-- Task 88: Comprehensive PO Workflow migration
-- Adds new status values, approval/locking/SLA columns to procurement_pos,
-- and creates po_comments + po_versions tables.

-- 1. Extend the proc_po_status enum with new lifecycle values
ALTER TYPE "public"."proc_po_status" ADD VALUE IF NOT EXISTS 'Submitted';--> statement-breakpoint
ALTER TYPE "public"."proc_po_status" ADD VALUE IF NOT EXISTS 'PendingApproval';--> statement-breakpoint
ALTER TYPE "public"."proc_po_status" ADD VALUE IF NOT EXISTS 'Approved';--> statement-breakpoint
ALTER TYPE "public"."proc_po_status" ADD VALUE IF NOT EXISTS 'Rejected';--> statement-breakpoint
ALTER TYPE "public"."proc_po_status" ADD VALUE IF NOT EXISTS 'OnHold';--> statement-breakpoint
ALTER TYPE "public"."proc_po_status" ADD VALUE IF NOT EXISTS 'Revised';--> statement-breakpoint
ALTER TYPE "public"."proc_po_status" ADD VALUE IF NOT EXISTS 'InvoiceMatched';--> statement-breakpoint
ALTER TYPE "public"."proc_po_status" ADD VALUE IF NOT EXISTS 'PaymentPending';--> statement-breakpoint
ALTER TYPE "public"."proc_po_status" ADD VALUE IF NOT EXISTS 'Paid';--> statement-breakpoint

-- 2. Add approval workflow columns to procurement_pos
ALTER TABLE "procurement_pos"
  ADD COLUMN IF NOT EXISTS "is_locked" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "approval_request_id" integer,
  ADD COLUMN IF NOT EXISTS "sla_deadline" timestamp,
  ADD COLUMN IF NOT EXISTS "revision_number" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "submitted_at" timestamp,
  ADD COLUMN IF NOT EXISTS "submitted_by" integer,
  ADD COLUMN IF NOT EXISTS "submitted_by_name" text,
  ADD COLUMN IF NOT EXISTS "rejected_at" timestamp,
  ADD COLUMN IF NOT EXISTS "rejected_by" integer,
  ADD COLUMN IF NOT EXISTS "rejected_by_name" text,
  ADD COLUMN IF NOT EXISTS "rejection_reason" text,
  ADD COLUMN IF NOT EXISTS "on_hold_at" timestamp,
  ADD COLUMN IF NOT EXISTS "on_hold_by" integer,
  ADD COLUMN IF NOT EXISTS "on_hold_reason" text;--> statement-breakpoint

-- 3. Create po_comments table (threaded comments with optional attachment)
CREATE TABLE IF NOT EXISTS "po_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "po_id" integer NOT NULL REFERENCES "procurement_pos"("id") ON DELETE CASCADE,
  "user_id" integer,
  "user_name" text,
  "body" text NOT NULL,
  "parent_id" integer,
  "attachment_url" text,
  "attachment_name" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "po_comment_po_id_idx" ON "po_comments" ("po_id");--> statement-breakpoint

-- 4. Create po_versions table (JSONB revision snapshots)
CREATE TABLE IF NOT EXISTS "po_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "po_id" integer NOT NULL REFERENCES "procurement_pos"("id") ON DELETE CASCADE,
  "revision_number" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "changed_by" integer,
  "changed_by_name" text,
  "changed_at" timestamp NOT NULL DEFAULT now(),
  "change_summary" text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "po_version_po_id_idx" ON "po_versions" ("po_id");
