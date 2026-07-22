import { pgTable, serial, text, varchar, boolean, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";

export const vendorStatusEnum = pgEnum("vendor_status", ["Active", "Inactive", "Blacklisted"]);

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).unique(),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  status: vendorStatusEnum("status").default("Active").notNull(),

  // GST & Tax
  gstin: varchar("gstin", { length: 20 }),
  pan: varchar("pan", { length: 15 }),
  gstRegisteredState: text("gst_registered_state"),
  gstStateCode: varchar("gst_state_code", { length: 4 }),
  isMsme: boolean("is_msme").default(false),
  msmeNumber: varchar("msme_number", { length: 30 }),

  // Billing Address
  billingAddress: text("billing_address"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingPincode: varchar("billing_pincode", { length: 10 }),
  billingCountry: text("billing_country").default("India"),

  // Primary Contact
  primaryEmail: text("primary_email"),
  primaryPhone: varchar("primary_phone", { length: 20 }),
  website: text("website"),

  // Bank Details
  bankName: text("bank_name"),
  bankBranch: text("bank_branch"),
  bankAccountNumber: varchar("bank_account_number", { length: 30 }),
  bankIfsc: varchar("bank_ifsc", { length: 15 }),
  bankAccountType: text("bank_account_type"),
  upiId: text("upi_id"),

  // Terms
  paymentTerms: text("payment_terms"),
  creditLimit: text("credit_limit"),
  tags: text("tags").array(),
  notes: text("notes"),

  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorContactsTable = pgTable("vendor_contacts", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  designation: text("designation"),
  email: text("email"),
  phone: varchar("phone", { length: 20 }),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
