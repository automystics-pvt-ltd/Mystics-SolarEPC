---
name: Mystics ERP Navigation System
description: NavRail architecture — slim icon rail replaced the old 240px dark sidebar
---

## Rule
The desktop navigation is now a **56px icon rail** (`NavRail.tsx`) with animated flyout panels — not a persistent sidebar. The old `Sidebar.tsx` is no longer used in `Shell.tsx`.

**Why:** The sidebar consumed ~240px of workspace. The rail + flyout overlays content, maximising usable area — matching SAP Fiori / Linear pattern.

## How to apply
- `Shell.tsx` imports `NavRail` instead of `Sidebar`
- `NavRail.tsx` owns all nav structure (`RAIL` array) AND flyout state
- Flyout: `fixed left-14 z-[29]`, backdrop `fixed inset-0 left-14 z-[28]`
- Rail is hidden on mobile (`hidden lg:flex`); mobile uses bottom tab bar (5 tabs in `Shell.tsx`) + `MobileNavSheet` in `Topbar.tsx`
- `useSidebar` context still exists but is no longer used in `Topbar` or `Shell`
- Active section detection: `getActiveSectionKey()` inside `NavRail.tsx`
- Procurement badge dot: from `/api/procurement/badge-counts` via `useProcBadge()`
- Framer Motion `layoutId="rail-indicator"` animates the orange left-edge accent between sections

## Key files
- `artifacts/erp/src/components/layout/NavRail.tsx` — complete rail + flyout system
- `artifacts/erp/src/components/layout/Shell.tsx` — slim, no Sidebar dependency
- `artifacts/erp/src/components/layout/Topbar.tsx` — no sidebar toggle; has `MobileNavSheet`
