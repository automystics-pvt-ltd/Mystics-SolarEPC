import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  sourceModule: text("source_module"), // crm|project
  sourceRefId: integer("source_ref_id"),
  title: text("title").notNull(),
  ownerId: integer("owner_id"),
  priority: text("priority").notNull().default("Medium"), // Low|Medium|High|Critical
  dueDate: date("due_date", { mode: "string" }),
  status: text("status").notNull().default("Open"), // Open|InProgress|Done|Cancelled
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
