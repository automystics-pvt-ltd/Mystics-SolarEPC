import { useState, useMemo } from "react";
import { useGetPaymentMilestones, useCreatePaymentMilestone, useTriggerPaymentMilestone, getGetPaymentMilestonesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Plus, Zap, Flag, List, BarChart2, AlertTriangle, CheckCircle2, Clock, CircleDashed } from "lucide-react";
import { format, differenceInDays, parseISO, startOfDay } from "date-fns";
import { SectionCard, StatusBadge, EmptyState } from "@/components/shared";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExecMilestone {
  id: number; projectId: number; phase?: string; name: string; description?: string;
  milestoneType: string; baselineDate?: string; forecastDate?: string; actualDate?: string;
  weightPct: number; dependencies: number[]; isCriticalPath: boolean; completionPct: number;
  status: string; blockerReason?: string; approvalRequired: boolean; approvalStatus?: string;
  createdAt: string; updatedAt: string;
}

const PHASES = ["SiteSurvey","Planning","BOQ","Budgeting","ResourceAllocation","Procurement","Installation","QualityInspection","TestingCommissioning","Handover","Warranty","Closure"];
const STATUSES = ["NotStarted","InProgress","AtRisk","Delayed","Completed","Blocked"];

function statusColor(status: string) {
  if (status === "Completed") return "text-emerald-600";
  if (status === "Delayed" || status === "Blocked") return "text-red-500";
  if (status === "AtRisk") return "text-orange-500";
  if (status === "InProgress") return "text-blue-600";
  return "text-muted-foreground";
}

function statusIcon(status: string) {
  if (status === "Completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "Delayed" || status === "Blocked") return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (status === "AtRisk") return <AlertTriangle className="h-4 w-4 text-orange-500" />;
  if (status === "InProgress") return <Clock className="h-4 w-4 text-blue-500" />;
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
}

// ── Gantt / Timeline ──────────────────────────────────────────────────────────
function TimelineView({ milestones }: { milestones: ExecMilestone[] }) {
  const withDates = milestones.filter(m => m.baselineDate || m.forecastDate);
  if (!withDates.length) return (
    <div className="py-12 text-center text-muted-foreground text-sm">No milestones with dates to display in timeline view.</div>
  );

  const allDates = withDates.flatMap(m => [m.baselineDate, m.forecastDate, m.actualDate].filter(Boolean) as string[]);
  const minDate = startOfDay(new Date(Math.min(...allDates.map(d => new Date(d).getTime()))));
  const maxDate = startOfDay(new Date(Math.max(...allDates.map(d => new Date(d).getTime()))));
  const totalDays = Math.max(differenceInDays(maxDate, minDate) + 14, 60);

  function pct(d: string) { return (differenceInDays(parseISO(d), minDate) / totalDays) * 100; }
  function width(start: string, end: string) { return Math.max((differenceInDays(parseISO(end), parseISO(start)) / totalDays) * 100, 1); }

  return (
    <div className="space-y-2 overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Date header */}
        <div className="flex items-center mb-2 pl-[220px] text-[10px] text-muted-foreground">
          <span>{format(minDate, "MMM yyyy")}</span>
          <span className="ml-auto">{format(maxDate, "MMM yyyy")}</span>
        </div>
        {withDates.map(m => {
          const barStart = m.baselineDate || m.forecastDate!;
          const barEnd = m.forecastDate || m.actualDate || m.baselineDate!;
          const barColor =
            m.status === "Completed" ? "bg-emerald-500" :
            m.status === "Delayed"   ? "bg-red-400"     :
            m.status === "AtRisk"    ? "bg-orange-400"  :
            m.isCriticalPath         ? "bg-orange-300"  : "bg-blue-400";

          return (
            <div key={m.id} className="flex items-center gap-2 mb-1.5">
              <div className={cn("w-[212px] shrink-0 text-[11px] font-medium truncate pr-2", m.isCriticalPath && "text-orange-600")}>
                {m.isCriticalPath && "⚡ "}{m.name}
              </div>
              <div className="flex-1 relative h-6 bg-muted/30 rounded">
                <div
                  className={cn("absolute top-1 h-4 rounded", barColor, "opacity-80")}
                  style={{ left: `${pct(barStart)}%`, width: `${width(barStart, barEnd)}%` }}
                />
                {m.actualDate && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-emerald-600 opacity-70"
                    style={{ left: `${pct(m.actualDate)}%` }}
                  />
                )}
              </div>
              <div className="w-16 text-right text-[11px] font-mono text-muted-foreground">{m.completionPct}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ProjectMilestones({ projectId }: { projectId: number }) {
  const [view, setView] = useState<"list" | "timeline">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [detailMilestone, setDetailMilestone] = useState<ExecMilestone | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const qc = useQueryClient();

  // Execution milestones
  const execKey = ["exec-milestones", projectId];
  const { data: execMs = [], isLoading: execLoading } = useQuery<ExecMilestone[]>({
    queryKey: execKey,
    queryFn: () => apiGet(`/projects/${projectId}/milestones`),
    enabled: !!projectId,
  });

  // Payment milestones (existing)
  const { data: payMs, isLoading: payLoading } = useGetPaymentMilestones(projectId, {
    query: { enabled: !!projectId, queryKey: getGetPaymentMilestonesQueryKey(projectId) }
  });

  const createExec = useMutation({
    mutationFn: (d: any) => apiPost(`/projects/${projectId}/milestones`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: execKey }); setAddOpen(false); },
    onError: () => toast.error("Failed to add milestone"),
  });

  const patchExec = useMutation({
    mutationFn: ({ id, ...d }: any) => apiPatch(`/project-milestones/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: execKey }); setDetailMilestone(null); },
    onError: () => toast.error("Failed to update milestone"),
  });

  const triggerPay = useTriggerPaymentMilestone({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getGetPaymentMilestonesQueryKey(projectId) }) }
  });
  const createPay = useCreatePaymentMilestone({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetPaymentMilestonesQueryKey(projectId) }); setPayOpen(false); } }
  });

  // Weighted completion
  const overallPct = useMemo(() => {
    const totalW = execMs.reduce((s, m) => s + m.weightPct, 0);
    if (!totalW) return 0;
    return Math.round(execMs.reduce((s, m) => s + m.completionPct * m.weightPct, 0) / totalW);
  }, [execMs]);

  // Add exec milestone form
  const [form, setForm] = useState({ name: "", phase: "", baselineDate: "", forecastDate: "", weightPct: "10", isCriticalPath: false, status: "NotStarted" });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Execution milestones */}
      <SectionCard
        title={`Execution Milestones  ${execMs.length ? `· ${overallPct}% overall` : ""}`}
        isLoading={execLoading}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setView("list")} className={cn("px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors", view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                <List className="h-3.5 w-3.5" /> List
              </button>
              <button onClick={() => setView("timeline")} className={cn("px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors", view === "timeline" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                <BarChart2 className="h-3.5 w-3.5" /> Timeline
              </button>
            </div>
            <Button size="sm" className="h-8 gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        }
      >
        {execMs.length === 0 ? (
          <EmptyState icon={Flag} title="No execution milestones" description="Add milestones to track progress with baseline, forecast, and actual dates." action={{ label: "Add Milestone", onClick: () => setAddOpen(true) }} size="sm" />
        ) : view === "timeline" ? (
          <TimelineView milestones={execMs} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20">
                  {["Milestone","Phase","Baseline","Forecast","Actual","Compl.","Status",""].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {execMs.map(m => (
                  <tr key={m.id} className="border-b border-border/40 hover:bg-muted/20 cursor-pointer" onClick={() => setDetailMilestone(m)}>
                    <td className={cn("px-3 py-2.5 font-semibold text-sm", m.isCriticalPath && "text-orange-600")}>
                      {m.isCriticalPath && <span className="mr-1">⚡</span>}{m.name}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.phase ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-mono">{m.baselineDate ? format(parseISO(m.baselineDate), "dd/MM/yy") : "—"}</td>
                    <td className={cn("px-3 py-2.5 text-xs font-mono", m.status === "Delayed" && "text-red-500 font-bold")}>
                      {m.forecastDate ? format(parseISO(m.forecastDate), "dd/MM/yy") : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-emerald-600">{m.actualDate ? format(parseISO(m.actualDate), "dd/MM/yy") : "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${m.completionPct}%` }} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{m.completionPct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {statusIcon(m.status)}
                        <StatusBadge status={m.status} size="sm" />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {m.weightPct > 0 && <span className="text-[10px] text-muted-foreground">{m.weightPct}%wt</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Payment milestones */}
      <SectionCard
        title="Payment Milestones"
        isLoading={payLoading}
        noPadding
        actions={
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setPayOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20 hover:bg-muted/20">
              {["Milestone","Condition","Due Date","Amount","Status",""].map(h => (
                <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payMs?.map(m => (
              <tr key={m.id} className="border-b border-border/40 hover:bg-muted/20">
                <td className="px-4 py-2.5 font-semibold">{m.milestoneName}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.triggerCondition || "—"}</td>
                <td className="px-4 py-2.5 text-xs">{m.dueDate ? format(parseISO(m.dueDate), "dd MMM yyyy") : "—"}</td>
                <td className="px-4 py-2.5 font-mono font-bold text-right">₹{Number(m.amount).toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5"><StatusBadge status={m.status} size="sm" /></td>
                <td className="px-4 py-2.5 text-right">
                  {m.status === "Pending" && (
                    <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => triggerPay.mutate({ id: m.id })} disabled={triggerPay.isPending}>
                      <Zap className="h-3 w-3" /> Trigger
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!payMs?.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">No payment milestones</td></tr>
            )}
          </tbody>
        </table>
      </SectionCard>

      {/* Add exec milestone */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Execution Milestone</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name *</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Module Mounting Complete" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phase</Label>
                <Select value={form.phase} onValueChange={v => setForm(f => ({ ...f, phase: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Baseline Date</Label>
                <Input type="date" className="mt-1" value={form.baselineDate} onChange={e => setForm(f => ({ ...f, baselineDate: e.target.value }))} />
              </div>
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Forecast Date</Label>
                <Input type="date" className="mt-1" value={form.forecastDate} onChange={e => setForm(f => ({ ...f, forecastDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Weight %</Label>
                <Input type="number" className="mt-1 font-mono" value={form.weightPct} onChange={e => setForm(f => ({ ...f, weightPct: e.target.value }))} min={0} max={100} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isCriticalPath} onChange={e => setForm(f => ({ ...f, isCriticalPath: e.target.checked }))} className="rounded" />
                  <span className="text-sm font-medium text-orange-600">Critical Path</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button disabled={!form.name || createExec.isPending} onClick={() => createExec.mutate({ name: form.name, phase: form.phase || null, baselineDate: form.baselineDate || null, forecastDate: form.forecastDate || null, weightPct: Number(form.weightPct), isCriticalPath: form.isCriticalPath, status: form.status })}>
                {createExec.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Milestone"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail/edit slide-over */}
      <Sheet open={!!detailMilestone} onOpenChange={v => !v && setDetailMilestone(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {detailMilestone && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className={cn(detailMilestone.isCriticalPath && "text-orange-600")}>
                  {detailMilestone.isCriticalPath && "⚡ "}{detailMilestone.name}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Completion %", key: "completionPct", type: "number" },
                    { label: "Status", key: "status", type: "select", opts: STATUSES },
                    { label: "Baseline Date", key: "baselineDate", type: "date" },
                    { label: "Forecast Date", key: "forecastDate", type: "date" },
                    { label: "Actual Date", key: "actualDate", type: "date" },
                    { label: "Weight %", key: "weightPct", type: "number" },
                  ].map(f => (
                    <div key={f.key}>
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{f.label}</Label>
                      {f.type === "select" ? (
                        <Select
                          value={(detailMilestone as any)[f.key] ?? ""}
                          onValueChange={v => setDetailMilestone(m => m ? { ...m, [f.key]: v } : m)}
                        >
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{f.opts?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={f.type}
                          className="mt-1 font-mono"
                          value={(detailMilestone as any)[f.key] ?? ""}
                          onChange={e => setDetailMilestone(m => m ? { ...m, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value } : m)}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Blocker Reason</Label>
                  <Textarea className="mt-1 text-sm" value={detailMilestone.blockerReason ?? ""} onChange={e => setDetailMilestone(m => m ? { ...m, blockerReason: e.target.value } : m)} rows={2} placeholder="What is blocking this milestone?" />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setDetailMilestone(null)}>Cancel</Button>
                  <Button disabled={patchExec.isPending} onClick={() => patchExec.mutate({ id: detailMilestone.id, completionPct: detailMilestone.completionPct, status: detailMilestone.status, baselineDate: detailMilestone.baselineDate || null, forecastDate: detailMilestone.forecastDate || null, actualDate: detailMilestone.actualDate || null, weightPct: detailMilestone.weightPct, blockerReason: detailMilestone.blockerReason || null })}>
                    {patchExec.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add payment milestone */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Payment Milestone</DialogTitle></DialogHeader>
          <PayMilestoneForm projectId={projectId} onSuccess={() => { setPayOpen(false); qc.invalidateQueries({ queryKey: getGetPaymentMilestonesQueryKey(projectId) }); }} />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function PayMilestoneForm({ projectId, onSuccess }: { projectId: number; onSuccess: () => void }) {
  const [form, setForm] = useState({ milestoneName: "", amount: "", triggerCondition: "", dueDate: "" });
  const mut = useCreatePaymentMilestone({ mutation: { onSuccess } });
  return (
    <div className="space-y-4 pt-2">
      <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name *</Label>
        <Input className="mt-1" value={form.milestoneName} onChange={e => setForm(f => ({ ...f, milestoneName: e.target.value }))} placeholder="e.g. On Grid Synchronisation" />
      </div>
      <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (₹) *</Label>
        <Input type="number" className="mt-1 font-mono" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
      </div>
      <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trigger Condition</Label>
        <Input className="mt-1" value={form.triggerCondition} onChange={e => setForm(f => ({ ...f, triggerCondition: e.target.value }))} />
      </div>
      <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Due Date</Label>
        <Input type="date" className="mt-1" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button
          disabled={!form.milestoneName || !form.amount || mut.isPending}
          onClick={() => mut.mutate({ id: projectId, data: { milestoneName: form.milestoneName, amount: Number(form.amount), triggerCondition: form.triggerCondition || undefined, dueDate: form.dueDate || undefined, projectId } as any })}
        >
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
      </div>
    </div>
  );
}
