import { pgTable, serial, text, varchar, integer, timestamp, json } from "drizzle-orm/pg-core";
import { procurementPOsTable } from "./proc_pos";

export const procPOAuditLogsTable = pgTable("proc_po_audit_logs", {
  id: serial("id").primaryKey(),
  poId: integer("po_id").notNull().references(() => procurementPOsTable.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(),
  performedBy: integer("performed_by"),
  performedByName: text("performed_by_name"),
  remarks: text("remarks"),
  oldValues: json("old_values"),
  newValues: json("new_values"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
