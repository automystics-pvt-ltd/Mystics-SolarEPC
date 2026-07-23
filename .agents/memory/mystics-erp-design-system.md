---
name: Mystics ERP design system rules
description: Conventions for shared components, StatusBadge coverage, and enterprise page structure
---

## StatusBadge
- Lives at `artifacts/erp/src/components/shared/StatusBadge.tsx`
- Covers 50+ status strings across every module. Pass raw string; fallback auto-formats PascalCase with spaces.
- New `dot` prop adds a coloured dot before the label.
- New `size="lg"` option in addition to sm/md.
- **Never** add local STATUS_CONFIG / statusColors / getStatusColor helpers — they are banned. Always use StatusBadge.
- Missing statuses should be ADDED to StatusBadge, not worked around locally.

## DetailRow / DetailGrid
- Lives at `artifacts/erp/src/components/shared/DetailGrid.tsx` (exports both).
- `DetailRow` accepts `fullWidth` (boolean, alias for colSpan=2) and `colSpan` (number).
- `DetailGrid` accepts `cols={2|3|4}`.

## Page structure convention
Every page-level component must follow this layout:
1. `<motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:0.2}} className="space-y-6 pb-10">`
2. `<PageHeader title backHref actions badge />` (from @/components/shared)
3. Optional status bar: `<div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 rounded-xl border bg-card shadow-xs">`
4. `<SectionCard>` sections for grouped content
5. `<DetailGrid cols={3|4}><DetailRow /></DetailGrid>` for metadata

## Dark-mode rule
Only semantic tokens: `bg-card`, `text-foreground`, `border-border`, `text-muted-foreground`.
No hardcoded Tailwind colour classes for status — only StatusBadge.

## Shared component barrel
`import { PageHeader, StatCard, EmptyState, SkeletonList, SkeletonStats, SectionCard, DataTable, StatusBadge, DetailRow, DetailGrid, ConfirmDialog, Timeline, Kbd } from "@/components/shared";`
All of these exist. Do not import anything else from the barrel without verifying it's in `index.ts`.

**Why:** Enforcing a single source for status colours prevents 15+ divergent local colour maps from recurring across modules.
**How to apply:** Any new page or component that shows a status string must use StatusBadge. Any new detail view must use DetailGrid + DetailRow. Any new page title must use PageHeader.
