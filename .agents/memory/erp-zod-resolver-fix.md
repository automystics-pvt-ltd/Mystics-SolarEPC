---
name: ERP Zod v4 resolver fix
description: @hookform/resolvers checks error.errors (zod v3) but zod v4 uses error.issues — custom shim required
---

## Rule
Never use `@hookform/resolvers/zod` directly in this project. Import from `@/lib/zodResolver` instead.

**Why:** zod v4 changed `ZodError.errors` → `ZodError.issues`. The bundled resolver checks `Array.isArray(r?.errors)` which is always false in v4, so every validation error is re-thrown as an unhandled exception and appears in the Vite runtime-error overlay instead of being shown inline.

**How to apply:**
- `artifacts/erp/src/lib/zodResolver.ts` is the compatible shim — it checks both `.issues` and `.errors`
- All 10 form files already import from `@/lib/zodResolver` (grep confirms)
- When adding new forms, always import from `@/lib/zodResolver`
- The shim is typed with `<TFieldValues extends FieldValues>` generic — use as a drop-in replacement
- Error path returns `{} as any` for `values` to satisfy `ResolverError<T>.values: Record<string, never>` — this is intentional

## Column name mismatch pitfall
`quotation_attachments` table in DB has column `object_path`; Drizzle schema originally said `file_key`. Fixed by changing the schema mapping to `text("object_path")`. If this schema-vs-DB drift recurs, run `\d <table>` in psql to confirm actual column names before writing Drizzle queries.
