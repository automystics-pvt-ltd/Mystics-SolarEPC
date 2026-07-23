---
name: Executive Dashboard Architecture
description: Modular dashboard structure, component locations, data sources, and production-readiness decisions for the Mystics ERP Dashboard.
---

## Dashboard structure
`artifacts/erp/src/pages/dashboard/`
- `Dashboard.tsx` — orchestrator; all data fetching here, props down to sub-components
- `components/SystemStatusBar.tsx` — thin API health bar (green pulse / amber / red)
- `components/AlertsPanel.tsx` — collapsible alert panel; returns null when empty
- `components/QuickActionsGrid.tsx` — 3×2 action tiles with orange hover, wouter nav
- `components/ActivityFeed.tsx` — vertical timeline from notifications + recent leads/projects
- `components/UpcomingTasksPanel.tsx` — milestones from combined dashboard, overdue-first
- `components/PerformanceMetrics.tsx` — 3 animated progress-bar metric cards
- `components/PipelineChart.tsx` — recharts BarChart; API field is `stage` not `name` (normalised in Dashboard)
- `components/FinancialTrendChart.tsx` — dual AreaChart; uses deterministic synthetic data (no time-series API)

## Data sources
- `useGetDashboard()` — KPIs, escalations, recent leads/projects
- `useGetCombinedDashboard()` — pipeline stages (field: `stage`), portfolio summary, milestones, DPRs
- `useQuery(['procurement-dashboard'], () => apiGet('/api/procurement-dashboard'))` — PO/GRN/invoice counts

## Production-readiness files added
- `src/lib/logger.ts` — structured logger, suppresses debug in prod
- `src/lib/env.ts` — typed env constants (env.basePath, env.apiBase, env.version, etc.)
- `src/components/ErrorBoundary.tsx` — class-based, "Try again" reset button

## App.tsx decisions
- ALL page imports are now `lazy()` (named exports wrapped `.then(m => ({ default: m.X }))`)
- QueryClient: smart retry skips 401/403, gcTime 5min, refetchOnWindowFocus false
- Router wrapped in `<ErrorBoundary>`, each ProtectedRoute Suspense wrapped in `<ErrorBoundary fallbackTitle="Page failed to load">`
- `env.basePath` used for WouterRouter base

**Why:** Lazy-loading all pages enables code splitting — initial bundle only loads auth + shell. ErrorBoundary prevents one broken route from crashing the whole app.
