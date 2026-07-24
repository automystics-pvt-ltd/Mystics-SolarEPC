import { useGetProjectDashboard, getGetProjectDashboardQueryKey } from "@workspace/api-client-react";
import { TrendingUp, AlertTriangle, FileCheck, ClipboardCheck, Calendar, CheckCircle2, Target, ShieldCheck, Layers } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { SectionCard, StatCard, EmptyState, SkeletonStats } from "@/components/shared";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";

export function ProjectOverview({ projectId }: { projectId: number }) {
  const { data: dashboard, isLoading } = useGetProjectDashboard(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectDashboardQueryKey(projectId) }
  });

  // Weighted milestone completion from execution milestones
  const { data: milestoneData } = useQuery<{ overallCompletionPct: number }>({
    queryKey: ["milestones-critical-path", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/milestones/critical-path`),
    enabled: !!projectId,
  });
  const overallPct = milestoneData?.overallCompletionPct ?? 0;

  // Warranty status (active vs expiring)
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
  const warrantyActive = allWarranty.filter(w => w.status === "Active").length;
  const warrantyExpiring = expiringWarranty.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonStats count={4} />
      </div>
    );
  }

  const bg = dashboard?.budgetSummary;
  const isOverBudget = bg ? bg.totalVariance > 0 : false;
  const health = bg ? (isOverBudget ? "Over Budget" : "On Budget") : "Unknown";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          trendLabel={`${health} (Var: ₹${Math.abs(bg?.totalVariance || 0).toLocaleString("en-IN")})`}
          className={isOverBudget ? "border-red-200 bg-red-50/40" : "border-emerald-200 bg-emerald-50/40"}
        />
        <StatCard
          label="Open Issues"
          value={dashboard?.openEscalationsCount || 0}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-100"
          trendLabel="Require immediate attention"
          className={dashboard?.openEscalationsCount ? "border-red-200" : undefined}
        />
        <StatCard
          label="Material Pipeline"
          value={`${dashboard?.openMRsCount || 0} MR · ${dashboard?.pendingPOsCount || 0} PO`}
          icon={Layers}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
          trendLabel="Open material requests & purchase orders"
        />
        <StatCard
          label="Warranty Status"
          value={allWarranty.length === 0 ? "—" : `${warrantyActive} active`}
          icon={ShieldCheck}
          iconColor={warrantyExpiring > 0 ? "text-amber-600" : "text-emerald-600"}
          iconBg={warrantyExpiring > 0 ? "bg-amber-100" : "bg-emerald-100"}
          trendLabel={warrantyExpiring > 0 ? `${warrantyExpiring} expiring within 90 days` : allWarranty.length === 0 ? "No components tracked" : "All components healthy"}
          className={warrantyExpiring > 0 ? "border-amber-200 bg-amber-50/30" : undefined}
        />
      </div>

      {/* Detail panels */}
      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard title="Last Daily Progress Report (DPR)">
          {dashboard?.lastDPR ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">
                      {format(new Date(dashboard.lastDPR.reportDate), "MMM d, yyyy")}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Submitted by {dashboard.lastDPR.submittedByName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Progress</p>
                  <p className="text-xl font-bold text-primary">{dashboard.lastDPR.percentComplete || 0}%</p>
                </div>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg border border-border/60">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Work Summary</p>
                <p className="text-sm text-foreground leading-relaxed">
                  {dashboard.lastDPR.workSummary || "No summary provided."}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Calendar}
              title="No DPRs submitted yet"
              size="sm"
            />
          )}
        </SectionCard>

        <SectionCard title="Upcoming Milestones">
          <div className="space-y-3">
            {dashboard?.upcomingMilestones?.map(m => (
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
                <div className="text-right">
                  <p className="font-bold text-foreground font-mono text-[15px]">
                    ₹{Number(m.amount).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            ))}
            {!dashboard?.upcomingMilestones?.length && (
              <EmptyState
                icon={CheckCircle2}
                title="No pending milestones"
                size="sm"
              />
            )}
          </div>
        </SectionCard>
      </div>
    </motion.div>
  );
}
