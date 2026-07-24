/**
 * Dashboard — Executive ERP Command Center
 *
 * Layout (desktop):
 *   [Welcome Bar — full width]
 *   [KPI Row — 5 cards]
 *   [Left 2/3: Action Required → My Tasks → Quick Actions]   [Right 1/3: Alerts → Recently Accessed → Favorites → Activity]
 *   [Analytics Row — Pipeline + Financial charts]
 *   [System Health strip]
 *
 * Personalization: show/hide widgets stored in localStorage["mystics_dashboard_prefs"].
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { useGetDashboard, useGetCombinedDashboard } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  RefreshCw, Settings2, CheckCircle2, ShoppingCart,
  CircleDollarSign, TrendingUp, Ticket, X, Eye, EyeOff,
  Clock, Flame, Users2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { SectionCard, SkeletonStats, SkeletonList } from "@/components/shared";
import { apiGet } from "@/lib/fetch";
import { cn } from "@/lib/utils";

// Sub-components
import { SystemStatusBar } from "./components/SystemStatusBar";
import { AlertsPanel, AlertItem } from "./components/AlertsPanel";
import { QuickActionsGrid } from "./components/QuickActionsGrid";
import { ActivityFeed, ActivityItem } from "./components/ActivityFeed";
import { UpcomingTasksPanel, UpcomingItem } from "./components/UpcomingTasksPanel";
import { PipelineChart } from "./components/PipelineChart";
import { FinancialTrendChart } from "./components/FinancialTrendChart";
import { KPIRow, KPIData, buildKPICards } from "./components/KPIRow";
import { RecentlyAccessed } from "./components/RecentlyAccessed";
import { FavoriteModules } from "./components/FavoriteModules";
import { formatINRCompact } from "@/lib/currency";

/* ════════════════════════════════════════════════════════════════
   Helpers
════════════════════════════════════════════════════════════════ */
// formatCurrency imported from @/lib/currency as formatINRCompact

function getFYLabel(): string {
  const today = new Date();
  const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `FY ${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`;
}

function getGreeting(name: string): { greeting: string; date: string } {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const date = new Date().toLocaleDateString("en-IN", {
    weekday: "long", month: "long", day: "numeric",
  });
  return { greeting: `${greeting}, ${name}`, date };
}

/* ════════════════════════════════════════════════════════════════
   Widget personalization
════════════════════════════════════════════════════════════════ */
type WidgetId =
  | "kpis" | "action_required" | "my_tasks" | "quick_actions"
  | "alerts" | "recently_accessed" | "favorites" | "activity"
  | "analytics" | "system_health";

const WIDGET_DEFS: { id: WidgetId; label: string; description: string }[] = [
  { id: "kpis",             label: "KPI Cards",          description: "Key performance indicators at a glance" },
  { id: "action_required",  label: "Action Required",    description: "Items needing immediate attention" },
  { id: "alerts",           label: "Alerts & Exceptions",description: "Critical warnings and system alerts" },
  { id: "my_tasks",         label: "My Tasks",           description: "Upcoming milestones and deadlines" },
  { id: "quick_actions",    label: "Quick Actions",      description: "Role-based shortcut buttons" },
  { id: "recently_accessed",label: "Recently Accessed",  description: "Your last visited pages" },
  { id: "favorites",        label: "Favorites",          description: "Pages you've pinned in the nav rail" },
  { id: "activity",         label: "Activity Feed",      description: "Real-time events across all modules" },
  { id: "analytics",        label: "Analytics Charts",   description: "Pipeline funnel and financial trend charts" },
  { id: "system_health",    label: "System Health",      description: "Live status of all ERP services" },
];

const PREFS_KEY = "mystics_dashboard_prefs";

function useDashboardPrefs() {
  const [hidden, setHidden] = useState<Set<WidgetId>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "[]") as WidgetId[];
      return new Set(raw);
    } catch { return new Set(); }
  });

  const toggle = useCallback((id: WidgetId) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(PREFS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setHidden(new Set());
    localStorage.removeItem(PREFS_KEY);
  }, []);

  const show = useCallback((id: WidgetId) => !hidden.has(id), [hidden]);

  return { hidden, toggle, reset, show };
}

/* ════════════════════════════════════════════════════════════════
   Welcome Bar
════════════════════════════════════════════════════════════════ */
interface WelcomeBarProps {
  name: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onCustomize: () => void;
  openEscalations: number;
  activeLeads: number;
}

function WelcomeBar({ name, isRefreshing, onRefresh, onCustomize, openEscalations, activeLeads }: WelcomeBarProps) {
  const { greeting, date } = getGreeting(name);

  // Live IST clock — updates every minute
  const [istTime, setIstTime] = useState(() =>
    new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })
  );
  useEffect(() => {
    const tick = () =>
      setIstTime(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }));
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const pulseChips = [
    {
      icon: Clock,
      label: "IST",
      value: istTime,
      colorClass: "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300",
      iconClass: "text-slate-500",
    },
    {
      icon: Users2,
      label: "Active Leads",
      value: activeLeads,
      colorClass: activeLeads > 0
        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
        : "bg-muted/40 border-border text-muted-foreground",
      iconClass: activeLeads > 0 ? "text-blue-500" : "text-muted-foreground",
    },
    {
      icon: Flame,
      label: "Open Escalations",
      value: openEscalations,
      colorClass: openEscalations > 0
        ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        : "bg-muted/40 border-border text-muted-foreground",
      iconClass: openEscalations > 0 ? "text-red-500" : "text-muted-foreground",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        {/* Left: greeting */}
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold text-foreground leading-tight tracking-tight">
            {greeting} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{date}</p>
        </div>

        {/* Centre: live pulse chips */}
        <div className="hidden md:flex items-center gap-2">
          {pulseChips.map((chip) => {
            const Icon = chip.icon;
            return (
              <div
                key={chip.label}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium select-none",
                  chip.colorClass
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", chip.iconClass)} />
                <span className="tabular-nums font-semibold">{chip.value}</span>
                <span className="text-[11px] opacity-70">{chip.label}</span>
              </div>
            );
          })}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={onCustomize} className="gap-1.5 h-8 text-muted-foreground hover:text-foreground">
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-[13px]">Customize</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5 h-8" disabled={isRefreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline text-[13px]">Refresh</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Action Required Panel
════════════════════════════════════════════════════════════════ */
interface ActionItem {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  entityRef?: string;
  time?: string;
  href?: string;
  severity: "critical" | "warning";
}

function ActionRequiredPanel({ items, isLoading }: { items: ActionItem[]; isLoading?: boolean }) {
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
        <div className="flex flex-col items-center gap-2 py-7 text-center">
          <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">All caught up</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">No urgent items right now.</p>
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
                  "flex items-center gap-3 px-5 py-3 transition-colors border-l-[3px]",
                  item.severity === "critical" ? "border-l-red-500 hover:bg-red-50/30 dark:hover:bg-red-950/10" : "border-l-amber-400 hover:bg-amber-50/30 dark:hover:bg-amber-950/10",
                  item.href && "cursor-pointer"
                )}
                onClick={() => item.href && setLocation(item.href)}
                role={item.href ? "button" : undefined}
                tabIndex={item.href ? 0 : undefined}
                onKeyDown={(e) => { if (item.href && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setLocation(item.href); } }}
              >
                <div className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                  item.severity === "critical" ? "bg-red-50 dark:bg-red-950/40" : "bg-amber-50 dark:bg-amber-950/40"
                )}>
                  <Icon className={cn("h-3.5 w-3.5", item.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground leading-snug">
                    {item.title}
                    {item.entityRef && (
                      <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{item.entityRef}</span>
                    )}
                  </p>
                </div>
                {item.time && <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{item.time}</span>}
                {item.href && <span className="text-muted-foreground/40 text-[13px] shrink-0">→</span>}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

/* ════════════════════════════════════════════════════════════════
   Widget Customize Sheet
════════════════════════════════════════════════════════════════ */
function CustomizeSheet({
  open,
  onClose,
  hidden,
  onToggle,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  hidden: Set<WidgetId>;
  onToggle: (id: WidgetId) => void;
  onReset: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-80 p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[15px]">Customize Dashboard</SheetTitle>
            <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1 text-left">
            Choose which widgets to display. Changes save automatically.
          </p>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {WIDGET_DEFS.map((w) => {
            const isVisible = !hidden.has(w.id);
            return (
              <div key={w.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn("h-6 w-6 rounded-md flex items-center justify-center shrink-0", isVisible ? "bg-primary/10" : "bg-muted")}>
                    {isVisible
                      ? <Eye className="h-3.5 w-3.5 text-primary" />
                      : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground">{w.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{w.description}</p>
                  </div>
                </div>
                <Switch
                  checked={isVisible}
                  onCheckedChange={() => onToggle(w.id)}
                  className="shrink-0 ml-3"
                />
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-border">
          <Button variant="outline" size="sm" className="w-full" onClick={onReset}>
            Reset to defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════
   Dashboard — main component
════════════════════════════════════════════════════════════════ */
export function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const { show, hidden, toggle, reset } = useDashboardPrefs();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: dashboard, isPending, isLoading: d1 } = useGetDashboard();
  const { data: combined, isLoading: d2 } = useGetCombinedDashboard();
  const { data: procData, isLoading: d3 } = useQuery({
    queryKey: ["procurement-dashboard"],
    queryFn: () => apiGet<any>("/procurement-dashboard"),
  });

  const isLoading = d1 || d2 || d3;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLastRefresh(new Date());
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const firstName =
    (user as any)?.name?.split(" ")[0] ??
    (user as any)?.email?.split("@")[0] ??
    "there";

  const role = (user as any)?.role ?? "";

  // KPI data
  const kpiData: KPIData = useMemo(() => {
    const pipelineStages = combined?.pipeline?.stages ?? combined?.pipeline ?? [];
    const activeStageNames = ["New", "Contacted", "Qualified", "Proposal", "Negotiation"];
    const revenuePipeline = Array.isArray(pipelineStages)
      ? pipelineStages
          .filter((s: any) => activeStageNames.includes(s.stage ?? s.name ?? ""))
          .reduce((sum: number, s: any) => sum + (Number(s.value ?? s.totalValue) || 0), 0)
      : 0;

    const pendingGRNs = procData?.pendingGRNs?.length ?? 0;
    const pendingInvoices = procData?.pendingInvoices?.filter(
      (i: any) => i.status === "PendingApproval" || i.status === "Submitted"
    ).length ?? 0;

    const draftPOs = (procData?.poStatusCounts ?? []).find(
      (s: any) => s.status === "Draft"
    )?.count ?? 0;

    return {
      activeProjects:    combined?.portfolioSummary?.activeProjects ?? dashboard?.activeProjectsCount ?? 0,
      revenuePipeline,
      pendingApprovals:  pendingGRNs + pendingInvoices,
      overdueTaskCount:  dashboard?.overdueTasksCount ?? 0,
      draftPOs,
    };
  }, [dashboard, combined, procData]);

  const kpiCards = useMemo(() => buildKPICards(kpiData), [kpiData]);

  // Action Required items
  const actionItems: ActionItem[] = useMemo(() => {
    const list: ActionItem[] = [];

    // Overdue POs
    const overduePOs = (procData?.allPOs ?? []).filter((p: any) => {
      if (["FullyReceived", "Cancelled"].includes(p.status ?? "")) return false;
      if (!p.expectedDelivery) return false;
      return new Date(p.expectedDelivery) < new Date();
    });
    overduePOs.slice(0, 3).forEach((po: any) => {
      list.push({
        id: `po-${po.id}`, icon: ShoppingCart, iconColor: "text-red-500", severity: "critical",
        title: "Overdue PO — delivery date passed",
        entityRef: po.poNumber ?? `PO-${po.id}`,
        href: `/procurement/pos/${po.id}`,
        time: po.expectedDelivery
          ? new Date(po.expectedDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
          : undefined,
      });
    });

    // Invoices with mismatch
    const mismatchInvoices = (procData?.pendingInvoices ?? []).filter(
      (inv: any) => inv.status === "MismatchFlagged"
    );
    mismatchInvoices.slice(0, 3).forEach((inv: any) => {
      list.push({
        id: `inv-${inv.id}`, icon: CircleDollarSign, iconColor: "text-amber-500", severity: "warning",
        title: "Invoice mismatch requires sign-off",
        entityRef: inv.invoiceNumber ?? `INV-${inv.id}`,
        href: `/procurement/invoices/${inv.id}`,
      });
    });

    // Stale leads
    const staleLeads = (dashboard?.recentLeads ?? []).filter((lead: any) => {
      const updated = lead.updatedAt ?? lead.createdAt;
      if (!updated) return false;
      const days = (Date.now() - new Date(updated).getTime()) / 86_400_000;
      return days >= 14 && !["Won", "Closed", "Lost"].includes(lead.status ?? "");
    });
    staleLeads.slice(0, 2).forEach((lead: any) => {
      const days = Math.floor((Date.now() - new Date(lead.updatedAt ?? lead.createdAt).getTime()) / 86_400_000);
      list.push({
        id: `lead-stale-${lead.id}`, icon: TrendingUp, iconColor: "text-blue-500", severity: "warning",
        title: `Lead inactive for ${days} days`,
        entityRef: lead.companyName ?? lead.name,
        href: `/crm/leads/${lead.id}`,
      });
    });

    // Critical escalations
    const critEscalations = (dashboard?.openEscalations ?? []).filter(
      (e: any) => e.severity === "Critical" || e.severity === "High"
    );
    critEscalations.slice(0, 2).forEach((esc: any) => {
      list.push({
        id: `esc-${esc.id}`, icon: Ticket, iconColor: "text-red-500", severity: "critical",
        title: `${esc.severity} escalation — ${esc.reason ?? "unresolved"}`,
        entityRef: `ESC-${esc.id}`,
        href: `/crm/escalations/${esc.id}`,
      });
    });

    return list;
  }, [dashboard, procData]);

  // Alerts
  const alerts: AlertItem[] = useMemo(() => {
    const list: AlertItem[] = [];
    const pendingGRNCount = procData?.pendingGRNs?.length ?? 0;
    if (pendingGRNCount > 0) {
      list.push({
        id: "alert-grns", severity: "warning",
        title: `${pendingGRNCount} GRN${pendingGRNCount !== 1 ? "s" : ""} awaiting approval`,
        description: "Goods receipt notes pending warehouse sign-off.",
        action: { label: "Review GRNs", href: "/procurement/grns" },
      });
    }
    const overdueTaskCount = dashboard?.overdueTasksCount ?? 0;
    if (overdueTaskCount > 0) {
      list.push({
        id: "alert-tasks", severity: overdueTaskCount > 5 ? "critical" : "warning",
        title: `${overdueTaskCount} task${overdueTaskCount !== 1 ? "s" : ""} overdue`,
        description: "Project milestones have passed their deadline.",
        action: { label: "View Projects", href: "/projects" },
      });
    }
    return list;
  }, [dashboard, procData]);

  // Upcoming tasks for My Tasks panel
  const upcomingItems: UpcomingItem[] = useMemo(() => {
    return (combined?.pendingMilestones ?? []).slice(0, 6).map((m) => ({
      id: `m-${m.id}`,
      title: m.milestoneName ?? "Milestone",
      dueDate: m.dueDate ?? undefined,
      type: "milestone" as const,
      overdue: m.dueDate ? new Date(m.dueDate) < new Date() : false,
    }));
  }, [combined]);

  // Activity feed
  const activityItems: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];
    (dashboard?.recentLeads ?? []).slice(0, 3).forEach((lead: any) => {
      items.push({
        id: `lead-${lead.id}`, type: "lead",
        actor: lead.ownerName ?? "Sales",
        title: `updated lead — ${lead.companyName ?? lead.contactName ?? "Lead"}`,
        subtitle: lead.status ? `Status: ${lead.status}` : undefined,
        timestamp: lead.createdAt ?? lead.updatedAt,
        href: `/crm/leads/${lead.id}`,
      });
    });
    (dashboard?.recentProjects ?? []).slice(0, 2).forEach((project: any) => {
      items.push({
        id: `project-${project.id}`, type: "project",
        actor: project.pmOwnerName ?? "PM",
        title: `updated project — ${project.name ?? "Project"}`,
        subtitle: project.siteLocation ?? project.clientName,
        timestamp: project.updatedAt ?? project.createdAt,
        href: `/projects/${project.id}`,
      });
    });
    (combined?.recentDPRs ?? []).slice(0, 2).forEach((dpr: any) => {
      items.push({
        id: `dpr-${dpr.id}`, type: "milestone",
        actor: dpr.submittedBy ?? "Site",
        title: `submitted DPR — ${dpr.projectName ?? dpr.project ?? "Project"}`,
        timestamp: dpr.date ?? dpr.createdAt,
        href: dpr.projectId ? `/projects/${dpr.projectId}` : undefined,
      });
    });
    (procData?.pendingGRNs ?? []).slice(0, 2).forEach((grn: any) => {
      items.push({
        id: `grn-${grn.id}`, type: "grn",
        actor: grn.receivedBy ?? "Warehouse",
        title: `created GRN — ${grn.poNumber ?? `PO-${grn.poId}`}`,
        subtitle: grn.vendorName ?? grn.vendor,
        timestamp: grn.createdAt ?? grn.receivedAt,
        href: `/procurement/grns/${grn.id}`,
      });
    });
    return items
      .filter((i) => i.timestamp)
      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
      .slice(0, 8);
  }, [dashboard, combined, procData]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 px-4 py-3 pb-8 min-h-0">

      {/* ① Welcome Bar */}
      <WelcomeBar
        name={firstName}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onCustomize={() => setCustomizeOpen(true)}
        openEscalations={dashboard?.openEscalations?.length ?? 0}
        activeLeads={(combined?.pipeline as any)?.totalLeads ?? dashboard?.recentLeads?.length ?? 0}
      />

      {/* ② Quick Actions — prominent horizontal strip at top for immediate access */}
      {show("quick_actions") && <QuickActionsGrid />}

      {/* ③ Alerts — full-width banner (only when alerts exist) */}
      {show("alerts") && alerts.length > 0 && (
        <AlertsPanel alerts={alerts} />
      )}

      {/* ④ KPI Row */}
      {show("kpis") && (
        isLoading
          ? <SkeletonStats count={5} />
          : <KPIRow cards={kpiCards} />
      )}

      {/* ⑤ Main content — 12-column enterprise grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 items-start">

        {/* Left: Work items — Action Required + Upcoming Milestones */}
        <div className="md:col-span-1 xl:col-span-5 flex flex-col gap-3">
          {show("action_required") && (
            <ActionRequiredPanel items={actionItems} isLoading={d1 || d3} />
          )}
          {show("my_tasks") && (
            <UpcomingTasksPanel items={upcomingItems} isLoading={d2} />
          )}
        </div>

        {/* Center: Activity Feed */}
        {show("activity") && (
          <div className="md:col-span-1 xl:col-span-4">
            <ActivityFeed items={activityItems} isLoading={d1 || d2 || d3} />
          </div>
        )}

        {/* Right: Recently Accessed + Favorites */}
        <div className="md:col-span-2 xl:col-span-3 flex flex-col gap-3">
          {show("recently_accessed") && (
            <RecentlyAccessed maxItems={6} />
          )}
          {show("favorites") && (
            <FavoriteModules />
          )}
        </div>
      </div>

      {/* ⑥ Analytics Row */}
      {show("analytics") && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <PipelineChart stages={combined?.pipeline?.stages ?? []} isLoading={d2} />
          <FinancialTrendChart />
        </div>
      )}

      {/* ⑦ System Health */}
      {show("system_health") && (
        <SystemStatusBar lastRefresh={lastRefresh} isRefreshing={isRefreshing} />
      )}

      {/* Customize Sheet */}
      <CustomizeSheet
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        hidden={hidden}
        onToggle={toggle}
        onReset={reset}
      />
    </div>
  );
}
