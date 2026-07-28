/**
 * Zod v4-compatible resolver for react-hook-form.
 *
 * @hookform/resolvers checks `error.errors` (zod v3 API) but zod v4 uses
 * `error.issues`.  This shim supports both shapes so validation messages
 * are shown inline instead of surfacing in the Vite runtime-error overlay.
 */
import { toNestErrors, validateFieldsNatively } from "@hookform/resolvers";
import { appendErrors, type FieldValues } from "react-hook-form";
import type { Resolver, ResolverOptions } from "react-hook-form";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodSchema = {
  // Use `any` for ctx to accommodate both zod v3 and v4 parse signatures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse: (data: unknown, ctx?: any) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseAsync: (data: unknown, ctx?: any) => Promise<unknown>;
};

interface ZodIssue {
  code: string;
  message: string;
  path: Array<string | number>;
  unionErrors?: Array<{ issues: ZodIssue[] }>;
}

function flattenIssues(
  rawIssues: ZodIssue[],
  criteriaMode: boolean,
): Record<string, { message: string; type: string; types?: Record<string, string | string[]> }> {
  // Work on a copy so we can push union errors without mutating the original
  const issues = [...rawIssues];
  const out: Record<string, { message: string; type: string; types?: Record<string, string | string[]> }> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    if (!out[key]) {
      if ("unionErrors" in issue && issue.unionErrors?.length) {
        const first = issue.unionErrors[0].issues[0];
        out[key] = { message: first?.message ?? issue.message, type: first?.code ?? issue.code };
      } else {
        out[key] = { message: issue.message, type: issue.code };
      }
    }
    if ("unionErrors" in issue) {
      issue.unionErrors?.forEach((ue) => ue.issues.forEach((i) => issues.push(i)));
    }
    if (criteriaMode) {
      const existing = out[key].types?.[issue.code];
      out[key] = appendErrors(
        key,
        true,
        out,
        issue.code,
        existing ? [existing, issue.message].flat() : issue.message,
      ) as typeof out[string];
    }
  }
  return out;
}

function getIssues(err: unknown): ZodIssue[] | null {
  if (!err || typeof err !== "object") return null;
  const e = err as Record<string, unknown>;
  // zod v4 uses .issues; zod v3 uses .errors (alias for .issues in v3)
  if (Array.isArray(e.issues)) return e.issues as ZodIssue[];
  if (Array.isArray(e.errors)) return e.errors as ZodIssue[];
  return null;
}

export function zodResolver<TFieldValues extends FieldValues = FieldValues>(
  schema: ZodSchema,
  context?: unknown,
  opts: { mode?: "async" | "sync"; raw?: boolean } = {},
): Resolver<TFieldValues> {
  return async (
    values: TFieldValues,
    _ctx: unknown,
    resolverOptions: ResolverOptions<TFieldValues>,
  ) => {
    try {
      const result =
        opts.mode === "sync"
          ? schema.parse(values, context)
          : await schema.parseAsync(values, context);
      if (resolverOptions.shouldUseNativeValidation) {
        validateFieldsNatively({}, resolverOptions);
      }
      return { errors: {}, values: (opts.raw ? values : result) as TFieldValues };
    } catch (err) {
      const issues = getIssues(err);
      if (issues) {
        return {
          values: {},
          errors: toNestErrors(
            flattenIssues(
              issues,
              !resolverOptions.shouldUseNativeValidation &&
                resolverOptions.criteriaMode === "all",
            ),
            resolverOptions,
          ),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      }
      throw err;
    }
  };
}
