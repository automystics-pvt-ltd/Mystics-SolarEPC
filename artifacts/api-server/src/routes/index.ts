import { Router, type IRouter } from "express";
import healthRouter from "./health";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(leadsRouter);
router.use(quotationsRouter);
router.use(crmInvoicesRouter);
router.use(tasksRouter);
router.use(escalationsRouter);
router.use(projectsRouter);
router.use(procurementRouter);
router.use(inventoryRouter);
router.use(engineeringRouter);
router.use(commissioningRouter);
router.use(oamRouter);

export default router;
