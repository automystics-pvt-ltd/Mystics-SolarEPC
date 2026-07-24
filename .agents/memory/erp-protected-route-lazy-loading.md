---
name: ERP ProtectedRoute lazy loading rule
description: The ProtectedRoute in App.tsx must NOT gate the Suspense/lazy render behind perms.isLoading — doing so creates sequential loading and breaks the dashboard.
---

## The rule

`ProtectedRoute` must use this pattern (the "single-gate" approach):

```jsx
{moduleName && !perms.isLoading && !perms.canView ? (
  <ForbiddenPage module={moduleName} />
) : (
  <Suspense fallback={<PageLoader />}>
    <Component {...rest} />
  </Suspense>
)}
```

**Never** add an extra `perms.isLoading ? <PageLoader />` branch before the Suspense:

```jsx
// ❌ WRONG — breaks lazy loading
{moduleName && perms.isLoading ? (
  <PageLoader />  // ← This prevents the lazy import from starting!
) : moduleName && !perms.canView ? (
  <ForbiddenPage />
) : (
  <Suspense fallback={<PageLoader />}>
    <Component {...rest} />
  </Suspense>
)}
```

## Why

React.lazy only triggers the `import()` factory when it actually **renders** `<Component />` inside a Suspense boundary. If we show `<PageLoader />` instead while permissions are loading, the lazy JS chunk download never starts until the permission API call completes.

This creates **three sequential wait states**: permission API → JS chunk download → data API fetch.

The correct pattern works because `LOADING_PERMS.canView = true` (the sentinel used while permissions are pending). So the Suspense/Component always renders during permission loading — triggering the lazy import in parallel with the permission call — and only switches to `ForbiddenPage` once we know for certain the user lacks access.

**How to apply:** Any future RBAC/permissions refactor of `ProtectedRoute` must preserve the single-gate structure above. The permission check only ever gates on `!perms.isLoading && !perms.canView`.
