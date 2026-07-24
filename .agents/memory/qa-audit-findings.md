---
name: QA Audit Findings (July 2026)
description: Results and fixes from a comprehensive end-to-end QA audit of the Solar ERP — broken endpoints, data gaps, accessibility, performance.
---

## Critical bug fixed
- `procurement_quotations` DB table was missing `reopened_by_name` column (schema had it, migration never ran).
  Fix: `ALTER TABLE procurement_quotations ADD COLUMN IF NOT EXISTS reopened_by_name text`
  Symptom: GET /api/procurement-quotations returned 500 for all users.

## SLA job pattern
- `slaEscalation.ts` PO monitoring block must use `status::text IN (...)` cast when filtering by enum column in raw/sql template.
  Drizzle `inArray()` on Postgres enum columns can fail with type mismatch; text casting is the safe fallback.

## Vendor performance report — unlinked POs
- Seeded POs have `vendorId = null` with only a `vendorName` snapshot (no FK to vendors table).
- `reports.ts` vendor-performance previously filtered strictly on `vendorId`, returning empty for these POs.
- Fix: match POs by `vendorId OR vendorName`; also group any unlinked-name POs as separate entries with `linked: false`.
- Frontend shows amber "Unlinked" badge for `v.linked === false` vendors.

## Procurement report openValue bug
- Was hardcoded to `status === "Open"` — a status that doesn't exist in the schema.
- Fix: use array of actual active statuses: Draft, Submitted, PendingApproval, Approved, Revised, OnHold, Issued, Acknowledged, PartiallyReceived.

## Vendor performance category
- Vendors table has no category column. Category is now derived from PO items using `deriveCategory()` + `topCategoryForPOs()` helper in reports.ts.

## React key collision
- `VendorPerformance.tsx` used `key={v.id}` — null for all unlinked vendors. Fixed to `key={v.id ?? v.name}`.

## MaterialsList SortIcon
- `SortIcon` component used `key` as a prop name (reserved React prop) → browser console warning.
  Fixed: renamed to `column` prop in both definition and usage.

## PO list accessibility
- Clickable PO cards were bare `<div onClick>` with no keyboard support.
  Fixed: added `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space).
- Filter clear (X) buttons had no `aria-label`. Fixed: added descriptive aria-labels.

## Endpoint URLs
- `/api/warehouses` is the correct API path (not `/api/inventory/warehouses`).
  The `/inventory/warehouses` prefix is frontend routing only; the API route has no prefix.

## All-clear baseline (post-audit)
- 26 API endpoints all returning 200.
- ERP TypeScript: 0 errors. API TypeScript: 0 errors.
- Browser console: 0 errors.
- SLA job: runs silently (no warnings in clean server start).
