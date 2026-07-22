---
name: Mystics ERP stack decisions
description: Architecture, file layout, and key conventions for the Mystics ERP project
---

## Stack
- **Frontend**: React + Vite, artifact `artifacts/erp`, previewPath `/`, slug `erp`
- **Backend**: Express 5 + Node, artifact `artifacts/api-server`
- **Database**: PostgreSQL via Drizzle ORM, package `@workspace/db`
- **API contract**: OpenAPI spec at `lib/api-spec/openapi.yaml`
- **Codegen**: Orval → `lib/api-client-react` (React Query hooks) + `lib/api-zod` (Zod validators)

## Key route files
- `artifacts/api-server/src/routes/auth.ts` — JWT login + /auth/me
- `artifacts/api-server/src/routes/dashboard.ts` — /dashboard + /dashboard/combined
- `artifacts/api-server/src/routes/leads.ts`, `quotations.ts`, `crm-invoices.ts`, `tasks.ts`, `escalations.ts`
- `artifacts/api-server/src/routes/projects.ts` — projects, activities, DPRs, milestones, expenses, budgets
- `artifacts/api-server/src/routes/procurement.ts` — MRs, vendor quotations, POs, contractors
- `artifacts/api-server/src/routes/inventory.ts` — warehouses, GRNs, QC, challans, stock, audits

## DB schema files
- `lib/db/src/schema/users.ts`, `leads.ts`, `quotations.ts` (also clientPOs), `crm-invoices.ts`, `tasks.ts`, `escalations.ts`
- `lib/db/src/schema/projects.ts` — projects, activities, budgets, expenses, milestones, DPRs, contractors
- `lib/db/src/schema/procurement.ts` — MRs, vendor quotations, POs, vendor invoices
- `lib/db/src/schema/inventory.ts` — warehouses, locations, GRNs, QC, challans, stock ledger, valuation, audits

## Golden-thread FK pattern
`project_id`, `party_id`, `org_id` on nearly every table. Logging a Client PO auto-creates a Project.

**Why:** Blueprint specifies tight module integration — a PO triggers a Project so PM module has a starting point immediately.

**How to apply:** Any new tables linking to a project should include `projectId` as FK.
