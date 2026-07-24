import {
  useGetProjectDashboard,
  getGetProjectDashboardQueryKey,
} from "@workspace/api-client-react";
import {
  TrendingUp, AlertTriangle, CheckCircle2, Calendar, Target,
  ShieldCheck, Layers, ShoppingCart, Package2, ChevronRight,
  ArrowUpRight, FileText, DollarSign, Zap, Activity,
  Clock, TrendingDown, CircleDot, AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { SectionCard, EmptyState, SkeletonStats } from "@/components/shared";
import { cn } from "@/lib/utils";

interface ProjectOverviewProps {
  projectId: number;
  onTabChange?: (tab: string) => void;
}

/* ── Currency formatter ─────────────────────────────────────────────────────── */
function fmtINR(v: number): string {
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)}Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(2)}L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

/* ── KPI card ───────────────────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, accent, icon: Icon, onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent: "emerald" | "blue" | "amber" | "red" | "violet" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  const map = {
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30",  iconBg: "bg-emerald-100 dark:bg-emerald-900/50", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200/60 dark:border-emerald-900/60" },
    blue:    { bg: "bg-blue-50    dark:bg-blue-950/30",     iconBg: "bg-blue-100    dark:bg-blue-900/50",    text: "text-blue-600    dark:text-blue-400",    border: "border-blue-200/60    dark:border-blue-900/60" },
    amber:   { bg: "bg-amber-50   dark:bg-amber-950/30",    iconBg: "bg-amber-100   dark:bg-amber-900/50",   text: "text-amber-600   dark:text-amber-400",   border: "border-amber-200/60   dark:border-amber-900/60" },
    red:     { bg: "bg-red-50     dark:bg-red-950/30",      iconBg: "bg-red-100     dark:bg-red-900/50",     text: "text-red-600     dark:text-red-400",     border: "border-red-200/60     dark:border-red-900/60" },
    violet:  { bg: "bg-violet-50  dark:bg-violet-950/30",   iconBg: "bg-violet-100  dark:bg-violet-900/50",  text: "text-violet-600  dark:text-violet-400",  border: "border-violet-200/60  dark:border-violet-900/60" },
    neutral: { bg: "bg-muted/40",                           iconBg: "bg-muted",                              text: "text-muted-foreground",                  border: "border-border" },
  }[accent];

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 flex items-start gap-3 transition-shadow",
        map.bg, map.border,
        onClick && "cursor-pointer hover:shadow-md"
      )}
    >
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", map.iconBg)}>
        <Icon className={cn("h-4.5 w-4.5", map.text)} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 leading-none mb-1">
          {label}
        </p>
        <p className={cn("text-xl font-bold leading-none", map.text)}>{value}</p>
        {sub && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{sub}</p>
        )}
      </div>
    </div>
  );
}

/* ── Phase progress strip ───────────────────────────────────────────────────── */
function PhaseStrip({ projectId }: { projectId: number }) {
  const { data: phases = [] } = useQuery<Array<{
    phase: string; status: "NotStarted" | "InProgress" | "Completed" | "Blocked";
  }>>({
    queryKey: ["project-phases", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/phases`),
    enabled: !!projectId,
  });

  if (!phases.length) return null;

  const LABELS: Record<string, string> = {
    SiteSurvey: "Survey", Planning: "Planning", BOQ: "BOQ", Budgeting: "Budget",
    ResourceAllocation: "Resources", Procurement: "Procurement", Installation: "Install",
    QualityInspection: "QC", TestingCommissioning: "T&C", Handover: "Handover",
    Warranty: "Warranty", Closure: "Closure",
  };
  const COLORS: Record<string, string> = {
    Completed: "bg-emerald-500",
    InProgress: "bg-blue-500",
    Blocked: "bg-red-500",
    NotStarted: "bg-muted-foreground/20",
  };
  const DOT: Record<string, string> = {
    Completed: "bg-emerald-500",
    InProgress: "bg-blue-500 animate-pulse",
    Blocked: "bg-red-500",
    NotStarted: "bg-border",
  };

  const completed = phases.filter(p => p.status === "Completed").length;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Project Lifecycle — {completed}/{phases.length} phases
        </p>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${phases.length ? Math.round((completed / phases.length) * 100) : 0}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-muted-foreground">
            {phases.length ? Math.round((completed / phases.length) * 100) : 0}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
        {phases.map((p, i) => (
          <div key={p.phase} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "h-2 w-2 rounded-full ring-2 ring-offset-1 ring-offset-card",
                DOT[p.status],
                p.status === "Completed" ? "ring-emerald-300" :
                p.status === "InProgress" ? "ring-blue-300" :
                p.status === "Blocked" ? "ring-red-300" : "ring-border"
              )} />
              <span className={cn(
                "text-[9px] font-semibold whitespace-nowrap",
                p.status === "Completed" ? "text-emerald-600 dark:text-emerald-400" :
                p.status === "InProgress" ? "text-blue-600 dark:text-blue-400" :
                p.status === "Blocked" ? "text-red-600 dark:text-red-400" :
                "text-muted-foreground/60"
              )}>
                {LABELS[p.phase] ?? p.phase}
              </span>
            </div>
            {i < phases.length - 1 && (
              <div className={cn(
                "w-6 h-px mx-0.5 mb-3",
                p.status === "Completed" ? "bg-emerald-300" : "bg-border"
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main overview ───────────────────────────────────────────────────────────── */
export function ProjectOverview({ projectId, onTabChange }: ProjectOverviewProps) {
  const [, navigate] = useLocation();

  const { data: dashboard, isPending, isLoading } = useGetProjectDashboard(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: getGetProjectDashboardQueryKey(projectId),
    },
  });

  const { data: milestoneData } = useQuery<{ overallCompletionPct: number }>({
    queryKey: ["milestones-critical-path", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/milestones/critical-path`),
    enabled: !!projectId,
  });
  const overallPct = milestoneData?.overallCompletionPct ?? 0;

  const { data: expiringWarranty = [] } = useQuery<Array<{ status: string }>>({
    queryKey: ["project-warranty-expiring", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/warranty/expiring`),
    enabled: !!projectId,
    staleTime: 2 * 60_000,
  });
  const { data: allWarranty = [] } = useQuery<Array<{ status: string }>>({
    queryKey: ["project-warranty", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/warranty`),
    enabled: !!projectId,
    staleTime: 2 * 60_000,
  });
  const warrantyActive   = allWarranty.filter(w => w.status === "Active").length;
  const warrantyExpiring = expiringWarranty.length;

  if (isPending) return <div className="space-y-6"><SkeletonStats count={4} /></div>;

  const bg          = (dashboard as any)?.budgetSummary;
  const isOverBudget = bg ? bg.totalVariance < 0 : false;
  const openMRs    = (dashboard as any)?.openMRsCount    ?? 0;
  const pendingPOs = (dashboard as any)?.pendingPOsCount ?? 0;
  const openIssues = (dashboard as any)?.openEscalationsCount ?? 0;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-5">

      {/* ── Phase lifecycle strip ─────────────────────────────────────────── */}
      <PhaseStrip projectId={projectId} />

      {/* ── KPI cards 2×3 grid ───────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Milestone Completion"
          value={`${overallPct}%`}
          sub="Weighted across all milestones"
          accent={overallPct >= 80 ? "emerald" : overallPct >= 40 ? "blue" : "amber"}
          icon={Target}
          onClick={() => onTabChange?.("milestones")}
        />
        <KpiCard
          label="Budget Health"
          value={bg ? fmtINR(bg.totalActual) : "—"}
          sub={bg ? `${isOverBudget ? "⚠ Over" : "✓"} Var ${fmtINR(Math.abs(bg.totalVariance))}` : "No budget set"}
          accent={!bg ? "neutral" : isOverBudget ? "red" : "emerald"}
          icon={isOverBudget ? TrendingDown : TrendingUp}
          onClick={() => onTabChange?.("budget")}
        />
        <KpiCard
          label="Open Issues"
          value={openIssues || "—"}
          sub={openIssues > 0 ? "Escalations need attention" : "All clear"}
          accent={openIssues > 0 ? "red" : "emerald"}
          icon={AlertTriangle}
          onClick={() => openIssues > 0 ? navigate("/crm/escalations") : undefined}
        />
        <KpiCard
          label="Material Pipeline"
          value={`${openMRs}MR`}
          sub={`${pendingPOs} open purchase orders`}
          accent={openMRs > 0 || pendingPOs > 0 ? "amber" : "neutral"}
          icon={Layers}
          onClick={() => onTabChange?.("mrs")}
        />
        <KpiCard
          label="Warranty"
          value={allWarranty.length === 0 ? "—" : `${warrantyActive}`}
          sub={warrantyExpiring > 0 ? `${warrantyExpiring} expiring soon` : "All components healthy"}
          accent={warrantyExpiring > 0 ? "amber" : "neutral"}
          icon={ShieldCheck}
          onClick={() => onTabChange?.("warranty")}
        />
        <KpiCard
          label="Activities"
          value={(dashboard as any)?.activitiesCount ?? "—"}
          sub="WBS items tracked"
          accent="blue"
          icon={Activity}
          onClick={() => onTabChange?.("activities")}
        />
      </div>

      {/* ── Budget burn bar (if budget data) ──────────────────────────────── */}
      {bg && bg.totalBudgeted > 0 && (
        <div
          className={cn(
            "rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-shadow",
            isOverBudget ? "border-red-200/60 bg-red-50/30 dark:border-red-900/60 dark:bg-red-950/10" : "border-border bg-card"
          )}
          onClick={() => onTabChange?.("budget")}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Budget Burn</p>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground">
                Actual <span className="font-mono font-bold text-foreground">{fmtINR(bg.totalActual)}</span>
              </span>
              <span className="text-muted-foreground/40">of</span>
              <span className="text-[11px] text-muted-foreground">
                Budget <span className="font-mono font-bold text-foreground">{fmtINR(bg.totalBudgeted)}</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            </div>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                isOverBudget ? "bg-red-500" :
                bg.totalActual / bg.totalBudgeted >= 0.8 ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ width: `${Math.min(100, Math.round((bg.totalActual / bg.totalBudgeted) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">
              {Math.round((bg.totalActual / bg.totalBudgeted) * 100)}% spent
            </span>
            {isOverBudget && (
              <span className="text-[10px] font-bold text-red-600">
                Over by {fmtINR(Math.abs(bg.totalVariance))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Lower split: DPR + Milestones ─────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Last DPR */}
        <SectionCard
          title="Last Daily Progress Report"
          actions={
            <button
              onClick={() => onTabChange?.("dprs")}
              className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
            >
              All reports <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          {(dashboard as any)?.lastDPR ? (() => {
            const dpr = (dashboard as any).lastDPR;
            return (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">
                        {format(new Date(dpr.reportDate), "dd MMM yyyy")}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        by {dpr.submittedByName ?? "Unknown"} ·{" "}
                        {formatDistanceToNow(new Date(dpr.reportDate), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Progress</p>
                    <p className={cn(
                      "text-2xl font-bold tabular-nums",
                      dpr.percentComplete >= 80 ? "text-emerald-600" :
                      dpr.percentComplete >= 40 ? "text-blue-600" : "text-amber-600"
                    )}>
                      {dpr.percentComplete ?? 0}%
                    </p>
                  </div>
                </div>
                {dpr.workSummary && (
                  <div className="bg-muted/30 rounded-lg border border-border/50 p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Summary</p>
                    <p className="text-[13px] text-foreground leading-relaxed line-clamp-3">{dpr.workSummary}</p>
                  </div>
                )}
                {dpr.manpowerCount > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <CircleDot className="h-3 w-3" />
                    {dpr.manpowerCount} workers on site · Weather: {dpr.weather ?? "N/A"}
                  </div>
                )}
              </div>
            );
          })() : (
            <EmptyState icon={Calendar} title="No DPRs submitted yet" size="sm" />
          )}
        </SectionCard>

        {/* Upcoming milestones */}
        <SectionCard
          title="Payment Milestones"
          actions={
            <button
              onClick={() => onTabChange?.("milestones")}
              className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
            >
              All milestones <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          {(dashboard as any)?.upcomingMilestones?.length ? (
            <div className="space-y-2">
              {(dashboard as any).upcomingMilestones.map((m: any) => {
                const isOverdue = m.dueDate && new Date(m.dueDate) < new Date();
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isOverdue
                        ? "border-red-200/60 bg-red-50/30 dark:border-red-900/60 dark:bg-red-950/10"
                        : "border-border/60 bg-muted/20 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        isOverdue ? "bg-red-500" : "bg-blue-500"
                      )} />
                      <div className="min-w-0">
                        <p className="font-semibold text-[13px] text-foreground truncate">{m.milestoneName}</p>
                        <p className={cn(
                          "text-[10px] uppercase tracking-wider",
                          isOverdue ? "text-red-600 font-bold" : "text-muted-foreground"
                        )}>
                          {isOverdue ? "⚠ Overdue · " : "Due "}
                          {m.dueDate ? format(new Date(m.dueDate), "dd MMM yyyy") : "No date"}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold text-foreground font-mono text-[14px] shrink-0 ml-3">
                      {fmtINR(Number(m.amount))}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="No pending milestones" size="sm" />
          )}
        </SectionCard>
      </div>

      {/* ── Connected module cards ─────────────────────────────────────────── */}
      <SectionCard title="Connected Modules">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: ShoppingCart,
              title: "Procurement",
              desc: `${openMRs} open MR · ${pendingPOs} open PO`,
              status: openMRs > 0 || pendingPOs > 0 ? "attention" : "ok",
              alert: openMRs > 0 ? "Pending material requests" : undefined,
              onTab: () => onTabChange?.("mrs"),
              onMod: () => navigate("/procurement/pos"),
              tabLabel: "View MRs",
              modLabel: "Open Procurement",
            },
            {
              icon: Package2,
              title: "Inventory",
              desc: "Material allocations & stock levels",
              status: "neutral",
              onMod: () => navigate("/inventory/allocations"),
              modLabel: "Open Inventory",
            },
            {
              icon: DollarSign,
              title: "Budget & Finance",
              desc: bg ? `${fmtINR(bg.totalActual)} of ${fmtINR(bg.totalBudgeted)}` : "No budget configured",
              status: isOverBudget ? "attention" : "ok",
              alert: isOverBudget ? "Over budget — review required" : undefined,
              onTab: () => onTabChange?.("budget"),
              tabLabel: "View budget",
            },
            {
              icon: AlertTriangle,
              title: "Escalations",
              desc: openIssues > 0 ? `${openIssues} open issue${openIssues > 1 ? "s" : ""}` : "No open escalations",
              status: openIssues > 0 ? "attention" : "ok",
              alert: openIssues > 0 ? "Immediate attention needed" : undefined,
              onMod: () => navigate("/crm/escalations"),
              modLabel: "View escalations",
            },
          ].map((mod, i) => {
            const borderCls =
              mod.status === "attention" ? "border-amber-200 dark:border-amber-800" :
              mod.status === "ok"        ? "border-emerald-200/60 dark:border-emerald-900/60" :
                                           "border-border";
            const iconCls =
              mod.status === "attention" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" :
              mod.status === "ok"        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" :
                                           "bg-muted text-muted-foreground";
            return (
              <div key={i} className={cn("rounded-xl border p-4 flex flex-col gap-3 bg-card", borderCls)}>
                <div className="flex items-start gap-3">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", iconCls)}>
                    <mod.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[13px] text-foreground leading-tight">{mod.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{mod.desc}</p>
                    {mod.alert && (
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 uppercase tracking-wide">
                        ⚠ {mod.alert}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1 border-t border-border/40">
                  {mod.onTab && mod.tabLabel && (
                    <button
                      onClick={mod.onTab}
                      className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline"
                    >
                      {mod.tabLabel} <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                  {mod.onMod && mod.modLabel && (
                    <button
                      onClick={mod.onMod}
                      className={cn(
                        "flex items-center gap-1 text-[11px] font-medium hover:underline",
                        mod.onTab ? "text-muted-foreground ml-auto" : "text-primary"
                      )}
                    >
                      {mod.modLabel} <ArrowUpRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </motion.div>
  );
}
