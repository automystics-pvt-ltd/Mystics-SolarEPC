import { pgTable, serial, text, varchar, boolean, timestamp, numeric, integer, pgEnum } from "drizzle-orm/pg-core";

export const materialCategoriesTable = pgTable("material_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: varchar("code", { length: 20 }),
  description: text("description"),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const uomEnum = pgEnum("uom", [
  "Nos", "Pcs", "Set", "Pair",
  "Kg", "MT", "Gm",
  "Mtr", "Cm", "Mm", "Ft", "Inch",
  "Sqm", "Sqft",
  "Ltr", "ML",
  "Box", "Carton", "Bundle", "Roll", "Bag", "Drum",
  "KVA", "KW", "KWp", "kWh", "VA",
  "Other",
]);

export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 30 }).unique(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: integer("category_id").references(() => materialCategoriesTable.id),
  uom: uomEnum("uom").default("Nos").notNull(),

  // Tax & Compliance
  hsnSacCode: varchar("hsn_sac_code", { length: 20 }),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).default("18"),
  cessRate: numeric("cess_rate", { precision: 5, scale: 2 }).default("0"),

  // Pricing
  basePrice: numeric("base_price", { precision: 14, scale: 2 }),
  lastPurchasePrice: numeric("last_purchase_price", { precision: 14, scale: 2 }),
  currency: varchar("currency", { length: 5 }).default("INR"),

  // Specifications
  brand: text("brand"),
  model: text("model"),
  specifications: text("specifications"),
  minOrderQty: numeric("min_order_qty", { precision: 12, scale: 3 }),
  leadTimeDays: integer("lead_time_days"),

  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
