import { pgTable, serial, text, integer, numeric, timestamp, varchar, pgEnum } from "drizzle-orm/pg-core";
import { procGRNsTable } from "./proc_grns";
import { procurementPOsTable } from "./proc_pos";
import { vendorsTable } from "./vendors";

export const grnReturnStatusEnum = pgEnum("grn_return_status", [
  "Draft", "Submitted", "Approved", "Dispatched", "Closed", "Cancelled",
]);

export const grnReturnsTable = pgTable("grn_returns", {
  id: serial("id").primaryKey(),
  returnNumber: varchar("return_number", { length: 30 }).unique().notNull(),
  grnId: integer("grn_id").notNull().references(() => procGRNsTable.id),
  poId: integer("po_id").references(() => procurementPOsTable.id),
  vendorId: integer("vendor_id").references(() => vendorsTable.id),
  vendorName: text("vendor_name").notNull(),
  status: grnReturnStatusEnum("status").default("Draft").notNull(),
  returnReason: text("return_reason").notNull(),
  returnType: text("return_type").notNull().default("Rejection"), // Rejection|Excess|Damage|Quality
  returnDate: varchar("return_date", { length: 20 }),
  dispatchDate: varchar("dispatch_date", { length: 20 }),
  creditNoteNumber: varchar("credit_note_number", { length: 50 }),
  creditNoteDate: varchar("credit_note_date", { length: 20 }),
  creditNoteAmount: numeric("credit_note_amount", { precision: 14, scale: 2 }).default("0"),
  totalReturnQty: numeric("total_return_qty", { precision: 12, scale: 3 }).default("0"),
  totalReturnValue: numeric("total_return_value", { precision: 14, scale: 2 }).default("0"),
  remarks: text("remarks"),
  // Workflow actors
  createdBy: integer("created_by"),
  createdByName: text("created_by_name"),
  submittedBy: integer("submitted_by"),
  submittedByName: text("submitted_by_name"),
  submittedAt: timestamp("submitted_at"),
  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  approvalRemarks: text("approval_remarks"),
  dispatchedBy: integer("dispatched_by"),
  dispatchedByName: text("dispatched_by_name"),
  dispatchedAt: timestamp("dispatched_at"),
  closedBy: integer("closed_by"),
  closedByName: text("closed_by_name"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const grnReturnItemsTable = pgTable("grn_return_items", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id").notNull().references(() => grnReturnsTable.id, { onDelete: "cascade" }),
  grnItemId: integer("grn_item_id"),
  lineNo: integer("line_no").notNull(),
  materialId: integer("material_id"),
  materialCode: varchar("material_code", { length: 30 }),
  materialName: text("material_name").notNull(),
  uom: text("uom").default("Nos"),
  returnQty: numeric("return_qty", { precision: 12, scale: 3 }).default("0"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).default("0"),
  returnValue: numeric("return_value", { precision: 14, scale: 2 }).default("0"),
  rejectionReason: text("rejection_reason"),
  batchLotNumber: varchar("batch_lot_number", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const grnReturnAuditLogsTable = pgTable("grn_return_audit_logs", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id").notNull().references(() => grnReturnsTable.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(),
  performedBy: integer("performed_by"),
  performedByName: text("performed_by_name"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type GrnReturn = typeof grnReturnsTable.$inferSelect;
export type GrnReturnItem = typeof grnReturnItemsTable.$inferSelect;
