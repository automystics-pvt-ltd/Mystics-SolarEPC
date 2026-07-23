---
name: Mystics ERP GRN Module
description: Comprehensive GRN schema, API endpoints, and frontend — what was added and how it fits together
---

## Schema additions (lib/db/src/schema/proc_grns.ts)

### proc_grn_status enum — all values
`Draft`, `Submitted`, `Accepted`, `PartiallyAccepted`, `Rejected`, `Cancelled`, `Reversed`

### proc_grns table — new columns added
- `isLocked` (boolean, default false) — set true when Accepted/PartiallyAccepted; prevents edits
- `warehouseId`, `warehouseName`, `storageLocation` — warehouse assignment
- `cancelledAt/By/Name`, `cancellationReason` — cancellation metadata
- `reversedAt/By/Name`, `reversalReason` — reversal metadata

### proc_grn_items table — new columns added
- `batchNumber`, `serialNumbers`, `expiryDate`, `barcodeData`, `storageLocation` — traceability

### grn_comments table (new)
- `grnId`, `parentId` (threading), `userId/Name/Role`, `body`, `attachmentUrl/Name`, timestamps

## API endpoints (artifacts/api-server/src/routes/proc_grns.ts)

### New endpoints
- `POST /proc-grns/:id/cancel` — Draft/Submitted → Cancelled; requires `reason` in body
- `POST /proc-grns/:id/reverse` — Accepted/PartiallyAccepted → Reversed; undoes PO deliveredQty + writes Outward stock ledger; requires `reason`
- `GET  /proc-grns/:id/comments` — list comments for a GRN
- `POST /proc-grns/:id/comments` — add comment; notifies GRN creator
- `DELETE /proc-grns/:id/comments/:commentId` — delete comment (no body — apiDelete sends no body)

### Approve endpoint additions
- Sets `isLocked = true` on Accepted/PartiallyAccepted
- Writes `Inward` entries to `stock_ledger` for each accepted item (uses warehouseId from GRN, falls back to 1)
- Sends notification to GRN creator

### Notifications
- Submit: notifies all admins/approvers (type: approval)
- Approve: notifies GRN creator (type: success or error)
- Reject: notifies GRN creator (type: error)
- Cancel/Reverse: notifies all admins/approvers (type: warning)

**Why:** notification failures are non-fatal (caught and swallowed) so main operations never fail due to notification issues.

## Frontend

### GRNDetail.tsx — tabs: Overview | Items & QC | Comments | Activity
- LifecycleBar shows Draft→Submitted→Accepted/PartiallyAccepted/Rejected; terminal states (Cancelled, Reversed) show banner
- Lock banner when isLocked
- Cancel GRN dialog (from Draft/Submitted); Reverse GRN dialog (from Accepted/PartiallyAccepted, approver only)
- Create Return quick action (from Accepted/PartiallyAccepted/Rejected)
- Comments tab: add/delete comments with local optimistic state
- Items tab: shows batchNumber, expiryDate, storageLocation, barcodeData columns

### GRNForm.tsx — enhancements
- Warehouse selection dropdown (fetches /api/warehouses)
- Per-item expandable traceability: batch number, expiry date, barcode, storage location
- Collapsible component from @/components/ui/collapsible

## Key constraints
- `SectionCard.title` is typed as `string` only — cannot pass JSX element
- `apiDelete(path)` accepts only path, no body — DELETE endpoints must not require body
- Stock ledger warehouse fallback: if GRN has no warehouseId, uses 1 as default
