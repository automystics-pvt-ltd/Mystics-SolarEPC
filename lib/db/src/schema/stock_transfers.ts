import { pgTable, serial, text, integer, numeric, timestamp, varchar, pgEnum } from "drizzle-orm/pg-core";
import { warehousesTable } from "./inventory";

export const stockTransferStatusEnum = pgEnum("stock_transfer_status", [
  "Draft", "Approved", "InTransit", "Completed", "Cancelled",
]);

export const stockTransfersTable = pgTable("stock_transfers", {
  id: serial("id").primaryKey(),
  transferNumber: varchar("transfer_number", { length: 30 }).unique().notNull(),
  fromWarehouseId: integer("from_warehouse_id").notNull().references(() => warehousesTable.id),
  fromWarehouseName: text("from_warehouse_name").notNull(),
  toWarehouseId: integer("to_warehouse_id").notNull().references(() => warehousesTable.id),
  toWarehouseName: text("to_warehouse_name").notNull(),
  status: stockTransferStatusEnum("status").default("Draft").notNull(),
  reason: text("reason"),
  transferDate: varchar("transfer_date", { length: 20 }),
  completedDate: varchar("completed_date", { length: 20 }),
  remarks: text("remarks"),
  initiatedBy: integer("initiated_by"),
  initiatedByName: text("initiated_by_name"),
  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  completedBy: integer("completed_by"),
  completedByName: text("completed_by_name"),
  completedAt: timestamp("completed_at"),
  totalItems: integer("total_items").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stockTransferItemsTable = pgTable("stock_transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull().references(() => stockTransfersTable.id, { onDelete: "cascade" }),
  lineNo: integer("line_no").notNull(),
  materialId: integer("material_id"),
  materialCode: varchar("material_code", { length: 30 }),
  materialName: text("material_name").notNull(),
  uom: text("uom").default("Nos"),
  qty: numeric("qty", { precision: 12, scale: 3 }).default("0"),
  fromBin: varchar("from_bin", { length: 50 }),
  toBin: varchar("to_bin", { length: 50 }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StockTransfer = typeof stockTransfersTable.$inferSelect;
export type StockTransferItem = typeof stockTransferItemsTable.$inferSelect;
