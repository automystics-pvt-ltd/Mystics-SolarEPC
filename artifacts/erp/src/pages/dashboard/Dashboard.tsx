import { useState, useMemo } from "react";
import { useGetDashboard, useGetCombinedDashboard } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  FolderKanban,
  TrendingUp,
  CircleDollarSign,
  AlertCircle,
  ShoppingCart,
  Package,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  StatCard,
  SkeletonStats,
  SkeletonList,
} from "@/components/shared";
import { apiGet } from "@/lib/fetch";

import { SystemStatusBar } from "./components/SystemStatusBar";
import { AlertsPanel, AlertItem } from "./components/AlertsPanel";
import { QuickActionsGrid } from "./components/QuickActionsGrid";
import { ActivityFeed, ActivityItem } from "./components/ActivityFeed";
import { UpcomingTasksPanel, UpcomingItem } from "./components/UpcomingTasksPanel";
import { PerformanceMetrics } from "./components/PerformanceMetrics";
import { PipelineChart } from "./components/PipelineChart";
import { FinancialTrendChart } from "./components/FinancialTrendChart";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount?: number | null): string {
  if (!amount) return "₹0";
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)} L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}k`;
  return `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function getTimeOfDay(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function getFYBadge() {
  const today = new Date();
  const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return { fyStart, fyEndShort: String(fyStart + 1).slice(2) };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: dashboard, isLoading: d1 } = useGetDashboard();
  const { data: combined, isLoading: d2 } = useGetCombinedDashboard();
  const { data: procData, isLoading: d3 } = useQuery({
    queryKey: ["procurement-dashboard"],
    queryFn: () => apiGet<any>("/procurement-dashboard"),
  });

  const handleRefresh = () => {
    setLastRefresh(new Date());
    queryClient.invalidateQueries();
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const { fyStart, fyEndShort } = getFYBadge();
  const timeOfDay = getTimeOfDay();
  const firstName = (user as any)?.name?.split(" ")[0] ?? (user as any)?.email?.split("@")[0] ?? "there";

  const escalationCount = dashboard?.openEscalations?.length ?? 0;

  // Alerts
  const alerts: AlertItem[] = useMemo(() => {
    const list: AlertItem[] = [];
    if ((dashboard?.overdueTasksCount ?? 0) > 0) {
      list.push({
        id: "overdue",
        severity: "critical",
        title: `${dashboard!.overdueTasksCount} overdue tasks`,
        description: "Projects have past-due activities requiring immediate attention.",
        action: { label: "View Projects", href: "/projects" },
      });
    }
    if ((dashboard?.pendingApprovalsCount ?? 0) > 0) {
      list.push({
        id: "approvals",
        severity: "warning",
        title: `${dashboard!.pendingApprovalsCount} pending approvals`,
        description: "Quotations and invoices are awaiting sign-off.",
        action: { label: "View", href: "/procurement/quotations" },
      });
    }
    if (escalationCount > 0) {
      list.push({
        id: "escalations",
        severity: "critical",
        title: `${escalationCount} open escalations`,
        description: "Client escalations need resolution.",
        action: { label: "View Escalations", href: "/crm/escalations" },
      });
    }
    const pendingInvoiceCount = procData?.pendingInvoices?.length ?? 0;
    if (pendingInvoiceCount > 3) {
      list.push({
        id: "invoices",
        severity: "warning",
        title: `${pendingInvoiceCount} vendor invoices pending`,
        description: "Vendor invoices are awaiting 3-way match approval.",
      });
    }
    return list;
  }, [dashboard, procData, escalationCount]);

  // Activity feed
  const activityItems: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];

    (dashboard?.recentLeads ?? []).slice(0, 3).forEach((lead: any) => {
      items.push({
        id: `lead-${lead.id}`,
        type: "lead",
        title: lead.name ?? lead.companyName ?? "Lead",
        subtitle: lead.contactPerson ?? lead.email,
        timestamp: lead.createdAt ?? lead.updatedAt,
        status: lead.status,
        href: `/crm/leads/${lead.id}`,
      });
    });

    (dashboard?.recentProjects ?? []).slice(0, 3).forEach((project: any) => {
      items.push({
        id: `project-${project.id}`,
        type: "project",
        title: project.name ?? "Project",
        subtitle: project.client ?? project.clientName,
        timestamp: project.updatedAt ?? project.createdAt,
        status: project.status,
        href: `/projects/${project.id}`,
      });
    });

    (combined?.recentDPRs ?? []).slice(0, 3).forEach((dpr: any) => {
      items.push({
        id: `dpr-${dpr.id}`,
        type: "milestone",
        title: dpr.title ?? dpr.remarks ?? `DPR #${dpr.id}`,
        subtitle: dpr.projectName ?? dpr.project?.name,
        timestamp: dpr.date ?? dpr.createdAt,
        status: dpr.status,
        href: dpr.projectId ? `/projects/${dpr.projectId}` : undefined,
      });
    });

    return items.slice(0, 8);
  }, [dashboard, combined]);

  // Upcoming milestones
  const upcomingItems: UpcomingItem[] = useMemo(() => {
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    return (combined?.pendingMilestones ?? [])
      .map((m: any) => {
        const due = m.dueDate ?? m.targetDate ?? m.plannedDate;
        const dueDate = due ? new Date(due) : null;
        const overdue = dueDate ? dueDate < today : false;
        const inRange = !dueDate || dueDate <= thirtyDaysLater;
        return { m, dueDate, overdue, inRange };
      })
      .filter(({ inRange }: any) => inRange)
      .map(({ m, dueDate, overdue }: any) => ({
        id: m.id,
        title: m.title ?? m.name ?? `Milestone #${m.id}`,
        dueDate: dueDate ? dueDate.toISOString() : undefined,
        project: m.projectName ?? m.project?.name,
        type: "milestone" as const,
        overdue,
      }));
  }, [combined]);

  // Performance metrics
  const deliveryRate = useMemo(() => {
    const total = combined?.portfolioSummary?.totalProjects ?? 0;
    const completed = combined?.portfolioSummary?.completedProjects ?? 0;
    if (!total) return 0;
    return (completed / total) * 100;
  }, [combined]);

  const collectionRate = useMemo(() => {
    const outstanding = dashboard?.invoiceOutstanding ?? 0;
    const total = dashboard?.totalContractValue ?? 0;
    if (!total) return 0;
    const ratio = outstanding / total;
    return Math.max(0, Math.min(100, (1 - ratio) * 100));
  }, [dashboard]);

  const grnAcceptanceRate = useMemo(() => {
    const allGRNs: any[] = procData?.pendingGRNs ?? [];
    const allPOs: any[] = procData?.allPOs ?? [];
    // Derive from available data: approved GRNs are those in allPOs with status FullyReceived or PartiallyReceived
    const total = allGRNs.length + allPOs.filter((p: any) => p.status === "FullyReceived").length;
    const approved = allPOs.filter(
      (p: any) => p.status === "FullyReceived" || p.status === "PartiallyReceived"
    ).length;
    if (!total) return 0;
    return Math.min(100, (approved / total) * 100);
  }, [procData]);

  // Open POs count
  const openPOsCount =
    procData?.allPOs?.filter(
      (p: any) => p.status === "Approved" || p.status === "PartiallyReceived"
    ).length ?? 0;

  // ── Loading state ─────────────────────────────────────────────────────────

  if (d1 && d2 && d3) {
    return (
      <div className="space-y-6">
        <SkeletonStats count={6} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SkeletonList rows={5} />
          </div>
          <SkeletonList rows={4} />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-10"
    >
      {/* Header */}
      <PageHeader
        title={`Good ${timeOfDay}, ${firstName}`}
        subtitle="Executive overview — Mystics ERP"
        badge={
          <Badge variant="outline" className="font-mono text-xs">
            FY {fyStart}–{fyEndShort}
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {/* System status bar */}
      <SystemStatusBar lastRefresh={lastRefresh} />

      {/* KPI cards — 6 across */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0 * 0.05 }}
        >
          <StatCard
            label="Active Projects"
            value={dashboard?.activeProjectsCount ?? 0}
            icon={FolderKanban}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            trend="up"
            trendLabel="Running"
            onClick={() => setLocation("/projects")}
            compact
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 1 * 0.05 }}
        >
          <StatCard
            label="Contract Value"
            value={formatCurrency(dashboard?.totalContractValue)}
            icon={TrendingUp}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            trend="up"
            trendLabel="Total pipeline"
            compact
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 2 * 0.05 }}
        >
          <StatCard
            label="A/R Outstanding"
            value={formatCurrency(dashboard?.invoiceOutstanding)}
            icon={CircleDollarSign}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            trend="neutral"
            trendLabel="Receivables"
            onClick={() => setLocation("/finance/dashboard")}
            compact
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 3 * 0.05 }}
        >
          <StatCard
            label="Open Escalations"
            value={escalationCount}
            icon={AlertCircle}
            iconBg={escalationCount > 0 ? "bg-red-50" : "bg-muted"}
            iconColor={escalationCount > 0 ? "text-red-500" : "text-muted-foreground"}
            trend={escalationCount > 0 ? "down" : "neutral"}
            trendLabel="Client issues"
            onClick={() => setLocation("/crm/escalations")}
            compact
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 4 * 0.05 }}
        >
          <StatCard
            label="Open POs"
            value={openPOsCount}
            icon={ShoppingCart}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
            trend="neutral"
            trendLabel="Purchase orders"
            onClick={() => setLocation("/procurement/pos")}
            compact
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 5 * 0.05 }}
        >
          <StatCard
            label="Pending GRNs"
            value={procData?.pendingGRNs?.length ?? 0}
            icon={Package}
            iconBg="bg-cyan-50"
            iconColor="text-cyan-600"
            trend="neutral"
            trendLabel="Awaiting receipt"
            onClick={() => setLocation("/procurement/grns")}
            compact
          />
        </motion.div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && <AlertsPanel alerts={alerts} />}

      {/* Pipeline + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PipelineChart
            stages={(combined?.pipeline?.stages ?? []).map((s) => ({
              name: s.stage,
              count: s.count,
              value: s.value,
            }))}
            isLoading={d2}
          />
        </div>
        <QuickActionsGrid />
      </div>

      {/* Financial trend — full width */}
      <FinancialTrendChart />

      {/* Activity feed + Upcoming tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <ActivityFeed items={activityItems} isLoading={d1 || d2} />
        </div>
        <div className="lg:col-span-2">
          <UpcomingTasksPanel items={upcomingItems} isLoading={d2} />
        </div>
      </div>

      {/* Performance metrics */}
      <PerformanceMetrics
        deliveryRate={deliveryRate}
        collectionRate={collectionRate}
        grnAcceptanceRate={grnAcceptanceRate}
        isLoading={d1 || d2 || d3}
      />
    </motion.div>
  );
}
