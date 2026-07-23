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
- **Recently Visited** — tracked in `localStorage["mystics_nav_history"]` (rich `{href,name,section,ts}[]`); writes to cmd palette via `addRecentEntry()` from `@/lib/recentHistory`. Clock icon at bottom of rail.
- **Favorites/Pins** — stored in `localStorage["mystics_nav_favorites"]` (string[]). Star icon at bottom of rail shows favorites flyout.
- **Module flyout sections** — Pinned → Recently Visited (in module) → [separator] → All Pages
- **Exported** `RAIL` (module definitions) and `HREF_META` (href→{name,section,icon} lookup) — used by dashboard's RecentlyAccessed and FavoriteModules

## localStorage keys
| Key | Format | Owner |
|-----|--------|-------|
| `mystics_nav_history` | `HistoryEntry[]` `{href,name,section,ts}` | NavRail only |
| `mystics_cmd_recent` | `RecentEntry[]` `{href,label,section}` | Shared: NavRail writes via `addRecentEntry()`, Topbar/palette reads via `getRecentEntries()` |
| `mystics_nav_favorites` | `string[]` hrefs | NavRail + FavoriteModules dashboard widget |

## History sync
NavRail's `pushHistory()` calls `addRecentEntry(href, name, section)` from `@/lib/recentHistory`.
Do NOT write raw string[] to RECENT_KEY — format is now `RecentEntry[]`.
`clearHistory()` uses imported `RECENT_KEY` constant (not a local copy).

## Shell layout
```
h-[100dvh] flex
├── NavRail (60px, lg:flex hidden)
└── flex-1 flex-col
    ├── Topbar (h-14, sticky)
    └── main (flex-1 overflow-y-auto)
```

## Mobile
- NavRail: `hidden lg:flex` — not shown on mobile
- Bottom tab bar (5 tabs) in Shell.tsx
- Hamburger → `MobileNavSheet` in Topbar.tsx (full nav drawer, dark navy)

## TypeScript fixes applied (post-merge)
- `button-group.tsx:49` — cast `Comp` to `React.ElementType`
- `calendar.tsx:131` — cast `rootRef` to `React.Ref<HTMLDivElement>` (react-day-picker @types mismatch)
