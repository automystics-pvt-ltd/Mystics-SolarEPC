import {
  pgTable, serial, text, varchar, integer, numeric, timestamp, pgEnum, index,
} from "drizzle-orm/pg-core";
import { vendorsTable } from "./vendors";
import { procurementQuotationsTable } from "./proc_quotations";

export const procPOStatusEnum = pgEnum("proc_po_status", [
  "Draft", "Issued", "Acknowledged", "PartiallyReceived", "FullyReceived", "Closed", "Cancelled",
]);

export const procurementPOsTable = pgTable("procurement_pos", {
  id: serial("id").primaryKey(),
  poNumber: varchar("po_number", { length: 30 }).unique().notNull(),
  quotationId: integer("quotation_id").references(() => procurementQuotationsTable.id),
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
  // Dashboard: status aggregation + pipeline counts
  index("po_status_idx").on(table.status),
  // Dashboard: date-range spend queries
  index("po_created_at_idx").on(table.createdAt),
  // Vendor drill-down
  index("po_vendor_id_idx").on(table.vendorId),
  index("po_vendor_name_idx").on(table.vendorName),
  // Composite: the most common dashboard query (received POs in date range)
  index("po_status_created_at_idx").on(table.status, table.createdAt),
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
  // Category join in dashboard: items → POs by po_id
  index("po_item_po_id_idx").on(table.poId),
]);
