/**
 * quotationApprovalService.ts
 *
 * Shared transactional logic for the "approve quotation and generate PO"
 * workflow. Called from two entry points:
 *   1. POST /procurement-quotations/:id/approve  (quotation detail page)
 *   2. PATCH /approvals/:id/approve  (approval workbench — terminal step)
 *
 * Using a single function guarantees the same side-effects regardless of
 * which UI surface triggers the approval.
 */
import {
  db,
  procurementQuotationsTable, procQuotationItemsTable,
  procurementPOsTable, procPOItemsTable,
  vendorsTable, approvalRequestsTable,
  quotationAuditLogsTable, notificationsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

/* ── Counter shared with the route file ──────────────────────────────────── */
let poProcCounter = 1;
(async () => {
  try {
    const r = await db.select().from(procurementPOsTable)
      .orderBy(desc(procurementPOsTable.id)).limit(1);
    if (r.length > 0) poProcCounter = r[0].id + 1;
  } catch { /* ignore on first boot */ }
})();

export function nextPoCounter() { return poProcCounter++; }

/* ── Types ───────────────────────────────────────────────────────────────── */
interface Actor { userId: number | null; role?: string; name: string }

/* ── Shared approval transaction ─────────────────────────────────────────── */
/**
 * Approves a quotation, generates the linked PO, and fires notifications.
 *
 * Pre-conditions checked by caller:
 *   - quotation exists
 *   - quotation.status is 'Submitted' or 'UnderReview'
 *   - actor is authorised to approve
 *
 * Returns the updated quotation and the new PO, or throws on failure.
 */
export async function approveQuotationAndGeneratePO(
  quotationId: number,
  remarks: string,
  actor: Actor,
): Promise<{ quotation: typeof procurementQuotationsTable.$inferSelect; po: typeof procurementPOsTable.$inferSelect }> {

  const [existing] = await db.select().from(procurementQuotationsTable)
    .where(eq(procurementQuotationsTable.id, quotationId));
  if (!existing) throw new Error("Quotation not found");

  const PRE_TERMINAL_STATUSES = ["Submitted", "UnderReview"];
  if (!PRE_TERMINAL_STATUSES.includes(existing.status ?? "")) {
    throw new Error(`Cannot approve: quotation must be Submitted or UnderReview (currently ${existing.status})`);
  }

  const items = await db.select().from(procQuotationItemsTable)
    .where(eq(procQuotationItemsTable.quotationId, quotationId))
    .orderBy(procQuotationItemsTable.lineNo);

  let vendor: typeof vendorsTable.$inferSelect | null = null;
  if (existing.vendorId) {
    const [v] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, existing.vendorId));
    vendor = v ?? null;
  }

  const year = new Date().getFullYear();
  const poNumber = `PO-${year}-${String(nextPoCounter()).padStart(4, "0")}`;
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();

  // Atomic transaction: approve quotation + create PO + create PO items
  const [updatedQuotation, newPO] = await db.transaction(async (tx) => {
    const [q] = await tx.update(procurementQuotationsTable)
      .set({
        status: "Approved",
        approvedAt: now, approvedBy: actor.userId, approvedByName: actor.name,
        approvalRemarks: remarks, updatedAt: now,
        lockedAt: now, lockedBy: actor.userId,
      })
      .where(eq(procurementQuotationsTable.id, quotationId))
      .returning();
    if (!q) throw new Error("Failed to lock quotation");

    const [po] = await tx.insert(procurementPOsTable).values({
      poNumber, quotationId, vendorId: existing.vendorId,
      vendorName: existing.vendorSnapshotName ?? vendor?.name ?? "Unknown",
      vendorGstin: vendor?.gstin ?? null,
      vendorAddress: vendor?.billingAddress ?? null,
      vendorContact: vendor?.primaryPhone ?? null,
      status: "Draft", poDate: today,
      paymentTerms: existing.paymentTerms, warrantyMonths: existing.warrantyMonths,
      freightCharges: existing.freightCharges, otherCharges: existing.otherCharges,
      subtotal: existing.subtotal, totalGst: existing.totalGst, totalAmount: existing.totalAmount,
      approvedBy: actor.userId, approvedByName: actor.name, approvedAt: now,
      createdBy: actor.userId, createdByName: actor.name,
    }).returning();
    if (!po) throw new Error("Failed to create PO");

    if (items.length > 0) {
      await tx.insert(procPOItemsTable).values(items.map(item => ({
        poId: po.id, lineNo: item.lineNo, materialId: item.materialId,
        materialCode: item.materialCode, materialName: item.materialName,
        description: item.description, uom: item.uom, hsnSacCode: item.hsnSacCode,
        brand: item.brand, qty: item.qty, unitPrice: item.unitPrice,
        discountPct: item.discountPct, discountAmount: item.discountAmount,
        taxableAmount: item.taxableAmount, gstRate: item.gstRate,
        totalGst: item.totalGst, lineTotal: item.lineTotal,
      })));
    }

    // Mark PO generated on quotation
    const [qFinal] = await tx.update(procurementQuotationsTable)
      .set({ poGenerated: true })
      .where(eq(procurementQuotationsTable.id, quotationId))
      .returning();

    return [qFinal ?? q, po] as const;
  });

  // ── Post-commit side-effects (best-effort; errors are non-throwing) ─────────
  // The DB transaction above has already committed. Audit, approval-request sync,
  // and notifications must NOT throw — a failure here should not roll back or
  // misrepresent the committed state to the caller.

  await Promise.allSettled([
    db.insert(quotationAuditLogsTable).values([
      { quotationId, action: "Approved", performedBy: actor.userId, performedByName: actor.name,
        performedByRole: actor.role ?? null, remarks },
      { quotationId, action: "POGenerated", performedBy: actor.userId, performedByName: actor.name,
        performedByRole: actor.role ?? null, remarks: `PO ${poNumber} generated` },
    ]),

    existing.approvalRequestId
      ? db.update(approvalRequestsTable)
          .set({ status: "approved", updatedAt: now, resolvedAt: now })
          .where(eq(approvalRequestsTable.id, existing.approvalRequestId))
      : Promise.resolve(),

    existing.submittedBy
      ? db.insert(notificationsTable).values({
          userId: existing.submittedBy, type: "success",
          title: "Quotation Approved! 🎉",
          message: `${existing.referenceId} has been approved by ${actor.name}. PO ${poNumber} has been generated.`,
          entityType: "quotation", entityId: quotationId, entityRef: existing.referenceId,
          actionUrl: `/procurement/quotations/${quotationId}`,
        })
      : Promise.resolve(),
  ]);

  return { quotation: updatedQuotation, po: newPO };
}

/**
 * Rejects a quotation and fires notifications.
 * Sets the same rejection metadata fields as POST /procurement-quotations/:id/reject:
 * rejectedAt, rejectedBy, rejectedByName, approvalRemarks, status, updatedAt.
 *
 * Called from both the quotation detail route and the approval workbench reject path
 * so that both entry points always produce identical lifecycle state.
 */
export async function rejectQuotation(
  quotationId: number,
  reason: string,
  actor: Actor,
): Promise<void> {
  const [existing] = await db.select().from(procurementQuotationsTable)
    .where(eq(procurementQuotationsTable.id, quotationId));
  if (!existing) throw new Error(`Quotation ${quotationId} not found`);

  const PRE_TERMINAL_STATUSES = ["Submitted", "UnderReview"];
  if (!PRE_TERMINAL_STATUSES.includes(existing.status ?? "")) {
    throw new Error(`Cannot reject: quotation must be Submitted or UnderReview (currently ${existing.status})`);
  }

  const now = new Date();

  // Set the full set of rejection fields — identical to the detail-page reject route
  // Core rejection — this is the operation that must not fail silently
  await db.update(procurementQuotationsTable)
    .set({
      status: "Rejected",
      rejectedAt: now,
      rejectedBy: actor.userId,
      rejectedByName: actor.name,
      approvalRemarks: reason,
      updatedAt: now,
    })
    .where(eq(procurementQuotationsTable.id, quotationId));

  // ── Post-commit side-effects (best-effort; errors are non-throwing) ─────────
  await Promise.allSettled([
    existing.approvalRequestId
      ? db.update(approvalRequestsTable)
          .set({ status: "rejected", updatedAt: now, resolvedAt: now })
          .where(eq(approvalRequestsTable.id, existing.approvalRequestId))
      : Promise.resolve(),

    db.insert(quotationAuditLogsTable).values({
      quotationId, action: "Rejected", performedBy: actor.userId, performedByName: actor.name,
      performedByRole: actor.role ?? null, remarks: reason,
    }),

    existing.submittedBy
      ? db.insert(notificationsTable).values({
          userId: existing.submittedBy, type: "error", title: "Quotation Rejected",
          message: `${existing.referenceId} was rejected by ${actor.name}. Reason: ${reason}`,
          entityType: "quotation", entityId: quotationId, entityRef: existing.referenceId,
          actionUrl: `/procurement/quotations/${quotationId}`,
        })
      : Promise.resolve(),
  ]);
}
