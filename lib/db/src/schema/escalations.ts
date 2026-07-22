import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const escalationsTable = pgTable("escalations", {
  id: serial("id").primaryKey(),
  sourceEntityType: text("source_entity_type"), // lead|quotation|project|material_request|purchase_order
  sourceEntityId: integer("source_entity_id"),
  projectId: integer("project_id"),
  module: text("module"), // crm|project|inventory
  raisedBy: integer("raised_by"),
  reason: text("reason").notNull(),
  severity: text("severity").notNull().default("Medium"), // Low|Medium|High|Critical
  assignedTo: integer("assigned_to"),
  status: text("status").notNull().default("Pending"), // Pending|InProgress|Resolved|Escalated
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEscalationSchema = createInsertSchema(escalationsTable).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true });
export type InsertEscalation = z.infer<typeof insertEscalationSchema>;
export type Escalation = typeof escalationsTable.$inferSelect;
