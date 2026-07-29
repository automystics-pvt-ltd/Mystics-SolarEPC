import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/rbac";
import { auditMiddleware } from "../middleware/auditMiddleware";
import { requireModule } from "../middleware/moduleGuard";
import { getAllModuleStatuses } from "../lib/moduleCache";
import healthRouter from "./health";
import storageRouter from "./storage";
import procQuotationAttachmentsRouter from "./proc_quotation_attachments";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import leadsRouter from "./leads";
import quotationsRouter from "./quotations";
import crmInvoicesRouter from "./crm-invoices";
import tasksRouter from "./tasks";
import escalationsRouter from "./escalations";
import projectsRouter from "./projects";
import procurementRouter from "./procurement";
import inventoryRouter from "./inventory";
import engineeringRouter from "./engineering";
import commissioningRouter from "./commissioning";
import oamRouter from "./oam";
import vendorsRouter from "./vendors";
import materialsRouter from "./materials";
import procQuotationsRouter from "./proc_quotations";
import procPOsRouter from "./proc_pos";
import procGRNsRouter from "./proc_grns";
import procInvoicesRouter from "./proc_invoices";
import procDashboardRouter from "./proc_dashboard";
import notificationsRouter from "./notifications";
import grnReturnsRouter from "./grn_returns";
import stockTransfersRouter from "./stock_transfers";
import reportsRouter from "./reports";
import usersRouter from "./users";
import approvalsRouter from "./approvals";
import rbacRouter from "./rbac";
import solarInventoryRouter from "./solar_inventory";
import projLifecycleRouter from "./proj_lifecycle";
import projExecutionRouter from "./proj_execution";
import projClosureRouter from "./proj_closure";
import auditLogsRouter from "./audit_logs";
import dbAdminRouter from "./db_admin";
import platformAdminRouter from "./platform_admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(procQuotationAttachmentsRouter);
router.use(authRouter);
// Catch-all auth guard — any future router that omits requireAuth is still protected
router.use(requireAuth());
// Automatic audit capture for all non-GET, non-excluded routes
router.use(auditMiddleware());

// ── Public module status endpoint (all authenticated users) ──────────────────
// Used by the frontend NavRail to hide disabled module groups.
router.get("/modules/status", async (_req, res): Promise<void> => {
  try {
    const statuses = await getAllModuleStatuses();
    res.json(statuses);
  } catch {
    res.json({});
  }
});

// ── Dashboard ────────────────────────────────────────────────────────────────
router.use(requireModule("dashboard"), dashboardRouter);

// ── CRM ─────────────────────────────────────────────────────────────────────
router.use(requireModule("crm"), leadsRouter);
router.use(requireModule("crm"), quotationsRouter);
router.use(requireModule("crm"), crmInvoicesRouter);
router.use(requireModule("crm"), tasksRouter);
router.use(requireModule("crm"), escalationsRouter);

// ── Projects ─────────────────────────────────────────────────────────────────
router.use(requireModule("projects"), projectsRouter);
router.use(requireModule("projects"), projLifecycleRouter);
router.use(requireModule("projects"), projExecutionRouter);
router.use(requireModule("projects"), projClosureRouter);

// ── Procurement ───────────────────────────────────────────────────────────────
router.use(requireModule("procurement"), procurementRouter);
// vendors and materials each have their own module flag AND live under procurement
router.use(requireModule("procurement"), requireModule("vendors"), vendorsRouter);
router.use(requireModule("procurement"), requireModule("materials"), materialsRouter);
router.use(requireModule("procurement"), procQuotationsRouter);
router.use(requireModule("procurement"), procPOsRouter);
router.use(requireModule("procurement"), procGRNsRouter);
router.use(requireModule("procurement"), procInvoicesRouter);
router.use(requireModule("procurement"), procDashboardRouter);
router.use(requireModule("procurement"), grnReturnsRouter);

// ── Inventory ─────────────────────────────────────────────────────────────────
router.use(requireModule("inventory"), inventoryRouter);
router.use(requireModule("inventory"), solarInventoryRouter);
router.use(requireModule("inventory"), stockTransfersRouter);

// ── Engineering ───────────────────────────────────────────────────────────────
router.use(requireModule("engineering"), engineeringRouter);

// ── Commissioning ─────────────────────────────────────────────────────────────
router.use(requireModule("commissioning"), commissioningRouter);

// ── O&M ──────────────────────────────────────────────────────────────────────
router.use(requireModule("oam"), oamRouter);

// ── Finance / Reports ─────────────────────────────────────────────────────────
// NavRail uses the "finance" group key; backend must match to keep enforcement consistent.
// Gating on both "finance" AND "reports" ensures the group is blocked if either is disabled.
router.use(requireModule("finance"), requireModule("reports"), reportsRouter);

// ── Notifications (cross-cutting — always on) ────────────────────────────────
router.use(notificationsRouter);

// ── Admin & system (never gated by module guard) ────────────────────────────
router.use(usersRouter);
router.use(approvalsRouter);
router.use(rbacRouter);
router.use(auditLogsRouter);
router.use(dbAdminRouter);
router.use(platformAdminRouter);

export default router;
