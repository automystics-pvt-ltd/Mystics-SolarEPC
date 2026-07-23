---
name: Mystics ERP Navigation System
description: Complete enterprise nav-rail architecture — replaces old wide sidebar
---

## Architecture
**60px persistent icon rail** (`NavRail.tsx`) with animated 240px flyout panels.
Shell uses `NavRail` + `Topbar`. Old `Sidebar.tsx` still exists but is unused.

**Why:** Workspace-first philosophy — content takes priority over menus.
Flyout overlays content (never pushes it). Inspired by SAP Fiori / Linear / Workday.

## Key features in NavRail.tsx
- **Role-based visibility** — `RAIL` array has `roles?: string[]` per group; items also filtered per-item
- **Procurement badge dot** — from `/api/procurement/badge-counts` (draftPOs + pendingInvoices)
- **Recently Visited** — tracked in `localStorage["mystics_nav_history"]` (rich `{href,name,section,ts}[]`); also writes `localStorage["mystics_cmd_recent"]` (hrefs, for Topbar cmd palette compat). Clock icon at bottom of rail.
- **Favorites/Pins** — stored in `localStorage["mystics_nav_favorites"]` (string[]). Star icon appears on hover over any flyout item. Star icon at bottom of rail shows favorites flyout.
- **Module flyout sections** — Pinned → Recently Visited (in module) → [separator] → All Pages
- **History flyout** — last 12 visited pages with time-ago display. "Clear" button.
- **Favorites flyout** — all starred items grouped by section. Empty state guides user.
- **Framer Motion** — `layoutId="rail-indicator"` for orange accent, flyout slides in `x: -20→0`
- **Escape key** closes any open flyout
- **Exported** `RAIL` (module definitions) and `HREF_META` (href→{name,section,icon} lookup)

## localStorage keys
| Key | Format | Owner |
|-----|--------|-------|
| `mystics_nav_history` | `HistoryEntry[]` `{href,name,section,ts}` | NavRail |
| `mystics_cmd_recent` | `string[]` hrefs | NavRail + Topbar cmd palette |
| `mystics_nav_favorites` | `string[]` hrefs | NavRail |

## Shell layout
```
h-[100dvh] flex
├── NavRail (60px, lg:flex hidden)
└── flex-1 flex-col
    ├── Topbar (h-14, sticky)
    └── main (flex-1 overflow-y-auto, pb bottom-tab safe area on mobile)
```

## Mobile
- NavRail: `hidden lg:flex` — not shown on mobile
- Bottom tab bar (5 tabs) in Shell.tsx
- Hamburger → `MobileNavSheet` in Topbar.tsx (full nav drawer, dark navy)

## TypeScript fixes applied (post-merge)
- `button-group.tsx:49` — cast `Comp` to `React.ElementType`
- `calendar.tsx:131` — cast `rootRef` to `React.Ref<HTMLDivElement>` (react-day-picker @types mismatch)
