import { pgTable, serial, varchar, boolean, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const rolePermissionsTable = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role:    varchar("role",   { length: 50  }).notNull(),
  module:  varchar("module", { length: 100 }).notNull(),
  action:  varchar("action", { length: 50  }).notNull(),
  allowed: boolean("allowed").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by"),
}, (t) => [
  uniqueIndex("role_perm_uniq").on(t.role, t.module, t.action),
]);
