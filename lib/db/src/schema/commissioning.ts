import { pgTable, text, serial, timestamp, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Commissioning Checklist ────────────────────────────────────────────────────
export const commissioningChecklistsTable = pgTable("commissioning_checklists", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  status: text("status").notNull().default("Draft"), // Draft|InProgress|PendingClientSignoff|Completed
  commissionedOn: date("commissioned_on", { mode: "string" }),
  commissionedBy: integer("commissioned_by"),
  clientSignatoryName: text("client_signatory_name"),
  clientSignedAt: timestamp("client_signed_at", { withTimezone: true }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCommChecklistSchema = createInsertSchema(commissioningChecklistsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommChecklist = z.infer<typeof insertCommChecklistSchema>;
export type CommChecklist = typeof commissioningChecklistsTable.$inferSelect;

// ── Commissioning Checklist Items ──────────────────────────────────────────────
export const commissioningItemsTable = pgTable("commissioning_items", {
  id: serial("id").primaryKey(),
  checklistId: integer("checklist_id").notNull(),
  category: text("category").notNull().default("Electrical"), // Electrical|Safety|NetMetering|Documentation|Civil
  description: text("description").notNull(),
  isDone: boolean("is_done").notNull().default(false),
  doneBy: integer("done_by"),
  doneAt: timestamp("done_at", { withTimezone: true }),
  remarks: text("remarks"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommItemSchema = createInsertSchema(commissioningItemsTable).omit({ id: true, createdAt: true });
export type InsertCommItem = z.infer<typeof insertCommItemSchema>;
export type CommItem = typeof commissioningItemsTable.$inferSelect;

// ── Compliance Documents ───────────────────────────────────────────────────────
export const complianceDocumentsTable = pgTable("compliance_documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  docType: text("doc_type").notNull().default("DISCOM"), // DISCOM|Subsidy|NetMetering|Inspection|Handover|Other
  title: text("title").notNull(),
  fileUrl: text("file_url"),
  submittedBy: integer("submitted_by"),
  submissionDate: date("submission_date", { mode: "string" }),
  status: text("status").notNull().default("Draft"), // Draft|Submitted|Approved|Rejected
  expiryDate: date("expiry_date", { mode: "string" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertComplianceDocSchema = createInsertSchema(complianceDocumentsTable).omit({ id: true, createdAt: true });
export type InsertComplianceDoc = z.infer<typeof insertComplianceDocSchema>;
export type ComplianceDoc = typeof complianceDocumentsTable.$inferSelect;
