---
name: Mystics ERP Drizzle pool pitfall
description: Why db.insert on approval_requests fails, causes pool exhaustion, and how to fix it
---

## The rule
When inserting into `approval_requests` from `proc_quotations.ts`, use a **dedicated `pg.Client`** (not `db.insert`, not `pool.query`, not `db.execute(sql...)`).

**Why:**
1. Drizzle's `db.insert(approvalRequestsTable)` fails with "Failed query" (FK violation hidden by Drizzle's error wrapping).
2. Each failure leaks a pool connection because Drizzle doesn't release it cleanly on error.
3. After 10 failures the shared pool is exhausted → subsequent `pool.query()` and `db.execute(sql...)` hang indefinitely (pg Pool's default `connectionTimeoutMillis: 0` = wait forever).

Root FK violation: `approval_requests.requester_id` references `users(id)`. The `users` table has ids starting at 5 (admin=5, not 1). Always use `actor?.userId` from `getActor(req)` (JWT) for this field — never trust `req.body.userId` which can be an incorrect default.

**How to apply:**
- Use `new pg.Client({ connectionString: process.env.DATABASE_URL })` with `connect()`/`end()` for inserts into `approval_requests`, `approval_request_steps`, and `approval_actions` from `proc_quotations.ts`.
- `pg` must be in `artifacts/api-server/package.json` AND in the `external` array in `build.mjs`.
- Wrap the entire `createApprovalRequest` call in try-catch so submit succeeds even if the approval engine fails.
- Seed user IDs in DB: admin=5, rajan=6, priya=7, kiran=8.
