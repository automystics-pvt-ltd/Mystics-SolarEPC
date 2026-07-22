import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Design Documents ───────────────────────────────────────────────────────────
export const designDocumentsTable = pgTable("design_documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  docType: text("doc_type").notNull().default("Layout"), // Layout|SLD|Structural|Other
  title: text("title").notNull(),
  version: text("version").notNull().default("v1"),
  fileUrl: text("file_url"),
  uploadedBy: integer("uploaded_by"),
  description: text("description"),
  // Approval
  internalStatus: text("internal_status").notNull().default("Draft"), // Draft|InternalApproved|ClientApproved|Rejected
  internalApprovedBy: integer("internal_approved_by"),
  internalApprovedAt: timestamp("internal_approved_at", { withTimezone: true }),
  clientApprovedAt: timestamp("client_approved_at", { withTimezone: true }),
  clientApprovedBy: text("client_approved_by"), // name/email of client signatory
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDesignDocSchema = createInsertSchema(designDocumentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDesignDoc = z.infer<typeof insertDesignDocSchema>;
export type DesignDoc = typeof designDocumentsTable.$inferSelect;

// ── Design Revisions ──────────────────────────────────────────────────────────
export const designRevisionsTable = pgTable("design_revisions", {
  id: serial("id").primaryKey(),
  docId: integer("doc_id").notNull(),
  version: text("version").notNull(),
  fileUrl: text("file_url"),
  changeNotes: text("change_notes"),
  revisedBy: integer("revised_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDesignRevisionSchema = createInsertSchema(designRevisionsTable).omit({ id: true, createdAt: true });
export type InsertDesignRevision = z.infer<typeof insertDesignRevisionSchema>;
export type DesignRevision = typeof designRevisionsTable.$inferSelect;
