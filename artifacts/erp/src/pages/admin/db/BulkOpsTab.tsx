import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Download, Loader2, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { apiDelete } from "@/lib/fetch";
import { useToast } from "@/hooks/use-toast";
import type { BulkOpsState } from "./types";

interface Props {
  table: string;
  bulkState: BulkOpsState;
  onBulkChange: (state: BulkOpsState) => void;
}

export default function BulkOpsTab({ table, bulkState, onBulkChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleteDialog, setDeleteDialog] = useState(false);

  const count = bulkState.selectedIds.size;

  const deleteMut = useMutation({
    mutationFn: async () => {
      const ids = [...bulkState.selectedIds];
      for (const id of ids) {
        await apiDelete(`/db-admin/tables/${encodeURIComponent(table)}/records/${encodeURIComponent(id)}?pkCol=${encodeURIComponent(bulkState.pkCol)}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["db-admin-records", table] });
      qc.invalidateQueries({ queryKey: ["db-admin-tables"] });
      toast({ title: `Deleted ${count} row${count !== 1 ? "s" : ""}` });
      onBulkChange({ selectedIds: new Set(), pkCol: bulkState.pkCol });
      setDeleteDialog(false);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Bulk delete failed", description: e.message }),
  });

  const handleExportSelected = async () => {
    // We don't have the actual data here — navigate user to switch to Record Browser
    toast({ title: "Use Record Browser", description: "Select rows in Record Browser tab, then switch back here to export." });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="font-semibold text-sm mb-1">Bulk Operations</h3>
        <p className="text-xs text-muted-foreground">
          Select rows in the <strong>Record Browser</strong> tab using checkboxes, then return here to act on them.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
        <CheckSquare className="h-5 w-5 text-orange-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {count === 0 ? "No rows selected" : `${count} row${count !== 1 ? "s" : ""} selected`}
          </p>
          <p className="text-xs text-muted-foreground">
            {count > 0 ? `From table "${table}", primary key: "${bulkState.pkCol}"` : "Go to Record Browser and check rows to select them"}
          </p>
        </div>
        {count > 0 && (
          <Button
            variant="ghost" size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => onBulkChange({ selectedIds: new Set(), pkCol: bulkState.pkCol })}
          >
            Clear
          </Button>
        )}
      </div>

      {count > 0 && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={() => setDeleteDialog(true)}
            disabled={deleteMut.isPending}
          >
            <Trash2 className="h-4 w-4" />
            Delete {count} Row{count !== 1 ? "s" : ""}
          </Button>
        </div>
      )}

      {count === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
          <CheckSquare className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">No rows selected</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Switch to <strong>Record Browser</strong> and use the checkboxes to select rows
          </p>
        </div>
      )}

      {/* Delete confirm dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{count}</strong> row{count !== 1 ? "s" : ""} from <strong>{table}</strong>? This cannot be undone.
          </p>
          <div className="text-xs font-mono bg-muted rounded p-2 max-h-24 overflow-y-auto text-muted-foreground">
            IDs: {[...bulkState.selectedIds].join(", ")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="gap-2"
            >
              {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete {count} Rows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
