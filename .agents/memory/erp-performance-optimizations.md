---
name: ERP Performance Optimizations
description: What was done, what patterns to follow, and what NOT to redo for the enterprise performance pass
---

## DB Indexes Added
32 indexes via `CREATE INDEX CONCURRENTLY IF NOT EXISTS` covering:
- `procurement_quotations`: status, vendor_id, created_at
- `purchase_orders`: status, vendor_id, project_id, created_at
- `proc_grns`: status, created_at
- `approval_requests`: status, entity_type, created_at
- `approval_request_steps`: (request_id, step_order), approver_role, approver_user_id, delegated_to_id
- `material_stock_levels`: material_id, warehouse_id
- `projects`: status, pm_owner_id
- `leads`: status, created_at
- `quotations`: approval_status, lead_id
- `notifications`: user_id, is_read, created_at
- `snag_logs`: status, severity

**Why:** These tables are queried on every list page and were doing full scans.

## N+1 Fixes in approvals.ts
- `fmtRequest()` (single-record formatter): now fetches steps + actions in ONE `Promise.all` instead of sequentially
- `fmtRequestsBatch()` (NEW): batch formatter for list endpoints — ONE query for all steps across all requests, ONE for all actions, ONE for actor names → O(1) DB round trips regardless of list size
- `fmtRequestWithData()` (NEW): pure formatting function, no DB access
- `my-pending` loop replaced with a single `db.selectDistinct().innerJoin(approvalRequestStepsTable)` query
- `queue` endpoint: filters pushed to DB via Drizzle `.$dynamic()` (was JS-side filter on full table)
- `history` endpoint: non-admin scoping done with DB `inArray` instead of JS filter

**Why:** With 50 pending approvals, old code ran 150+ queries per list view.

## proc_quotations List Fix
- `GET /procurement-quotations`: mrId, vendorId, status filters now pushed into Drizzle WHERE clauses via `.$dynamic()`
- Previously: fetched all rows, filtered in JS

## GRNs and POs Lists
Already efficient (use `.$dynamic()` before this pass) — do NOT re-optimize.

## React Query Config (App.tsx)
- `staleTime`: 30s → 2 minutes (reduces refetch storms on fast navigation)
- `gcTime`: 5 min → 15 minutes (instant back-navigation results)
- `placeholderData: (prev) => prev` added (SWR stale-while-revalidate pattern)

## Frontend Performance
- `PageLoader`: replaced spinner with a rich 3-zone skeleton (header + KPI row + list rows) matching real page shapes
- `SkeletonBar` and `SkeletonCards` added to shared/index.ts exports (were missing)

## Keyboard Shortcuts System
- `src/lib/useGlobalShortcuts.ts`: Gmail-style `g d/l/q/p/v/o/r/i/a/f` navigation + `?` cheat-sheet toggle
- `src/components/layout/KeyboardShortcutsModal.tsx`: modal with grouped shortcut table
- Wired into `App.tsx` via `GlobalShortcutsProvider` component (inside WouterRouter so `useLocation` works)
- Topbar: `?` button dispatches synthetic keydown to trigger the hook

## NavRail Prefetch-on-Hover
- `PREFETCH_MAP` in NavRail.tsx: keyed by nav group key → `{ key, fn }` pairs
- `RailBtn` now accepts `onPrefetch?: () => void` and calls it on `onMouseEnter`
- Groups: crm→/leads, projects→/projects, procurement→/procurement-dashboard, inventory→/warehouses, approvals→/approvals/my-pending, finance→/finance/dashboard
- `staleTime: 60_000` on prefetch queries so they don't refetch immediately

## What Was NOT Changed (intentionally)
- `@types/pg` is installed; pre-existing TS errors in route files (missing db table exports) are NOT introduced by this pass
- `proc_grns` and `proc_pos` list endpoints already used `.$dynamic()` — not touched
- `loadFullQuotation` already used `Promise.all` — not touched (single-record, acceptable)
- MaterialsList.tsx TS2322 error is pre-existing, not introduced here
