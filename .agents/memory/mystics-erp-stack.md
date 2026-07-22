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
- `artifacts/api-server/src/routes/leads.ts` — leads + site survey upsert (`GET/POST /leads/:id/survey`)
- `artifacts/api-server/src/routes/quotations.ts`, `crm-invoices.ts`, `tasks.ts`, `escalations.ts`
- `artifacts/api-server/src/routes/projects.ts` — projects, activities, DPRs, milestones, expenses, budgets, snag logs
- `artifacts/api-server/src/routes/procurement.ts` — MRs, vendor quotations, POs, contractors
- `artifacts/api-server/src/routes/inventory.ts` — warehouses, GRNs, QC, challans, stock, audits
- `artifacts/api-server/src/routes/engineering.ts` — design docs, revisions, approve/reject
- `artifacts/api-server/src/routes/commissioning.ts` — checklists (auto-seeds 15 items), sign-off, compliance docs
- `artifacts/api-server/src/routes/oam.ts` — AMC contracts, maintenance schedules, service tickets

## DB schema files
- `lib/db/src/schema/users.ts`, `leads.ts` (+ siteSurveysTable), `quotations.ts`, `crm-invoices.ts`, `tasks.ts`, `escalations.ts`
- `lib/db/src/schema/projects.ts` — projects, activities, budgets, expenses, milestones, DPRs, contractors, snagLogsTable
- `lib/db/src/schema/procurement.ts` — MRs, vendor quotations, POs, vendor invoices
- `lib/db/src/schema/inventory.ts` — warehouses, locations, GRNs, QC, challans, stock ledger, valuation, audits
- `lib/db/src/schema/engineering.ts` — designDocumentsTable, designRevisionsTable
- `lib/db/src/schema/commissioning.ts` — commissioningChecklistsTable, commissioningItemsTable, complianceDocumentsTable
- `lib/db/src/schema/oam.ts` — amcContractsTable, maintenanceSchedulesTable, serviceTicketsTable

## Golden-thread FK pattern
`project_id`, `party_id`, `org_id` on nearly every table. Logging a Client PO auto-creates a Project.

**Why:** Blueprint specifies tight module integration — a PO triggers a Project so PM module has a starting point immediately.

**How to apply:** Any new tables linking to a project should include `projectId` as FK.
