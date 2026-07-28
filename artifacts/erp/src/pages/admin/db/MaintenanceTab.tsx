import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Wrench, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/fetch";
import { useToast } from "@/hooks/use-toast";
import type { MaintenanceStat } from "./types";

interface StatsResponse { stats: MaintenanceStat[] }

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
}

export default function MaintenanceTab() {
  const { toast } = useToast();
  const [running, setRunning] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<StatsResponse>({
    queryKey: ["db-admin-maintenance-stats"],
    queryFn: () => apiGet<StatsResponse>("/db-admin/maintenance/stats"),
    staleTime: 30_000,
  });

  const maintMut = useMutation({
    mutationFn: (body: { operation: string; table?: string }) =>
      apiPost("/db-admin/maintenance", body),
    onSuccess: (_data: any) => {
      toast({ title: "Maintenance complete", description: `${_data.operation} on ${_data.table} took ${_data.durationMs}ms` });
      setRunning(null);
      refetch();
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Maintenance failed", description: e?.data?.error ?? e.message });
      setRunning(null);
    },
  });

  const runOp = (operation: string, table?: string) => {
    const key = table ? `${operation}:${table}` : operation;
    setRunning(key);
    maintMut.mutate({ operation, table });
  };

  const stats = data?.stats ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20 shrink-0">
        <div>
          <p className="text-sm font-semibold">Database Maintenance</p>
          <p className="text-xs text-muted-foreground">Run VACUUM ANALYZE and REINDEX operations per table or globally.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-xs"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-2 text-xs bg-blue-700 hover:bg-blue-600 text-white"
            onClick={() => runOp("vacuum_analyze_all")}
            disabled={!!running}
          >
            {running === "vacuum_analyze_all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
            VACUUM ANALYZE ALL
          </Button>
        </div>
      </div>

      {/* Stats table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading stats…</span>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border/60 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Table</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Live Rows</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Dead Rows</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Size</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Last Autovacuum</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Last Autoanalyze</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => {
                const vacKey = `vacuum_analyze:${s.table_name}`;
                const reindexKey = `reindex:${s.table_name}`;
                const isRunningThis = running === vacKey || running === reindexKey;
                const hasDeadRows = (s.n_dead_tup ?? 0) > 0;
                return (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono font-semibold text-foreground">{s.table_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {(s.n_live_tup ?? 0).toLocaleString()}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${hasDeadRows ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground"}`}>
                      {(s.n_dead_tup ?? 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{s.total_size}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(s.last_autovacuum)}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(s.last_autoanalyze)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => runOp("vacuum_analyze", s.table_name)}
                          disabled={!!running}
                          title="VACUUM ANALYZE"
                        >
                          {running === vacKey ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Wrench className="h-2.5 w-2.5" />}
                          Vacuum
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => runOp("reindex", s.table_name)}
                          disabled={!!running}
                          title="REINDEX TABLE"
                        >
                          {running === reindexKey ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                          Reindex
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
