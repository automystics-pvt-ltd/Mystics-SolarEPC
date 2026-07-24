/**
 * SLA Escalation Job
 * Runs every 15 minutes — finds overdue approval steps, marks them escalated,
 * and emits notifications to the next approver level and admin.
 * Also monitors PO SLA deadlines and sends breach notifications.
 */
import {
  db, approvalRequestsTable, approvalRequestStepsTable,
  notificationsTable, usersTable,
} from "@workspace/db";
import { procurementPOsTable } from "@workspace/db";
import { eq, and, lt, isNull, inArray, sql } from "drizzle-orm";

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

    // Notify admins + directors
    const adminIds = (await db.select({ id: usersTable.id }).from(usersTable)
      .where(inArray(usersTable.role as any, ["admin", "director"]))).map(u => u.id);

    if (overdueSteps.length > 0) {
      // Mark as escalated
      await db.update(approvalRequestStepsTable)
        .set({ isEscalated: true, escalatedAt: now })
        .where(inArray(approvalRequestStepsTable.id, overdueSteps.map(s => s.stepId)));

      for (const step of overdueSteps) {
        const roleIds = step.role
          ? (await db.select({ id: usersTable.id }).from(usersTable)
              .where(eq(usersTable.role as any, step.role))).map(u => u.id)
          : [];

        const uniqueIds = [...new Set([...adminIds, ...roleIds])];
        if (!uniqueIds.length) continue;

        await db.insert(notificationsTable as any).values(
          uniqueIds.map(uid => ({
            userId: uid,
            type: "warning",
            title: "⚠ SLA Deadline Exceeded",
            message: `Approval step "${step.stepName}" has exceeded its SLA deadline and requires immediate attention.`,
            entityType: "approval_request",
            entityId: step.requestId,
            entityRef: `APR-${String(step.requestId).padStart(5, "0")}`,
            actionUrl: `/approvals`,
          })),
        );
      }

      console.log(`[SLA Job] Escalated ${overdueSteps.length} overdue approval steps`);
    }

    // ── PO SLA breach monitoring ─────────────────────────────────────────────
    try {
      const breachedPOs = await (db as any).execute(
        sql`SELECT id, po_number, submitted_by FROM procurement_pos
            WHERE status IN ('Submitted', 'PendingApproval')
              AND sla_deadline IS NOT NULL
              AND sla_deadline < now()
            LIMIT 50`
      );
      const rows = breachedPOs?.rows ?? [];
      for (const po of rows) {
        const notifications = [];
        if (po.submitted_by) {
          notifications.push({
            userId:     po.submitted_by,
            type:       "error",
            title:      "⚠ PO Approval SLA Breached",
            message:    `Purchase Order ${po.po_number} has exceeded its approval SLA deadline. Please escalate.`,
            entityType: "purchase_order",
            entityId:   po.id,
            entityRef:  po.po_number,
            actionUrl:  `/procurement/pos/${po.id}`,
          });
        }
        for (const uid of adminIds) {
          if (uid === po.submitted_by) continue;
          notifications.push({
            userId:     uid,
            type:       "warning",
            title:      "PO SLA Breach: Action Needed",
            message:    `Purchase Order ${po.po_number} has exceeded its approval SLA. Approval is overdue.`,
            entityType: "purchase_order",
            entityId:   po.id,
            entityRef:  po.po_number,
            actionUrl:  `/procurement/pos/${po.id}`,
          });
        }
        if (notifications.length > 0) {
          await db.insert(notificationsTable as any).values(notifications);
        }
      }
      if (rows.length > 0) {
        console.log(`[SLA Job] Notified ${rows.length} PO SLA breaches`);
      }
    } catch (poErr) {
      console.warn("[SLA Job] PO SLA check skipped:", (poErr as any)?.message);
    }

  } catch (err) {
    console.error("[SLA Job] Error:", err);
  }
}
