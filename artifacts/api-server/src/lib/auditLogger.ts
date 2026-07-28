/**
 * Central audit logging utility.
 *
 * Uses a dedicated pg.Pool (max 3) so audit writes never contend with
 * the main Drizzle pool and never propagate errors to callers.
 *
 * Key exports:
 *   writeAuditLog(data)   — fire-and-forget insert
 *   resolveRoute(path)    — maps /api/… path to { module, entityType, entityLabel }
 *   resolveAction(method, path) — POST→create, PATCH→update, etc.
 *   shouldSkip(path)      — true for paths the middleware should not audit
 */

import pg from "pg";
import type { Request } from "express";

// ── Dedicated pool (max 3, never starves main Drizzle pool) ──────────────────
const _pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30_000,
});

// ── Simple user-name cache (names almost never change) ────────────────────────
const _nameCache = new Map<number, string>();
async function lookupUserName(userId: number): Promise<string | undefined> {
  if (_nameCache.has(userId)) return _nameCache.get(userId)!;
  try {
    const r = await _pool.query<{ name: string }>("SELECT name FROM users WHERE id=$1", [userId]);
    if (r.rows[0]) { _nameCache.set(userId, r.rows[0].name); return r.rows[0].name; }
  } catch { /* ignore */ }
  return undefined;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuditLogData {
  userId?:       number;
  userName?:     string;   // pass directly when known (auth routes), else looked up
  userRole?:     string;
  action:        string;
  module:        string;
  entityType?:   string;
  entityId?:     string;
  entityLabel?:  string;
  description?:  string;
  oldValues?:    unknown;
  newValues?:    unknown;
  ipAddress?:    string;
  userAgent?:    string;
  status?:       "success" | "failure" | "error";
  errorMessage?: string;
  durationMs?:   number;
}

// ── Writer ────────────────────────────────────────────────────────────────────
export async function writeAuditLog(data: AuditLogData): Promise<void> {
  try {
    const userName = data.userName ?? (data.userId ? await lookupUserName(data.userId) : undefined);
    await _pool.query(
      `INSERT INTO audit_logs
         (user_id, user_name, user_role, action, module,
          entity_type, entity_id, entity_label, description,
          old_values, new_values,
          ip_address, user_agent,
          status, error_message, duration_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        data.userId       ?? null,
        userName          ?? null,
        data.userRole     ?? null,
        data.action,
        data.module,
        data.entityType   ?? null,
        data.entityId     ?? null,
        data.entityLabel  ?? null,
        data.description  ?? null,
        data.oldValues  != null ? JSON.stringify(data.oldValues) : null,
        data.newValues  != null ? JSON.stringify(data.newValues) : null,
        data.ipAddress    ?? null,
        data.userAgent    ?? null,
        data.status       ?? "success",
        data.errorMessage ?? null,
        data.durationMs   ?? null,
      ],
    );
  } catch (err) {
    // Never surface audit failures to callers
    console.error("[AuditLog] write failed:", (err as Error).message);
  }
}

// ── URL → route info ──────────────────────────────────────────────────────────
export interface RouteInfo { module: string; entityType: string; entityLabel: string }

// NOTE: req.path inside the /api router is WITHOUT the /api prefix.
// e.g. POST /api/leads → req.path = "/leads", POST /api/proc-grns → "/proc-grns"
// More-specific prefixes must appear BEFORE shorter ones that would also match.
const PREFIX_MAP: [string, RouteInfo][] = [
  // ── CRM ──────────────────────────────────────────────────────────────────
  ["/leads",                    { module: "crm",          entityType: "lead",                    entityLabel: "Lead"                   }],
  ["/quotations",               { module: "crm",          entityType: "quotation",               entityLabel: "CRM Quotation"          }],
  ["/crm-invoices",             { module: "crm",          entityType: "crm_invoice",             entityLabel: "CRM Invoice"            }],
  ["/client-pos",               { module: "crm",          entityType: "client_po",               entityLabel: "Client PO"              }],
  ["/tasks",                    { module: "crm",          entityType: "task",                    entityLabel: "Task"                   }],
  ["/escalations",              { module: "crm",          entityType: "escalation",              entityLabel: "Escalation"             }],

  // ── Projects (specific sub-resources before the generic /projects) ────────
  ["/material-requests",        { module: "projects",     entityType: "material_request",        entityLabel: "Material Request"       }],
  ["/payment-milestones",       { module: "projects",     entityType: "payment_milestone",       entityLabel: "Payment Milestone"      }],
  ["/boq-items",                { module: "projects",     entityType: "boq_item",                entityLabel: "BOQ Item"               }],
  ["/change-requests",          { module: "projects",     entityType: "change_request",          entityLabel: "Change Request"         }],
  ["/project-milestones",       { module: "projects",     entityType: "project_milestone",       entityLabel: "Project Milestone"      }],
  ["/project-inspections",      { module: "projects",     entityType: "project_inspection",      entityLabel: "Project Inspection"     }],
  ["/closure",                  { module: "projects",     entityType: "project_closure",         entityLabel: "Project Closure"        }],
  ["/handover",                 { module: "projects",     entityType: "project_handover",        entityLabel: "Project Handover"       }],
  ["/projects",                 { module: "projects",     entityType: "project",                 entityLabel: "Project"                }],
  ["/contractors",              { module: "projects",     entityType: "contractor",              entityLabel: "Contractor"             }],
  ["/activities",               { module: "projects",     entityType: "activity",                entityLabel: "Activity"               }],
  ["/budgets",                  { module: "projects",     entityType: "budget",                  entityLabel: "Budget"                 }],
  ["/dprs",                     { module: "projects",     entityType: "dpr",                     entityLabel: "DPR"                    }],
  ["/expenses",                 { module: "projects",     entityType: "expense",                 entityLabel: "Expense"                }],

  // ── Procurement (longer prefixes before shorter that would also match) ────
  ["/material-categories",      { module: "procurement",  entityType: "material_category",       entityLabel: "Material Category"      }],
  ["/material-suppliers",       { module: "procurement",  entityType: "material_supplier",       entityLabel: "Material Supplier"      }],
  ["/materials",                { module: "procurement",  entityType: "material",                entityLabel: "Material"               }],
  ["/vendors",                  { module: "procurement",  entityType: "vendor",                  entityLabel: "Vendor"                 }],
  ["/procurement-quotations",   { module: "procurement",  entityType: "proc_quotation",          entityLabel: "Vendor Quotation"       }],
  ["/procurement-pos",          { module: "procurement",  entityType: "purchase_order",          entityLabel: "Purchase Order"         }],
  ["/purchase-orders",          { module: "procurement",  entityType: "purchase_order",          entityLabel: "Purchase Order"         }],
  ["/proc-grns",                { module: "procurement",  entityType: "grn",                     entityLabel: "GRN"                    }],
  ["/proc-invoices",            { module: "procurement",  entityType: "invoice",                 entityLabel: "Invoice"                }],
  ["/grn-returns",              { module: "procurement",  entityType: "grn_return",              entityLabel: "GRN Return"             }],
  ["/delivery-challans",        { module: "procurement",  entityType: "delivery_challan",        entityLabel: "Delivery Challan"       }],

  // ── Inventory ─────────────────────────────────────────────────────────────
  ["/stock-transfers",          { module: "inventory",    entityType: "stock_transfer",          entityLabel: "Stock Transfer"         }],
  ["/solar-inventory",          { module: "inventory",    entityType: "solar_inventory",         entityLabel: "Solar Inventory"        }],
  ["/inventory-audits",         { module: "inventory",    entityType: "inventory_audit",         entityLabel: "Inventory Audit"        }],
  ["/inventory",                { module: "inventory",    entityType: "inventory",               entityLabel: "Inventory"              }],
  ["/warehouses",               { module: "inventory",    entityType: "warehouse",               entityLabel: "Warehouse"              }],
  ["/grns",                     { module: "inventory",    entityType: "grn",                     entityLabel: "GRN"                    }],

  // ── Engineering ───────────────────────────────────────────────────────────
  ["/design-documents",         { module: "engineering",    entityType: "design_document",       entityLabel: "Design Document"        }],
  ["/inspection-checklists",    { module: "engineering",    entityType: "inspection_checklist",  entityLabel: "Inspection Checklist"   }],

  // ── Commissioning ─────────────────────────────────────────────────────────
  ["/commissioning-checklists", { module: "commissioning",  entityType: "commissioning_checklist",entityLabel: "Commissioning Checklist"}],
  ["/commissioning-items",      { module: "commissioning",  entityType: "commissioning_item",    entityLabel: "Commissioning Item"     }],
  ["/compliance-documents",     { module: "commissioning",  entityType: "compliance_document",   entityLabel: "Compliance Document"    }],

  // ── O&M ───────────────────────────────────────────────────────────────────
  ["/amc-contracts",            { module: "oam",          entityType: "amc_contract",            entityLabel: "AMC Contract"           }],
  ["/maintenance-schedules",    { module: "oam",          entityType: "maintenance_schedule",    entityLabel: "Maintenance Schedule"   }],
  ["/service-tickets",          { module: "oam",          entityType: "service_ticket",          entityLabel: "Service Ticket"         }],

  // ── Approvals ─────────────────────────────────────────────────────────────
  ["/approval-workflows",       { module: "approvals",    entityType: "approval_workflow",       entityLabel: "Approval Workflow"      }],
  ["/approval-requests",        { module: "approvals",    entityType: "approval_request",        entityLabel: "Approval Request"       }],
  ["/approvals",                { module: "approvals",    entityType: "approval",                entityLabel: "Approval"               }],

  // ── Admin ─────────────────────────────────────────────────────────────────
  ["/users",                    { module: "admin",        entityType: "user",                    entityLabel: "User"                   }],
  ["/rbac",                     { module: "admin",        entityType: "role_permission",         entityLabel: "Permission"             }],
];

/** Paths that should NOT be audited by the middleware (auth handled manually).
 *  These are req.path values inside the /api router — no /api prefix. */
const SKIP_PREFIXES = [
  "/healthz",
  "/storage",
  "/dashboard",
  "/reports",
  "/notifications",
  "/proc-po-audit",
  "/proc-grn-audit",
  "/proc-dashboard",
  "/audit-logs",             // no recursion
  "/auth",                   // handled manually in auth.ts
  "/proc-quotation-attachments",
];

export function shouldSkip(path: string): boolean {
  return SKIP_PREFIXES.some(p => path.startsWith(p));
}

export function resolveRoute(path: string): RouteInfo | null {
  for (const [prefix, info] of PREFIX_MAP) {
    if (path.startsWith(prefix)) return info;
  }
  return null;
}

// ── Action from HTTP method + URL suffix ──────────────────────────────────────
const SUFFIX_ACTIONS: Record<string, string> = {
  approve: "approve", reject: "reject", submit: "submit", cancel: "cancel",
  accept: "accept", close: "close", issue: "issue", acknowledge: "acknowledge",
  reopen: "reopen", reverse: "reverse", dispatch: "dispatch", pay: "pay",
  lock: "lock", unlock: "unlock", duplicate: "duplicate", revise: "revise",
  assign: "assign",
};

export function resolveAction(method: string, path: string): string {
  const seg = path.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
  if (SUFFIX_ACTIONS[seg]) return SUFFIX_ACTIONS[seg];
  switch (method.toUpperCase()) {
    case "POST":   return "create";
    case "PUT":
    case "PATCH":  return "update";
    case "DELETE": return "delete";
    default:       return method.toLowerCase();
  }
}

// ── Entity info extraction from response body ─────────────────────────────────
const LABEL_FIELDS = [
  "poNumber", "grnNumber", "returnNumber", "invoiceNumber",
  "referenceId", "reference_id", "mrNumber", "clientPoNumber",
  "wbsCode", "milestoneName", "title",
  "companyName", "trade_name",
  "name", "email", "code",
];

export function extractEntityLabel(body: unknown): string | undefined {
  if (body == null || typeof body !== "object") return undefined;
  const obj = body as Record<string, unknown>;
  for (const field of LABEL_FIELDS) {
    if (typeof obj[field] === "string" && obj[field]) return obj[field] as string;
  }
  return undefined;
}

export function extractEntityId(path: string, body: unknown): string | undefined {
  // req.path inside the /api router has NO /api prefix.
  // e.g. /vendors/42/contacts → "42", /procurement-pos/7/approve → "7"
  const match = path.match(/\/[a-z-]+\/(\d+)/);
  if (match) return match[1];
  if (body != null && typeof body === "object") {
    const id = (body as Record<string, unknown>).id;
    if (id != null) return String(id);
  }
  return undefined;
}

// ── Client IP ─────────────────────────────────────────────────────────────────
export function getClientIP(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress ?? (req as any).ip ?? "unknown";
}

// ── User-agent ────────────────────────────────────────────────────────────────
export function parseBrowser(ua: string): string {
  if (/Edg\//i.test(ua))   return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return "Unknown";
}
export function parseDevice(ua: string): string {
  if (/Mobile|iPhone|iPod|Android.*Mobile/i.test(ua)) return "Mobile";
  if (/iPad|Android(?!.*Mobile)/i.test(ua))           return "Tablet";
  return "Desktop";
}
export function formatDevice(ua: string): string {
  return `${parseBrowser(ua)} · ${parseDevice(ua)}`;
}

// ── Human-readable description ────────────────────────────────────────────────
const ACTION_VERBS: Record<string, string> = {
  create: "Created", update: "Updated", delete: "Deleted",
  approve: "Approved", reject: "Rejected", submit: "Submitted",
  cancel: "Cancelled", accept: "Accepted", close: "Closed",
  issue: "Issued", acknowledge: "Acknowledged", reopen: "Reopened",
  reverse: "Reversed", dispatch: "Dispatched", pay: "Paid",
  lock: "Locked", unlock: "Unlocked", duplicate: "Duplicated",
  revise: "Revised", login: "Logged in", logout: "Logged out",
  assign: "Assigned",
};

export function buildDescription(
  action: string,
  entityType: string,
  entityLabel: string | undefined,
  fallbackLabel: string,
): string {
  const verb = ACTION_VERBS[action] ?? (action[0]?.toUpperCase() ?? "") + action.slice(1);
  const typeLabel = entityType.replace(/_/g, " ");
  return `${verb} ${typeLabel}: ${entityLabel ?? fallbackLabel}`;
}
