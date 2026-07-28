---
name: Mystics ERP audit logs module
description: Architecture decisions and pitfalls for the system-wide audit_logs table and middleware
---

# Mystics ERP Audit Logs Module

## req.path prefix pitfall
**Rule:** Inside a router mounted at `/api` (via `app.use("/api", router)`), `req.path` is the path **without** the `/api` prefix.
- A request to `POST /api/leads` arrives in the router middleware as `req.path = "/leads"`, not `"/api/leads"`.
- All PREFIX_MAP entries in `lib/auditLogger.ts` and SKIP_PREFIXES must omit the `/api` prefix.
**Why:** The audit middleware is mounted inside the /api router in `routes/index.ts`, not in `app.ts`. Forgetting this causes resolveRoute() to silently return null for every path and write 0 audit entries.
**How to apply:** Any future route mapper that runs inside the /api router must use paths like `/leads`, `/procurement-pos/42`, not `/api/leads`.

## pg params mutation bug
**Rule:** Never share a single `params` array between a count query and a paginated data query when using `Promise.all`.
**Why:** `addParam(limit)` and `addParam(offset)` mutate the array. If both queries reference the same array object, the count query receives the limit/offset params too, causing: `bind message supplies N parameters, but prepared statement requires 0`.
**How to apply:** Snapshot filter params before adding pagination: `const dataParams = [...filterParams, limit, offset]`, use `filterParams` for count, `dataParams` for the paginated select.

## Dedicated pg.Pool for audit writes
The audit logger uses a separate `pg.Pool({ max: 3 })` — never Drizzle — per the Drizzle pool pitfall rule. This pool is long-lived (singleton), not a fresh `pg.Client` per write.

## Auth events: manual writeAuditLog
Login success and failure are captured manually in `routes/auth.ts` because the auth router runs BEFORE the catch-all `requireAuth()` middleware and the audit middleware in `routes/index.ts`.

## Table
`audit_logs` was created with raw SQL (not Drizzle migration). Indexes on `created_at DESC`, `user_id`, `module`, `action`, `status`.
