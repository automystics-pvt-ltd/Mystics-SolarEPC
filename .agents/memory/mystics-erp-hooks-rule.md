---
name: Mystics ERP hooks rule
description: Rules of Hooks violation pattern found and fixed in ProcurementDashboard — useMemo/useCallback were called after an early conditional return.
---

## The pattern to avoid

```tsx
function SomeComponent() {
  const [state] = useState(...)
  const { data, isLoading } = useQuery(...)

  // ❌ WRONG — early return before hooks below
  if (isLoading && !data) return <Skeleton />;

  const derived = useMemo(() => ..., [data]); // ← hook after conditional return → crashes
}
```

## The fix

Always declare ALL hooks before any conditional return:

```tsx
function SomeComponent() {
  const [state] = useState(...)
  const { data, isLoading } = useQuery(...)

  // ✅ All hooks first — data may be undefined, memos must handle that with ?? defaults
  const derived = useMemo(() => (data ?? []).map(...), [data]);

  // Early return AFTER all hooks
  if (isLoading && !data) return <Skeleton />;

  return <MainUI />;
}
```

**Why:** React tracks hooks by call order. When a conditional return fires before all hooks are reached, the next render that doesn't take the early return sees a different hook count → "Rendered more hooks than during the previous render".

**How to apply:** Whenever adding memos/callbacks to a component that has an early loading-guard return, place the new hooks above the guard. Ensure all memos use `?? []` / `?? {}` / `?? 0` defaults so they're safe when data is undefined.
