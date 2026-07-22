---
name: Mystics ERP seed accounts
description: Dev test accounts seeded by artifacts/api-server/src/seed.ts
---

## Seed accounts (password = stored plaintext for dev, NOT production-ready)
| Email | Password | Role |
|---|---|---|
| admin@automystics.com | admin123 | admin |
| rajan@automystics.com | sales123 | sales |
| priya@automystics.com | pm123 | pm |
| kiran@automystics.com | wh123 | warehouse |

## Re-seeding
```bash
pnpm --filter @workspace/api-server exec tsx src/seed.ts
```
This clears and re-creates all seed data (projects, leads, quotations, activities, budgets, DPRs, etc.).

**Why:** Password is stored as plaintext for development speed. Before production, hash with bcrypt and update the auth route's comparison logic.
