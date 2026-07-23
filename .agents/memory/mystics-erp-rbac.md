---
name: Mystics ERP RBAC system
description: Centralized role-based access control — schema, API middleware, frontend hook, admin UI, and where it's applied.
---

## Architecture

### DB
- Table: `role_permissions` (role, module, action, allowed, updatedAt, updatedBy)
- Unique index on (role, module, action)
- Seeded via `POST /api/rbac/seed` (admin only); 119 rows cover 5 non-admin roles × 14 modules × 8 actions

### API (artifacts/api-server/src/lib/rbac.ts)
- `requirePermission(module, action)` — Express middleware; admin role always passes
- `requireAdmin()` — checks role === "admin" | "director"
- `requireAuth()` — just validates JWT, no permission check
- In-memory permission cache; 5-min TTL; `invalidateCache()` called on PATCH
- If DB table is empty, falls back to hardcoded role-defaults (`FALLBACK` map) matching NavRail role arrays

### API routes
- `GET /rbac/my-permissions` → permission map for current user (frontend hook)
- `GET /rbac/all` → full role×module×action matrix (admin/director)
- `PATCH /rbac/permission` → toggle one permission (admin)
- `POST /rbac/seed` → seed defaults
- `POST /rbac/reset` → wipe + re-seed

### Protected API routes
- `/users` (all verbs) → requireAdmin
- `/vendors` (POST/PATCH/DELETE) → requirePermission("vendors", create/edit/delete)
- `/materials` (POST/PATCH/DELETE/export/import/bulk) → requirePermission("materials", ...)
- `/material-categories` (POST/PATCH/DELETE) → requirePermission("materials", ...)
- `/proc-invoices` (create/submit/approve/reject/mark-paid) → requirePermission
- `/procurement-pos/:id` (PATCH/dispatch) → requireAuth/requirePermission

### Frontend (artifacts/erp/src/lib/permissions.tsx)
- `usePermissions(module)` hook → returns `{ canView, canCreate, canEdit, canDelete, canApprove, canExport, canImport, canAdmin, isLoading, can(action) }`
- `PermissionGate` component + `CanCreate/CanEdit/...` wrappers
- Admin role → always returns ALL_ALLOWED (no DB check)
- Query key `["rbac-my-permissions"]` — shared between App, NavRail, and all pages; staleTime: 5min

### ProtectedRoute (App.tsx)
- Accepts optional `module` prop
- If module provided + permissions loaded + canView=false → renders `<ForbiddenPage />`
- All routes have their module assigned

### NavRail
- Uses same `["rbac-my-permissions"]` query — served from React Query cache instantly
- Groups filtered by role FIRST (fast), then by RBAC view permission
- Added "Access Control" link under Administration (admin-only)

### Admin UI
- Page: `/admin/rbac` → `RBACManager.tsx`
- Role tab selector → per-module × per-action toggle grid
- Admin role is immutable (shown with Lock icon)
- "Grant All / Revoke All" per module row
- "Seed Defaults" and "Reset to Defaults" buttons

## Modules and action vocabulary
Modules: dashboard, crm, procurement, materials, vendors, projects, inventory, engineering, commissioning, oam, finance, reports, admin, approvals
Actions: view, create, edit, delete, approve, export, import, admin

## PermissionGate applied to pages
- MaterialsList: Create/Import/Export/SeedDemo buttons gated
- VendorsList: Add Vendor button gated (canCreate)
- Both use `usePermissions(module)` hook directly

**Why:** Centralizing in the DB (vs hardcoded roles) allows runtime permission changes without code deploys; the 5-min cache keeps it performant.
