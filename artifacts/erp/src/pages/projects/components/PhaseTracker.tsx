// @refresh reset
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import {
  Check, AlertCircle, Clock, Minus, Loader2,
  MapPin, BarChart3, Calculator, DollarSign, Users,
  ShoppingCart, Wrench, ClipboardCheck, Zap, Key, ShieldCheck, Archive,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Phase {
  id: number;
  projectId: number;
  phase: string;
  status: "NotStarted" | "InProgress" | "Completed" | "Blocked";
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
}

/* ── Phase metadata ─────────────────────────────────────────────────────────── */
const PHASES: { key: string; label: string; short: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "SiteSurvey",           label: "Site Survey",        short: "Survey",   icon: MapPin },
  { key: "Planning",             label: "Planning",           short: "Planning", icon: BarChart3 },
  { key: "BOQ",                  label: "Bill of Quantities", short: "BOQ",      icon: Calculator },
  { key: "Budgeting",            label: "Budgeting",          short: "Budget",   icon: DollarSign },
  { key: "ResourceAllocation",   label: "Resource Allocation",short: "Resources",icon: Users },
  { key: "Procurement",          label: "Procurement",        short: "Procure",  icon: ShoppingCart },
  { key: "Installation",         label: "Installation",       short: "Install",  icon: Wrench },
  { key: "QualityInspection",    label: "Quality Inspection", short: "QC",       icon: ClipboardCheck },
  { key: "TestingCommissioning", label: "Testing & Commissioning", short: "T&C", icon: Zap },
  { key: "Handover",             label: "Handover",           short: "Handover", icon: Key },
  { key: "Warranty",             label: "Warranty",           short: "Warranty", icon: ShieldCheck },
  { key: "Closure",              label: "Project Closure",    short: "Closure",  icon: Archive },
];

/* ── Status config ──────────────────────────────────────────────────────────── */
const STATUS = {
  NotStarted: {
    label:      "Not Started",
    nodeOuter:  "border-2 border-border bg-card",
    nodeFill:   "bg-transparent",
    icon:       Minus,
    iconCls:    "text-border",
    track:      "bg-muted-foreground/15",
    textCls:    "text-muted-foreground/50",
    ring:       "",
  },
  InProgress: {
    label:      "In Progress",
    nodeOuter:  "border-2 border-blue-400 bg-blue-500 shadow-[0_0_0_4px_rgba(96,165,250,0.20)]",
    nodeFill:   "bg-blue-500",
    icon:       Clock,
    iconCls:    "text-white",
    track:      "bg-blue-400",
    textCls:    "text-blue-600 dark:text-blue-400 font-semibold",
    ring:       "animate-pulse",
  },
  Completed: {
    label:      "Completed",
    nodeOuter:  "border-2 border-emerald-400 bg-emerald-500",
    nodeFill:   "bg-emerald-500",
    icon:       Check,
    iconCls:    "text-white",
    track:      "bg-emerald-500",
    textCls:    "text-emerald-600 dark:text-emerald-400",
    ring:       "",
  },
  Blocked: {
    label:      "Blocked",
    nodeOuter:  "border-2 border-red-400 bg-red-500 shadow-[0_0_0_4px_rgba(248,113,113,0.20)]",
    nodeFill:   "bg-red-500",
    icon:       AlertCircle,
    iconCls:    "text-white",
    track:      "bg-red-400",
    textCls:    "text-red-600 dark:text-red-400 font-semibold",
    ring:       "",
  },
} as const;

/* ── Edit popover ────────────────────────────────────────────────────────────── */
function EditPopover({
  phase, open, onOpenChange, onSaved,
}: {
  phase: Phase; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void;
}) {
  const [status, setStatus] = useState<string>(phase.status);
  const [notes, setNotes]   = useState(phase.notes ?? "");
  const meta = PHASES.find(p => p.key === phase.phase);

  const mut = useMutation({
    mutationFn: () => apiPatch(`/projects/${phase.projectId}/phases/${phase.phase}`, { status, notes }),
    onSuccess: () => { onOpenChange(false); onSaved(); },
  });

  return (
    <PopoverContent className="w-76 p-4" side="bottom" align="center" sideOffset={8}>
      <div className="flex items-center gap-2 mb-4">
        {meta && <meta.icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        <p className="text-sm font-semibold">{meta?.label ?? phase.phase}</p>
      </div>

      {(phase.startedAt || phase.completedAt) && (
        <div className="flex gap-3 mb-3 text-[11px] text-muted-foreground">
          {phase.startedAt && (
            <span>Started {format(new Date(phase.startedAt), "d MMM yyyy")}</span>
          )}
          {phase.completedAt && (
            <span>· Completed {format(new Date(phase.completedAt), "d MMM yyyy")}</span>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
            Status
          </Label>
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
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
            Notes
          </Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="h-16 text-sm resize-none"
            placeholder="Optional note…"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm" className="flex-1 h-8"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm" className="flex-1 h-8"
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
          >
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </PopoverContent>
  );
}

/* ── Main component ──────────────────────────────────────────────────────────── */
export function PhaseTracker({
  projectId,
  readOnly = false,
}: {
  projectId: number;
  readOnly?: boolean;
}) {
  const { user } = useAuth();
  const role     = (user as any)?.role ?? "";
  const canEdit  = !readOnly && ["admin", "director", "pm"].includes(role);
  const qc       = useQueryClient();

  const [openPhase, setOpenPhase] = useState<string | null>(null);

  const { data: phases = [], isPending } = useQuery<Phase[]>({
    queryKey: ["project-phases", projectId],
    queryFn:  () => apiGet(`/projects/${projectId}/phases`),
    enabled:  !!projectId,
  });

  const onSaved = () => {
    setOpenPhase(null);
    qc.invalidateQueries({ queryKey: ["project-phases", projectId] });
  };

  /* Sort by PHASES order so display is always canonical */
  const ordered = PHASES
    .map(meta => phases.find(p => p.phase === meta.key))
    .filter(Boolean) as Phase[];

  const total     = ordered.length;
  const completed = ordered.filter(p => p.status === "Completed").length;
  const inProg    = ordered.filter(p => p.status === "InProgress").length;
  const blocked   = ordered.filter(p => p.status === "Blocked").length;
  const pct       = total ? Math.round((completed / total) * 100) : 0;

  /* Track fill width: stop at the last completed/in-progress node's position */
  const lastActiveIdx = (() => {
    let idx = -1;
    ordered.forEach((p, i) => {
      if (p.status === "Completed" || p.status === "InProgress") idx = i;
    });
    return idx;
  })();
  const trackFillPct = total > 1 ? (lastActiveIdx / (total - 1)) * 100 : 0;

  /* ── skeleton ── */
  if (isPending) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="h-3 w-40 bg-muted rounded animate-pulse" />
          <div className="h-2 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-14 bg-muted/40 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!total) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start sm:items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
              Project Lifecycle
            </p>
            <p className="text-[13px] font-semibold text-foreground mt-0.5">
              {completed} of {total} phases complete
              {inProg > 0 && <span className="text-blue-500 ml-1.5">· {inProg} in progress</span>}
              {blocked > 0 && <span className="text-red-500 ml-1.5">· {blocked} blocked</span>}
            </p>
          </div>

          {/* Progress pill */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-28 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  blocked > 0 ? "bg-red-500" : pct === 100 ? "bg-emerald-500" : "bg-blue-500"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={cn(
              "text-[13px] font-bold tabular-nums w-8 text-right",
              blocked > 0 ? "text-red-600 dark:text-red-400" :
              pct === 100 ? "text-emerald-600 dark:text-emerald-400" :
              pct > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
            )}>
              {pct}%
            </span>
          </div>
        </div>

        {/* ── Track + nodes ──────────────────────────────────────────────── */}
        <div className="relative overflow-x-auto scrollbar-none">
          {/* Min-width ensures labels stay readable on small screens */}
          <div className="min-w-[560px]">

            {/* Track rail */}
            <div className="relative mx-[14px] h-1 bg-muted rounded-full mt-[14px] mb-0">
              {/* Filled portion */}
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{
                  width: `${trackFillPct}%`,
                  background: blocked > 0
                    ? "linear-gradient(to right, #10b981, #f87171)"
                    : "linear-gradient(to right, #10b981, #3b82f6)",
                }}
              />
            </div>

            {/* Nodes row — use flex so spacing adapts naturally */}
            <div
              className="absolute top-0 left-0 right-0 flex justify-between"
              style={{ paddingLeft: 0, paddingRight: 0 }}
            >
              {ordered.map((phase) => {
                const meta   = PHASES.find(p => p.key === phase.phase)!;
                const scfg   = STATUS[phase.status] ?? STATUS.NotStarted;
                const Icon   = scfg.icon;
                const isOpen = openPhase === phase.phase;

                const node = (
                  <button
                    key={phase.phase}
                    disabled={!canEdit || phase.status === "Completed"}
                    onClick={() => canEdit && phase.status !== "Completed" && setOpenPhase(isOpen ? null : phase.phase)}
                    className={cn(
                      "flex flex-col items-center gap-0 group outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full",
                      canEdit && phase.status !== "Completed" ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    {/* Circle node */}
                    <div className={cn(
                      "h-[28px] w-[28px] rounded-full flex items-center justify-center transition-transform duration-150",
                      scfg.nodeOuter,
                      canEdit && phase.status !== "Completed" && "group-hover:scale-110",
                      phase.status === "InProgress" && scfg.ring,
                    )}>
                      <Icon className={cn("h-3.5 w-3.5", scfg.iconCls)} />
                    </div>
                  </button>
                );

                return (
                  <Tooltip key={phase.phase}>
                    <TooltipTrigger asChild>
                      {canEdit && phase.status !== "Completed" ? (
                        <Popover open={isOpen} onOpenChange={v => setOpenPhase(v ? phase.phase : null)}>
                          <PopoverTrigger asChild>
                            {node}
                          </PopoverTrigger>
                          <EditPopover
                            phase={phase}
                            open={isOpen}
                            onOpenChange={v => setOpenPhase(v ? phase.phase : null)}
                            onSaved={onSaved}
                          />
                        </Popover>
                      ) : node}
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p className="font-semibold">{meta?.label ?? phase.phase}</p>
                      <p className="text-muted-foreground">{scfg.label}</p>
                      {phase.completedAt && (
                        <p className="text-muted-foreground">
                          Completed {format(new Date(phase.completedAt), "d MMM yyyy")}
                        </p>
                      )}
                      {phase.notes && <p className="mt-1 max-w-[200px] text-muted-foreground">{phase.notes}</p>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Spacer to account for node height above the rail */}
            <div className="h-[14px]" />

            {/* Phase labels row */}
            <div className="flex justify-between mt-2">
              {ordered.map((phase) => {
                const meta  = PHASES.find(p => p.key === phase.phase)!;
                const scfg  = STATUS[phase.status] ?? STATUS.NotStarted;
                return (
                  <span
                    key={phase.phase}
                    className={cn(
                      "text-[10px] font-semibold text-center leading-tight w-[28px] transition-colors",
                      scfg.textCls
                    )}
                    style={{ width: 42, textAlign: "center" }}
                  >
                    {meta?.short ?? phase.phase}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Legend / hint ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/40">
          {[
            { status: "Completed",  label: "Completed"   },
            { status: "InProgress", label: "In Progress" },
            { status: "Blocked",    label: "Blocked"     },
            { status: "NotStarted", label: "Not Started" },
          ].map(({ status, label }) => {
            const s = STATUS[status as keyof typeof STATUS];
            const count = ordered.filter(p => p.status === status).length;
            if (count === 0 && status !== "NotStarted") return null;
            return (
              <div key={status} className="flex items-center gap-1.5">
                <div className={cn("h-2 w-2 rounded-full", s.nodeFill,
                  status === "NotStarted" && "border border-border bg-card"
                )} />
                <span className="text-[11px] text-muted-foreground">
                  {count} {label}
                </span>
              </div>
            );
          })}
          {canEdit && (
            <span className="ml-auto text-[10px] text-muted-foreground/50 italic">
              Click a phase to update
            </span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
