import { pgTable, text, serial, timestamp, integer, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── AMC Contracts ──────────────────────────────────────────────────────────────
export const amcContractsTable = pgTable("amc_contracts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  contractNumber: text("contract_number").notNull(),
  clientName: text("client_name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  annualValue: numeric("annual_value", { precision: 15, scale: 2 }).notNull(),
  visitFrequency: text("visit_frequency").notNull().default("Quarterly"), // Monthly|Quarterly|HalfYearly|Annual
  status: text("status").notNull().default("Active"), // Draft|Active|Expired|Terminated
  terms: text("terms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAmcContractSchema = createInsertSchema(amcContractsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAmcContract = z.infer<typeof insertAmcContractSchema>;
export type AmcContract = typeof amcContractsTable.$inferSelect;

// ── Maintenance Schedules ──────────────────────────────────────────────────────
export const maintenanceSchedulesTable = pgTable("maintenance_schedules", {
  id: serial("id").primaryKey(),
  amcContractId: integer("amc_contract_id"),
  projectId: integer("project_id").notNull(),
  visitType: text("visit_type").notNull().default("Preventive"), // Preventive|Corrective|Emergency
  scheduledDate: date("scheduled_date", { mode: "string" }).notNull(),
  assignedTechnicianId: integer("assigned_technician_id"),
  assignedTechnicianName: text("assigned_technician_name"),
  status: text("status").notNull().default("Scheduled"), // Scheduled|InProgress|Completed|Cancelled
  completedDate: date("completed_date", { mode: "string" }),
  workDone: text("work_done"),
  observations: text("observations"),
  nextScheduledDate: date("next_scheduled_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMaintenanceScheduleSchema = createInsertSchema(maintenanceSchedulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMaintenanceSchedule = z.infer<typeof insertMaintenanceScheduleSchema>;
export type MaintenanceSchedule = typeof maintenanceSchedulesTable.$inferSelect;

// ── Service Tickets ────────────────────────────────────────────────────────────
export const serviceTicketsTable = pgTable("service_tickets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  amcContractId: integer("amc_contract_id"),
  ticketNumber: text("ticket_number").notNull(),
  raisedBy: text("raised_by"), // client name/contact
  issueCategory: text("issue_category").notNull().default("Performance"), // Performance|Electrical|Structural|Inverter|Module|Other
  description: text("description").notNull(),
  priority: text("priority").notNull().default("Medium"), // Low|Medium|High|Critical
  status: text("status").notNull().default("Open"), // Open|InProgress|Resolved|Closed
  assignedTechnicianId: integer("assigned_technician_id"),
  assignedTechnicianName: text("assigned_technician_name"),
  slaHours: integer("sla_hours").default(48),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolution: text("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertServiceTicketSchema = createInsertSchema(serviceTicketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServiceTicket = z.infer<typeof insertServiceTicketSchema>;
export type ServiceTicket = typeof serviceTicketsTable.$inferSelect;
