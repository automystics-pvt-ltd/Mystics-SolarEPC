import { pgTable, serial, text, varchar, integer, numeric, timestamp, json, pgEnum } from "drizzle-orm/pg-core";
import { procurementPOsTable } from "./proc_pos";
import { vendorsTable } from "./vendors";

export const procGRNStatusEnum = pgEnum("proc_grn_status", [
  "Draft", "Submitted", "Accepted", "PartiallyAccepted", "Rejected",
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
});

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

  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).default("0"),
  acceptedValue: numeric("accepted_value", { precision: 14, scale: 2 }).default("0"),
});

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
});
