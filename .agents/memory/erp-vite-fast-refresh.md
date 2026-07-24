---
name: ERP Vite Fast Refresh pitfalls
description: Files that mix component + hook + constant exports break Vite Fast Refresh, causing React context crashes on every HMR cycle (e.g. after task-agent merges).
---

## The rule
A file that exports BOTH a React component AND a hook (or a constant) cannot be fast-refreshed by Vite's React plugin. On HMR, Vite "invalidates" the module, which re-evaluates it and creates a new React context object. The old Provider holds the old context; consumers in hot-swapped modules hold the new one → "Invalid hook call" / "useAuth must be used within AuthProvider" crash.

## Files affected and how they were fixed
- `src/lib/auth.tsx` — exports `AuthProvider` (component) + `useAuth` (hook) → added `// @refresh reset`
- `src/lib/permissions.tsx` — exports components + hooks + `MODULES`/`PERM_ACTIONS`/`ROLE_LABELS` constants → added `// @refresh reset`
- `src/components/layout/NavRail.tsx` — exported `RAIL` (constant array) + `HREF_META` alongside React components → removed `export` from `RAIL`, moved `HREF_META` to `src/components/layout/nav-meta.ts`, added `// @refresh reset`

## What `// @refresh reset` does
Forces a full page reload instead of a partial module swap when the file changes (or when it's in the invalidation chain). Prevents context mismatch but loses React state on each HMR cycle. Better than a crash.

**Why:** Every task-agent merge touches files that propagate HMR to auth.tsx/permissions.tsx, causing auth context to be re-created mid-session.

**How to apply:** Any new file that mixes React components with non-component exports (hooks, constants, providers) should either (a) be split into separate files, or (b) get `// @refresh reset` at the top.

## Also fixed
- `lib/api-client-react/src/index.ts` had duplicate `export *` statements for the same two paths. Removed duplicates to stop spurious HMR cascades into auth.tsx.
- `ErrorBoundary.componentDidCatch` now calls `window.location.reload()` when it catches "Invalid hook call" / "must be used within" errors, so users auto-recover instead of seeing a dead error screen.
