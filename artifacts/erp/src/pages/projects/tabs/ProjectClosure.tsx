import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { motion } from "framer-motion";
import { SectionCard, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Loader2, Archive, BadgeCheck, Star,
  TrendingUp, TrendingDown, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReadinessResult {
  checklist: {
    allMilestonesComplete: boolean;
    allSnagsResolved: boolean;
    allPaymentsReceived: boolean;
    handoverSigned: boolean;
    documentsArchived: boolean;
    teamReleased: boolean;
  };
  allGreen: boolean;
  summary: {
    totalMilestones: number; doneMilestones: number;
    openSnags: number; unpaidMilestones: number; handoverStatus: string;
  };
}

interface ClosureRecord {
  id: number; projectId: number; closureType: string;
  initiatedBy: number | null; initiatedAt: string | null;
  finalCost: number | null; finalRevenue: number | null; margin: number | null;
  lessonsLearned: string | null; customerSatisfaction: number | null;
  customerFeedback: string | null; internalReviewNotes: string | null;
  outstandingPayments: number | null; retentionAmount: number | null;
  retentionReleaseDate: string | null; closureChecklist: Record<string, boolean>;
  status: string; approvedBy: number | null; approvedAt: string | null;
  closedAt: string | null; createdAt: string;
}

const GATE_LABELS: Record<string, string> = {
  allMilestonesComplete: "All Milestones Complete",
  allSnagsResolved: "All Snags Resolved",
  allPaymentsReceived: "All Payments Received",
  handoverSigned: "Handover Certificate Signed",
  documentsArchived: "Documents Archived",
  teamReleased: "Team Released",
};

function GateRow({ label, passed, detail }: { label: string; passed: boolean; detail?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      passed ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/30"
             : "bg-red-50/60 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/30"
    )}>
      {passed
        ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
      <div className="flex-1">
        <p className={cn("text-sm font-medium", passed ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300")}>
          {label}
        </p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star className={cn("h-6 w-6 transition-colors", n <= value ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 hover:text-amber-300")} />
        </button>
      ))}
    </div>
  );
}

export function ProjectClosure({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    closureType: "Completed", customerSatisfaction: 0,
  });

  const { data: readiness, isPending: readinessLoading } = useQuery<ReadinessResult>({
    queryKey: ["project-closure-readiness", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/closure/readiness`),
    enabled: !!projectId,
    refetchInterval: 30_000,
  });

  const { data: closure, isPending } = useQuery<ClosureRecord | null>({
    queryKey: ["project-closure", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/closure`),
    enabled: !!projectId,
  });

  const createMut = useMutation({
    mutationFn: (d: any) => apiPost(`/projects/${projectId}/closure`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-closure", projectId] }); setEditing(false); toast.success("Closure initiated"); },
    onError: () => toast.error("Failed to initiate closure"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: any }) => apiPatch(`/closure/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-closure", projectId] }); setEditing(false); toast.success("Closure updated"); },
    onError: () => toast.error("Failed to update closure"),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => apiPost(`/closure/${id}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-closure", projectId] });
      qc.invalidateQueries({ queryKey: ["project-closure-readiness", projectId] });
      toast.success("Project closed. Resources and allocations released.");
    },
    onError: () => toast.error("Failed to approve closure"),
  });

  const handleSave = () => {
    if (closure) {
      updateMut.mutate({ id: closure.id, d: form });
    } else {
      createMut.mutate(form);
    }
  };

  const startEdit = () => {
    setForm(closure ? {
      closureType: closure.closureType, finalCost: closure.finalCost,
      finalRevenue: closure.finalRevenue, margin: closure.margin,
      lessonsLearned: closure.lessonsLearned,
      customerSatisfaction: closure.customerSatisfaction ?? 0,
      customerFeedback: closure.customerFeedback, internalReviewNotes: closure.internalReviewNotes,
      outstandingPayments: closure.outstandingPayments, retentionAmount: closure.retentionAmount,
      retentionReleaseDate: closure.retentionReleaseDate,
    } : { closureType: "Completed", customerSatisfaction: 0 });
    setEditing(true);
  };

  const isLoaded = !isPending && !readinessLoading;
  const allGreen = readiness?.allGreen ?? false;

  const summary = readiness?.summary;

  const marginPct = closure?.finalRevenue && closure?.margin
    ? ((closure.margin / closure.finalRevenue) * 100).toFixed(1)
    : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Readiness Checklist */}
      <SectionCard title="Closure Readiness" isLoading={!isLoaded}>
        {readiness && (
          <div className="space-y-2">
            <GateRow label={GATE_LABELS.allMilestonesComplete} passed={readiness.checklist.allMilestonesComplete}
              detail={summary ? `${summary.doneMilestones} / ${summary.totalMilestones} milestones complete` : undefined} />
            <GateRow label={GATE_LABELS.allSnagsResolved} passed={readiness.checklist.allSnagsResolved}
              detail={summary?.openSnags ? `${summary.openSnags} open snag(s) remaining` : "All snags resolved"} />
            <GateRow label={GATE_LABELS.allPaymentsReceived} passed={readiness.checklist.allPaymentsReceived}
              detail={summary?.unpaidMilestones ? `${summary.unpaidMilestones} payment milestone(s) pending` : "All payments received"} />
            <GateRow label={GATE_LABELS.handoverSigned} passed={readiness.checklist.handoverSigned}
              detail={`Handover: ${summary?.handoverStatus ?? "None"}`} />
            <GateRow label={GATE_LABELS.documentsArchived} passed={readiness.checklist.documentsArchived} />
          </div>
        )}
      </SectionCard>

      {/* Closure not started */}
      {!closure && !editing && (
        <div className={cn(
          "flex items-center gap-4 p-5 rounded-xl border",
          allGreen ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300/60" : "bg-muted/30 border-border"
        )}>
          {allGreen
            ? <BadgeCheck className="h-8 w-8 text-emerald-600 shrink-0" />
            : <AlertCircle className="h-8 w-8 text-muted-foreground shrink-0" />}
          <div className="flex-1">
            <p className="font-bold text-sm">{allGreen ? "All gates are green — ready to close" : "Not all gates are met yet"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allGreen ? "You can now initiate formal project closure." : "Resolve all open items before initiating closure."}
            </p>
          </div>
          <Button onClick={startEdit} disabled={!allGreen} className={allGreen ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}>
            <Archive className="h-4 w-4 mr-1.5" /> Initiate Closure
          </Button>
        </div>
      )}

      {/* Closure form */}
      {editing && (
        <SectionCard title="Initiate Closure" actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        }>
          <div className="space-y-5">
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Closure Type</Label>
              <Select value={form.closureType ?? "Completed"} onValueChange={v => setForm((f: any) => ({ ...f, closureType: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Completed","EarlyTermination","Cancelled"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 pb-1 border-b border-border">Financial Summary</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Final Cost (₹)", key: "finalCost" },
                  { label: "Final Revenue (₹)", key: "finalRevenue" },
                  { label: "Margin (₹)", key: "margin" },
                  { label: "Outstanding Payments (₹)", key: "outstandingPayments" },
                  { label: "Retention Amount (₹)", key: "retentionAmount" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{label}</Label>
                    <Input type="number" className="h-9" value={(form as any)[key] ?? ""} onChange={e => setForm((f: any) => ({ ...f, [key]: Number(e.target.value) || null }))} />
                  </div>
                ))}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Retention Release Date</Label>
                  <Input type="date" className="h-9" value={form.retentionReleaseDate ?? ""} onChange={e => setForm((f: any) => ({ ...f, retentionReleaseDate: e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 pb-1 border-b border-border">Customer Feedback</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Satisfaction Score</Label>
                  <StarRating value={form.customerSatisfaction ?? 0} onChange={v => setForm((f: any) => ({ ...f, customerSatisfaction: v }))} />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Customer Feedback</Label>
                  <Textarea className="resize-none h-20" value={form.customerFeedback ?? ""} onChange={e => setForm((f: any) => ({ ...f, customerFeedback: e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Lessons Learned</Label>
              <Textarea className="resize-none h-24" placeholder="What went well, what could be improved…" value={form.lessonsLearned ?? ""} onChange={e => setForm((f: any) => ({ ...f, lessonsLearned: e.target.value }))} />
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Internal Review Notes</Label>
              <Textarea className="resize-none h-16" value={form.internalReviewNotes ?? ""} onChange={e => setForm((f: any) => ({ ...f, internalReviewNotes: e.target.value }))} />
            </div>
          </div>
        </SectionCard>
      )}

      {/* Closure record view */}
      {closure && !editing && (
        <div className="space-y-5">
          {/* Status banner */}
          <div className={cn(
            "flex items-center justify-between p-4 rounded-xl border",
            closure.status === "Approved" || closure.status === "Closed"
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30"
              : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30"
          )}>
            <div className="flex items-center gap-3">
              {closure.status === "Approved" || closure.status === "Closed"
                ? <BadgeCheck className="h-5 w-5 text-emerald-600" />
                : <Archive className="h-5 w-5 text-amber-600" />}
              <div>
                <p className="font-bold text-sm">{closure.closureType} — {closure.status}</p>
                {closure.closedAt && <p className="text-xs text-muted-foreground mt-0.5">Closed: {new Date(closure.closedAt).toLocaleDateString()}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {closure.status === "Draft" && (
                <>
                  <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
                  <Button size="sm" onClick={() => updateMut.mutate({ id: closure.id, d: { status: "PendingApproval" } })}>
                    Submit for Approval
                  </Button>
                </>
              )}
              {closure.status === "PendingApproval" && (
                <Button size="sm" onClick={() => approveMut.mutate(closure.id)} disabled={approveMut.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {approveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><BadgeCheck className="h-3.5 w-3.5 mr-1.5" />Approve & Close Project</>}
                </Button>
              )}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Final Revenue", value: closure.finalRevenue, icon: TrendingUp, color: "text-emerald-600 bg-emerald-100" },
              { label: "Final Cost", value: closure.finalCost, icon: TrendingDown, color: "text-red-600 bg-red-100" },
              { label: "Margin", value: closure.margin, icon: TrendingUp, color: "text-blue-600 bg-blue-100", suffix: marginPct ? ` (${marginPct}%)` : "" },
            ].map(({ label, value, icon: Icon, color, suffix }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                </div>
                <p className="text-xl font-bold font-mono text-foreground">
                  {value != null ? `₹${Number(value).toLocaleString("en-IN")}${suffix ?? ""}` : "—"}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {closure.customerSatisfaction && (
              <SectionCard title="Customer Satisfaction">
                <div className="flex gap-1 mb-3">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={cn("h-6 w-6", n <= closure.customerSatisfaction! ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20")} />
                  ))}
                  <span className="ml-2 font-bold text-foreground">{closure.customerSatisfaction}/5</span>
                </div>
                {closure.customerFeedback && <p className="text-sm text-muted-foreground italic">"{closure.customerFeedback}"</p>}
              </SectionCard>
            )}
            {closure.lessonsLearned && (
              <SectionCard title="Lessons Learned">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{closure.lessonsLearned}</p>
              </SectionCard>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
