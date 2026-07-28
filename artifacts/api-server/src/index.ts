import app from "./app";
import { logger } from "./lib/logger";
import { runAuditLogsMigration } from "./migrations/create_audit_logs";
import {
  db, approvalRequestsTable, approvalRequestStepsTable, approvalActionsTable,
  approvalWorkflowStepsTable, notificationsTable, usersTable,
} from "@workspace/db";
import { eq, and, lt, inArray } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run idempotent migrations on every boot
void runAuditLogsMigration();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

/* ══════════════════════════════════════════════════════════════════════════
   SLA ESCALATION BACKGROUND JOB  (runs every 15 minutes)
   Finds overdue pending approval steps and escalates them to the next role.
══════════════════════════════════════════════════════════════════════════ */
async function runSlaEscalation() {
  try {
    const now = new Date();

    // Find all overdue pending steps that have NOT been escalated yet
    const overdueSteps = await db.select({
      step: approvalRequestStepsTable,
    })
      .from(approvalRequestStepsTable)
      .where(and(
        eq(approvalRequestStepsTable.status, "pending"),
        eq(approvalRequestStepsTable.isEscalated, false),
        lt(approvalRequestStepsTable.slaDeadline, now),
      ));

    if (!overdueSteps.length) return;

    logger.info({ count: overdueSteps.length }, "SLA escalation: found overdue steps");

    for (const { step } of overdueSteps) {
      // Find the workflow step to get escalation config
      const [request] = await db.select().from(approvalRequestsTable)
        .where(eq(approvalRequestsTable.id, step.requestId));
      if (!request || request.status !== "pending") continue;

      // Find escalateToRole from workflow template
      let escalateToRole: string | null = null;
      if (request.workflowId) {
        const [wfStep] = await db.select().from(approvalWorkflowStepsTable)
          .where(and(
            eq(approvalWorkflowStepsTable.workflowId, request.workflowId),
            eq(approvalWorkflowStepsTable.stepOrder, step.stepOrder),
          ));
        escalateToRole = wfStep?.escalateToRole ?? null;
      }

      // Default escalation: director → admin
      if (!escalateToRole) {
        escalateToRole = step.approverRole === "admin" ? "admin" : "director";
      }

      // Mark step as escalated
      await db.update(approvalRequestStepsTable)
        .set({ isEscalated: true, escalatedAt: now, approverRole: escalateToRole })
        .where(eq(approvalRequestStepsTable.id, step.id));

      // Log escalation action
      await db.insert(approvalActionsTable).values({
        requestId: step.requestId, stepId: step.id, actorId: null,
        actionType: "escalated",
        comment: `Step escalated to ${escalateToRole} after SLA breach`,
        metadata: { previousRole: step.approverRole, escalatedTo: escalateToRole } as any,
      });

      // Notify escalation role
      const escalatedUsers = await db.select({ id: usersTable.id })
        .from(usersTable).where(eq(usersTable.role, escalateToRole as any));
      if (escalatedUsers.length) {
        await db.insert(notificationsTable).values(
          escalatedUsers.map(u => ({
            userId: u.id,
            type: "warning" as const,
            title: "Escalated Approval Requires Action",
            message: `Approval request ${request.refNumber} has been escalated to you after SLA breach. Please review immediately.`,
            entityType: request.entityType ?? "approval",
            entityId: request.id,
            entityRef: request.entityRef ?? request.refNumber,
            actionUrl: request.entityUrl ?? `/approvals`,
          }))
        );
      }

      logger.info({ stepId: step.id, requestId: step.requestId, escalateToRole }, "SLA escalated");
    }
  } catch (err) {
    logger.error({ err }, "SLA escalation job error");
  }
}

// Run immediately on start, then every 15 minutes
runSlaEscalation();
setInterval(runSlaEscalation, 15 * 60 * 1000);
