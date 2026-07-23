import {
  pgTable, serial, text, varchar, integer, numeric, timestamp, json, pgEnum, index, boolean,
} from "drizzle-orm/pg-core";
import { procurementPOsTable } from "./proc_pos";
import { vendorsTable } from "./vendors";

export const procGRNStatusEnum = pgEnum("proc_grn_status", [
  "Draft", "Submitted", "Accepted", "PartiallyAccepted", "Rejected", "Cancelled", "Reversed",
]);

export const procGRNItemQCStatusEnum = pgEnum("proc_grn_item_qc_status", [
  "Pending", "Accepted", "PartiallyAccepted", "Rejected",
]);

export const procGRNsTable = pgTable("proc_grns", {
  id: serial("id").primaryKey(),
  grnNumber: varchar("grn_number", { length: 30 }).unique().notNull(),
  poId: integer("po_id").notNull().references(() => procurementPOsTable.id),
  vendorId: integer("vendor_id").references(() => vendorsTable.id),
  vendorName: text("vendor_name").notNull(),
  status: procGRNStatusEnum("status").default("Draft").notNull(),

  // Lock — set true once Accepted/PartiallyAccepted; prevents further edits
  isLocked: boolean("is_locked").default(false).notNull(),

  // Warehouse where goods are received
  warehouseId: integer("warehouse_id"),
  warehouseName: text("warehouse_name"),
  storageLocation: text("storage_location"), // zone/rack/bin freetext

  deliveryDate: varchar("delivery_date", { length: 20 }),
  vehicleNumber: varchar("vehicle_number", { length: 30 }),
  dcNumber: varchar("dc_number", { length: 50 }),
  dcDate: varchar("dc_date", { length: 20 }),

  receivedBy: integer("received_by"),
  receivedByName: text("received_by_name"),
  receivedAt: timestamp("received_at"),

  inspectedBy: integer("inspected_by"),
  inspectedByName: text("inspected_by_name"),
  inspectedAt: timestamp("inspected_at"),

  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  rejectedBy: integer("rejected_by"),
  rejectedByName: text("rejected_by_name"),
  rejectedAt: timestamp("rejected_at"),
  approvalRemarks: text("approval_remarks"),

  // Cancellation
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: integer("cancelled_by"),
  cancelledByName: text("cancelled_by_name"),
  cancellationReason: text("cancellation_reason"),

  // Reversal (undo an accepted GRN)
  reversedAt: timestamp("reversed_at"),
  reversedBy: integer("reversed_by"),
  reversedByName: text("reversed_by_name"),
  reversalReason: text("reversal_reason"),

  totalOrderedQty: numeric("total_ordered_qty", { precision: 12, scale: 3 }).default("0"),
  totalReceivedQty: numeric("total_received_qty", { precision: 12, scale: 3 }).default("0"),
  totalAcceptedQty: numeric("total_accepted_qty", { precision: 12, scale: 3 }).default("0"),
  totalRejectedQty: numeric("total_rejected_qty", { precision: 12, scale: 3 }).default("0"),
  totalAcceptedValue: numeric("total_accepted_value", { precision: 16, scale: 2 }).default("0"),

  remarks: text("remarks"),
  internalNotes: text("internal_notes"),

  createdBy: integer("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("grn_status_idx").on(table.status),
  index("grn_created_at_idx").on(table.createdAt),
  index("grn_po_id_idx").on(table.poId),
  index("grn_vendor_id_idx").on(table.vendorId),
]);

export const procGRNItemsTable = pgTable("proc_grn_items", {
  id: serial("id").primaryKey(),
  grnId: integer("grn_id").notNull().references(() => procGRNsTable.id, { onDelete: "cascade" }),
  poItemId: integer("po_item_id"),
  lineNo: integer("line_no").notNull(),

  materialId: integer("material_id"),
  materialCode: varchar("material_code", { length: 30 }),
  materialName: text("material_name").notNull(),
  description: text("description"),
  uom: text("uom").default("Nos"),
  hsnSacCode: varchar("hsn_sac_code", { length: 20 }),

  orderedQty: numeric("ordered_qty", { precision: 12, scale: 3 }).default("0"),
  receivedQty: numeric("received_qty", { precision: 12, scale: 3 }).default("0"),
  acceptedQty: numeric("accepted_qty", { precision: 12, scale: 3 }).default("0"),
  rejectedQty: numeric("rejected_qty", { precision: 12, scale: 3 }).default("0"),
  damagedQty: numeric("damaged_qty", { precision: 12, scale: 3 }).default("0"),
  excessQty: numeric("excess_qty", { precision: 12, scale: 3 }).default("0"),
  shortQty: numeric("short_qty", { precision: 12, scale: 3 }).default("0"),

  qcStatus: procGRNItemQCStatusEnum("qc_status").default("Pending"),
  rejectionReason: text("rejection_reason"),
  itemRemarks: text("item_remarks"),

  // Batch / serial / traceability
  batchNumber: varchar("batch_number", { length: 100 }),
  serialNumbers: text("serial_numbers"),        // JSON array or comma-separated
  expiryDate: varchar("expiry_date", { length: 20 }),
  barcodeData: varchar("barcode_data", { length: 200 }),

  // Storage assignment
  storageLocation: text("storage_location"),    // zone-rack-bin freetext

  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).default("0"),
  acceptedValue: numeric("accepted_value", { precision: 14, scale: 2 }).default("0"),
}, (table) => [
  index("grn_item_grn_id_idx").on(table.grnId),
]);

export const procGRNAuditLogsTable = pgTable("proc_grn_audit_logs", {
  id: serial("id").primaryKey(),
  grnId: integer("grn_id").notNull().references(() => procGRNsTable.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(),
  performedBy: integer("performed_by"),
  performedByName: text("performed_by_name"),
  remarks: text("remarks"),
  oldValues: json("old_values"),
  newValues: json("new_values"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("grn_audit_grn_id_idx").on(table.grnId),
]);

// Comments — threaded, optional attachment
export const grnCommentsTable = pgTable("grn_comments", {
  id: serial("id").primaryKey(),
  grnId: integer("grn_id").notNull().references(() => procGRNsTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),               // null = top-level
  userId: integer("user_id"),
  userName: text("user_name"),
  userRole: varchar("user_role", { length: 50 }),
  body: text("body").notNull(),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("grn_comment_grn_id_idx").on(table.grnId),
]);
