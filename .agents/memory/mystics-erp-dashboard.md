---
name: Mystics ERP Executive Dashboard
description: Dashboard architecture, API field names, and component contracts
---

## Layout
Executive Command Center — `pages/dashboard/Dashboard.tsx`

```
[WelcomeBar — full width: greeting + 3 inline mini-stats + FY pill + Refresh + Customize]
[KPIRow — 5 cards: Active Projects, Revenue Pipeline, Pending Approvals, Overdue Tasks, Draft POs]
[Left 2/3]                          [Right 1/3]
  ActionRequiredPanel                 AlertsPanel
  UpcomingTasksPanel                  RecentlyAccessed
  QuickActionsGrid                    FavoriteModules
                                      ActivityFeed
[Analytics Row: PipelineChart | FinancialTrendChart]
[SystemStatusBar]
```

Widget show/hide personalization via `localStorage["mystics_dashboard_prefs"]` (array of hidden widget IDs).
Customize Sheet opens on "Customize" button click.

## Correct DashboardData field names (from api.schemas.ts)
- `activeProjectsCount` (NOT `activeProjects`)
- `overdueTasksCount` (NOT `overdueTaskCount`)
- `totalContractValue`, `invoiceOutstanding`
- `recentLeads`, `recentProjects`, `openEscalations`

## Correct CombinedDashboardData field names
- `pipeline?: PipelineSummary` → has `stages: {stage, count, value}[]`, `totalLeads`, `totalValue`
- `portfolioSummary?: PortfolioSummary` → has `activeProjects`, `totalProjects`, etc.
- `recentDPRs?: Dpr[]`
- `pendingMilestones?: PaymentMilestone[]` — NOT `milestones`
- `openEscalations?: Escalation[]`

## Component prop contracts
| Component | Props |
|-----------|-------|
| `KPIRow` | `cards: KPICardDef[], isLoading?: boolean` |
| `PipelineChart` | `stages: PipelineStage[], isLoading?: boolean` |
| `FinancialTrendChart` | *(no props — fetches own data via useGetDashboard)* |
| `SystemStatusBar` | `lastRefresh: Date, isRefreshing?: boolean` |
| `QuickActionsGrid` | *(no props — reads role from useAuth internally)* |
| `UpcomingTasksPanel` | `items: UpcomingItem[], isLoading?: boolean` |
| `AlertsPanel` | `alerts: AlertItem[]` |
| `ActivityFeed` | `items: ActivityItem[], isLoading?: boolean` |
| `RecentlyAccessed` | `maxItems?: number` — reads from `getRecentEntries()` |
| `FavoriteModules` | *(no props — reads from localStorage["mystics_nav_favorites"])* |

## UpcomingItem shape
```typescript
{ id, title, dueDate?, project?, type: "milestone"|"task"|"deadline", overdue? }
// NO subtitle, status, href — map from pendingMilestones (PaymentMilestone)
```

## New dashboard components (added)
- `components/KPIRow.tsx` — `KPIRow`, `KPICardDef`, `KPIData`, `buildKPICards()`
- `components/RecentlyAccessed.tsx` — uses `getRecentEntries()` + `HREF_META` from NavRail
- `components/FavoriteModules.tsx` — reads `mystics_nav_favorites`
