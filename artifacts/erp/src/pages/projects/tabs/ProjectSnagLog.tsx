import { useState } from "react";
import { useGetProjectSnags, useCreateProjectSnag, useResolveSnag, getGetProjectSnagsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, CheckCircle2, Circle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Civil", "Electrical", "Structural", "Safety", "Other"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];

const severityColors: Record<string, string> = {
  Low: "bg-slate-100 text-slate-600",
  Medium: "bg-amber-50 text-amber-700",
  High: "bg-orange-50 text-orange-700",
  Critical: "bg-red-50 text-red-700",
};

const statusColors: Record<string, string> = {
  Open: "text-red-600",
  InProgress: "text-amber-600",
  Resolved: "text-emerald-600",
  Closed: "text-slate-400",
};

interface Props { projectId: number; }

export function ProjectSnagLog({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [resolveId, setResolveId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: snags = [], isLoading } = useGetProjectSnags(projectId, {
    query: { queryKey: getGetProjectSnagsQueryKey(projectId), enabled: !!projectId }
  });
  const createMut = useCreateProjectSnag();
  const resolveMut = useResolveSnag();
  const { register, handleSubmit, setValue, reset } = useForm<any>();
  const { register: rReg, handleSubmit: rSubmit, reset: rReset } = useForm<any>();

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetProjectSnagsQueryKey(projectId) });

  const onSubmit = (d: any) => {
    createMut.mutate({ id: projectId, data: d }, { onSuccess: () => { invalidate(); setOpen(false); reset(); } });
  };

  const onResolve = (d: any) => {
    if (!resolveId) return;
    resolveMut.mutate({ id: resolveId, data: d }, { onSuccess: () => { invalidate(); setResolveId(null); rReset(); } });
  };

  const open_ = snags.filter(s => s.status === "Open" || s.status === "InProgress").length;
  const critical = snags.filter(s => s.severity === "Critical" && s.status !== "Resolved").length;

  return (
    <div className="space-y-5 pt-4">
      {/* Summary + action */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-3">
          {[
            { label: "Total Snags", value: snags.length },
            { label: "Open", value: open_, color: open_ > 0 ? "text-red-600" : undefined },
            { label: "Critical", value: critical, color: critical > 0 ? "text-red-600" : undefined },
            { label: "Resolved", value: snags.filter(s => s.status === "Resolved").length, color: "text-emerald-600" },
          ].map((s, i) => (
            <div key={i} className="px-4 py-3 bg-white border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={cn("text-xl font-semibold", s.color ?? "text-slate-900")}>{s.value}</p>
            </div>
          ))}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Log Snag</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Log Snag / Issue</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Zone / Location</Label><Input {...register("zone")} placeholder="e.g. Block A, Row 3" className="mt-1" /></div>
                <div>
                  <Label>Category</Label>
                  <Select onValueChange={v => setValue("category", v)} defaultValue="Civil">
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Severity</Label>
                <Select onValueChange={v => setValue("severity", v)} defaultValue="Medium">
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Textarea {...register("description")} placeholder="Describe the snag/defect clearly..." className="mt-1 min-h-[80px]" /></div>
              <div><Label>Photo URL</Label><Input {...register("photoUrl")} placeholder="https://..." className="mt-1" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Logging…" : "Log Snag"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resolve dialog */}
      <Dialog open={!!resolveId} onOpenChange={v => !v && setResolveId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Resolve Snag</DialogTitle></DialogHeader>
          <form onSubmit={rSubmit(onResolve)} className="space-y-4 pt-2">
            <div><Label>Resolution</Label><Textarea {...rReg("resolution")} placeholder="How was this resolved?" className="mt-1 min-h-[80px]" /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResolveId(null)}>Cancel</Button>
              <Button type="submit" disabled={resolveMut.isPending}>{resolveMut.isPending ? "Saving…" : "Mark Resolved"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Snag list */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : snags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3 border-2 border-dashed border-slate-200 rounded-xl">
          <AlertTriangle className="w-8 h-8 text-slate-300" />
          <p className="text-slate-500 font-medium">No snags logged</p>
          <p className="text-slate-400 text-sm">Log defects and issues found during installation</p>
        </div>
      ) : (
        <div className="space-y-2">
          {snags.map((snag, i) => (
            <motion.div key={snag.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className={cn("flex items-start gap-4 p-4 bg-white border rounded-xl", snag.severity === "Critical" && snag.status !== "Resolved" ? "border-red-200" : "border-slate-200")}>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                  snag.severity === "Critical" ? "bg-red-50" : snag.severity === "High" ? "bg-orange-50" : "bg-slate-50")}>
                  <AlertTriangle className={cn("w-4 h-4", snag.severity === "Critical" ? "text-red-500" : snag.severity === "High" ? "text-orange-500" : "text-slate-400")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColors[snag.severity] ?? "bg-slate-100 text-slate-600"}`}>{snag.severity}</span>
                    <span className="text-xs text-slate-400">{snag.category}</span>
                    {snag.zone && <span className="text-xs text-slate-400">· {snag.zone}</span>}
                  </div>
                  <p className="text-sm text-slate-800 mt-1">{snag.description}</p>
                  {snag.resolution && <p className="text-xs text-emerald-600 mt-1">✓ {snag.resolution}</p>}
                  <p className="text-xs text-slate-400 mt-1">{new Date(snag.createdAt!).toLocaleDateString("en-IN")}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={cn("text-xs font-medium flex items-center gap-1", statusColors[snag.status] ?? "text-slate-500")}>
                    {snag.status === "Resolved" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    {snag.status}
                  </span>
                  {snag.status !== "Resolved" && snag.status !== "Closed" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResolveId(snag.id)}>
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
