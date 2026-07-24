import {
  useGetProjectDashboard,
  getGetProjectDashboardQueryKey,
} from "@workspace/api-client-react";
import {
  TrendingUp, AlertTriangle, CheckCircle2, Calendar, Target,
  ShieldCheck, Layers, ShoppingCart, Package2, ChevronRight,
  ArrowUpRight, FileText, DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { SectionCard, StatCard, EmptyState, SkeletonStats } from "@/components/shared";
import { cn } from "@/lib/utils";

interface ProjectOverviewProps {
  projectId: number;
  onTabChange?: (tab: string) => void;
}

export function ProjectOverview({ projectId, onTabChange }: ProjectOverviewProps) {
  const [, navigate] = useLocation();

  const { data: dashboard, isLoading } = useGetProjectDashboard(projectId, {
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonStats count={4} />
      </div>
    );
  }

  const bg          = (dashboard as any)?.budgetSummary;
  const isOverBudget = bg ? bg.totalVariance < 0 : false;
  const health      = bg ? (isOverBudget ? "Over Budget" : "On Budget") : "Unknown";

  const openMRs    = (dashboard as any)?.openMRsCount ?? 0;
  const pendingPOs = (dashboard as any)?.pendingPOsCount ?? 0;
  const openIssues = (dashboard as any)?.openEscalationsCount ?? 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overall Completion"
          value={`${overallPct}%`}
          icon={Target}
          iconColor={overallPct >= 80 ? "text-emerald-600" : overallPct >= 40 ? "text-blue-600" : "text-muted-foreground"}
          iconBg={overallPct >= 80 ? "bg-emerald-100" : overallPct >= 40 ? "bg-blue-100" : "bg-muted"}
          trendLabel="Weighted milestone progress"
        />
        <StatCard
          label="Budget Health"
          value={`₹${Number(bg?.totalActual || 0).toLocaleString("en-IN")}`}
          icon={TrendingUp}
          iconColor={isOverBudget ? "text-red-600" : "text-emerald-600"}
          iconBg={isOverBudget ? "bg-red-100" : "bg-emerald-100"}
          trend={isOverBudget ? "up" : "down"}
          trendLabel={`${health} · Var ₹${Math.abs(bg?.totalVariance || 0).toLocaleString("en-IN")}`}
          className={cn(
            "cursor-pointer hover:shadow-md transition-shadow",
            isOverBudget ? "border-red-200 bg-red-50/40" : "border-emerald-200 bg-emerald-50/40"
          )}
          onClick={() => onTabChange?.("budget")}
        />
        <StatCard
          label="Open Issues"
          value={(dashboard as any)?.openEscalationsCount || 0}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-100"
          trendLabel="Escalations requiring attention"
          className={cn(
            (dashboard as any)?.openEscalationsCount ? "border-red-200 cursor-pointer hover:shadow-md transition-shadow" : undefined
          )}
          onClick={() => navigate("/crm/escalations")}
        />
        <StatCard
          label="Material Pipeline"
          value={`${openMRs} MR · ${pendingPOs} PO`}
          icon={Layers}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
          trendLabel="Open material requests & purchase orders"
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onTabChange?.("mrs")}
        />
        <StatCard
          label="Warranty Status"
          value={allWarranty.length === 0 ? "—" : `${warrantyActive} active`}
          icon={ShieldCheck}
          iconColor={warrantyExpiring > 0 ? "text-amber-600" : "text-emerald-600"}
          iconBg={warrantyExpiring > 0 ? "bg-amber-100" : "bg-emerald-100"}
          trendLabel={
            warrantyExpiring > 0
              ? `${warrantyExpiring} expiring within 90 days`
              : allWarranty.length === 0
              ? "No components tracked"
              : "All components healthy"
          }
          className={warrantyExpiring > 0
            ? "border-amber-200 bg-amber-50/30 cursor-pointer hover:shadow-md transition-shadow"
            : undefined
          }
          onClick={() => onTabChange?.("warranty")}
        />
      </div>

      {/* ── Connected Modules ──────────────────────────────────────────────── */}
      <SectionCard title="Connected Modules">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Procurement */}
          <ModuleCard
            icon={ShoppingCart}
            title="Procurement"
            description={`${openMRs} open MRs · ${pendingPOs} open POs`}
            status={openMRs > 0 || pendingPOs > 0 ? "attention" : "ok"}
            attentionLabel={openMRs > 0 ? "Pending material requests" : undefined}
            onTabLabel="View in tab"
            onModuleLabel="Open Procurement"
            onTab={() => onTabChange?.("mrs")}
            onModule={() => navigate("/procurement/pos")}
          />

          {/* Inventory */}
          <ModuleCard
            icon={Package2}
            title="Inventory"
            description="Material allocations & stock"
            status="neutral"
            onTabLabel={undefined}
            onModuleLabel="Open Inventory"
            onTab={undefined}
            onModule={() => navigate("/inventory/allocations")}
          />

          {/* Budget */}
          <ModuleCard
            icon={DollarSign}
            title="Budget"
            description={bg
              ? `₹${Number(bg.totalActual).toLocaleString("en-IN")} actual of ₹${Number(bg.totalBudgeted).toLocaleString("en-IN")}`
              : "No budget lines yet"}
            status={isOverBudget ? "attention" : "ok"}
            attentionLabel={isOverBudget ? "Over budget" : undefined}
            onTabLabel="View budget"
            onModuleLabel={undefined}
            onTab={() => onTabChange?.("budget")}
            onModule={undefined}
          />

          {/* Escalations / Approvals */}
          <ModuleCard
            icon={AlertTriangle}
            title="Escalations"
            description={openIssues > 0 ? `${openIssues} open issues` : "No open escalations"}
            status={openIssues > 0 ? "attention" : "ok"}
            attentionLabel={openIssues > 0 ? "Immediate attention needed" : undefined}
            onTabLabel={undefined}
            onModuleLabel="View escalations"
            onTab={undefined}
            onModule={() => navigate("/crm/escalations")}
          />
        </div>
      </SectionCard>

      {/* ── Detail panels ──────────────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
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
          {(dashboard as any)?.lastDPR ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">
                      {format(new Date((dashboard as any).lastDPR.reportDate), "MMM d, yyyy")}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Submitted by {(dashboard as any).lastDPR.submittedByName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Progress</p>
                  <p className="text-xl font-bold text-primary">{(dashboard as any).lastDPR.percentComplete || 0}%</p>
                </div>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg border border-border/60">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Work Summary</p>
                <p className="text-sm text-foreground leading-relaxed">
                  {(dashboard as any).lastDPR.workSummary || "No summary provided."}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState icon={Calendar} title="No DPRs submitted yet" size="sm" />
          )}
        </SectionCard>

        {/* Upcoming Milestones */}
        <SectionCard
          title="Upcoming Payment Milestones"
          actions={
            <button
              onClick={() => onTabChange?.("milestones")}
              className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
            >
              All milestones <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="space-y-3">
            {(dashboard as any)?.upcomingMilestones?.map((m: any) => (
              <div
                key={m.id}
                className="flex justify-between items-center p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div>
                  <p className="font-semibold text-sm text-foreground">{m.milestoneName}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                    Due: {m.dueDate ? format(new Date(m.dueDate), "MMM d, yyyy") : "No due date"}
                  </p>
                </div>
                <p className="font-bold text-foreground font-mono text-[15px]">
                  ₹{Number(m.amount).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
            {!(dashboard as any)?.upcomingMilestones?.length && (
              <EmptyState icon={CheckCircle2} title="No pending milestones" size="sm" />
            )}
          </div>
        </SectionCard>
      </div>
    </motion.div>
  );
}

/* ── Module connection card ─────────────────────────────────────────────────── */
function ModuleCard({
  icon: Icon,
  title,
  description,
  status,
  attentionLabel,
  onTabLabel,
  onModuleLabel,
  onTab,
  onModule,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  status: "ok" | "attention" | "neutral";
  attentionLabel?: string;
  onTabLabel?: string;
  onModuleLabel?: string;
  onTab?: () => void;
  onModule?: () => void;
}) {
  const borderColor =
    status === "attention" ? "border-amber-200 dark:border-amber-800" :
    status === "ok"        ? "border-emerald-200/60 dark:border-emerald-900/60" :
                             "border-border";
  const iconBg =
    status === "attention" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" :
    status === "ok"        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" :
                             "bg-muted text-muted-foreground";

  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-3 bg-card", borderColor)}>
      <div className="flex items-start gap-3">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground leading-tight">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
          {attentionLabel && (
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 uppercase tracking-wide">
              ⚠ {attentionLabel}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        {onTab && onTabLabel && (
          <button
            onClick={onTab}
            className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline"
          >
            {onTabLabel} <ChevronRight className="h-3 w-3" />
          </button>
        )}
        {onModule && onModuleLabel && (
          <button
            onClick={onModule}
            className={cn(
              "flex items-center gap-1 text-[11px] font-medium hover:underline",
              onTab ? "text-muted-foreground ml-auto" : "text-primary"
            )}
          >
            {onModuleLabel} <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
