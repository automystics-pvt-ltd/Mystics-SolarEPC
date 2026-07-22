import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  source: text("source").notNull().default("Manual"), // IndiaMART|JustDial|Website|Referral|Card-scan|Manual
  ownerId: integer("owner_id"),
  territory: text("territory"),
  companyName: text("company_name"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  productInterest: text("product_interest"),
  estimatedValue: numeric("estimated_value", { precision: 15, scale: 2 }),
  score: integer("score").default(0),
  status: text("status").notNull().default("New"), // New|Contacted|Qualified|Proposal|Negotiation|Won|Lost
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
