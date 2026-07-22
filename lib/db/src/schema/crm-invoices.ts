import { pgTable, text, serial, timestamp, integer, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const crmInvoicesTable = pgTable("crm_invoices", {
  id: serial("id").primaryKey(),
  clientPoId: integer("client_po_id").notNull(),
  projectId: integer("project_id"),
  type: text("type").notNull().default("Tax"), // Tax|Proforma
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  taxDetails: text("tax_details"),
  dueDate: date("due_date", { mode: "string" }),
  paymentStatus: text("payment_status").notNull().default("Unpaid"), // Unpaid|PartiallyPaid|Paid|Overdue
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }),
  paidDate: date("paid_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCrmInvoiceSchema = createInsertSchema(crmInvoicesTable).omit({ id: true, createdAt: true });
export type InsertCrmInvoice = z.infer<typeof insertCrmInvoiceSchema>;
export type CrmInvoice = typeof crmInvoicesTable.$inferSelect;
