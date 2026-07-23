import {
  pgTable, serial, text, integer, boolean, timestamp, jsonb,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/* ── Workflow templates ──────────────────────────────────────────────────── */
export const approvalWorkflowsTable = pgTable("approval_workflows", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description"),
  module:      text("module").notNull().default("other"),
  // procurement|sales|finance|hr|projects|inventory|engineering|admin|other
  isActive:    boolean("is_active").default(true).notNull(),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

/* ── Steps within a workflow template ───────────────────────────────────── */
export const approvalWorkflowStepsTable = pgTable("approval_workflow_steps", {
  id:                  serial("id").primaryKey(),
  workflowId:          integer("workflow_id").notNull()
                         .references(() => approvalWorkflowsTable.id, { onDelete: "cascade" }),
  stepOrder:           integer("step_order").notNull(),
  name:                text("name").notNull(),
  stepType:            text("step_type").notNull().default("sequential"),
  // sequential | parallel | conditional
  approverType:        text("approver_type").notNull().default("role"),
  // role | user | any
  approverRole:        text("approver_role"),
  // admin|director|pm|finance|warehouse|sales
  approverUserId:      integer("approver_user_id").references(() => usersTable.id),
  slaHours:            integer("sla_hours").default(24),
  escalateAfterHours:  integer("escalate_after_hours"),
  escalateToRole:      text("escalate_to_role"),
  isRequired:          boolean("is_required").default(true).notNull(),
});

/* ── Submitted approval requests ────────────────────────────────────────── */
export const approvalRequestsTable = pgTable("approval_requests", {
  id:           serial("id").primaryKey(),
  workflowId:   integer("workflow_id").references(() => approvalWorkflowsTable.id),
  refNumber:    text("ref_number").notNull(),
  title:        text("title").notNull(),
  description:  text("description"),
  module:       text("module").notNull().default("other"),
  entityType:   text("entity_type"),
  entityRef:    text("entity_ref"),
  entityUrl:    text("entity_url"),
  requesterId:  integer("requester_id").notNull().references(() => usersTable.id),
  priority:     text("priority").notNull().default("medium"),
  // low | medium | high | critical
  status:       text("status").notNull().default("pending"),
  // pending | approved | rejected | recalled | cancelled
  currentStep:  integer("current_step").default(1).notNull(),
  totalSteps:   integer("total_steps").default(1).notNull(),
  slaDeadline:  timestamp("sla_deadline"),
  notes:        text("notes"),
  metadata:     jsonb("metadata"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
  resolvedAt:   timestamp("resolved_at"),
});

/* ── Per-step tracking for each request ─────────────────────────────────── */
export const approvalRequestStepsTable = pgTable("approval_request_steps", {
  id:             serial("id").primaryKey(),
  requestId:      integer("request_id").notNull()
                    .references(() => approvalRequestsTable.id, { onDelete: "cascade" }),
  stepOrder:      integer("step_order").notNull(),
  name:           text("name").notNull(),
  stepType:       text("step_type").notNull().default("sequential"),
  approverType:   text("approver_type").notNull().default("role"),
  approverRole:   text("approver_role"),
  approverUserId: integer("approver_user_id"),
  status:         text("status").notNull().default("pending"),
  // pending | approved | rejected | skipped | delegated
  actedById:      integer("acted_by_id").references(() => usersTable.id),
  delegatedToId:  integer("delegated_to_id").references(() => usersTable.id),
  actedAt:        timestamp("acted_at"),
  slaDeadline:    timestamp("sla_deadline"),
  isEscalated:    boolean("is_escalated").default(false),
  escalatedAt:    timestamp("escalated_at"),
  comment:        text("comment"),
});

/* ── Full audit trail (every action ever taken) ─────────────────────────── */
export const approvalActionsTable = pgTable("approval_actions", {
  id:          serial("id").primaryKey(),
  requestId:   integer("request_id").notNull()
                 .references(() => approvalRequestsTable.id, { onDelete: "cascade" }),
  stepId:      integer("step_id").references(() => approvalRequestStepsTable.id),
  actorId:     integer("actor_id").references(() => usersTable.id),
  actionType:  text("action_type").notNull(),
  // submitted|approved|rejected|recalled|delegated|escalated|commented|cancelled
  comment:     text("comment"),
  attachments: jsonb("attachments"),
  metadata:    jsonb("metadata"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

/* ── Delegation rules ───────────────────────────────────────────────────── */
export const approvalDelegatesTable = pgTable("approval_delegates", {
  id:          serial("id").primaryKey(),
  fromUserId:  integer("from_user_id").notNull().references(() => usersTable.id),
  toUserId:    integer("to_user_id").notNull().references(() => usersTable.id),
  module:      text("module"), // null = all modules
  startDate:   timestamp("start_date").notNull(),
  endDate:     timestamp("end_date"),
  isActive:    boolean("is_active").default(true).notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});
