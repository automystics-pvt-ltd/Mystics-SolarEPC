---
name: Mystics ERP auth setup
description: How JWT authentication is wired end-to-end in the ERP
---

## Auth flow
1. POST `/api/auth/login` with `{ email, password }` → returns `{ token, user }`
2. Token stored in `localStorage` key `"mystics_token"`
3. `setAuthTokenGetter(() => localStorage.getItem("mystics_token"))` called in `AuthProvider` on mount
4. `customFetch` reads the getter before every request and attaches `Authorization: Bearer <token>`
5. `useGetMe` (enabled when token present) validates the token and hydrates the user context

## JWT config
- Secret: `SESSION_SECRET` env secret (falls back to `"mystics-erp-secret"` in dev)
- Expiry: 7 days

## Auth files
- `artifacts/erp/src/lib/auth.tsx` — AuthProvider + useAuth hook
- `lib/api-client-react/src/custom-fetch.ts` — token attachment via `setAuthTokenGetter`
- `artifacts/api-server/src/routes/auth.ts` — login + /auth/me endpoints

**Why:** The project uses stateless JWT instead of sessions to keep the API stateless and support future mobile clients.
