---
name: Mystics ERP seed accounts
description: Dev test accounts seeded by artifacts/api-server/src/seed.ts
---

## Seed accounts (password stored as plaintext for dev, NOT production-ready)
| Email | Password | Role | Name |
|---|---|---|---|
| admin@automystics.com | admin123 | admin | Arjun Kapoor |
| meera@automystics.com | sales123 | sales | Meera Nair |
| vikram@automystics.com | pm123 | pm | Vikram Rathod |
| santosh@automystics.com | wh123 | warehouse | Santosh Pawar |

## Re-seeding
```bash
pnpm --filter @workspace/api-server exec tsx src/seed.ts
```
This clears and re-creates all seed data (projects, leads, quotations, activities, budgets, DPRs, etc.).

**Why:** Password is stored as plaintext for development speed. Before production, hash with bcrypt and update the auth route's comparison logic.

**Note:** Login.tsx quick-access buttons must match these emails exactly. Past mismatch (rajan/priya/kiran) caused 401s for all non-admin logins.
