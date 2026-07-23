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
  ShoppingCart,
  Package,
  Ticket,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StatCard,
  SectionCard,
  SkeletonStats,
  SkeletonList,
} from "@/components/shared";
import { apiGet } from "@/lib/fetch";
import { cn } from "@/lib/utils";

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

function getFYLabel(): string {
  const today = new Date();
  const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `FY ${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`;
}

// ─── Greeting Bar ─────────────────────────────────────────────────────────────

interface GreetingBarProps {
  name: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function GreetingBar({ name, isRefreshing, onRefresh }: GreetingBarProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-card border border-border rounded-xl px-5 py-3.5 flex items-center justify-between gap-4">
      {/* Left: greeting */}
      <div className="min-w-0">
        <p className="text-lg font-bold text-foreground leading-tight">
          {greeting}, {name} 👋
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
      </div>

      {/* Right: FY pill + refresh */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-full px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
          <span className="text-[12px] font-semibold text-orange-700 dark:text-orange-400">
            {getFYLabel()}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="gap-1.5 h-8"
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
    </div>
  );
}

// ─── Action Required Panel ────────────────────────────────────────────────────

interface ActionItem {
  id: string;
  icon: typeof ShoppingCart;
  iconColor: string;
  title: string;
  entityRef?: string;
  time?: string;
  href?: string;
  severity: "critical" | "warning";
}

interface ActionRequiredPanelProps {
  items: ActionItem[];
  isLoading?: boolean;
}

function ActionRequiredPanel({ items, isLoading }: ActionRequiredPanelProps) {
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <SectionCard title="Action Required" subtitle="Items needing immediate attention">
        <SkeletonList rows={4} cols={3} className="border-0 rounded-none" />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Action Required" subtitle="Items needing immediate attention">
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-8 text-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-500 opacity-70" />
          <div>
            <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
              All caught up
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              No urgent items require your attention right now.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border/50 -mx-5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 transition-colors",
                  item.href && "cursor-pointer hover:bg-muted/40",
                  item.severity === "critical"
                    ? "border-l-[3px] border-l-red-500 ml-0"
                    : "border-l-[3px] border-l-amber-400 ml-0"
                )}
                onClick={() => item.href && setLocation(item.href)}
                role={item.href ? "button" : undefined}
                tabIndex={item.href ? 0 : undefined}
                onKeyDown={(e) => {
                  if (item.href && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setLocation(item.href);
                  }
                }}
              >
                <div
                  className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                    item.severity === "critical"
                      ? "bg-red-50 dark:bg-red-950/40"
                      : "bg-amber-50 dark:bg-amber-950/40"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", item.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground leading-snug">
                    {item.title}
                    {item.entityRef && (
                      <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                        {item.entityRef}
                      </span>
                    )}
                  </p>
                </div>
                {item.time && (
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    {item.time}
                  </span>
                )}
                {item.href && (
                  <span className="text-muted-foreground/40 text-[13px] shrink-0">→</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: dashboard, isLoading: d1 } = useGetDashboard();
  const { data: combined, isLoading: d2 } = useGetCombinedDashboard();
  const { data: procData, isLoading: d3 } = useQuery({
    queryKey: ["procurement-dashboard"],
    queryFn: () => apiGet<any>("/procurement-dashboard"),
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLastRefresh(new Date());
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const firstName =
    (user as any)?.name?.split(" ")[0] ??
    (user as any)?.email?.split("@")[0] ??
    "there";

  const escalationCount = dashboard?.openEscalations?.length ?? 0;

  // KPI: Revenue pipeline (sum of lead values in active stages)
  const revenuePipeline = useMemo(() => {
    const pipelineStages = combined?.pipeline?.stages ?? [];
    const activeStages = ["New", "Contacted", "Qualified", "Proposal", "Negotiation"];
    return pipelineStages
      .filter((s: any) => activeStages.includes(s.stage ?? s.name ?? ""))
      .reduce((sum: number, s: any) => sum + (Number(s.value) || 0), 0);
  }, [combined]);

  // KPI: POs pending approval
  const posPendingApproval = useMemo(() => {
    return (
      procData?.allPOs?.filter((p: any) => p.status === "Pending" || p.status === "Submitted")
        .length ?? 0
    );
  }, [procData]);

  // KPI: Collection rate
  const collectionRate = useMemo(() => {
    const outstanding = dashboard?.invoiceOutstanding ?? 0;
    const total = dashboard?.totalContractValue ?? 0;
    if (!total) return 0;
    const ratio = outstanding / total;
    return Math.max(0, Math.min(100, (1 - ratio) * 100));
  }, [dashboard]);

  // KPI: GRNs this month
  const grnsThisMonth = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return (
      procData?.pendingGRNs?.filter((g: any) => {
        if (!g.createdAt) return true; // include if no date
        const d = new Date(g.createdAt);
        return d.getMonth() === month && d.getFullYear() === year;
      }).length ?? procData?.pendingGRNs?.length ?? 0
    );
  }, [procData]);

  // KPI: Open service tickets (use escalations as proxy)
  const openTickets = escalationCount;

  // ── Action Required items ────────────────────────────────────────────────
  const actionItems: ActionItem[] = useMemo(() => {
    const list: ActionItem[] = [];

    // Overdue POs (past delivery date, not received)
    const overduePOs =
      procData?.allPOs?.filter((p: any) => {
        if (p.status === "FullyReceived" || p.status === "Cancelled") return false;
        if (!p.expectedDelivery) return false;
        return new Date(p.expectedDelivery) < new Date();
      }) ?? [];
    overduePOs.slice(0, 3).forEach((po: any) => {
      list.push({
        id: `po-${po.id}`,
        icon: ShoppingCart,
        iconColor: "text-red-500",
        severity: "critical",
        title: `Overdue PO — delivery date passed`,
        entityRef: po.poNumber ?? `PO-${po.id}`,
        href: `/procurement/pos/${po.id}`,
        time: po.expectedDelivery
          ? new Date(po.expectedDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
          : undefined,
      });
    });

    // Invoices with mismatch flagged
    const mismatchInvoices =
      procData?.pendingInvoices?.filter((inv: any) => inv.status === "MismatchFlagged") ?? [];
    mismatchInvoices.slice(0, 3).forEach((inv: any) => {
      list.push({
        id: `inv-${inv.id}`,
        icon: CircleDollarSign,
        iconColor: "text-amber-500",
        severity: "warning",
        title: `Invoice mismatch requires sign-off`,
        entityRef: inv.invoiceNumber ?? `INV-${inv.id}`,
        href: `/procurement/invoices/${inv.id}`,
      });
    });

    // Leads with no activity in 14+ days
    const staleLeads = (dashboard?.recentLeads ?? []).filter((lead: any) => {
      const updated = lead.updatedAt ?? lead.createdAt;
      if (!updated) return false;
      const daysSince = (Date.now() - new Date(updated).getTime()) / 86_400_000;
      return (
        daysSince >= 14 &&
        !["Won", "Closed", "Lost"].includes(lead.status ?? "")
      );
    });
    staleLeads.slice(0, 2).forEach((lead: any) => {
      const days = Math.floor(
        (Date.now() - new Date(lead.updatedAt ?? lead.createdAt).getTime()) / 86_400_000
      );
      list.push({
        id: `lead-stale-${lead.id}`,
        icon: TrendingUp,
        iconColor: "text-blue-500",
        severity: "warning",
        title: `Lead inactive for ${days} days`,
        entityRef: lead.companyName ?? lead.name,
        href: `/crm/leads/${lead.id}`,
      });
    });

    // Critical/High escalations
    const criticalEscalations = (dashboard?.openEscalations ?? []).filter(
      (e: any) => e.severity === "Critical" || e.severity === "High"
    );
    criticalEscalations.slice(0, 2).forEach((esc: any) => {
      list.push({
        id: `esc-${esc.id}`,
        icon: Ticket,
        iconColor: "text-red-500",
        severity: "critical",
        title: `${esc.severity} escalation — ${esc.reason ?? "unresolved"}`,
        entityRef: `ESC-${esc.id}`,
        href: `/crm/escalations/${esc.id}`,
      });
    });

    return list;
  }, [dashboard, procData]);

  // ── Activity Feed ────────────────────────────────────────────────────────
  const activityItems: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];

    (dashboard?.recentLeads ?? []).slice(0, 4).forEach((lead: any) => {
      items.push({
        id: `lead-${lead.id}`,
        type: "lead",
        actor: lead.ownerName ?? "Sales",
        title: `updated lead — ${lead.companyName ?? lead.contactName ?? "Lead"}`,
        subtitle: lead.status ? `Status: ${lead.status}` : undefined,
        timestamp: lead.createdAt ?? lead.updatedAt,
        status: lead.status,
        href: `/crm/leads/${lead.id}`,
      });
    });

    (dashboard?.recentProjects ?? []).slice(0, 3).forEach((project: any) => {
      items.push({
        id: `project-${project.id}`,
        type: "project",
        actor: project.pmOwnerName ?? "PM",
        title: `updated project — ${project.name ?? "Project"}`,
        subtitle: project.siteLocation ?? project.clientName,
        timestamp: project.updatedAt ?? project.createdAt,
        status: project.status,
        href: `/projects/${project.id}`,
      });
    });

    (combined?.recentDPRs ?? []).slice(0, 3).forEach((dpr: any) => {
      items.push({
        id: `dpr-${dpr.id}`,
        type: "milestone",
        actor: "Site Team",
        title: `submitted DPR — ${dpr.title ?? dpr.remarks ?? `#${dpr.id}`}`,
        subtitle: dpr.projectName ?? dpr.project?.name,
        timestamp: dpr.date ?? dpr.createdAt,
        status: dpr.status,
        href: dpr.projectId ? `/projects/${dpr.projectId}` : undefined,
      });
    });

    // Sort by timestamp descending
    return items
      .sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })
      .slice(0, 10);
  }, [dashboard, combined]);

  // ── Upcoming milestones ──────────────────────────────────────────────────
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
        title: m.milestoneName ?? m.title ?? m.name ?? `Milestone #${m.id}`,
        dueDate: dueDate ? dueDate.toISOString() : undefined,
        project: m.projectName ?? m.project?.name,
        type: "milestone" as const,
        overdue,
      }));
  }, [combined]);

  // ── Performance metrics ──────────────────────────────────────────────────
  const deliveryRate = useMemo(() => {
    const total = combined?.portfolioSummary?.totalProjects ?? 0;
    const completed = combined?.portfolioSummary?.completedProjects ?? 0;
    if (!total) return 0;
    return (completed / total) * 100;
  }, [combined]);

  const grnAcceptanceRate = useMemo(() => {
    const allGRNs: any[] = procData?.pendingGRNs ?? [];
    const allPOs: any[] = procData?.allPOs ?? [];
    const total = allGRNs.length + allPOs.filter((p: any) => p.status === "FullyReceived").length;
    const approved = allPOs.filter(
      (p: any) => p.status === "FullyReceived" || p.status === "PartiallyReceived"
    ).length;
    if (!total) return 0;
    return Math.min(100, (approved / total) * 100);
  }, [procData]);

  // Open POs count (for quick nav badge)
  const openPOsCount =
    procData?.allPOs?.filter(
      (p: any) => p.status === "Approved" || p.status === "PartiallyReceived"
    ).length ?? 0;

  // ── Loading state ─────────────────────────────────────────────────────────

  if (d1 && d2 && d3) {
    return (
      <div className="space-y-6 pb-10">
        <div className="bg-card border border-border rounded-xl px-5 py-3.5 h-[72px] animate-pulse" />
        <SkeletonStats count={6} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonList rows={5} />
          <SkeletonList rows={5} />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 pb-10"
    >
      {/* ① Personalised greeting bar */}
      <GreetingBar
        name={firstName}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {/* System status sub-bar */}
      <SystemStatusBar lastRefresh={lastRefresh} isRefreshing={isRefreshing} />

      {/* ② KPI cards — 6 across */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: "Active Projects",
            value: dashboard?.activeProjectsCount ?? 0,
            icon: FolderKanban,
            iconBg: "bg-blue-50 dark:bg-blue-950/40",
            iconColor: "text-blue-600 dark:text-blue-400",
            trend: "up" as const,
            trendLabel: "In progress",
            href: "/projects",
          },
          {
            label: "Revenue Pipeline",
            value: formatCurrency(revenuePipeline),
            icon: TrendingUp,
            iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            trend: "up" as const,
            trendLabel: "Active stages",
          },
          {
            label: "POs Pending Approval",
            value: posPendingApproval,
            icon: ShoppingCart,
            iconBg:
              posPendingApproval > 5
                ? "bg-red-50 dark:bg-red-950/40"
                : posPendingApproval > 0
                ? "bg-amber-50 dark:bg-amber-950/40"
                : "bg-muted",
            iconColor:
              posPendingApproval > 5
                ? "text-red-500"
                : posPendingApproval > 0
                ? "text-amber-500"
                : "text-muted-foreground",
            trend: posPendingApproval > 5 ? ("down" as const) : ("neutral" as const),
            trendLabel: posPendingApproval > 5 ? "Urgent" : "Awaiting sign-off",
            href: "/procurement/pos",
          },
          {
            label: "Collection Rate",
            value: `${collectionRate.toFixed(1)}%`,
            icon: CircleDollarSign,
            iconBg:
              collectionRate >= 80
                ? "bg-emerald-50 dark:bg-emerald-950/40"
                : "bg-amber-50 dark:bg-amber-950/40",
            iconColor:
              collectionRate >= 80
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-500",
            trend: collectionRate >= 80 ? ("up" as const) : ("neutral" as const),
            trendLabel: "AR collected",
            href: "/finance/dashboard",
          },
          {
            label: "GRNs This Month",
            value: grnsThisMonth,
            icon: Package,
            iconBg: "bg-violet-50 dark:bg-violet-950/40",
            iconColor: "text-violet-600 dark:text-violet-400",
            trend: "neutral" as const,
            trendLabel: "Receipts recorded",
            href: "/procurement/grns",
          },
          {
            label: "Open Tickets",
            value: openTickets,
            icon: Ticket,
            iconBg:
              openTickets > 0
                ? "bg-red-50 dark:bg-red-950/40"
                : "bg-muted",
            iconColor:
              openTickets > 0 ? "text-red-500" : "text-muted-foreground",
            trend: openTickets > 0 ? ("down" as const) : ("neutral" as const),
            trendLabel: openTickets > 0 ? "Need resolution" : "All resolved",
            href: "/crm/escalations",
          },
        ].map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
          >
            <StatCard
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              iconBg={kpi.iconBg}
              iconColor={kpi.iconColor}
              trend={kpi.trend}
              trendLabel={kpi.trendLabel}
              onClick={kpi.href ? () => setLocation(kpi.href!) : undefined}
              compact
            />
          </motion.div>
        ))}
      </div>

      {/* ③ Action Required + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActionRequiredPanel items={actionItems} isLoading={d1 || d2 || d3} />
        <ActivityFeed items={activityItems} isLoading={d1 || d2} />
      </div>

      {/* ④ Pipeline Funnel + Financial Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PipelineChart
          stages={(combined?.pipeline?.stages ?? []).map((s) => ({
            name: s.stage,
            count: s.count,
            value: s.value,
          }))}
          isLoading={d2}
        />
        <FinancialTrendChart />
      </div>

      {/* ⑤ Quick Actions grid — full width row */}
      <QuickActionsGrid />

      {/* ⑥ Activity + Upcoming milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <UpcomingTasksPanel items={upcomingItems} isLoading={d2} />
        </div>
        <div className="lg:col-span-2">
          <PerformanceMetrics
            deliveryRate={deliveryRate}
            collectionRate={collectionRate}
            grnAcceptanceRate={grnAcceptanceRate}
            isLoading={d1 || d2 || d3}
          />
        </div>
      </div>
    </motion.div>
  );
}
