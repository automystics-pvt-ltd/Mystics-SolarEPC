import { pgTable, text, serial, timestamp, integer, numeric, json, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const materialRequestsTable = pgTable("material_requests", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  activityId: integer("activity_id"),
  raisedBy: integer("raised_by"),
  mrNumber: text("mr_number").notNull(),
  items: json("items").$type<Array<{ itemName: string; itemCode?: string; qty: number; unit: string; specifications?: string }>>().default([]),
  requiredByDate: date("required_by_date", { mode: "string" }),
  status: text("status").notNull().default("Open"), // Open|QuotationPending|L1Pending|POGenerated|Closed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMRSchema = createInsertSchema(materialRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMR = z.infer<typeof insertMRSchema>;
export type MaterialRequest = typeof materialRequestsTable.$inferSelect;

export const vendorQuotationsTable = pgTable("vendor_quotations", {
  id: serial("id").primaryKey(),
  mrId: integer("mr_id").notNull(),
  vendorId: integer("vendor_id"),
  vendorName: text("vendor_name").notNull(),
  quotationNumber: text("quotation_number").notNull(),
  quotedAmount: numeric("quoted_amount", { precision: 15, scale: 2 }).notNull(),
  itemPriceBreakup: json("item_price_breakup").$type<Array<{ itemName: string; qty: number; unitPrice: number; amount: number }>>().default([]),
  validityDate: date("validity_date", { mode: "string" }),
  quotationFileUrl: text("quotation_file_url"),
  managerRemarks: text("manager_remarks"),
  mdRemarks: text("md_remarks"),
  isRecommended: boolean("is_recommended").default(false),
  l1Status: text("l1_status").notNull().default("Pending"), // Pending|Approved|Rejected
  status: text("status").notNull().default("Submitted"), // Submitted|UnderReview|Approved|Rejected
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVQSchema = createInsertSchema(vendorQuotationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVQ = z.infer<typeof insertVQSchema>;
export type VendorQuotation = typeof vendorQuotationsTable.$inferSelect;

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  vendorQuotationId: integer("vendor_quotation_id").notNull(),
  vendorId: integer("vendor_id"),
  vendorName: text("vendor_name").notNull(),
  projectId: integer("project_id"),
  poNumber: text("po_number").notNull(),
  poDate: date("po_date", { mode: "string" }).notNull(),
  expectedDeliveryDate: date("expected_delivery_date", { mode: "string" }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  deliveryTerms: text("delivery_terms"),
  status: text("status").notNull().default("Open"), // Open|PartiallyReceived|FullyReceived|Cancelled
  warehouseId: integer("warehouse_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPOSchema = createInsertSchema(purchaseOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPO = z.infer<typeof insertPOSchema>;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;

export const vendorInvoicesTable = pgTable("vendor_invoices", {
  id: serial("id").primaryKey(),
  poId: integer("po_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  scannedFileUrl: text("scanned_file_url"),
  invoiceAmount: numeric("invoice_amount", { precision: 15, scale: 2 }).notNull(),
  invoiceDate: date("invoice_date", { mode: "string" }),
  dueDate: date("due_date", { mode: "string" }),
  approvalStatus: text("approval_status").notNull().default("Pending"), // Pending|Approved|Rejected|Paid
  creditTermDays: integer("credit_term_days").default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVendorInvoiceSchema = createInsertSchema(vendorInvoicesTable).omit({ id: true, createdAt: true });
export type InsertVendorInvoice = z.infer<typeof insertVendorInvoiceSchema>;
export type VendorInvoice = typeof vendorInvoicesTable.$inferSelect;
