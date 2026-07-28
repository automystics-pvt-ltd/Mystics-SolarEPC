import { useQuery } from "@tanstack/react-query";
import { Loader2, Key, Link2, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { apiGet } from "@/lib/fetch";
import type { SchemaResult } from "./types";

interface Props { table: string }

export default function SchemaTab({ table }: Props) {
  const { data, isLoading, error } = useQuery<SchemaResult>({
    queryKey: ["db-admin-schema", table],
    queryFn: () => apiGet<SchemaResult>(`/db-admin/tables/${encodeURIComponent(table)}/schema`),
    enabled: !!table,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading schema…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-40 text-destructive text-sm">
        Failed to load schema: {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full">
      {/* Columns */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
          Columns <span className="font-normal normal-case text-muted-foreground/60">({data.columns.length})</span>
        </h3>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Column</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Type</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Nullable</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Default</th>
              </tr>
            </thead>
            <tbody>
              {data.columns.map((col, i) => (
                <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono font-semibold text-foreground">{col.column_name}</td>
                  <td className="px-3 py-2 font-mono text-blue-600 dark:text-blue-400">
                    {col.data_type}{col.character_maximum_length ? `(${col.character_maximum_length})` : ""}
                  </td>
                  <td className="px-3 py-2">
                    {col.is_nullable === "YES"
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                      : <XCircle className="h-3.5 w-3.5 text-amber-500" />}
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground truncate max-w-[200px]">
                    {col.column_default ?? <span className="italic opacity-40">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Indexes */}
      {data.indexes.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <Key className="h-3 w-3" /> Indexes <span className="font-normal normal-case text-muted-foreground/60">({data.indexes.length})</span>
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Columns</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Unique</th>
                </tr>
              </thead>
              <tbody>
                {data.indexes.map((idx, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-foreground">{idx.index_name}</td>
                    <td className="px-3 py-2 font-mono text-blue-600 dark:text-blue-400">
                      {Array.isArray(idx.columns) ? idx.columns.join(", ") : idx.columns}
                    </td>
                    <td className="px-3 py-2">
                      {idx.is_unique
                        ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-[10px] font-semibold">YES</span>
                        : <span className="text-muted-foreground/50">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Foreign Keys */}
      {data.foreignKeys.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <Link2 className="h-3 w-3" /> Foreign Keys <span className="font-normal normal-case text-muted-foreground/60">({data.foreignKeys.length})</span>
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Column</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">→ Table</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">→ Column</th>
                </tr>
              </thead>
              <tbody>
                {data.foreignKeys.map((fk, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono font-semibold text-foreground">{fk.column_name}</td>
                    <td className="px-3 py-2 font-mono text-orange-600 dark:text-orange-400">{fk.foreign_table}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{fk.foreign_column}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Referenced By */}
      {data.referencedBy.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <ArrowLeft className="h-3 w-3" /> Referenced By <span className="font-normal normal-case text-muted-foreground/60">({data.referencedBy.length})</span>
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Source Table</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Source Column</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Target Column</th>
                </tr>
              </thead>
              <tbody>
                {data.referencedBy.map((ref, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-violet-600 dark:text-violet-400">{ref.source_table}</td>
                    <td className="px-3 py-2 font-mono text-foreground">{ref.source_column}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{ref.target_column}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
