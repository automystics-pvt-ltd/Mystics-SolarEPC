import { pgTable, text, serial, timestamp, integer, numeric, json, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const warehousesTable = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  projectId: integer("project_id"),
  location: text("location"),
  custodianId: integer("custodian_id"),
  capacity: text("capacity"),
  type: text("type").notNull().default("Site"), // Site|Central
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWarehouseSchema = createInsertSchema(warehousesTable).omit({ id: true, createdAt: true });
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type Warehouse = typeof warehousesTable.$inferSelect;

export const warehouseLocationsTable = pgTable("warehouse_locations", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").notNull(),
  zone: text("zone").notNull(),
  rack: text("rack").notNull(),
  bin: text("bin").notNull(),
  currentItemId: integer("current_item_id"),
  currentItemName: text("current_item_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWLSchema = createInsertSchema(warehouseLocationsTable).omit({ id: true, createdAt: true });
export type InsertWL = z.infer<typeof insertWLSchema>;
export type WarehouseLocation = typeof warehouseLocationsTable.$inferSelect;

export const grnsTable = pgTable("grns", {
  id: serial("id").primaryKey(),
  poId: integer("po_id").notNull(),
  warehouseId: integer("warehouse_id").notNull(),
  grnNumber: text("grn_number").notNull(),
  receivedDate: date("received_date", { mode: "string" }).notNull(),
  lineItems: json("line_items").$type<Array<{ itemName: string; poQty: number; receivedQty: number; pendingQty: number; unit: string }>>().default([]),
  qcStatus: text("qc_status").notNull().default("Pending"), // Pending|Passed|Failed|Partial
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGRNSchema = createInsertSchema(grnsTable).omit({ id: true, createdAt: true });
export type InsertGRN = z.infer<typeof insertGRNSchema>;
export type GRN = typeof grnsTable.$inferSelect;

export const qcChecksTable = pgTable("qc_checks", {
  id: serial("id").primaryKey(),
  grnId: integer("grn_id").notNull(),
  inspectedBy: integer("inspected_by"),
  checklistJson: text("checklist_json"),
  acceptedQty: numeric("accepted_qty", { precision: 12, scale: 3 }).notNull(),
  rejectedQty: numeric("rejected_qty", { precision: 12, scale: 3 }).notNull().default("0"),
  rejectionReason: text("rejection_reason"),
  status: text("status").notNull().default("Passed"), // Passed|Failed|Partial
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQCCheckSchema = createInsertSchema(qcChecksTable).omit({ id: true, createdAt: true });
export type InsertQCCheck = z.infer<typeof insertQCCheckSchema>;
export type QCCheck = typeof qcChecksTable.$inferSelect;

export const deliveryChallansTable = pgTable("delivery_challans", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").notNull(),
  projectId: integer("project_id"),
  challanNumber: text("challan_number").notNull(),
  issuedTo: text("issued_to"),
  lineItems: json("line_items").$type<Array<{ itemName: string; qty: number; unit: string }>>().default([]),
  issuedDate: date("issued_date", { mode: "string" }).notNull(),
  purpose: text("purpose").notNull().default("SiteIssue"), // SiteIssue|Return|Transfer
  referenceDoc: text("reference_doc"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChallanSchema = createInsertSchema(deliveryChallansTable).omit({ id: true, createdAt: true });
export type InsertChallan = z.infer<typeof insertChallanSchema>;
export type DeliveryChallan = typeof deliveryChallansTable.$inferSelect;

export const stockLedgerTable = pgTable("stock_ledger", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").notNull(),
  itemId: integer("item_id"),
  itemName: text("item_name").notNull(),
  txnType: text("txn_type").notNull(), // Inward|Outward|Transfer|Adjustment
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  balanceQty: numeric("balance_qty", { precision: 12, scale: 3 }).notNull(),
  refDocType: text("ref_doc_type"),
  refDocId: integer("ref_doc_id"),
  date: date("date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStockLedgerSchema = createInsertSchema(stockLedgerTable).omit({ id: true, createdAt: true });
export type InsertStockLedger = z.infer<typeof insertStockLedgerSchema>;
export type StockLedgerEntry = typeof stockLedgerTable.$inferSelect;

export const stockValuationTable = pgTable("stock_valuation", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").notNull(),
  itemId: integer("item_id"),
  itemName: text("item_name").notNull(),
  valuationMethod: text("valuation_method").notNull().default("FIFO"),
  unitValue: numeric("unit_value", { precision: 15, scale: 4 }).notNull().default("0"),
  totalValue: numeric("total_value", { precision: 15, scale: 2 }).notNull().default("0"),
  balanceQty: numeric("balance_qty", { precision: 12, scale: 3 }).notNull().default("0"),
  asOfDate: date("as_of_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStockValuationSchema = createInsertSchema(stockValuationTable).omit({ id: true, createdAt: true });
export type InsertStockValuation = z.infer<typeof insertStockValuationSchema>;
export type StockValuation = typeof stockValuationTable.$inferSelect;

export const inventoryAuditsTable = pgTable("inventory_audits", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").notNull(),
  auditDate: date("audit_date", { mode: "string" }).notNull(),
  auditorId: integer("auditor_id"),
  systemQty: numeric("system_qty", { precision: 12, scale: 3 }),
  physicalQty: numeric("physical_qty", { precision: 12, scale: 3 }),
  varianceQty: numeric("variance_qty", { precision: 12, scale: 3 }),
  varianceValue: numeric("variance_value", { precision: 15, scale: 2 }),
  status: text("status").notNull().default("Open"), // Open|Reconciled|Closed
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInventoryAuditSchema = createInsertSchema(inventoryAuditsTable).omit({ id: true, createdAt: true });
export type InsertInventoryAudit = z.infer<typeof insertInventoryAuditSchema>;
export type InventoryAudit = typeof inventoryAuditsTable.$inferSelect;
