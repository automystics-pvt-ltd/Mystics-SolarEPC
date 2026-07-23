import { useState } from "react";
import { useGetProjectSnags, useCreateProjectSnag, useResolveSnag, getGetProjectSnagsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, CheckCircle2, Circle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SectionCard, StatCard, StatusBadge, EmptyState } from "@/components/shared";

const CATEGORIES = ["Civil", "Electrical", "Structural", "Safety", "Other"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];

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

  const openCount = snags.filter(s => s.status === "Open" || s.status === "InProgress").length;
  const criticalCount = snags.filter(s => s.severity === "Critical" && s.status !== "Resolved").length;
  const resolvedCount = snags.filter(s => s.status === "Resolved").length;

  const logSnagDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Log Snag
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Log Snag / Issue</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Zone / Location</Label>
              <Input {...register("zone")} placeholder="e.g. Block A, Row 3" className="mt-1" />
            </div>
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
          <div>
            <Label>Description</Label>
            <Textarea {...register("description")} placeholder="Describe the snag/defect clearly..." className="mt-1 min-h-[80px]" />
          </div>
          <div>
            <Label>Photo URL</Label>
            <Input {...register("photoUrl")} placeholder="https://..." className="mt-1" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? "Logging…" : "Log Snag"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Resolve dialog */}
      <Dialog open={!!resolveId} onOpenChange={v => !v && setResolveId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Resolve Snag</DialogTitle></DialogHeader>
          <form onSubmit={rSubmit(onResolve)} className="space-y-4 pt-2">
            <div>
              <Label>Resolution</Label>
              <Textarea {...rReg("resolution")} placeholder="How was this resolved?" className="mt-1 min-h-[80px]" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResolveId(null)}>Cancel</Button>
              <Button type="submit" disabled={resolveMut.isPending}>
                {resolveMut.isPending ? "Saving…" : "Mark Resolved"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Snags" value={snags.length} compact />
        <StatCard
          label="Open"
          value={openCount}
          compact
          className={openCount > 0 ? "border-red-200" : undefined}
        />
        <StatCard
          label="Critical"
          value={criticalCount}
          compact
          className={criticalCount > 0 ? "border-red-200 bg-red-50/30" : undefined}
        />
        <StatCard
          label="Resolved"
          value={resolvedCount}
          compact
          className={resolvedCount > 0 ? "border-emerald-200 bg-emerald-50/30" : undefined}
        />
      </div>

      {/* Snag list */}
      <SectionCard title="Snag Log" actions={logSnagDialog} isLoading={isLoading}>
        {snags.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No snags logged"
            description="Log defects and issues found during installation"
            size="sm"
          />
        ) : (
          <div className="space-y-2">
            {snags.map((snag, i) => (
              <motion.div
                key={snag.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div
                  className={cn(
                    "flex items-start gap-4 p-4 bg-card border rounded-xl",
                    snag.severity === "Critical" && snag.status !== "Resolved"
                      ? "border-red-200"
                      : "border-border"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      snag.severity === "Critical" ? "bg-red-50" :
                      snag.severity === "High"     ? "bg-orange-50" : "bg-muted"
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        "w-4 h-4",
                        snag.severity === "Critical" ? "text-red-500" :
                        snag.severity === "High"     ? "text-orange-500" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={snag.severity} size="sm" />
                      <span className="text-xs text-muted-foreground">{snag.category}</span>
                      {snag.zone && <span className="text-xs text-muted-foreground">· {snag.zone}</span>}
                    </div>
                    <p className="text-sm text-foreground mt-1">{snag.description}</p>
                    {snag.resolution && (
                      <p className="text-xs text-emerald-600 mt-1">✓ {snag.resolution}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(snag.createdAt!).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusBadge status={snag.status} size="sm" />
                    {snag.status !== "Resolved" && snag.status !== "Closed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setResolveId(snag.id)}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}
