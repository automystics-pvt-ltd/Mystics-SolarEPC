import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database, Play, Download, ChevronRight, AlertCircle,
  CheckCircle2, Clock, Loader2, Table2, History, X,
  AlertTriangle, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function apiFetch(url: string, method: string, body?: any) {
  const token = (window as any).__mystics_token ?? localStorage.getItem("mystics_token");
  return fetch(`/api${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? r.statusText);
    return data;
  });
}

type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  sql: string;
  ts: Date;
};

type TableInfo = { name: string; rowCount: number; size: string };

const QUICK_QUERIES: Array<{ label: string; sql: string }> = [
  { label: "Users",        sql: "SELECT id, name, email, role, created_at FROM users ORDER BY id;" },
  { label: "Modules",      sql: "SELECT module, enabled, updated_at FROM module_config ORDER BY module;" },
  { label: "Settings",     sql: "SELECT key, value, updated_at FROM system_settings ORDER BY key;" },
  { label: "Audit (today)",sql: "SELECT user_name, action, module, description, status, created_at\nFROM audit_logs\nWHERE created_at >= CURRENT_DATE\nORDER BY created_at DESC\nLIMIT 50;" },
  { label: "Sessions",     sql: "SELECT DISTINCT ON (user_id) user_id, user_name, ip_address, created_at\nFROM audit_logs\nWHERE created_at > NOW() - INTERVAL '8 hours' AND user_id IS NOT NULL\nORDER BY user_id, created_at DESC;" },
  { label: "Failed logins",sql: "SELECT entity_label AS email, ip_address, created_at\nFROM audit_logs\nWHERE action = 'login' AND status = 'failure'\nORDER BY created_at DESC\nLIMIT 20;" },
];

function exportCsv(columns: string[], rows: Record<string, unknown>[], filename: string) {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v).replace(/"/g, '""'); return /[",\n\r]/.test(s) ? `"${s}"` : s; };
  const csv = [columns.join(","), ...rows.map(r => columns.map(c => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

export function AdminDbConsole() {
  const [sql, setSql]           = useState("SELECT id, name, email, role FROM users ORDER BY id;");
  const [result, setResult]     = useState<QueryResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [running, setRunning]   = useState(false);
  const [history, setHistory]   = useState<Array<{ sql: string; ts: Date; ok: boolean }>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ["pa-db-tables"],
    queryFn:  () => apiGet<{ tables: TableInfo[]; total: number }>("/db-admin/tables"),
    staleTime: 60_000,
  });

  const run = useCallback(async () => {
    if (!sql.trim() || running) return;
    setRunning(true);
    setError(null);
    const start = Date.now();
    try {
      const data = await apiFetch("/db-admin/sql", "POST", { sql });
      setResult({
        columns: data.columns ?? [],
        rows:    data.rows    ?? [],
        rowCount: data.rowCount ?? (data.rows?.length ?? 0),
        durationMs: Date.now() - start,
        sql,
        ts: new Date(),
      });
      setHistory(h => [{ sql, ts: new Date(), ok: true }, ...h].slice(0, 20));
    } catch (e: any) {
      setError(e.message ?? "Query failed");
      setHistory(h => [{ sql, ts: new Date(), ok: false }, ...h].slice(0, 20));
    } finally {
      setRunning(false);
    }
  }, [sql, running]);

  // Ctrl/Cmd+Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [run]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Database Console</h2>
        <p className="text-xs text-zinc-500">Execute SQL directly against the live database · SELECT, INSERT, UPDATE, DELETE only</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* ── Left: Table Browser ────────────────────────────────────────── */}
        <Card className="bg-zinc-900 border-zinc-800 overflow-hidden lg:col-span-1">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800">
            <Table2 className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-semibold text-zinc-200">Tables</span>
            {tables && (
              <Badge className="ml-auto bg-zinc-800 text-zinc-400 text-[10px]">{tables.total}</Badge>
            )}
          </div>
          <div className="overflow-y-auto max-h-80">
            {tablesLoading ? (
              <div className="p-2 space-y-1">
                {Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-6 w-full bg-zinc-800"/>)}
              </div>
            ) : (
              <div className="py-1">
                {(tables?.tables ?? []).map(t => (
                  <button key={t.name}
                    onClick={() => setSql(`SELECT * FROM ${t.name} LIMIT 100;`)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-zinc-800/60 transition-colors group"
                    title={`SELECT * FROM ${t.name} LIMIT 100`}
                  >
                    <span className="text-zinc-300 font-mono truncate group-hover:text-violet-300 transition-colors">{t.name}</span>
                    <span className="text-[10px] text-zinc-600 shrink-0">{t.rowCount.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick queries */}
          <div className="border-t border-zinc-800 px-3 py-2">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide font-medium mb-1.5">Quick Queries</p>
            <div className="space-y-0.5">
              {QUICK_QUERIES.map(q => (
                <button key={q.label}
                  onClick={() => setSql(q.sql)}
                  className="w-full text-left text-xs text-zinc-400 hover:text-violet-300 px-1 py-0.5 rounded transition-colors flex items-center gap-1.5"
                >
                  <ChevronRight className="w-3 h-3 shrink-0" />{q.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Right: Editor + Results ─────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-3">
          {/* SQL Editor */}
          <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800">
              <Database className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-semibold text-zinc-200">SQL Editor</span>
              <span className="text-[10px] text-zinc-600 ml-auto">Ctrl+Enter to run</span>
            </div>
            <div className="p-3">
              <textarea
                ref={textareaRef}
                value={sql}
                onChange={e => setSql(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-zinc-200 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-violet-600 placeholder:text-zinc-600"
                placeholder="SELECT * FROM users LIMIT 10;"
              />
            </div>
            <div className="flex items-center gap-2 px-4 pb-3">
              <Button size="sm" disabled={!sql.trim() || running} onClick={run}
                className="h-7 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs">
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {running ? "Running…" : "Run Query"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setSql(""); setResult(null); setError(null); }}
                className="h-7 gap-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 text-xs">
                <RotateCcw className="w-3 h-3" /> Clear
              </Button>
              {history.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setShowHistory(h => !h)}
                  className="h-7 gap-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 text-xs ml-auto">
                  <History className="w-3 h-3" /> History ({history.length})
                </Button>
              )}
            </div>

            {/* History dropdown */}
            {showHistory && history.length > 0 && (
              <div className="border-t border-zinc-800 max-h-48 overflow-y-auto">
                {history.map((h, i) => (
                  <button key={i}
                    onClick={() => { setSql(h.sql); setShowHistory(false); }}
                    className="w-full flex items-start gap-2 px-4 py-2 text-left text-[11px] hover:bg-zinc-800/40 transition-colors group border-b border-zinc-800/40 last:border-0"
                  >
                    {h.ok
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                      : <AlertCircle  className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />}
                    <span className="text-zinc-400 font-mono truncate flex-1 group-hover:text-zinc-200 transition-colors">
                      {h.sql.slice(0, 80)}{h.sql.length > 80 ? "…" : ""}
                    </span>
                    <span className="text-zinc-700 shrink-0 text-[10px]">{format(h.ts, "HH:mm:ss")}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-950/30 border border-red-800/50 text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold mb-0.5">Query Error</p>
                <p className="text-[11px] font-mono break-words">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Results */}
          {result && (
            <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  {result.rowCount} row{result.rowCount !== 1 ? "s" : ""} returned
                </span>
                <div className="flex items-center gap-1.5 ml-1 text-[11px] text-zinc-500">
                  <Clock className="w-3 h-3" /> {result.durationMs}ms
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600">{format(result.ts, "HH:mm:ss")}</span>
                  {result.rows.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => exportCsv(result.columns, result.rows, `query_${Date.now()}.csv`)}
                      className="h-6 px-2 gap-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-[11px]">
                      <Download className="w-3 h-3" /> CSV
                    </Button>
                  )}
                </div>
              </div>
              {result.rows.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-zinc-500">Query executed successfully · no rows returned</div>
              ) : (
                <div className="overflow-auto max-h-80">
                  <table className="w-full text-[11px] min-w-max">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-500">
                        {result.columns.map(c => (
                          <th key={c} className="text-left px-3 py-2 font-medium font-mono whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} className={cn("border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors", i % 2 === 0 ? "" : "bg-zinc-900/40")}>
                          {result.columns.map(c => {
                            const val = row[c];
                            const isNull = val === null || val === undefined;
                            const isBool = typeof val === "boolean";
                            const isNum  = typeof val === "number";
                            return (
                              <td key={c} className="px-3 py-1.5 whitespace-nowrap max-w-xs truncate align-top">
                                {isNull ? (
                                  <span className="text-zinc-700 italic">NULL</span>
                                ) : isBool ? (
                                  <Badge className={cn("text-[9px] px-1.5", val ? "bg-emerald-900/50 text-emerald-300" : "bg-zinc-800 text-zinc-500")}>
                                    {String(val)}
                                  </Badge>
                                ) : isNum ? (
                                  <span className="text-cyan-400 font-mono tabular-nums">{String(val)}</span>
                                ) : (
                                  <span className={cn("font-mono", String(val).length > 60 ? "text-zinc-400" : "text-zinc-200")}
                                    title={String(val).length > 60 ? String(val) : undefined}>
                                    {String(val).slice(0, 80)}{String(val).length > 80 ? "…" : ""}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
