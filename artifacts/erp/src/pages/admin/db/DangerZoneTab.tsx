import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { apiPost } from "@/lib/fetch";
import { useToast } from "@/hooks/use-toast";
import type { TableSummary } from "./types";

interface Props {
  table: string;
  tables: TableSummary[];
}

interface TruncateTarget {
  name: string;
  rowCount: number;
}

export default function DangerZoneTab({ table, tables }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [truncateTarget, setTruncateTarget] = useState<TruncateTarget | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const truncateMut = useMutation({
    mutationFn: (tableName: string) =>
      apiPost(`/db-admin/tables/${encodeURIComponent(tableName)}/truncate`, { confirm: tableName }),
    onSuccess: (_data, tableName) => {
      qc.invalidateQueries({ queryKey: ["db-admin-tables"] });
      qc.invalidateQueries({ queryKey: ["db-admin-records", tableName] });
      toast({ title: `Table "${tableName}" truncated`, variant: "default" });
      setTruncateTarget(null);
      setConfirmText("");
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Truncate failed", description: e?.data?.error ?? e.message });
    },
  });

  // Highlight currently selected table at top
  const currentTable = tables.find(t => t.name === table);
  const otherTables = tables.filter(t => t.name !== table);
  const sortedTables = currentTable ? [currentTable, ...otherTables] : tables;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-4">
        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Danger Zone</p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 leading-relaxed">
            Truncating a table permanently deletes ALL rows and resets sequences. This action cascades to dependent tables and cannot be undone. Proceed only if you are certain.
          </p>
        </div>
      </div>

      {/* Table list */}
      <div className="space-y-2">
        {sortedTables.map(t => (
          <div
            key={t.name}
            className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
              t.name === table
                ? "border-orange-300 bg-orange-50/50 dark:border-orange-700 dark:bg-orange-950/20"
                : "border-border bg-card hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <Trash2 className={`h-4 w-4 shrink-0 ${t.name === table ? "text-orange-500" : "text-muted-foreground/40"}`} />
              <div>
                <p className="text-sm font-mono font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.rowCount.toLocaleString()} rows · {t.size}</p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => { setTruncateTarget({ name: t.name, rowCount: t.rowCount }); setConfirmText(""); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Truncate
            </Button>
          </div>
        ))}
      </div>

      {/* Truncate confirm dialog */}
      <Dialog open={!!truncateTarget} onOpenChange={open => { if (!open) { setTruncateTarget(null); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Truncate Table: {truncateTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              This will permanently delete <strong>{truncateTarget?.rowCount.toLocaleString()}</strong> rows from <strong>{truncateTarget?.name}</strong> and reset all sequences. <strong>This cannot be undone.</strong>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Type <span className="font-mono bg-muted px-1 py-0.5 rounded">{truncateTarget?.name}</span> to confirm:
              </label>
              <Input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={truncateTarget?.name}
                className="font-mono text-sm"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTruncateTarget(null); setConfirmText(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => truncateTarget && truncateMut.mutate(truncateTarget.name)}
              disabled={confirmText !== truncateTarget?.name || truncateMut.isPending}
              className="gap-2"
            >
              {truncateMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Truncate Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
