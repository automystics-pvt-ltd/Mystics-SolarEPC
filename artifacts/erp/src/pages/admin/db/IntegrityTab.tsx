import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/fetch";
import type { IntegrityViolation } from "./types";

interface IntegrityResult {
  violations: IntegrityViolation[];
  scannedAt: string;
}

export default function IntegrityTab() {
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery<IntegrityResult>({
    queryKey: ["db-admin-integrity"],
    queryFn: () => apiGet<IntegrityResult>("/db-admin/integrity"),
    enabled,
    staleTime: 60_000,
  });

  const handleScan = () => {
    if (enabled) refetch();
    else setEnabled(true);
  };

  const violations = data?.violations ?? [];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Referential Integrity Scan</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scans all foreign key constraints and reports orphaned rows where referenced records are missing.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={handleScan}
          disabled={isLoading || isFetching}
        >
          {(isLoading || isFetching) ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {!enabled ? "Run Scan" : "Re-scan"}
        </Button>
      </div>

      {!enabled && (
        <div className="rounded-xl border-2 border-dashed border-border p-10 text-center">
          <ShieldCheck className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Integrity scan not yet run</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Click "Run Scan" to check all FK constraints</p>
        </div>
      )}

      {(isLoading || isFetching) && (
        <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Scanning FK constraints…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {(error as Error).message}
        </div>
      )}

      {data && !isLoading && !isFetching && (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Scanned at {new Date(data.scannedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "medium" })}
          </div>

          {violations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">No integrity violations found</p>
                <p className="text-xs text-muted-foreground mt-0.5">All foreign key constraints are satisfied</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Found <strong>{violations.length}</strong> FK constraint{violations.length !== 1 ? "s" : ""} with violations
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Constraint</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Table.Column</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">→ References</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Violations</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Sample IDs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((v, i) => (
                      <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono text-muted-foreground text-[11px]">{v.constraintName}</td>
                        <td className="px-3 py-2">
                          <span className="font-semibold text-foreground">{v.table}</span>
                          <span className="text-muted-foreground">.</span>
                          <span className="text-orange-600 dark:text-orange-400">{v.column}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {v.foreignTable}<span className="opacity-50">.</span>{v.foreignColumn}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 font-semibold">
                            {v.violationCount}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground truncate max-w-[160px]">
                          {v.sampleIds.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
