import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, ChevronDown, Trash2, Eye, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { apiGet, apiDelete } from "@/lib/fetch";
import { useToast } from "@/hooks/use-toast";
import type { TableRecord, BulkOpsState } from "./types";

interface Props {
  table: string;
  bulkState: BulkOpsState;
  onBulkChange: (state: BulkOpsState) => void;
}

interface RecordsResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  pkCol: string;
}

function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: "asc" | "desc" }) {
  if (sortCol !== col) return <ChevronUp className="h-3 w-3 opacity-20" />;
  return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/40 italic text-xs">null</span>;
  }
  if (typeof value === "object") {
    return (
      <span className="font-mono text-xs text-muted-foreground truncate max-w-[180px] block">
        {JSON.stringify(value)}
      </span>
    );
  }
  const str = String(value);
  return (
    <span className={`text-xs truncate max-w-[200px] block ${typeof value === "number" ? "font-mono text-right" : ""}`}>
      {str}
    </span>
  );
}

export default function RecordBrowserTab({ table, bulkState, onBulkChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [detailRow, setDetailRow] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Record<string, unknown>; pkCol: string } | null>(null);

  const filterTimer = useCallback((val: string) => {
    setFilter(val);
    const t = setTimeout(() => setDebouncedFilter(val), 400);
    return () => clearTimeout(t);
  }, []);

  const { data, isLoading } = useQuery<RecordsResponse>({
    queryKey: ["db-admin-records", table, page, sortCol, sortDir, debouncedFilter],
    queryFn: () => apiGet<RecordsResponse>(`/db-admin/tables/${encodeURIComponent(table)}/records`, {
      page, sortCol: sortCol || undefined, sortDir, filter: debouncedFilter || undefined,
    }),
    enabled: !!table,
  });

  const deleteMut = useMutation({
    mutationFn: ({ id, pkCol }: { id: string; pkCol: string }) =>
      apiDelete(`/db-admin/tables/${encodeURIComponent(table)}/records/${encodeURIComponent(id)}?pkCol=${encodeURIComponent(pkCol)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["db-admin-records", table] });
      qc.invalidateQueries({ queryKey: ["db-admin-tables"] });
      toast({ title: "Row deleted" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Delete failed", description: e.message }),
  });

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const toggleCheck = (id: string) => {
    const next = new Set(bulkState.selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onBulkChange({ ...bulkState, selectedIds: next, pkCol: data?.pkCol ?? "id" });
  };

  const toggleAll = () => {
    if (!data) return;
    const allIds = data.rows.map(r => String(r[data.pkCol]));
    const allSelected = allIds.every(id => bulkState.selectedIds.has(id));
    const next = new Set(bulkState.selectedIds);
    if (allSelected) allIds.forEach(id => next.delete(id));
    else allIds.forEach(id => next.add(id));
    onBulkChange({ ...bulkState, selectedIds: next, pkCol: data.pkCol });
  };

  const columns = data?.columns ?? [];
  const rows = data?.rows ?? [];
  const pkCol = data?.pkCol ?? "id";

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/20">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filter}
            onChange={e => filterTimer(e.target.value)}
            placeholder="Filter rows…"
            className="pl-8 h-8 text-xs"
          />
          {filter && (
            <button onClick={() => { setFilter(""); setDebouncedFilter(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {data && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {data.total.toLocaleString()} rows
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading records…</span>
          </div>
        ) : columns.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border/60 z-10">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every(r => bulkState.selectedIds.has(String(r[pkCol])))}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                {columns.map(col => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-3 py-2 text-left font-semibold text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap select-none"
                  >
                    <span className="flex items-center gap-1">
                      {col}
                      <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
                <th className="w-20 px-3 py-2 text-right text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const id = String(row[pkCol]);
                const checked = bulkState.selectedIds.has(id);
                return (
                  <tr
                    key={i}
                    className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${checked ? "bg-orange-50/50 dark:bg-orange-950/20" : ""}`}
                  >
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCheck(id)}
                        className="rounded"
                      />
                    </td>
                    {columns.map(col => (
                      <td
                        key={col}
                        className="px-3 py-2 cursor-pointer"
                        onClick={() => setDetailRow(row)}
                      >
                        <CellValue value={row[col]} />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDetailRow(row)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget({ row, pkCol })}
                        >
                          <Trash2 className="h-3 w-3" />
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

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/60 bg-muted/20 shrink-0">
          <span className="text-xs text-muted-foreground">
            Page {data.page} of {data.totalPages} ({data.total.toLocaleString()} rows)
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPage(1)} disabled={page <= 1}>«</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>‹</Button>
            <span className="text-xs px-2">{page}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages}>›</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPage(data.totalPages)} disabled={page >= data.totalPages}>»</Button>
          </div>
        </div>
      )}

      {/* Row detail sheet */}
      <Sheet open={!!detailRow} onOpenChange={open => { if (!open) setDetailRow(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-base">Row Detail — {table}</SheetTitle>
          </SheetHeader>
          <div className="space-y-2">
            {detailRow && Object.entries(detailRow).map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 border-b border-border/40 pb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{k}</span>
                <span className="font-mono text-xs break-all text-foreground">
                  {v == null ? <span className="text-muted-foreground/40 italic">null</span> : typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}
                </span>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Row</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete row where <strong>{deleteTarget?.pkCol}</strong> = <strong>{deleteTarget ? String(deleteTarget.row[deleteTarget.pkCol]) : ""}</strong> from <strong>{table}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return;
                deleteMut.mutate({ id: String(deleteTarget.row[deleteTarget.pkCol]), pkCol: deleteTarget.pkCol });
              }}
              disabled={deleteMut.isPending}
              className="gap-2"
            >
              {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
