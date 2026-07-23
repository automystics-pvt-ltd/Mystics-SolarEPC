/**
 * SLA Escalation Job
 * Runs every 15 minutes — finds overdue approval steps, marks them escalated,
 * and emits notifications to the next approver level and admin.
 */
import {
  db, approvalRequestsTable, approvalRequestStepsTable,
  notificationsTable, usersTable,
} from "@workspace/db";
import { eq, and, lt, isNull, inArray } from "drizzle-orm";

export async function slaEscalationJob(): Promise<void> {
  try {
    const now = new Date();

    // Find pending steps with expired SLA that haven't been escalated yet
    const overdueSteps = await db.select({
      stepId:    approvalRequestStepsTable.id,
      requestId: approvalRequestStepsTable.requestId,
      stepName:  approvalRequestStepsTable.name,
      role:      approvalRequestStepsTable.approverRole,
    })
      .from(approvalRequestStepsTable)
      .where(and(
        eq(approvalRequestStepsTable.status, "pending"),
        lt(approvalRequestStepsTable.slaDeadline as any, now),
        eq(approvalRequestStepsTable.isEscalated, false),
      ))
      .limit(50); // process in batches

    if (!overdueSteps.length) return;

    // Mark as escalated
    await db.update(approvalRequestStepsTable)
      .set({ isEscalated: true, escalatedAt: now })
      .where(inArray(approvalRequestStepsTable.id, overdueSteps.map(s => s.stepId)));

    // Notify admins + directors about each overdue item
    const adminIds = (await db.select({ id: usersTable.id }).from(usersTable)
      .where(inArray(usersTable.role as any, ["admin", "director"]))).map(u => u.id);

    for (const step of overdueSteps) {
      // Notify role-specific approvers
      const roleIds = step.role
        ? (await db.select({ id: usersTable.id }).from(usersTable)
            .where(eq(usersTable.role as any, step.role))).map(u => u.id)
        : [];

      const uniqueIds = [...new Set([...adminIds, ...roleIds])];
      if (!uniqueIds.length) continue;

      await db.insert(notificationsTable).values(
        uniqueIds.map(uid => ({
          userId: uid,
          type: "warning",
          title: "⚠ SLA Deadline Exceeded",
          message: `Approval step "${step.name}" has exceeded its SLA deadline and requires immediate attention.`,
          entityType: "approval_request",
          entityId: step.requestId,
          entityRef: `APR-${String(step.requestId).padStart(5, "0")}`,
          actionUrl: `/approvals`,
        })),
      );
    }

    if (overdueSteps.length > 0) {
      console.log(`[SLA Job] Escalated ${overdueSteps.length} overdue approval steps`);
    }
  } catch (err) {
    console.error("[SLA Job] Error:", err);
  }
}
