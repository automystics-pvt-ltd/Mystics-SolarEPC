---
name: Mystics ERP shared component contracts
description: Prop contracts and export names for shared UI components — avoids re-breaking after merges
---

## StatCard
Export: `StatCard` (main) + `CompactStatCard` (compact chip)
Props: label, value, icon?, iconColor?, iconBg?, trend?, trendLabel?, onClick?, className?, compact?
Both exported from `artifacts/erp/src/components/shared/StatCard.tsx`

## EmptyState
Accepts BOTH naming conventions:
- `title` OR `heading` (aliases — either works)
- `description` OR `message` (aliases — either works)
**Why:** merged task-agent code used `heading`/`message`; original code used `title`/`description`.
Both are supported via `const resolvedTitle = title ?? heading`.

## SkeletonList exports
All four must be exported from `SkeletonList.tsx`:
- `SkeletonList` — table-style shimmer
- `SkeletonStats` — KPI card grid shimmer
- `SkeletonBar` — single horizontal bar shimmer
- `SkeletonCards` — card grid shimmer

## Barrel
All shared components re-exported from `artifacts/erp/src/components/shared/index.ts`.
After any merge, verify the barrel exports match the actual exports in each file.
