import { pgTable, text, serial, timestamp, integer, numeric, date, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  clientPoId: integer("client_po_id"),
  name: text("name").notNull(),
  siteLocation: text("site_location"),
  pmOwnerId: integer("pm_owner_id"),
  startDate: date("start_date", { mode: "string" }),
  plannedEnd: date("planned_end", { mode: "string" }),
  status: text("status").notNull().default("Planning"), // Planning|Active|OnHold|Completed|Cancelled
  parentProjectId: integer("parent_project_id"),
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }),
  percentComplete: real("percent_complete").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  wbsCode: text("wbs_code"),
  name: text("name").notNull(),
  plannedStart: date("planned_start", { mode: "string" }),
  plannedEnd: date("planned_end", { mode: "string" }),
  actualStart: date("actual_start", { mode: "string" }),
  actualEnd: date("actual_end", { mode: "string" }),
  dependencyIds: integer("dependency_ids").array().default([]),
  percentComplete: real("percent_complete").default(0),
  status: text("status").notNull().default("NotStarted"), // NotStarted|InProgress|Completed|Delayed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;

export const budgetsTable = pgTable("budgets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  costHead: text("cost_head").notNull(),
  budgetedAmount: numeric("budgeted_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  committedAmount: numeric("committed_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  actualAmount: numeric("actual_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  revisionNo: integer("revision_no").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({ id: true, createdAt: true });
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgetsTable.$inferSelect;

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  incurredBy: integer("incurred_by"),
  date: date("date", { mode: "string" }).notNull(),
  receiptUrl: text("receipt_url"),
  approvalStatus: text("approval_status").notNull().default("Pending"), // Pending|Approved|Rejected
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;

export const paymentMilestonesTable = pgTable("payment_milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  milestoneName: text("milestone_name").notNull(),
  triggerCondition: text("trigger_condition"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  dueDate: date("due_date", { mode: "string" }),
  status: text("status").notNull().default("Pending"), // Pending|Triggered|Invoiced|Paid
  invoiceRef: integer("invoice_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentMilestoneSchema = createInsertSchema(paymentMilestonesTable).omit({ id: true, createdAt: true });
export type InsertPaymentMilestone = z.infer<typeof insertPaymentMilestoneSchema>;
export type PaymentMilestone = typeof paymentMilestonesTable.$inferSelect;

export const dprsTable = pgTable("dprs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  reportDate: date("report_date", { mode: "string" }).notNull(),
  submittedBy: integer("submitted_by"),
  workSummary: text("work_summary"),
  manpowerCount: integer("manpower_count"),
  weather: text("weather"),
  percentComplete: real("percent_complete"),
  photos: text("photos").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDPRSchema = createInsertSchema(dprsTable).omit({ id: true, createdAt: true });
export type InsertDPR = z.infer<typeof insertDPRSchema>;
export type DPR = typeof dprsTable.$inferSelect;

export const contractorsTable = pgTable("contractors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  trade: text("trade").notNull(),
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }),
  contact: text("contact"),
  rating: real("rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContractorSchema = createInsertSchema(contractorsTable).omit({ id: true, createdAt: true });
export type InsertContractor = z.infer<typeof insertContractorSchema>;
export type Contractor = typeof contractorsTable.$inferSelect;

// ── Snag Logs ──────────────────────────────────────────────────────────────────
export const snagLogsTable = pgTable("snag_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  zone: text("zone"),
  category: text("category").notNull().default("Civil"), // Civil|Electrical|Structural|Safety|Other
  description: text("description").notNull(),
  reportedBy: integer("reported_by"),
  photoUrl: text("photo_url"),
  severity: text("severity").notNull().default("Medium"), // Low|Medium|High|Critical
  status: text("status").notNull().default("Open"), // Open|InProgress|Resolved|Closed
  assignedTo: integer("assigned_to"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolution: text("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSnagLogSchema = createInsertSchema(snagLogsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSnagLog = z.infer<typeof insertSnagLogSchema>;
export type SnagLog = typeof snagLogsTable.$inferSelect;
