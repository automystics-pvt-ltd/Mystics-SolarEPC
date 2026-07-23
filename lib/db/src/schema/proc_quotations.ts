import { pgTable, serial, text, varchar, integer, numeric, timestamp, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { vendorsTable } from "./vendors";
import { materialsTable } from "./materials";

export const procQuotationStatusEnum = pgEnum("proc_quotation_status", [
  "Draft", "Submitted", "UnderReview", "RevisionRequested", "Approved", "Rejected",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "Created", "Updated", "Submitted", "ReviewStarted",
  "RevisionRequested", "Approved", "Rejected", "Deleted",
  "CommentAdded", "DocumentUploaded", "POGenerated",
  "Reopened", "Cancelled", "AttachmentAdded", "AttachmentRemoved", "Escalated",
]);

export const procurementQuotationsTable = pgTable("procurement_quotations", {
  id: serial("id").primaryKey(),
  referenceId: varchar("reference_id", { length: 30 }).unique().notNull(),
  version: integer("version").default(1).notNull(),
  status: procQuotationStatusEnum("status").default("Draft").notNull(),

  mrId: integer("mr_id"),
  vendorId: integer("vendor_id").references(() => vendorsTable.id),
  vendorSnapshotName: text("vendor_snapshot_name"),

  quotationDate: varchar("quotation_date", { length: 20 }),
  validityDate: varchar("validity_date", { length: 20 }),
  currency: varchar("currency", { length: 5 }).default("INR"),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  deliveryLeadDays: integer("delivery_lead_days"),
  warrantyMonths: integer("warranty_months"),

  subtotal: numeric("subtotal", { precision: 16, scale: 2 }).default("0"),
  totalDiscount: numeric("total_discount", { precision: 16, scale: 2 }).default("0"),
  totalGst: numeric("total_gst", { precision: 16, scale: 2 }).default("0"),
  freightCharges: numeric("freight_charges", { precision: 14, scale: 2 }).default("0"),
  otherCharges: numeric("other_charges", { precision: 14, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 16, scale: 2 }).default("0"),

  fileUrl: text("file_url"),
  fileOriginalName: text("file_original_name"),
  vendorRemarks: text("vendor_remarks"),
  internalNotes: text("internal_notes"),

  submittedAt: timestamp("submitted_at"),
  submittedBy: integer("submitted_by"),
  submittedByName: text("submitted_by_name"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by"),
  reviewedByName: text("reviewed_by_name"),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: integer("rejected_by"),
  rejectedByName: text("rejected_by_name"),
  approvalRemarks: text("approval_remarks"),

  isL1: boolean("is_l1").default(false),
  isRecommended: boolean("is_recommended").default(false),
  recommendationNotes: text("recommendation_notes"),
  poGenerated: boolean("po_generated").default(false),

  // Lock / reopen tracking
  lockedAt: timestamp("locked_at"),
  lockedBy: integer("locked_by"),
  reopenedAt: timestamp("reopened_at"),
  reopenedBy: integer("reopened_by"),
  reopenReason: text("reopen_reason"),

  // Central approval engine link
  approvalRequestId: integer("approval_request_id"),

  createdBy: integer("created_by"),
  createdByName: text("created_by_name"),
  updatedBy: integer("updated_by"),
  updatedByName: text("updated_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const procQuotationItemsTable = pgTable("proc_quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => procurementQuotationsTable.id, { onDelete: "cascade" }),
  lineNo: integer("line_no").notNull(),
  materialId: integer("material_id").references(() => materialsTable.id),
  materialCode: varchar("material_code", { length: 30 }),
  materialName: text("material_name").notNull(),
  description: text("description"),
  uom: text("uom").default("Nos"),
  hsnSacCode: varchar("hsn_sac_code", { length: 20 }),
  brand: text("brand"),
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).default("0"),
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).default("0"),
  taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).default("0"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).default("18"),
  cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }).default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }).default("0"),
  igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }).default("0"),
  totalGst: numeric("total_gst", { precision: 14, scale: 2 }).default("0"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).default("0"),
  deliveryDays: integer("delivery_days"),
  remarks: text("remarks"),
});

export const quotationVersionsTable = pgTable("quotation_versions", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => procurementQuotationsTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  changedBy: integer("changed_by"),
  changedByName: text("changed_by_name"),
  changeSummary: text("change_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Attachments ──────────────────────────────────────────────────────────────
export const quotationAttachmentsTable = pgTable("quotation_attachments", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => procurementQuotationsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  objectPath: text("object_path").notNull(), // GCS object path
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: integer("uploaded_by"),
  uploadedByName: text("uploaded_by_name"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const quotationAuditLogsTable = pgTable("quotation_audit_logs", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => procurementQuotationsTable.id, { onDelete: "cascade" }),
  action: auditActionEnum("action").notNull(),
  performedBy: integer("performed_by"),
  performedByName: text("performed_by_name").notNull(),
  performedByRole: text("performed_by_role"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
