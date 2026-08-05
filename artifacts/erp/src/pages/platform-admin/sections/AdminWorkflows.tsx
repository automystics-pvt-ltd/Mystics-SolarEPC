import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  GitBranch, Plus, Trash2, AlertTriangle, ChevronRight,
  Check, ToggleLeft, ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const ENTITY_TYPES = [
  "purchase_order","quotation","grn","invoice","expense",
  "project","lead","commissioning","material_request",
];

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
    const json = await r.json();
    if (!r.ok) throw new Error(json.error ?? r.statusText);
    return json;
  });
}

/* ── Create Workflow Dialog ─────────────────────────────────────────────────── */
function CreateWorkflowDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName]           = useState("");
  const [entityType, setEntityType] = useState("purchase_order");
  const [threshold, setThreshold] = useState("");
  const [error, setError]         = useState("");

  const mut = useMutation({
    mutationFn: () => apiFetch("/approval-workflows", "POST", {
      name,
      entity_type: entityType,
      is_active: true,
      conditions: threshold ? { threshold: Number(threshold) } : {},
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pa-workflows"] });
      toast({ title: `Workflow "${name}" created` });
      setName(""); setEntityType("purchase_order"); setThreshold(""); setError("");
      onClose();
    },
    onError: (e: any) => setError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-400" /> New Approval Workflow
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-zinc-400">Workflow Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. High-Value PO Approval"
              className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-400">Entity Type</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {ENTITY_TYPES.map(t => (
                  <SelectItem key={t} value={t} className="text-xs text-zinc-200 capitalize">
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-400">Amount Threshold (₹, optional)</Label>
            <Input value={threshold} onChange={e => setThreshold(e.target.value)} type="number" placeholder="e.g. 100000"
              className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200" />
            <p className="text-[11px] text-zinc-600">Workflow triggers only when amount exceeds this value</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">Cancel</Button>
          <Button size="sm" disabled={!name || mut.isPending} onClick={() => mut.mutate()}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {mut.isPending ? "Creating…" : "Create Workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Delete Confirm Dialog ──────────────────────────────────────────────────── */
function DeleteWorkflowDialog({ wf, onClose }: { wf: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const mut = useMutation({
    mutationFn: () => apiFetch(`/approval-workflows/${wf.id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pa-workflows"] });
      toast({ title: `Workflow "${wf.name}" deleted` });
      onClose();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-red-400">Delete Workflow</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-300 py-2">
          Delete <span className="font-semibold text-white">"{wf.name}"</span>? Any pending approvals using this workflow will be affected.
        </p>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400">Cancel</Button>
          <Button size="sm" disabled={mut.isPending} onClick={() => mut.mutate()}
            className="bg-red-700 hover:bg-red-600 text-white">
            {mut.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
export function AdminWorkflows() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<any>(null);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["pa-workflows"],
    queryFn: () => apiGet<any[]>("/approval-workflows"),
  });

  const toggleActive = useMutation({
    mutationFn: (wf: any) =>
      apiFetch(`/approval-workflows/${wf.id}`, "PATCH", { is_active: !wf.is_active }),
    onSuccess: (_data, wf) => {
      qc.invalidateQueries({ queryKey: ["pa-workflows"] });
      toast({ title: `Workflow ${!wf.is_active ? "activated" : "deactivated"}` });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const activeCount   = workflows.filter((w: any) => w.is_active).length;
  const inactiveCount = workflows.length - activeCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Approval Workflows</h2>
          <p className="text-xs text-zinc-500">
            Platform-wide approval chains and escalation rules
            {workflows.length > 0 && ` · ${activeCount} active, ${inactiveCount} inactive`}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}
          className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs">
          <Plus className="w-3.5 h-3.5" /> New Workflow
        </Button>
      </div>

      {/* Status summary */}
      {workflows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total",    value: workflows.length, color: "text-zinc-200" },
            { label: "Active",   value: activeCount,       color: "text-emerald-400" },
            { label: "Inactive", value: inactiveCount,     color: "text-zinc-500" },
          ].map(s => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
              <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-48 bg-zinc-800" />
                  <Skeleton className="h-3 w-32 bg-zinc-800" />
                </div>
                <Skeleton className="h-6 w-16 bg-zinc-800 rounded-full" />
                <Skeleton className="h-7 w-7 bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-600/10 flex items-center justify-center">
              <GitBranch className="w-6 h-6 text-violet-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-300">No workflows configured</p>
              <p className="text-xs text-zinc-500 mt-0.5">Create a workflow to require approvals for key actions</p>
            </div>
            <Button size="sm" onClick={() => setCreating(true)}
              className="mt-1 bg-violet-600 hover:bg-violet-700 text-white text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Create First Workflow
            </Button>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Entity</th>
                <th className="text-center px-4 py-2.5 font-medium">Steps</th>
                <th className="text-left px-4 py-2.5 font-medium">Created</th>
                <th className="text-center px-4 py-2.5 font-medium">Active</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w: any) => (
                <tr key={w.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <GitBranch className={cn("w-3.5 h-3.5 shrink-0", w.is_active ? "text-violet-400" : "text-zinc-600")} />
                      <span className={cn("font-medium", w.is_active ? "text-zinc-200" : "text-zinc-500")}>{w.name}</span>
                    </div>
                    {w.conditions?.threshold && (
                      <p className="text-[10px] text-zinc-600 ml-5.5 mt-0.5">
                        ≥ ₹{Number(w.conditions.threshold).toLocaleString("en-IN")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="bg-zinc-800 text-zinc-300 text-[10px] capitalize border-zinc-700">
                      {(w.entity_type ?? w.module ?? "—").replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-400">
                    {w.steps?.length ?? w.step_count ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-[11px]">
                    {w.created_at ? format(new Date(w.created_at), "dd MMM yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={w.is_active ?? false}
                      onCheckedChange={() => toggleActive.mutate(w)}
                      disabled={toggleActive.isPending}
                      className="data-[state=checked]:bg-emerald-600 mx-auto"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleting(w)}
                      className="p-1.5 rounded hover:bg-red-900/40 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete workflow"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Dialogs */}
      {creating && <CreateWorkflowDialog open onClose={() => setCreating(false)} />}
      {deleting  && <DeleteWorkflowDialog wf={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
