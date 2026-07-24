---
name: ERP Vite Fast Refresh pitfalls
description: Files that mix components+hooks+constants break HMR; root causes and fixes for cascade loops that cause rapid re-mounting and "nothing loading" on direct navigation.
---

## The problem
Vite Fast Refresh marks a file as "incompatible" when it exports both React components/hooks AND plain values (constants, objects, arrays). When an incompatible file is in the dependency chain of an `// @refresh reset` file, it creates a cascade loop: every HMR update triggers multiple re-evaluations of the entire dependency subtree.

## Affected files and fixes

### `auth.tsx`
- **Symptom**: "useAuth export is incompatible" — because `AuthContext = createContext(...)` is module-level state.
- **Fix**: Keep `// @refresh reset` pragma. This forces a full page reload when auth.tsx itself changes, preventing context mismatch crashes.

### `permissions.tsx`
- **Symptom**: "MODULES export is incompatible" — because it exported plain constants `MODULES`, `PERM_ACTIONS`, `ROLE_LABELS` alongside hooks and components.
- **Root cause**: Those constants were never imported by any external consumer (each call site has its own local copy), making them truly orphaned exports.
- **Fix**: Removed the three constants from `permissions.tsx`. Also removed the `// @refresh reset` pragma since the file is now HMR-clean (hooks + components only, no plain constants).

### `NavRail.tsx`
- **Symptom**: `HREF_META` constant exported alongside components.
- **Fix**: Moved `HREF_META` to `nav-meta.ts`. NavRail now exports only React components. Added `// @refresh reset` as safety net.

## Cascade mechanism
1. Any file edit → HMR fires for that file and its dependents
2. If a dependent has "incompatible" exports → Vite invalidates it and triggers its own dependents
3. With `// @refresh reset` files in the chain, each invalidation round triggers ANOTHER round
4. Result: 6+ rounds in <1 second, which remounts every Shell/NavRail/Topbar instance → 4-8x API calls per "poll interval"

## Rule for new code
**Never export both React components/hooks AND plain constants from the same file.** Put constants in a separate `.ts` file (no JSX). The only export types compatible with Fast Refresh in a single file are: React components (uppercase), custom hooks (`use*`), and TypeScript types (erased at runtime).

## Auth instant-restore (direct-URL navigation fix)
**Problem**: On direct URL load (fresh tab/page refresh), `isInitializing = true` shows a full-screen auth spinner for ~200-500ms before the page renders.

**Fix applied** (July 2026): Cache the user object in `localStorage` as `mystics_user_v2` with a timestamp. On mount:
- Read cache → if present and <4h old: set `user` and `isInitializing = false` immediately
- `useGetMe` is still enabled when no user is in state (`enabled: !!token && !user`)
- Result: returning users see content instantly; first-time visitors still see the spinner

**Why**: The `login()` function writes to the cache. The `logout()` function clears it. On error (`isError`), cache is also cleared to prevent stale sessions.

## NavRail prefetch endpoints
The `PREFETCH_MAP` in `NavRail.tsx` must match the actual `queryFn` endpoints used by each page component:
- `finance` prefetch must use `/reports/invoices` (what `FinanceDashboard.tsx` actually calls), NOT `/finance/dashboard` (which doesn't exist → 404)
