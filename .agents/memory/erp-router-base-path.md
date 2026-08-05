---
name: ERP router base path
description: Why VITE_ROUTER_BASE=/erp is required and how it's wired up
---

# ERP WouterRouter Base Path

## The Rule
`VITE_ROUTER_BASE=/erp` must be set as a shared environment variable. Without it, direct URL navigation to any sub-route (e.g. `/erp/inventory`) shows the app's 404 page because wouter's `<Router base="">` doesn't strip the `/erp` prefix before matching routes like `path="/inventory"`.

**Why:** The Replit proxy keeps the full path (including `/erp`) in the browser URL. Vite's own `base` config (`process.env.BASE_PATH`) is intentionally kept at `/` so that proxied asset requests resolve correctly. The router base must be set separately.

**How to apply:** `env.ts` reads `import.meta.env.VITE_ROUTER_BASE` (with fallback to `BASE_URL`) and passes it to `<WouterRouter base={env.basePath}>`. The env var is set via Replit's shared environment, **not** a `.env` file (Replit blocks `.env` writes).

## Internal vs Direct Navigation
- Internal NavRail navigation worked before this fix because `setLocation('/inventory')` navigated to `/inventory` (no prefix), which wouter matched correctly.
- Direct URL loads (bookmarks, test agent `goto`, page refresh) include the `/erp` prefix and require the base to be stripped.

## Vite Base vs Router Base
- **Vite `base`** (`process.env.BASE_PATH`): controls asset paths, keep at `/` for proxy compatibility.
- **Router base** (`VITE_ROUTER_BASE`): controls wouter route matching only, set to `/erp`.
- These are intentionally decoupled. Do NOT set `BASE_PATH=/erp` as it breaks proxied asset serving.

## API Calls Are Unaffected
`fetch.ts` constructs API URLs as `/api${path}` — root-relative, not affected by `env.basePath`. API calls continue to work correctly through the Replit proxy's `/api/*` routing.
