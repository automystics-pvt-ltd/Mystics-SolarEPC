-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."audit_action" AS ENUM('Created', 'Updated', 'Submitted', 'ReviewStarted', 'RevisionRequested', 'Approved', 'Rejected', 'Deleted', 'CommentAdded', 'DocumentUploaded', 'POGenerated', 'Reopened', 'Cancelled', 'AttachmentAdded', 'AttachmentRemoved', 'Escalated');--> statement-breakpoint
CREATE TYPE "public"."grn_return_status" AS ENUM('Draft', 'Submitted', 'Approved', 'Dispatched', 'Closed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('info', 'warning', 'success', 'error', 'approval');--> statement-breakpoint
CREATE TYPE "public"."proc_grn_item_qc_status" AS ENUM('Pending', 'Accepted', 'PartiallyAccepted', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."proc_grn_status" AS ENUM('Draft', 'Submitted', 'Accepted', 'PartiallyAccepted', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."proc_invoice_match_status" AS ENUM('Matched', 'MismatchPending', 'MismatchApproved');--> statement-breakpoint
CREATE TYPE "public"."proc_invoice_status" AS ENUM('Draft', 'PendingApproval', 'Approved', 'OnHold', 'Paid', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."proc_po_status" AS ENUM('Draft', 'Issued', 'Acknowledged', 'PartiallyReceived', 'FullyReceived', 'Closed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."proc_quotation_status" AS ENUM('Draft', 'Submitted', 'UnderReview', 'RevisionRequested', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."stock_transfer_status" AS ENUM('Draft', 'Approved', 'InTransit', 'Completed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."uom" AS ENUM('Nos', 'Pcs', 'Set', 'Pair', 'Kg', 'MT', 'Gm', 'Mtr', 'Cm', 'Mm', 'Ft', 'Inch', 'Sqm', 'Sqft', 'Ltr', 'ML', 'Box', 'Carton', 'Bundle', 'Roll', 'Bag', 'Drum', 'KVA', 'KW', 'KWp', 'kWh', 'VA', 'Other');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('Active', 'Inactive', 'Blacklisted');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'Manual' NOT NULL,
	"owner_id" integer,
	"territory" text,
	"company_name" text,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"product_interest" text,
	"estimated_value" numeric(15, 2),
	"score" integer DEFAULT 0,
	"status" text DEFAULT 'New' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_pos" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"client_po_number" text NOT NULL,
	"client_po_file_url" text,
	"contract_value" numeric(15, 2) NOT NULL,
	"payment_terms" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"project_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"boq_items" json DEFAULT '[]'::json,
	"version" integer DEFAULT 1 NOT NULL,
	"markup_pct" numeric(5, 2) DEFAULT '0',
	"total_amount" numeric(15, 2),
	"approval_status" text DEFAULT 'Draft' NOT NULL,
	"valid_till" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_po_id" integer NOT NULL,
	"project_id" integer,
	"type" text DEFAULT 'Tax' NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"tax_details" text,
	"due_date" date,
	"payment_status" text DEFAULT 'Unpaid' NOT NULL,
	"paid_amount" numeric(15, 2),
	"paid_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_module" text,
	"source_ref_id" integer,
	"title" text NOT NULL,
	"owner_id" integer,
	"priority" text DEFAULT 'Medium' NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'Open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_entity_type" text,
	"source_entity_id" integer,
	"project_id" integer,
	"module" text,
	"raised_by" integer,
	"reason" text NOT NULL,
	"severity" text DEFAULT 'Medium' NOT NULL,
	"assigned_to" integer,
	"status" text DEFAULT 'Pending' NOT NULL,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"wbs_code" text,
	"name" text NOT NULL,
	"planned_start" date,
	"planned_end" date,
	"actual_start" date,
	"actual_end" date,
	"dependency_ids" integer[] DEFAULT '{}',
	"percent_complete" real DEFAULT 0,
	"status" text DEFAULT 'NotStarted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'sales' NOT NULL,
	"org_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"cost_head" text NOT NULL,
	"budgeted_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"committed_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"actual_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"revision_no" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trade" text NOT NULL,
	"contract_value" numeric(15, 2),
	"contact" text,
	"rating" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dprs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"report_date" date NOT NULL,
	"submitted_by" integer,
	"work_summary" text,
	"manpower_count" integer,
	"weather" text,
	"percent_complete" real,
	"photos" text[] DEFAULT '{""}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"incurred_by" integer,
	"date" date NOT NULL,
	"receipt_url" text,
	"approval_status" text DEFAULT 'Pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"milestone_name" text NOT NULL,
	"trigger_condition" text,
	"amount" numeric(15, 2) NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'Pending' NOT NULL,
	"invoice_ref" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_po_id" integer,
	"name" text NOT NULL,
	"site_location" text,
	"pm_owner_id" integer,
	"start_date" date,
	"planned_end" date,
	"status" text DEFAULT 'Planning' NOT NULL,
	"parent_project_id" integer,
	"contract_value" numeric(15, 2),
	"percent_complete" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"activity_id" integer,
	"raised_by" integer,
	"mr_number" text NOT NULL,
	"items" json DEFAULT '[]'::json,
	"required_by_date" date,
	"status" text DEFAULT 'Open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_quotation_id" integer NOT NULL,
	"vendor_id" integer,
	"vendor_name" text NOT NULL,
	"project_id" integer,
	"po_number" text NOT NULL,
	"po_date" date NOT NULL,
	"expected_delivery_date" date,
	"amount" numeric(15, 2) NOT NULL,
	"delivery_terms" text,
	"status" text DEFAULT 'Open' NOT NULL,
	"warehouse_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"invoice_number" text NOT NULL,
	"scanned_file_url" text,
	"invoice_amount" numeric(15, 2) NOT NULL,
	"invoice_date" date,
	"due_date" date,
	"approval_status" text DEFAULT 'Pending' NOT NULL,
	"credit_term_days" integer DEFAULT 30,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"mr_id" integer NOT NULL,
	"vendor_id" integer,
	"vendor_name" text NOT NULL,
	"quotation_number" text NOT NULL,
	"quoted_amount" numeric(15, 2) NOT NULL,
	"item_price_breakup" json DEFAULT '[]'::json,
	"validity_date" date,
	"quotation_file_url" text,
	"manager_remarks" text,
	"md_remarks" text,
	"is_recommended" boolean DEFAULT false,
	"l1_status" text DEFAULT 'Pending' NOT NULL,
	"status" text DEFAULT 'Submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_challans" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" integer NOT NULL,
	"project_id" integer,
	"challan_number" text NOT NULL,
	"issued_to" text,
	"line_items" json DEFAULT '[]'::json,
	"issued_date" date NOT NULL,
	"purpose" text DEFAULT 'SiteIssue' NOT NULL,
	"reference_doc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grns" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"grn_number" text NOT NULL,
	"received_date" date NOT NULL,
	"line_items" json DEFAULT '[]'::json,
	"qc_status" text DEFAULT 'Pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" integer NOT NULL,
	"audit_date" date NOT NULL,
	"auditor_id" integer,
	"system_qty" numeric(12, 3),
	"physical_qty" numeric(12, 3),
	"variance_qty" numeric(12, 3),
	"variance_value" numeric(15, 2),
	"status" text DEFAULT 'Open' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qc_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"grn_id" integer NOT NULL,
	"inspected_by" integer,
	"checklist_json" text,
	"accepted_qty" numeric(12, 3) NOT NULL,
	"rejected_qty" numeric(12, 3) DEFAULT '0' NOT NULL,
	"rejection_reason" text,
	"status" text DEFAULT 'Passed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" integer NOT NULL,
	"item_id" integer,
	"item_name" text NOT NULL,
	"txn_type" text NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"balance_qty" numeric(12, 3) NOT NULL,
	"ref_doc_type" text,
	"ref_doc_id" integer,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_valuation" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" integer NOT NULL,
	"item_id" integer,
	"item_name" text NOT NULL,
	"valuation_method" text DEFAULT 'FIFO' NOT NULL,
	"unit_value" numeric(15, 4) DEFAULT '0' NOT NULL,
	"total_value" numeric(15, 2) DEFAULT '0' NOT NULL,
	"balance_qty" numeric(12, 3) DEFAULT '0' NOT NULL,
	"as_of_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" integer NOT NULL,
	"zone" text NOT NULL,
	"rack" text NOT NULL,
	"bin" text NOT NULL,
	"current_item_id" integer,
	"current_item_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_surveys" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"surveyed_by" integer,
	"survey_date" date,
	"roof_type" text,
	"roof_area" real,
	"shadow_analysis" text,
	"gps_lat" real,
	"gps_lng" real,
	"sanctioned_load" real,
	"avg_monthly_bill" real,
	"proposed_capacity" real,
	"photos" text[] DEFAULT '{""}',
	"structural_notes" text,
	"feasibility_status" text DEFAULT 'Pending' NOT NULL,
	"feasibility_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snag_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"zone" text,
	"category" text DEFAULT 'Civil' NOT NULL,
	"description" text NOT NULL,
	"reported_by" integer,
	"photo_url" text,
	"severity" text DEFAULT 'Medium' NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"assigned_to" integer,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"project_id" integer,
	"location" text,
	"custodian_id" integer,
	"capacity" text,
	"type" text DEFAULT 'Site' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"doc_type" text DEFAULT 'Layout' NOT NULL,
	"title" text NOT NULL,
	"version" text DEFAULT 'v1' NOT NULL,
	"file_url" text,
	"uploaded_by" integer,
	"description" text,
	"internal_status" text DEFAULT 'Draft' NOT NULL,
	"internal_approved_by" integer,
	"internal_approved_at" timestamp with time zone,
	"client_approved_at" timestamp with time zone,
	"client_approved_by" text,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_id" integer NOT NULL,
	"version" text NOT NULL,
	"file_url" text,
	"change_notes" text,
	"revised_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commissioning_checklists" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"commissioned_on" date,
	"commissioned_by" integer,
	"client_signatory_name" text,
	"client_signed_at" timestamp with time zone,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commissioning_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"checklist_id" integer NOT NULL,
	"category" text DEFAULT 'Electrical' NOT NULL,
	"description" text NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"done_by" integer,
	"done_at" timestamp with time zone,
	"remarks" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"doc_type" text DEFAULT 'DISCOM' NOT NULL,
	"title" text NOT NULL,
	"file_url" text,
	"submitted_by" integer,
	"submission_date" date,
	"status" text DEFAULT 'Draft' NOT NULL,
	"expiry_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amc_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"contract_number" text NOT NULL,
	"client_name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"annual_value" numeric(15, 2) NOT NULL,
	"visit_frequency" text DEFAULT 'Quarterly' NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"terms" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"amc_contract_id" integer,
	"project_id" integer NOT NULL,
	"visit_type" text DEFAULT 'Preventive' NOT NULL,
	"scheduled_date" date NOT NULL,
	"assigned_technician_id" integer,
	"assigned_technician_name" text,
	"status" text DEFAULT 'Scheduled' NOT NULL,
	"completed_date" date,
	"work_done" text,
	"observations" text,
	"next_scheduled_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"amc_contract_id" integer,
	"ticket_number" text NOT NULL,
	"raised_by" text,
	"issue_category" text DEFAULT 'Performance' NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'Medium' NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"assigned_technician_id" integer,
	"assigned_technician_name" text,
	"sla_hours" integer DEFAULT 48,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id" integer NOT NULL,
	"name" text NOT NULL,
	"designation" text,
	"email" text,
	"phone" varchar(20),
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procurement_quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference_id" varchar(30) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "proc_quotation_status" DEFAULT 'Draft' NOT NULL,
	"mr_id" integer,
	"vendor_id" integer,
	"vendor_snapshot_name" text,
	"quotation_date" varchar(20),
	"validity_date" varchar(20),
	"currency" varchar(5) DEFAULT 'INR',
	"payment_terms" text,
	"delivery_terms" text,
	"delivery_lead_days" integer,
	"warranty_months" integer,
	"subtotal" numeric(16, 2) DEFAULT '0',
	"total_discount" numeric(16, 2) DEFAULT '0',
	"total_gst" numeric(16, 2) DEFAULT '0',
	"freight_charges" numeric(14, 2) DEFAULT '0',
	"other_charges" numeric(14, 2) DEFAULT '0',
	"total_amount" numeric(16, 2) DEFAULT '0',
	"file_url" text,
	"file_original_name" text,
	"vendor_remarks" text,
	"internal_notes" text,
	"submitted_at" timestamp,
	"submitted_by" integer,
	"submitted_by_name" text,
	"reviewed_at" timestamp,
	"reviewed_by" integer,
	"reviewed_by_name" text,
	"approved_at" timestamp,
	"approved_by" integer,
	"approved_by_name" text,
	"rejected_at" timestamp,
	"rejected_by" integer,
	"rejected_by_name" text,
	"approval_remarks" text,
	"is_l1" boolean DEFAULT false,
	"is_recommended" boolean DEFAULT false,
	"recommendation_notes" text,
	"po_generated" boolean DEFAULT false,
	"created_by" integer,
	"created_by_name" text,
	"updated_by" integer,
	"updated_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"locked_by" integer,
	"reopened_at" timestamp,
	"reopened_by" integer,
	"reopen_reason" text,
	"approval_request_id" integer,
	CONSTRAINT "procurement_quotations_reference_id_unique" UNIQUE("reference_id")
);
--> statement-breakpoint
CREATE TABLE "proc_quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"material_id" integer,
	"material_code" varchar(30),
	"material_name" text NOT NULL,
	"description" text,
	"uom" text DEFAULT 'Nos',
	"hsn_sac_code" varchar(20),
	"brand" text,
	"qty" numeric(12, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0',
	"discount_amount" numeric(14, 2) DEFAULT '0',
	"taxable_amount" numeric(14, 2) DEFAULT '0',
	"gst_rate" numeric(5, 2) DEFAULT '18',
	"cgst_amount" numeric(14, 2) DEFAULT '0',
	"sgst_amount" numeric(14, 2) DEFAULT '0',
	"igst_amount" numeric(14, 2) DEFAULT '0',
	"total_gst" numeric(14, 2) DEFAULT '0',
	"line_total" numeric(14, 2) DEFAULT '0',
	"delivery_days" integer,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "quotation_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"action" "audit_action" NOT NULL,
	"performed_by" integer,
	"performed_by_name" text NOT NULL,
	"performed_by_role" text,
	"old_values" jsonb,
	"new_values" jsonb,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by" integer,
	"changed_by_name" text,
	"change_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proc_po_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"material_id" integer,
	"material_code" varchar(30),
	"material_name" text NOT NULL,
	"description" text,
	"uom" text DEFAULT 'Nos',
	"hsn_sac_code" varchar(20),
	"brand" text,
	"qty" numeric(12, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0',
	"discount_amount" numeric(14, 2) DEFAULT '0',
	"taxable_amount" numeric(14, 2) DEFAULT '0',
	"gst_rate" numeric(5, 2) DEFAULT '18',
	"total_gst" numeric(14, 2) DEFAULT '0',
	"line_total" numeric(14, 2) DEFAULT '0',
	"delivered_qty" numeric(12, 3) DEFAULT '0',
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20),
	"name" text NOT NULL,
	"trade_name" text,
	"status" "vendor_status" DEFAULT 'Active' NOT NULL,
	"gstin" varchar(20),
	"pan" varchar(15),
	"gst_registered_state" text,
	"gst_state_code" varchar(4),
	"is_msme" boolean DEFAULT false,
	"msme_number" varchar(30),
	"billing_address" text,
	"billing_city" text,
	"billing_state" text,
	"billing_pincode" varchar(10),
	"billing_country" text DEFAULT 'India',
	"primary_email" text,
	"primary_phone" varchar(20),
	"website" text,
	"bank_name" text,
	"bank_branch" text,
	"bank_account_number" varchar(30),
	"bank_ifsc" varchar(15),
	"bank_account_type" text,
	"upi_id" text,
	"payment_terms" text,
	"credit_limit" text,
	"tags" text[],
	"notes" text,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "material_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" varchar(20),
	"description" text,
	"parent_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "material_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "procurement_pos" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_number" varchar(30) NOT NULL,
	"quotation_id" integer,
	"vendor_id" integer,
	"vendor_name" text NOT NULL,
	"vendor_gstin" varchar(20),
	"vendor_address" text,
	"vendor_contact" text,
	"status" "proc_po_status" DEFAULT 'Draft' NOT NULL,
	"po_date" varchar(20),
	"delivery_deadline" varchar(20),
	"delivery_address" text,
	"payment_terms" text,
	"warranty_months" integer,
	"freight_charges" numeric(14, 2) DEFAULT '0',
	"other_charges" numeric(14, 2) DEFAULT '0',
	"subtotal" numeric(16, 2) DEFAULT '0',
	"total_gst" numeric(16, 2) DEFAULT '0',
	"total_amount" numeric(16, 2) DEFAULT '0',
	"special_terms" text,
	"internal_notes" text,
	"approved_by" integer,
	"approved_by_name" text,
	"approved_at" timestamp,
	"acknowledged_at" timestamp,
	"closed_at" timestamp,
	"created_by" integer,
	"created_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"vendor_dispatch_ref" varchar(50),
	"tracking_number" varchar(50),
	"dispatched_at" timestamp,
	"expected_delivery_date" varchar(20),
	CONSTRAINT "procurement_pos_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "proc_grns" (
	"id" serial PRIMARY KEY NOT NULL,
	"grn_number" varchar(30) NOT NULL,
	"po_id" integer NOT NULL,
	"vendor_id" integer,
	"vendor_name" text NOT NULL,
	"status" "proc_grn_status" DEFAULT 'Draft' NOT NULL,
	"delivery_date" varchar(20),
	"vehicle_number" varchar(30),
	"dc_number" varchar(50),
	"dc_date" varchar(20),
	"received_by" integer,
	"received_by_name" text,
	"received_at" timestamp,
	"inspected_by" integer,
	"inspected_by_name" text,
	"inspected_at" timestamp,
	"approved_by" integer,
	"approved_by_name" text,
	"approved_at" timestamp,
	"rejected_by" integer,
	"rejected_by_name" text,
	"rejected_at" timestamp,
	"approval_remarks" text,
	"total_ordered_qty" numeric(12, 3) DEFAULT '0',
	"total_received_qty" numeric(12, 3) DEFAULT '0',
	"total_accepted_qty" numeric(12, 3) DEFAULT '0',
	"total_rejected_qty" numeric(12, 3) DEFAULT '0',
	"total_accepted_value" numeric(16, 2) DEFAULT '0',
	"remarks" text,
	"internal_notes" text,
	"created_by" integer,
	"created_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "proc_grns_grn_number_unique" UNIQUE("grn_number")
);
--> statement-breakpoint
CREATE TABLE "proc_grn_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"grn_id" integer NOT NULL,
	"po_item_id" integer,
	"line_no" integer NOT NULL,
	"material_id" integer,
	"material_code" varchar(30),
	"material_name" text NOT NULL,
	"description" text,
	"uom" text DEFAULT 'Nos',
	"hsn_sac_code" varchar(20),
	"ordered_qty" numeric(12, 3) DEFAULT '0',
	"received_qty" numeric(12, 3) DEFAULT '0',
	"accepted_qty" numeric(12, 3) DEFAULT '0',
	"rejected_qty" numeric(12, 3) DEFAULT '0',
	"damaged_qty" numeric(12, 3) DEFAULT '0',
	"excess_qty" numeric(12, 3) DEFAULT '0',
	"short_qty" numeric(12, 3) DEFAULT '0',
	"qc_status" "proc_grn_item_qc_status" DEFAULT 'Pending',
	"rejection_reason" text,
	"item_remarks" text,
	"unit_price" numeric(14, 2) DEFAULT '0',
	"accepted_value" numeric(14, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "proc_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" varchar(30) NOT NULL,
	"po_id" integer NOT NULL,
	"grn_id" integer,
	"vendor_id" integer,
	"vendor_name" text NOT NULL,
	"vendor_invoice_number" varchar(50),
	"vendor_invoice_date" varchar(20),
	"status" "proc_invoice_status" DEFAULT 'Draft' NOT NULL,
	"match_status" "proc_invoice_match_status" DEFAULT 'Matched',
	"mismatch_details" text,
	"mismatch_approved_by" integer,
	"mismatch_approved_by_name" text,
	"mismatch_approved_at" timestamp,
	"subtotal" numeric(16, 2) DEFAULT '0',
	"total_gst" numeric(16, 2) DEFAULT '0',
	"freight_charges" numeric(14, 2) DEFAULT '0',
	"other_charges" numeric(14, 2) DEFAULT '0',
	"total_amount" numeric(16, 2) DEFAULT '0',
	"tds_amount" numeric(14, 2) DEFAULT '0',
	"net_payable" numeric(16, 2) DEFAULT '0',
	"payment_terms" text,
	"due_date" varchar(20),
	"submitted_at" timestamp,
	"submitted_by" integer,
	"submitted_by_name" text,
	"approved_by" integer,
	"approved_by_name" text,
	"approved_at" timestamp,
	"rejected_by" integer,
	"rejected_by_name" text,
	"rejected_at" timestamp,
	"approval_remarks" text,
	"paid_at" timestamp,
	"paid_by" integer,
	"paid_by_name" text,
	"payment_reference" varchar(100),
	"payment_mode" varchar(30),
	"internal_notes" text,
	"created_by" integer,
	"created_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "proc_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "proc_invoice_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"performed_by" integer,
	"performed_by_name" text,
	"remarks" text,
	"old_values" json,
	"new_values" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proc_invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"po_item_id" integer,
	"grn_item_id" integer,
	"line_no" integer NOT NULL,
	"material_name" text NOT NULL,
	"material_code" varchar(30),
	"uom" text DEFAULT 'Nos',
	"hsn_sac_code" varchar(20),
	"ordered_qty" numeric(12, 3) DEFAULT '0',
	"received_qty" numeric(12, 3) DEFAULT '0',
	"invoiced_qty" numeric(12, 3) DEFAULT '0',
	"unit_price" numeric(14, 2) DEFAULT '0',
	"discount_pct" numeric(5, 2) DEFAULT '0',
	"taxable_amount" numeric(14, 2) DEFAULT '0',
	"gst_rate" numeric(5, 2) DEFAULT '18',
	"gst_amount" numeric(14, 2) DEFAULT '0',
	"line_total" numeric(14, 2) DEFAULT '0',
	"is_matched" boolean DEFAULT true,
	"mismatch_note" text
);
--> statement-breakpoint
CREATE TABLE "proc_po_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"performed_by" integer,
	"performed_by_name" text,
	"remarks" text,
	"old_values" json,
	"new_values" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proc_grn_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"grn_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"performed_by" integer,
	"performed_by_name" text,
	"remarks" text,
	"old_values" json,
	"new_values" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "notification_type" DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"entity_ref" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"action_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_number" varchar(30) NOT NULL,
	"from_warehouse_id" integer NOT NULL,
	"from_warehouse_name" text NOT NULL,
	"to_warehouse_id" integer NOT NULL,
	"to_warehouse_name" text NOT NULL,
	"status" "stock_transfer_status" DEFAULT 'Draft' NOT NULL,
	"reason" text,
	"transfer_date" varchar(20),
	"completed_date" varchar(20),
	"remarks" text,
	"initiated_by" integer,
	"initiated_by_name" text,
	"approved_by" integer,
	"approved_by_name" text,
	"approved_at" timestamp,
	"completed_by" integer,
	"completed_by_name" text,
	"completed_at" timestamp,
	"total_items" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_transfers_transfer_number_unique" UNIQUE("transfer_number")
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"material_id" integer,
	"material_code" varchar(30),
	"material_name" text NOT NULL,
	"uom" text DEFAULT 'Nos',
	"qty" numeric(12, 3) DEFAULT '0',
	"from_bin" varchar(50),
	"to_bin" varchar(50),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(30),
	"name" text NOT NULL,
	"description" text,
	"category_id" integer,
	"uom" "uom" DEFAULT 'Nos' NOT NULL,
	"hsn_sac_code" varchar(20),
	"gst_rate" numeric(5, 2) DEFAULT '18',
	"cess_rate" numeric(5, 2) DEFAULT '0',
	"base_price" numeric(14, 2),
	"last_purchase_price" numeric(14, 2),
	"currency" varchar(5) DEFAULT 'INR',
	"brand" text,
	"model" text,
	"specifications" text,
	"min_order_qty" numeric(12, 3),
	"lead_time_days" integer,
	"is_active" boolean DEFAULT true,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"min_stock_level" numeric(12, 3),
	"max_stock_level" numeric(12, 3),
	"reorder_point" numeric(12, 3),
	CONSTRAINT "materials_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "grn_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_number" varchar(30) NOT NULL,
	"grn_id" integer NOT NULL,
	"po_id" integer,
	"vendor_id" integer,
	"vendor_name" text NOT NULL,
	"status" "grn_return_status" DEFAULT 'Draft' NOT NULL,
	"return_reason" text NOT NULL,
	"return_type" text DEFAULT 'Rejection' NOT NULL,
	"return_date" varchar(20),
	"dispatch_date" varchar(20),
	"credit_note_number" varchar(50),
	"credit_note_date" varchar(20),
	"credit_note_amount" numeric(14, 2) DEFAULT '0',
	"total_return_qty" numeric(12, 3) DEFAULT '0',
	"total_return_value" numeric(14, 2) DEFAULT '0',
	"remarks" text,
	"created_by" integer,
	"created_by_name" text,
	"submitted_by" integer,
	"submitted_by_name" text,
	"submitted_at" timestamp,
	"approved_by" integer,
	"approved_by_name" text,
	"approved_at" timestamp,
	"approval_remarks" text,
	"dispatched_by" integer,
	"dispatched_by_name" text,
	"dispatched_at" timestamp,
	"closed_by" integer,
	"closed_by_name" text,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "grn_returns_return_number_unique" UNIQUE("return_number")
);
--> statement-breakpoint
CREATE TABLE "grn_return_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"performed_by" integer,
	"performed_by_name" text,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grn_return_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_id" integer NOT NULL,
	"grn_item_id" integer,
	"line_no" integer NOT NULL,
	"material_id" integer,
	"material_code" varchar(30),
	"material_name" text NOT NULL,
	"uom" text DEFAULT 'Nos',
	"return_qty" numeric(12, 3) DEFAULT '0',
	"unit_price" numeric(14, 2) DEFAULT '0',
	"return_value" numeric(14, 2) DEFAULT '0',
	"rejection_reason" text,
	"batch_lot_number" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_delegates" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"module" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"step_id" integer,
	"actor_id" integer,
	"action_type" text NOT NULL,
	"comment" text,
	"attachments" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" integer,
	"ref_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"module" text DEFAULT 'other' NOT NULL,
	"entity_type" text,
	"entity_ref" text,
	"entity_url" text,
	"requester_id" integer NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"total_steps" integer DEFAULT 1 NOT NULL,
	"sla_deadline" timestamp,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "approval_request_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"name" text NOT NULL,
	"step_type" text DEFAULT 'sequential' NOT NULL,
	"approver_type" text DEFAULT 'role' NOT NULL,
	"approver_role" text,
	"approver_user_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"acted_by_id" integer,
	"delegated_to_id" integer,
	"acted_at" timestamp,
	"sla_deadline" timestamp,
	"is_escalated" boolean DEFAULT false,
	"escalated_at" timestamp,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "approval_workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"module" text DEFAULT 'other' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_workflow_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"name" text NOT NULL,
	"step_type" text DEFAULT 'sequential' NOT NULL,
	"approver_type" text DEFAULT 'role' NOT NULL,
	"approver_role" text,
	"approver_user_id" integer,
	"sla_hours" integer DEFAULT 24,
	"escalate_after_hours" integer,
	"escalate_to_role" text,
	"is_required" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"material_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"field_changed" text,
	"old_value" text,
	"new_value" text,
	"performed_by" integer,
	"performed_by_name" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"material_id" integer NOT NULL,
	"vendor_id" integer,
	"vendor_name" text NOT NULL,
	"supplier_part_code" varchar(100),
	"unit_price" numeric(14, 2),
	"currency" varchar(5) DEFAULT 'INR',
	"lead_time_days" integer,
	"min_order_qty" numeric(12, 3),
	"is_preferred" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" varchar(50) NOT NULL,
	"module" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"allowed" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "quotation_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"object_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" integer,
	"uploaded_by_name" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_quotations" ADD CONSTRAINT "procurement_quotations_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_quotation_items" ADD CONSTRAINT "proc_quotation_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_quotation_items" ADD CONSTRAINT "proc_quotation_items_quotation_id_procurement_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."procurement_quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_audit_logs" ADD CONSTRAINT "quotation_audit_logs_quotation_id_procurement_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."procurement_quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_versions" ADD CONSTRAINT "quotation_versions_quotation_id_procurement_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."procurement_quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_po_items" ADD CONSTRAINT "proc_po_items_po_id_procurement_pos_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."procurement_pos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_pos" ADD CONSTRAINT "procurement_pos_quotation_id_procurement_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."procurement_quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_pos" ADD CONSTRAINT "procurement_pos_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_grns" ADD CONSTRAINT "proc_grns_po_id_procurement_pos_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."procurement_pos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_grns" ADD CONSTRAINT "proc_grns_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_grn_items" ADD CONSTRAINT "proc_grn_items_grn_id_proc_grns_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."proc_grns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_invoices" ADD CONSTRAINT "proc_invoices_grn_id_proc_grns_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."proc_grns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_invoices" ADD CONSTRAINT "proc_invoices_po_id_procurement_pos_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."procurement_pos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_invoices" ADD CONSTRAINT "proc_invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_invoice_audit_logs" ADD CONSTRAINT "proc_invoice_audit_logs_invoice_id_proc_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."proc_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_invoice_items" ADD CONSTRAINT "proc_invoice_items_invoice_id_proc_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."proc_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_po_audit_logs" ADD CONSTRAINT "proc_po_audit_logs_po_id_procurement_pos_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."procurement_pos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proc_grn_audit_logs" ADD CONSTRAINT "proc_grn_audit_logs_grn_id_proc_grns_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."proc_grns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_category_id_material_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grn_returns" ADD CONSTRAINT "grn_returns_grn_id_proc_grns_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."proc_grns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grn_returns" ADD CONSTRAINT "grn_returns_po_id_procurement_pos_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."procurement_pos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grn_returns" ADD CONSTRAINT "grn_returns_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grn_return_audit_logs" ADD CONSTRAINT "grn_return_audit_logs_return_id_grn_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."grn_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grn_return_items" ADD CONSTRAINT "grn_return_items_return_id_grn_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."grn_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_delegates" ADD CONSTRAINT "approval_delegates_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_delegates" ADD CONSTRAINT "approval_delegates_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_request_id_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."approval_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_step_id_approval_request_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."approval_request_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workflow_id_approval_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."approval_workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_request_steps" ADD CONSTRAINT "approval_request_steps_acted_by_id_users_id_fk" FOREIGN KEY ("acted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_request_steps" ADD CONSTRAINT "approval_request_steps_delegated_to_id_users_id_fk" FOREIGN KEY ("delegated_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_request_steps" ADD CONSTRAINT "approval_request_steps_request_id_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."approval_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_workflow_steps" ADD CONSTRAINT "approval_workflow_steps_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_workflow_steps" ADD CONSTRAINT "approval_workflow_steps_workflow_id_approval_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."approval_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_audit_logs" ADD CONSTRAINT "material_audit_logs_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_suppliers" ADD CONSTRAINT "material_suppliers_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_attachments" ADD CONSTRAINT "quotation_attachments_quotation_id_procurement_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."procurement_quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "po_item_po_id_idx" ON "proc_po_items" USING btree ("po_id" int4_ops);--> statement-breakpoint
CREATE INDEX "po_created_at_idx" ON "procurement_pos" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "po_status_created_at_idx" ON "procurement_pos" USING btree ("status" enum_ops,"created_at" enum_ops);--> statement-breakpoint
CREATE INDEX "po_status_idx" ON "procurement_pos" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "po_vendor_id_idx" ON "procurement_pos" USING btree ("vendor_id" int4_ops);--> statement-breakpoint
CREATE INDEX "po_vendor_name_idx" ON "procurement_pos" USING btree ("vendor_name" text_ops);--> statement-breakpoint
CREATE INDEX "grn_created_at_idx" ON "proc_grns" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "grn_po_id_idx" ON "proc_grns" USING btree ("po_id" int4_ops);--> statement-breakpoint
CREATE INDEX "grn_status_idx" ON "proc_grns" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "grn_vendor_id_idx" ON "proc_grns" USING btree ("vendor_id" int4_ops);--> statement-breakpoint
CREATE INDEX "grn_item_grn_id_idx" ON "proc_grn_items" USING btree ("grn_id" int4_ops);--> statement-breakpoint
CREATE INDEX "inv_created_at_idx" ON "proc_invoices" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "inv_match_status_idx" ON "proc_invoices" USING btree ("match_status" enum_ops);--> statement-breakpoint
CREATE INDEX "inv_po_id_idx" ON "proc_invoices" USING btree ("po_id" int4_ops);--> statement-breakpoint
CREATE INDEX "inv_status_idx" ON "proc_invoices" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "inv_vendor_id_idx" ON "proc_invoices" USING btree ("vendor_id" int4_ops);--> statement-breakpoint
CREATE INDEX "inv_audit_invoice_id_idx" ON "proc_invoice_audit_logs" USING btree ("invoice_id" int4_ops);--> statement-breakpoint
CREATE INDEX "inv_item_invoice_id_idx" ON "proc_invoice_items" USING btree ("invoice_id" int4_ops);--> statement-breakpoint
CREATE INDEX "grn_audit_grn_id_idx" ON "proc_grn_audit_logs" USING btree ("grn_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "role_perm_uniq" ON "role_permissions" USING btree ("role" text_ops,"module" text_ops,"action" text_ops);
*/