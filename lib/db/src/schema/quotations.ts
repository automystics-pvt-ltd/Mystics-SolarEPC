import { pgTable, text, serial, timestamp, integer, numeric, json, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quotationsTable = pgTable("quotations", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  boqItems: json("boq_items").$type<Array<{ description: string; qty: number; unit: string; unitPrice: number; amount: number }>>().default([]),
  version: integer("version").notNull().default(1),
  markupPct: numeric("markup_pct", { precision: 5, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }),
  approvalStatus: text("approval_status").notNull().default("Draft"), // Draft|Pending|Approved|Rejected
  validTill: date("valid_till", { mode: "string" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQuotationSchema = createInsertSchema(quotationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type Quotation = typeof quotationsTable.$inferSelect;

export const clientPOsTable = pgTable("client_pos", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull(),
  clientPoNumber: text("client_po_number").notNull(),
  clientPoFileUrl: text("client_po_file_url"),
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }).notNull(),
  paymentTerms: text("payment_terms"),
  status: text("status").notNull().default("Active"), // Active|Closed|Cancelled
  projectId: integer("project_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClientPOSchema = createInsertSchema(clientPOsTable).omit({ id: true, createdAt: true });
export type InsertClientPO = z.infer<typeof insertClientPOSchema>;
export type ClientPO = typeof clientPOsTable.$inferSelect;
