import {
  pgTable, serial, text, varchar, integer, numeric, timestamp,
  boolean, json, pgEnum, index,
} from "drizzle-orm/pg-core";
import { procurementPOsTable } from "./proc_pos";
import { procGRNsTable } from "./proc_grns";
import { vendorsTable } from "./vendors";

export const procInvoiceStatusEnum = pgEnum("proc_invoice_status", [
  "Draft", "PendingApproval", "Approved", "OnHold", "Paid", "Cancelled",
]);

export const procInvoiceMatchStatusEnum = pgEnum("proc_invoice_match_status", [
  "Matched", "MismatchPending", "MismatchApproved",
]);

export const procInvoicesTable = pgTable("proc_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 30 }).unique().notNull(),
  poId: integer("po_id").notNull().references(() => procurementPOsTable.id),
  grnId: integer("grn_id").references(() => procGRNsTable.id),
  vendorId: integer("vendor_id").references(() => vendorsTable.id),
  vendorName: text("vendor_name").notNull(),

  vendorInvoiceNumber: varchar("vendor_invoice_number", { length: 50 }),
  vendorInvoiceDate: varchar("vendor_invoice_date", { length: 20 }),

  status: procInvoiceStatusEnum("status").default("Draft").notNull(),
  matchStatus: procInvoiceMatchStatusEnum("match_status").default("Matched"),
  mismatchDetails: text("mismatch_details"),
  mismatchApprovedBy: integer("mismatch_approved_by"),
  mismatchApprovedByName: text("mismatch_approved_by_name"),
  mismatchApprovedAt: timestamp("mismatch_approved_at"),

  subtotal: numeric("subtotal", { precision: 16, scale: 2 }).default("0"),
  totalGst: numeric("total_gst", { precision: 16, scale: 2 }).default("0"),
  freightCharges: numeric("freight_charges", { precision: 14, scale: 2 }).default("0"),
  otherCharges: numeric("other_charges", { precision: 14, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 16, scale: 2 }).default("0"),
  tdsAmount: numeric("tds_amount", { precision: 14, scale: 2 }).default("0"),
  netPayable: numeric("net_payable", { precision: 16, scale: 2 }).default("0"),

  paymentTerms: text("payment_terms"),
  dueDate: varchar("due_date", { length: 20 }),

  submittedAt: timestamp("submitted_at"),
  submittedBy: integer("submitted_by"),
  submittedByName: text("submitted_by_name"),

  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  rejectedBy: integer("rejected_by"),
  rejectedByName: text("rejected_by_name"),
  rejectedAt: timestamp("rejected_at"),
  approvalRemarks: text("approval_remarks"),

  paidAt: timestamp("paid_at"),
  paidBy: integer("paid_by"),
  paidByName: text("paid_by_name"),
  paymentReference: varchar("payment_reference", { length: 100 }),
  paymentMode: varchar("payment_mode", { length: 30 }),

  internalNotes: text("internal_notes"),
  createdBy: integer("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // Dashboard: pending invoices filter (Draft + PendingApproval + OnHold)
  index("inv_status_idx").on(table.status),
  // Dashboard: date-range activity feed + mismatch queries
  index("inv_created_at_idx").on(table.createdAt),
  // Invoice list: filter by PO
  index("inv_po_id_idx").on(table.poId),
  index("inv_vendor_id_idx").on(table.vendorId),
  // Mismatch filter
  index("inv_match_status_idx").on(table.matchStatus),
]);

export const procInvoiceItemsTable = pgTable("proc_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => procInvoicesTable.id, { onDelete: "cascade" }),
  poItemId: integer("po_item_id"),
  grnItemId: integer("grn_item_id"),
  lineNo: integer("line_no").notNull(),

  materialName: text("material_name").notNull(),
  materialCode: varchar("material_code", { length: 30 }),
  uom: text("uom").default("Nos"),
  hsnSacCode: varchar("hsn_sac_code", { length: 20 }),

  orderedQty: numeric("ordered_qty", { precision: 12, scale: 3 }).default("0"),
  receivedQty: numeric("received_qty", { precision: 12, scale: 3 }).default("0"),
  invoicedQty: numeric("invoiced_qty", { precision: 12, scale: 3 }).default("0"),

  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).default("0"),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).default("0"),
  taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).default("0"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).default("18"),
  gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).default("0"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).default("0"),

  isMatched: boolean("is_matched").default(true),
  mismatchNote: text("mismatch_note"),
}, (table) => [
  index("inv_item_invoice_id_idx").on(table.invoiceId),
]);

export const procInvoiceAuditLogsTable = pgTable("proc_invoice_audit_logs", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => procInvoicesTable.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(),
  performedBy: integer("performed_by"),
  performedByName: text("performed_by_name"),
  remarks: text("remarks"),
  oldValues: json("old_values"),
  newValues: json("new_values"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("inv_audit_invoice_id_idx").on(table.invoiceId),
]);
