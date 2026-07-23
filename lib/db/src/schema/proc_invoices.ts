import {
  pgTable, serial, text, varchar, integer, numeric, timestamp,
  boolean, json, pgEnum, index,
} from "drizzle-orm/pg-core";
import { procurementPOsTable } from "./proc_pos";
import { procGRNsTable } from "./proc_grns";
import { vendorsTable } from "./vendors";

export const procInvoiceStatusEnum = pgEnum("proc_invoice_status", [
  "Draft", "PendingApproval", "Approved", "OnHold", "Paid", "Cancelled",
  "PartiallyPaid", "Disputed", "Revised",
]);

export const procInvoiceMatchStatusEnum = pgEnum("proc_invoice_match_status", [
  "Matched", "MismatchPending", "MismatchApproved",
]);

export const procInvoiceTypeEnum = pgEnum("proc_invoice_type", [
  "Standard", "CreditNote", "DebitNote",
]);

export const procInvoicesTable = pgTable("proc_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 30 }).unique().notNull(),
  invoiceType: procInvoiceTypeEnum("invoice_type").default("Standard").notNull(),
  poId: integer("po_id").notNull().references(() => procurementPOsTable.id),
  grnId: integer("grn_id").references(() => procGRNsTable.id),
  vendorId: integer("vendor_id").references(() => vendorsTable.id),
  vendorName: text("vendor_name").notNull(),

  vendorInvoiceNumber: varchar("vendor_invoice_number", { length: 50 }),
  vendorInvoiceDate: varchar("vendor_invoice_date", { length: 20 }),

  status: procInvoiceStatusEnum("status").default("Draft").notNull(),
  isLocked: boolean("is_locked").default(false).notNull(),

  // Versioning / revisions
  revisionNumber: integer("revision_number").default(0).notNull(),
  originalInvoiceId: integer("original_invoice_id"),
  linkedCreditNoteId: integer("linked_credit_note_id"),
  linkedDebitNoteId: integer("linked_debit_note_id"),

  // 3-way match
  matchStatus: procInvoiceMatchStatusEnum("match_status").default("Matched"),
  mismatchDetails: text("mismatch_details"),
  mismatchApprovedBy: integer("mismatch_approved_by"),
  mismatchApprovedByName: text("mismatch_approved_by_name"),
  mismatchApprovedAt: timestamp("mismatch_approved_at"),

  // Financials
  subtotal: numeric("subtotal", { precision: 16, scale: 2 }).default("0"),
  totalGst: numeric("total_gst", { precision: 16, scale: 2 }).default("0"),
  freightCharges: numeric("freight_charges", { precision: 14, scale: 2 }).default("0"),
  otherCharges: numeric("other_charges", { precision: 14, scale: 2 }).default("0"),
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 16, scale: 2 }).default("0"),
  tdsAmount: numeric("tds_amount", { precision: 14, scale: 2 }).default("0"),
  netPayable: numeric("net_payable", { precision: 16, scale: 2 }).default("0"),

  // Payment tracking
  paidAmount: numeric("paid_amount", { precision: 16, scale: 2 }).default("0"),
  paymentTerms: text("payment_terms"),
  paymentTermsDays: integer("payment_terms_days"),
  dueDate: varchar("due_date", { length: 20 }),

  // Bank details for payment
  bankName: varchar("bank_name", { length: 100 }),
  bankAccount: varchar("bank_account", { length: 30 }),
  bankIfsc: varchar("bank_ifsc", { length: 20 }),
  bankBranch: text("bank_branch"),

  // Duplicate detection
  isDuplicateFlagged: boolean("is_duplicate_flagged").default(false).notNull(),
  duplicateOfId: integer("duplicate_of_id"),

  // Attachments
  attachmentUrls: json("attachment_urls").$type<string[]>().default([]),

  // Submission
  submittedAt: timestamp("submitted_at"),
  submittedBy: integer("submitted_by"),
  submittedByName: text("submitted_by_name"),

  // Approval
  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  rejectedBy: integer("rejected_by"),
  rejectedByName: text("rejected_by_name"),
  rejectedAt: timestamp("rejected_at"),
  approvalRemarks: text("approval_remarks"),

  // Payment (full / final)
  paidAt: timestamp("paid_at"),
  paidBy: integer("paid_by"),
  paidByName: text("paid_by_name"),
  paymentReference: varchar("payment_reference", { length: 100 }),
  paymentMode: varchar("payment_mode", { length: 30 }),

  // Hold
  heldReason: text("held_reason"),
  heldAt: timestamp("held_at"),
  heldBy: integer("held_by"),
  heldByName: text("held_by_name"),
  holdReleasedAt: timestamp("hold_released_at"),
  holdReleasedBy: integer("hold_released_by"),
  holdReleasedByName: text("hold_released_by_name"),

  // Dispute
  disputeReason: text("dispute_reason"),
  disputedAt: timestamp("disputed_at"),
  disputedBy: integer("disputed_by"),
  disputedByName: text("disputed_by_name"),
  disputeResolution: text("dispute_resolution"),
  disputeResolvedAt: timestamp("dispute_resolved_at"),
  disputeResolvedBy: integer("dispute_resolved_by"),
  disputeResolvedByName: text("dispute_resolved_by_name"),

  // Cancellation
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: integer("cancelled_by"),
  cancelledByName: text("cancelled_by_name"),
  cancellationReason: text("cancellation_reason"),

  internalNotes: text("internal_notes"),
  createdBy: integer("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("inv_status_idx").on(table.status),
  index("inv_created_at_idx").on(table.createdAt),
  index("inv_po_id_idx").on(table.poId),
  index("inv_vendor_id_idx").on(table.vendorId),
  index("inv_match_status_idx").on(table.matchStatus),
  index("inv_vendor_inv_no_idx").on(table.vendorInvoiceNumber),
  index("inv_type_idx").on(table.invoiceType),
  index("inv_due_date_idx").on(table.dueDate),
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
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).default("0"),
  taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).default("0"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).default("18"),
  cgstRate: numeric("cgst_rate", { precision: 5, scale: 2 }).default("9"),
  sgstRate: numeric("sgst_rate", { precision: 5, scale: 2 }).default("9"),
  igstRate: numeric("igst_rate", { precision: 5, scale: 2 }).default("0"),
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
  action: varchar("action", { length: 80 }).notNull(),
  performedBy: integer("performed_by"),
  performedByName: text("performed_by_name"),
  remarks: text("remarks"),
  oldValues: json("old_values"),
  newValues: json("new_values"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("inv_audit_invoice_id_idx").on(table.invoiceId),
]);

// Threaded comments per invoice
export const invoiceCommentsTable = pgTable("invoice_comments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => procInvoicesTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  userId: integer("user_id"),
  userName: text("user_name"),
  userRole: varchar("user_role", { length: 50 }),
  body: text("body").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("inv_comment_invoice_id_idx").on(table.invoiceId),
]);

// Partial / full payment records
export const invoicePaymentsTable = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => procInvoicesTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
  paymentReference: varchar("payment_reference", { length: 100 }),
  paymentMode: varchar("payment_mode", { length: 30 }),
  paymentDate: varchar("payment_date", { length: 20 }),
  bankName: varchar("bank_name", { length: 100 }),
  utrNumber: varchar("utr_number", { length: 50 }),
  notes: text("notes"),
  paidBy: integer("paid_by"),
  paidByName: text("paid_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("inv_payment_invoice_id_idx").on(table.invoiceId),
]);
