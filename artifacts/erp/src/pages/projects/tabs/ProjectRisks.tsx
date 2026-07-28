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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ShieldAlert, Plus, Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Risk {
  id: number; projectId: number; title: string; category: string;
  probability: string; impact: string; riskScore: number;
  mitigationPlan: string | null; owner: string | null; status: string;
  createdAt: string; updatedAt: string;
}

const CATEGORIES = ["Technical","Financial","Regulatory","Weather","Supply","Resource","Safety"];
const PROB_OPTS = ["Low","Medium","High"];
const IMPACT_OPTS = ["Low","Medium","High","Critical"];
const STATUS_OPTS = ["Open","Mitigated","Accepted","Closed"];

const PROB_COLORS: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  Medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  High: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300",
};

const IMPACT_COLORS: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Critical: "bg-red-50 text-red-700 border-red-200",
};

const CAT_COLORS: Record<string, string> = {
  Technical: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  Financial: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Regulatory: "bg-violet-50 text-violet-700 border-violet-200",
  Weather: "bg-sky-50 text-sky-700 border-sky-200",
  Supply: "bg-amber-50 text-amber-700 border-amber-200",
  Resource: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Safety: "bg-red-50 text-red-700 border-red-200",
};

function RiskScoreBadge({ score }: { score: number }) {
  const color = score >= 6 ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-300"
    : score >= 3 ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300"
    : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300";
  return (
    <Badge variant="outline" className={cn("text-xs font-bold w-8 justify-center border", color)}>
      {score}
    </Badge>
  );
}

export function ProjectRisks({ projectId }: { projectId: number }) {
  const [addOpen, setAddOpen] = useState(false);
  const [sortKey, setSortKey] = useState<"riskScore" | "category" | "status">("riskScore");
  const qc = useQueryClient();

  const { register, handleSubmit, control, reset } = useForm<any>({
    defaultValues: { category: "Technical", probability: "Low", impact: "Low" },
  });

  const { data: risks = [], isPending } = useQuery<Risk[]>({
    queryKey: ["project-risks", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/risks`),
    enabled: !!projectId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project-risks", projectId] });

  const addMut = useMutation({
    mutationFn: (d: any) => apiPost(`/projects/${projectId}/risks`, d),
    onSuccess: () => { invalidate(); setAddOpen(false); reset(); toast.success("Risk added"); },
    onError: () => toast.error("Failed to add risk"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiPatch(`/risks/${id}`, data),
    onSuccess: () => invalidate(),
  });

  const sorted = [...risks].sort((a, b) => {
    if (sortKey === "riskScore") return b.riskScore - a.riskScore;
    if (sortKey === "category") return a.category.localeCompare(b.category);
    return a.status.localeCompare(b.status);
  });

  const openCount = risks.filter(r => r.status === "Open").length;
  const highCount = risks.filter(r => r.riskScore >= 6).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Summary chips */}
      {risks.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground">{risks.length} risks total</span>
          {openCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-200 bg-amber-50 text-amber-700">{openCount} open</Badge>
          )}
          {highCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-700">{highCount} high-risk</Badge>
          )}
        </div>
      )}

      <SectionCard
        title="Risk Register"
        noPadding
        isLoading={isPending}
        actions={
          <div className="flex items-center gap-2">
            <Select value={sortKey} onValueChange={v => setSortKey(v as any)}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="riskScore">By Score</SelectItem>
                <SelectItem value="category">By Category</SelectItem>
                <SelectItem value="status">By Status</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setAddOpen(true)}>
              <Plus className="h-3 w-3" /> Add Risk
            </Button>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider px-4">Risk</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-28">Category</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-20 text-center">Prob.</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-20 text-center">Impact</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-16 text-center">Score</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-28">Owner</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(risk => (
              <TableRow key={risk.id} className="border-b border-border/40 hover:bg-muted/10 group">
                <TableCell className="px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{risk.title}</p>
                  {risk.mitigationPlan && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{risk.mitigationPlan}</p>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", CAT_COLORS[risk.category])}>
                    {risk.category}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 text-center">
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", PROB_COLORS[risk.probability])}>
                    {risk.probability}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 text-center">
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", IMPACT_COLORS[risk.impact])}>
                    {risk.impact}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 text-center">
                  <RiskScoreBadge score={risk.riskScore} />
                </TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground">{risk.owner || "—"}</TableCell>
                <TableCell className="py-3">
                  <Select
                    value={risk.status}
                    onValueChange={v => updateMut.mutate({ id: risk.id, data: { status: v } })}
                  >
                    <SelectTrigger className="h-7 text-xs w-28 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {!sorted.length && (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    icon={ShieldAlert}
                    title="No risks identified"
                    description="Document project risks with probability, impact, and mitigation plans."
                    size="sm"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>

      {/* Add Risk Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6"><SheetTitle>Add Risk</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit(d => addMut.mutate(d))} className="space-y-4">
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Risk Title *</Label>
              <Input className="h-9" {...register("title", { required: true })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Category</Label>
                <Controller control={control} name="category" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Owner</Label>
                <Input className="h-9" placeholder="Person responsible" {...register("owner")} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Probability</Label>
                <Controller control={control} name="probability" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{PROB_OPTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Impact</Label>
                <Controller control={control} name="impact" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{IMPACT_OPTS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Mitigation Plan</Label>
              <Textarea className="h-20 resize-none" {...register("mitigationPlan")} />
            </div>
            <Button type="submit" className="w-full h-10" disabled={addMut.isPending}>
              {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Risk"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
