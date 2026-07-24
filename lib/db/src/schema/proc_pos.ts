import {
  pgTable, serial, text, varchar, integer, numeric, timestamp, boolean, pgEnum, index, jsonb,
} from "drizzle-orm/pg-core";
import { vendorsTable } from "./vendors";
import { procurementQuotationsTable } from "./proc_quotations";
import { projectsTable } from "./projects";

export const procPOStatusEnum = pgEnum("proc_po_status", [
  "Draft",
  "Submitted",
  "PendingApproval",
  "Approved",
  "Rejected",
  "OnHold",
  "Revised",
  "Issued",
  "Acknowledged",
  "PartiallyReceived",
  "FullyReceived",
  "InvoiceMatched",
  "PaymentPending",
  "Paid",
  "Closed",
  "Cancelled",
]);

export const procurementPOsTable = pgTable("procurement_pos", {
  id: serial("id").primaryKey(),
  poNumber: varchar("po_number", { length: 30 }).unique().notNull(),
  quotationId: integer("quotation_id").references(() => procurementQuotationsTable.id),
  projectId: integer("project_id").references(() => projectsTable.id),
  vendorId: integer("vendor_id").references(() => vendorsTable.id),

  vendorName: text("vendor_name").notNull(),
  vendorGstin: varchar("vendor_gstin", { length: 20 }),
  vendorAddress: text("vendor_address"),
  vendorContact: text("vendor_contact"),

  status: procPOStatusEnum("status").default("Draft").notNull(),
  poDate: varchar("po_date", { length: 20 }),
  deliveryDeadline: varchar("delivery_deadline", { length: 20 }),
  deliveryAddress: text("delivery_address"),
  paymentTerms: text("payment_terms"),
  warrantyMonths: integer("warranty_months"),
  freightCharges: numeric("freight_charges", { precision: 14, scale: 2 }).default("0"),
  otherCharges: numeric("other_charges", { precision: 14, scale: 2 }).default("0"),
  subtotal: numeric("subtotal", { precision: 16, scale: 2 }).default("0"),
  totalGst: numeric("total_gst", { precision: 16, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 16, scale: 2 }).default("0"),

  specialTerms: text("special_terms"),
  internalNotes: text("internal_notes"),

  // Approval workflow
  isLocked: boolean("is_locked").default(false).notNull(),
  approvalRequestId: integer("approval_request_id"),
  slaDeadline: timestamp("sla_deadline"),
  revisionNumber: integer("revision_number").default(1).notNull(),
  submittedAt: timestamp("submitted_at"),
  submittedBy: integer("submitted_by"),
  submittedByName: text("submitted_by_name"),
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: integer("rejected_by"),
  rejectedByName: text("rejected_by_name"),
  rejectionReason: text("rejection_reason"),
  onHoldAt: timestamp("on_hold_at"),
  onHoldBy: integer("on_hold_by"),
  onHoldReason: text("on_hold_reason"),

  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  closedAt: timestamp("closed_at"),

  // Dispatch tracking
  vendorDispatchRef: varchar("vendor_dispatch_ref", { length: 50 }),
  trackingNumber: varchar("tracking_number", { length: 50 }),
  dispatchedAt: timestamp("dispatched_at"),
  expectedDeliveryDate: varchar("expected_delivery_date", { length: 20 }),

  createdBy: integer("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("po_status_idx").on(table.status),
  index("po_created_at_idx").on(table.createdAt),
  index("po_vendor_id_idx").on(table.vendorId),
  index("po_vendor_name_idx").on(table.vendorName),
  index("po_status_created_at_idx").on(table.status, table.createdAt),
  index("idx_proc_pos_project_id_drizzle").on(table.projectId),
]);

export const procPOItemsTable = pgTable("proc_po_items", {
  id: serial("id").primaryKey(),
  poId: integer("po_id").notNull().references(() => procurementPOsTable.id, { onDelete: "cascade" }),
  lineNo: integer("line_no").notNull(),
  materialId: integer("material_id"),
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
  totalGst: numeric("total_gst", { precision: 14, scale: 2 }).default("0"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).default("0"),
  deliveredQty: numeric("delivered_qty", { precision: 12, scale: 3 }).default("0"),
  remarks: text("remarks"),
}, (table) => [
  index("po_item_po_id_idx").on(table.poId),
]);

export const poCommentsTable = pgTable("po_comments", {
  id: serial("id").primaryKey(),
  poId: integer("po_id").notNull().references(() => procurementPOsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id"),
  userName: text("user_name"),
  body: text("body").notNull(),
  parentId: integer("parent_id"), // for threading
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("po_comment_po_id_idx").on(table.poId),
]);

export const poVersionsTable = pgTable("po_versions", {
  id: serial("id").primaryKey(),
  poId: integer("po_id").notNull().references(() => procurementPOsTable.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  changedBy: integer("changed_by"),
  changedByName: text("changed_by_name"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  changeSummary: text("change_summary"),
}, (table) => [
  index("po_version_po_id_idx").on(table.poId),
]);
