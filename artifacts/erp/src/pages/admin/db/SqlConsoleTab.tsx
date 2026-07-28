import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Play, AlertTriangle, Clock, Rows3, History, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/fetch";
import type { SqlResult } from "./types";

const MUTATING_PATTERN = /^\s*(insert|update|delete)\s/i;

/**
 * Mirrors server-side BLOCKED_VERBS — checked client-side so the user gets
 * instant feedback before the request is sent.
 */
const BLOCKED_VERBS_RE = /^\s*(drop|alter|create|truncate|rename|comment|copy|vacuum|reindex|cluster|lock|listen|notify|unlisten|load)\s/i;

/**
 * Strip SQL comments before extracting the first verb of each statement.
 * Prevents comment-obfuscation bypass (e.g. `/* hi *‌/ DROP ...`).
 */
function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\r\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** Returns an error message if any statement in the payload is blocked. */
function validateSqlClient(sql: string): string | null {
  const stripped = stripSqlComments(sql);
  const statements = stripped.split(";").map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    if (BLOCKED_VERBS_RE.test(stmt)) {
      const verb = stmt.split(/\s+/)[0]?.toUpperCase();
      return `${verb} is blocked. Use the Maintenance tab for VACUUM/REINDEX and the Danger Zone tab for TRUNCATE.`;
    }
  }
  return null;
}

function CellVal({ v }: { v: unknown }) {
  if (v === null || v === undefined) return <span className="text-muted-foreground/40 italic">null</span>;
  if (typeof v === "object") return <span className="font-mono text-xs text-muted-foreground">{JSON.stringify(v)}</span>;
  return <span className="text-xs">{String(v)}</span>;
}

export default function SqlConsoleTab() {
  const [sql, setSql] = useState("SELECT * FROM users LIMIT 10;");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warned, setWarned] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const runMut = useMutation({
    mutationFn: (query: string) => apiPost<SqlResult>("/db-admin/sql", { sql: query }),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      setWarned(false);
      setHistory(prev => [sql, ...prev.filter(s => s !== sql)].slice(0, 10));
    },
    onError: (e: any) => {
      setError(e?.data?.error ?? e.message ?? "Query failed");
      setResult(null);
      setWarned(false);
    },
  });

  const handleRun = () => {
    const trimmed = sql.trim();
    if (!trimmed) return;

    const blockErr = validateSqlClient(trimmed);
    if (blockErr) {
      setError(blockErr);
      return;
    }

    if (MUTATING_PATTERN.test(stripSqlComments(trimmed)) && !warned) {
      setWarned(true);
      return;
    }

    runMut.mutate(trimmed);
  };

  const isMutating = MUTATING_PATTERN.test(stripSqlComments(sql.trim()));
  const columns = result?.fields ?? [];

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Editor */}
      <div className="relative border-b border-border/60">
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={e => { setSql(e.target.value); setWarned(false); }}
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleRun(); }
          }}
          rows={8}
          spellCheck={false}
          className="w-full font-mono text-xs resize-none bg-[#0f172a] text-green-300 px-4 py-3 outline-none leading-relaxed placeholder:text-slate-600"
          placeholder="-- Write SQL here…  Ctrl+Enter to run"
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {isMutating && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/50">
              <AlertTriangle className="h-2.5 w-2.5" /> Mutating statement
            </span>
          )}
          <Button
            size="sm"
            onClick={handleRun}
            disabled={runMut.isPending || !sql.trim()}
            className="h-7 text-xs gap-1.5 bg-green-700 hover:bg-green-600 text-white"
          >
            {runMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run
          </Button>
        </div>
      </div>

      {/* Mutation confirm warning */}
      {warned && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>This statement will modify data. Click Run again to confirm.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setWarned(false)}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={() => runMut.mutate(sql.trim())}>
              {runMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Confirm
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <pre className="whitespace-pre-wrap font-mono text-xs flex-1">{error}</pre>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-4 px-4 py-2 border-b border-border/60 bg-muted/20 text-xs text-muted-foreground shrink-0">
            <span className="flex items-center gap-1"><Rows3 className="h-3 w-3" />{result.rowCount.toLocaleString()} rows</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{result.durationMs}ms</span>
          </div>
          {result.rows.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">Query returned no rows</div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border/60">
                  <tr>
                    {columns.map(col => (
                      <th key={col} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                      {columns.map(col => (
                        <td key={col} className="px-3 py-2 max-w-[260px]"><CellVal v={row[col]} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Query history */}
      {!result && !error && history.length > 0 && (
        <div className="flex-1 px-4 py-3 overflow-y-auto">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
            <History className="h-3.5 w-3.5" /> Recent queries
          </p>
          <div className="space-y-1">
            {history.map((q, i) => (
              <button
                key={i}
                onClick={() => setSql(q)}
                className="w-full text-left px-3 py-2 rounded-md bg-muted/40 hover:bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {!result && !error && history.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Press Ctrl+Enter or click Run to execute
        </div>
      )}
    </div>
  );
}
