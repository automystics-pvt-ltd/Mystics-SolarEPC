import { pgTable, text, serial, timestamp, integer, numeric, real, date } from "drizzle-orm/pg-core";
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

// ── Site Surveys ───────────────────────────────────────────────────────────────
export const siteSurveysTable = pgTable("site_surveys", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  surveyedBy: integer("surveyed_by"),
  surveyDate: date("survey_date", { mode: "string" }),
  roofType: text("roof_type"), // Flat|Sloped|Ground-mount
  roofArea: real("roof_area"),  // sq ft
  shadowAnalysis: text("shadow_analysis"), // None|Partial|Heavy
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  sanctionedLoad: real("sanctioned_load"), // kW
  avgMonthlyBill: real("avg_monthly_bill"),  // INR
  proposedCapacity: real("proposed_capacity"), // kWp
  photos: text("photos").array().default([]),
  structuralNotes: text("structural_notes"),
  feasibilityStatus: text("feasibility_status").notNull().default("Pending"), // Pending|Feasible|NotFeasible|ConditionallyFeasible
  feasibilityNotes: text("feasibility_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSiteSurveySchema = createInsertSchema(siteSurveysTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSiteSurvey = z.infer<typeof insertSiteSurveySchema>;
export type SiteSurvey = typeof siteSurveysTable.$inferSelect;
