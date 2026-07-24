import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { motion } from "framer-motion";
import { SectionCard, EmptyState, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { GitBranch, Plus, CheckCircle2, XCircle, Clock, Loader2, ArrowUpDown } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CR {
  id: number; projectId: number; crNumber: string; title: string; description: string | null;
  type: string; impact: string; requestedBy: number | null; requesterName: string | null;
  requestedAt: string; budgetImpact: number; timelineImpactDays: number; status: string;
  reviewedBy: number | null; reviewerName: string | null; reviewedAt: string | null;
  reviewNotes: string | null; attachmentUrls: string[]; createdAt: string; updatedAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  Scope: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  Budget: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  Timeline: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  Resource: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300",
  Technical: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
};

const IMPACT_COLORS: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Critical: "bg-red-50 text-red-700 border-red-200",
};

export function ProjectChangeRequests({ projectId }: { projectId: number }) {
  const { user } = useAuth();
  const role = (user as any)?.role ?? "";
  const canApprove = ["admin", "director"].includes(role);
  const [addOpen, setAddOpen] = useState(false);
  const [detailCR, setDetailCR] = useState<CR | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const qc = useQueryClient();

  const { register, handleSubmit, control, reset } = useForm<any>({
    defaultValues: { type: "Scope", impact: "Low", budgetImpact: 0, timelineImpactDays: 0 },
  });

  const { data: crs = [], isLoading } = useQuery<CR[]>({
    queryKey: ["project-crs", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/change-requests`),
    enabled: !!projectId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project-crs", projectId] });

  const addMut = useMutation({
    mutationFn: (d: any) => apiPost(`/projects/${projectId}/change-requests`, { ...d, requestedBy: (user as any)?.id }),
    onSuccess: () => { invalidate(); setAddOpen(false); reset(); toast.success("Change request created"); },
    onError: () => toast.error("Failed to create change request"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiPatch(`/change-requests/${id}`, data),
    onSuccess: (updated: any) => { invalidate(); setDetailCR(updated); toast.success("CR updated"); },
    onError: () => toast.error("Failed to update CR"),
  });

  const submitMut = useMutation({
    mutationFn: (id: number) => apiPatch(`/change-requests/${id}`, { status: "Submitted" }),
    onSuccess: (updated: any) => { invalidate(); setDetailCR(updated); },
  });

  const fmtINR = (n: number) => `${n >= 0 ? "+" : ""}₹${Math.abs(n).toLocaleString("en-IN")}`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <SectionCard
        title="Change Requests"
        isLoading={isLoading}
        actions={
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="h-3 w-3" /> New CR
          </Button>
        }
      >
        {crs.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No change requests"
            description="Log scope, budget, or timeline changes with full audit trail."
            size="sm"
          />
        ) : (
          <div className="space-y-3">
            {crs.map(cr => (
              <button
                key={cr.id}
                className="w-full text-left p-4 rounded-xl border border-border/60 hover:border-border hover:bg-muted/20 transition-all group"
                onClick={() => setDetailCR(cr)}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono font-bold text-muted-foreground">{cr.crNumber}</span>
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", TYPE_COLORS[cr.type])}>{cr.type}</Badge>
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", IMPACT_COLORS[cr.impact])}>{cr.impact} Impact</Badge>
                  </div>
                  <StatusBadge status={cr.status} size="sm" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">{cr.title}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {cr.budgetImpact !== 0 && (
                    <span className={cn("font-mono font-bold", cr.budgetImpact > 0 ? "text-red-600" : "text-emerald-600")}>
                      {fmtINR(cr.budgetImpact)}
                    </span>
                  )}
                  {cr.timelineImpactDays !== 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {cr.timelineImpactDays > 0 ? "+" : ""}{cr.timelineImpactDays} days
                    </span>
                  )}
                  <span>By {cr.requesterName ?? "Unknown"}</span>
                  <span>{format(new Date(cr.requestedAt), "MMM d, yyyy")}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Create CR Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6"><SheetTitle>New Change Request</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit(d => addMut.mutate(d))} className="space-y-4">
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Title *</Label>
              <Input className="h-9" {...register("title", { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Type</Label>
                <Controller control={control} name="type" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Scope","Budget","Timeline","Resource","Technical"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Impact</Label>
                <Controller control={control} name="impact" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Low","Medium","High","Critical"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Description</Label>
              <Textarea className="h-20 resize-none" {...register("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Budget Impact (₹)</Label>
                <Input type="number" className="h-9 font-mono" {...register("budgetImpact")} />
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Timeline (days)</Label>
                <Input type="number" className="h-9 font-mono" {...register("timelineImpactDays")} />
              </div>
            </div>
            <Button type="submit" className="w-full h-10" disabled={addMut.isPending}>
              {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Change Request"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet */}
      {detailCR && (
        <Sheet open={!!detailCR} onOpenChange={() => setDetailCR(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-muted-foreground">{detailCR.crNumber}</span>
                <StatusBadge status={detailCR.status} size="sm" />
              </div>
              <SheetTitle className="text-lg">{detailCR.title}</SheetTitle>
            </SheetHeader>

            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className={cn("text-[10px] border", TYPE_COLORS[detailCR.type])}>{detailCR.type}</Badge>
                <Badge variant="outline" className={cn("text-[10px] border", IMPACT_COLORS[detailCR.impact])}>{detailCR.impact} Impact</Badge>
              </div>

              {detailCR.description && (
                <p className="text-sm text-muted-foreground">{detailCR.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Budget Impact</p>
                  <p className={cn("font-mono font-bold text-sm", detailCR.budgetImpact > 0 ? "text-red-600" : detailCR.budgetImpact < 0 ? "text-emerald-600" : "text-muted-foreground")}>
                    {detailCR.budgetImpact !== 0 ? `${detailCR.budgetImpact > 0 ? "+" : ""}₹${Math.abs(detailCR.budgetImpact).toLocaleString("en-IN")}` : "No change"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Timeline Impact</p>
                  <p className="font-mono font-bold text-sm text-foreground">
                    {detailCR.timelineImpactDays !== 0 ? `${detailCR.timelineImpactDays > 0 ? "+" : ""}${detailCR.timelineImpactDays} days` : "No change"}
                  </p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Requested by <span className="font-semibold text-foreground">{detailCR.requesterName ?? "Unknown"}</span> on {format(new Date(detailCR.requestedAt), "MMM d, yyyy")}</p>
                {detailCR.reviewerName && (
                  <p>Reviewed by <span className="font-semibold text-foreground">{detailCR.reviewerName}</span>{detailCR.reviewedAt ? ` on ${format(new Date(detailCR.reviewedAt), "MMM d, yyyy")}` : ""}</p>
                )}
              </div>

              {detailCR.reviewNotes && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Review Notes</p>
                  <p className="text-sm text-foreground">{detailCR.reviewNotes}</p>
                </div>
              )}

              {/* Actions */}
              <Separator />
              <div className="space-y-3">
                {detailCR.status === "Draft" && (
                  <Button className="w-full gap-1.5" onClick={() => submitMut.mutate(detailCR.id)} disabled={submitMut.isPending}>
                    <ArrowUpDown className="h-3.5 w-3.5" /> Submit for Review
                  </Button>
                )}

                {canApprove && ["Submitted", "UnderReview"].includes(detailCR.status) && (
                  <>
                    <div>
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Review Notes</Label>
                      <Textarea className="h-16 resize-none" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => updateMut.mutate({ id: detailCR.id, data: { status: "Approved", reviewedBy: (user as any)?.id, reviewNotes } })}
                        disabled={updateMut.isPending}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button variant="destructive" className="flex-1 gap-1.5"
                        onClick={() => updateMut.mutate({ id: detailCR.id, data: { status: "Rejected", reviewedBy: (user as any)?.id, reviewNotes } })}
                        disabled={updateMut.isPending}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </motion.div>
  );
}
