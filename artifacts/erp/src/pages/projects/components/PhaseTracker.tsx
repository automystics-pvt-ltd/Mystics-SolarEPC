import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { Check, AlertCircle, Clock, Minus, ChevronRight, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

interface Phase {
  id: number;
  projectId: number;
  phase: string;
  status: "NotStarted" | "InProgress" | "Completed" | "Blocked";
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  SiteSurvey: "Site Survey",
  Planning: "Planning",
  BOQ: "BOQ",
  Budgeting: "Budgeting",
  ResourceAllocation: "Resources",
  Procurement: "Procurement",
  Installation: "Installation",
  QualityInspection: "QC",
  TestingCommissioning: "T&C",
  Handover: "Handover",
  Warranty: "Warranty",
  Closure: "Closure",
};

const STATUS_CONFIG = {
  NotStarted: { icon: Minus, cls: "bg-muted text-muted-foreground border-border/60", ring: "border-border/40", label: "Not Started" },
  InProgress: { icon: Clock, cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800", ring: "border-blue-400", label: "In Progress" },
  Completed: { icon: Check, cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800", ring: "border-emerald-400", label: "Completed" },
  Blocked: { icon: AlertCircle, cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800", ring: "border-red-400", label: "Blocked" },
};

function PhaseNode({ phase, isLast, isAdmin, onUpdated }: {
  phase: Phase; isLast: boolean; isAdmin: boolean; onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(phase.status);
  const [notes, setNotes] = useState(phase.notes ?? "");
  const qc = useQueryClient();

  const cfg = STATUS_CONFIG[phase.status] ?? STATUS_CONFIG.NotStarted;
  const Icon = cfg.icon;
  const label = PHASE_LABELS[phase.phase] ?? phase.phase;
  const canEdit = isAdmin && phase.status !== "Completed";

  const mut = useMutation({
    mutationFn: () => apiPatch(`/projects/${phase.projectId}/phases/${phase.phase}`, { status, notes }),
    onSuccess: () => {
      setOpen(false);
      onUpdated();
    },
  });

  return (
    <div className="flex items-center">
      <Popover open={open && canEdit} onOpenChange={canEdit ? setOpen : undefined}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex flex-col items-center gap-1 group transition-all",
              canEdit ? "cursor-pointer" : "cursor-default"
            )}
            onClick={() => canEdit && setOpen(true)}
            title={canEdit ? `Update ${label}` : label}
          >
            <div className={cn(
              "h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
              cfg.ring,
              canEdit && "group-hover:scale-110 group-hover:shadow-sm",
              phase.status === "InProgress" && "animate-pulse-slow"
            )}>
              <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", cfg.cls)}>
                <Icon className="h-3 w-3" />
              </div>
            </div>
            <span className={cn(
              "text-[10px] font-semibold whitespace-nowrap",
              phase.status === "NotStarted" ? "text-muted-foreground" :
              phase.status === "Completed" ? "text-emerald-700 dark:text-emerald-400" :
              phase.status === "Blocked" ? "text-red-700 dark:text-red-400" :
              "text-blue-700 dark:text-blue-400"
            )}>
              {label}
            </span>
          </button>
        </PopoverTrigger>
        {canEdit && (
          <PopoverContent className="w-72 p-4" side="bottom" align="center">
            <p className="text-sm font-semibold text-foreground mb-3">{label}</p>
            <div className="space-y-3">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NotStarted">Not Started</SelectItem>
                    <SelectItem value="InProgress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="h-16 text-sm resize-none"
                  placeholder="Optional note…"
                />
              </div>
              <Button
                size="sm"
                className="w-full h-8"
                onClick={() => mut.mutate()}
                disabled={mut.isPending}
              >
                {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
          </PopoverContent>
        )}
      </Popover>
      {!isLast && (
        <ChevronRight className={cn(
          "h-3.5 w-3.5 mx-0.5 shrink-0 mb-4",
          phase.status === "Completed" ? "text-emerald-400" : "text-border"
        )} />
      )}
    </div>
  );
}

export function PhaseTracker({ projectId }: { projectId: number }) {
  const { user } = useAuth();
  const role = (user as any)?.role ?? "";
  const isAdmin = ["admin", "director", "pm"].includes(role);
  const qc = useQueryClient();

  const { data: phases = [], isPending } = useQuery<Phase[]>({
    queryKey: ["project-phases", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/phases`),
    enabled: !!projectId,
  });

  const onUpdated = () => qc.invalidateQueries({ queryKey: ["project-phases", projectId] });

  const completed = phases.filter(p => p.status === "Completed").length;
  const pct = phases.length ? Math.round((completed / phases.length) * 100) : 0;

  if (isPending) {
    return (
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading phases…</span>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Project Lifecycle</span>
          <span className="text-[11px] font-semibold text-muted-foreground">·</span>
          <span className="text-[11px] font-semibold text-foreground">{completed} / {phases.length} phases</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] font-bold text-muted-foreground">{pct}%</span>
        </div>
      </div>
      <div className="flex items-center overflow-x-auto scrollbar-none pb-1">
        {phases.map((phase, i) => (
          <PhaseNode
            key={phase.phase}
            phase={phase}
            isLast={i === phases.length - 1}
            isAdmin={isAdmin}
            onUpdated={onUpdated}
          />
        ))}
      </div>
      {isAdmin && (
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
          Click any phase to update its status and notes.
        </p>
      )}
    </div>
  );
}
