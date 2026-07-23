import { useGetCombinedDashboard, useGetDashboard } from "@workspace/api-client-react";
import {
  TrendingUp, Users, FolderKanban, AlertCircle, FileCheck,
  CircleDollarSign, FileText, Package,
  ClipboardList, Boxes, HardHat, LayoutTemplate,
  ChevronRight
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, SkeletonStats, SkeletonList, SectionCard } from "@/components/shared";

function formatCurrency(amount?: number | null) {
  if (!amount) return "₹0";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
  return `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: dashboard, isLoading: isDashboardLoading } = useGetDashboard();
  const { data: combined, isLoading: isCombinedLoading } = useGetCombinedDashboard();

  const today = new Date();
  const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fyEnd = fyStart + 1;
  const dateRange = `${fyStart}-04-01 to ${fyEnd}-03-31`;

  if (isDashboardLoading || isCombinedLoading) {
    return (
      <div className="space-y-6">
        <SkeletonStats count={4} />
        <SkeletonList rows={6} />
      </div>
    );
  }

  const pipelineData = combined?.pipeline?.stages || [];

  const quickActions = [
    { label: "New Lead", icon: Users, href: "/crm/leads" },
    { label: "Create Quote", icon: FileText, href: "/crm/quotations/new" },
    { label: "Log PO", icon: FileCheck, href: "/crm/client-pos" },
    { label: "Issue GRN", icon: Boxes, href: "/inventory/grns" },
    { label: "Submit DPR", icon: ClipboardList, href: "/projects" },
    { label: "Contractors", icon: HardHat, href: "/projects/contractors" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-10"
    >
      <PageHeader
        title="Dashboard"
        subtitle="Operational overview — Mystics ERP"
        badge={
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs text-muted-foreground rounded-[6px]">
            {dateRange}
          </Badge>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Projects"
          value={dashboard?.activeProjectsCount ?? 0}
          icon={FolderKanban}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          trend="up"
          trendLabel="+2 this month"
        />
        <StatCard
          label="Contract Value"
          value={formatCurrency(dashboard?.totalContractValue)}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          trend="up"
          trendLabel="vs Last Year"
        />
        <StatCard
          label="A/R Outstanding"
          value={formatCurrency(dashboard?.invoiceOutstanding)}
          icon={CircleDollarSign}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          trend="down"
          trendLabel="12 Invoices"
        />
        <StatCard
          label="Open Escalations"
          value={dashboard?.openEscalations?.length ?? 0}
          icon={AlertCircle}
          iconBg={(dashboard?.openEscalations?.length ?? 0) > 0 ? "bg-red-50" : "bg-muted"}
          iconColor={(dashboard?.openEscalations?.length ?? 0) > 0 ? "text-red-600" : "text-muted-foreground"}
          trend="down"
          trendLabel={`${dashboard?.overdueTasksCount ?? 0} Overdue Tasks`}
        />
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left Col: Charts & Portfolio */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard
            title="Sales Pipeline"
            subtitle={`${combined?.pipeline?.totalLeads ?? 0} active leads`}
            actions={
              <Button variant="ghost" size="sm" className="text-[#EA580C] hover:text-[#C2410C] hover:bg-orange-50 font-semibold" onClick={() => setLocation("/crm/leads")}>
                View Pipeline <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            }
            noPadding={false}
          >
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12, fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12, fontWeight: 500 }} />
                  <Tooltip
                    cursor={{ fill: "#F3F4F6" }}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", fontSize: 13, fontWeight: 600 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {pipelineData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.stage === "Closed Won" ? "#10B981" : "#EA580C"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid sm:grid-cols-2 gap-4">
            <SectionCard title="Portfolio Health">
              <div className="flex items-center gap-2 mb-2">
                <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-bold tracking-tight text-foreground">{combined?.portfolioSummary?.activeProjects ?? 0}</span>
                <span className="text-sm font-medium text-muted-foreground">Active</span>
              </div>
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">On Track</p>
                  <p className="text-lg font-bold text-emerald-600">{combined?.portfolioSummary?.onTrackCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Delayed</p>
                  <p className="text-lg font-bold text-red-500">{combined?.portfolioSummary?.delayedCount ?? 0}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Budget vs Spend">
              <div className="flex items-center gap-2 mb-2">
                <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-bold tracking-tight text-foreground">{formatCurrency(combined?.portfolioSummary?.totalActualSpend)}</span>
              </div>
              <p className="text-sm font-medium text-muted-foreground mt-1">Total Actual Spend</p>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Budget</p>
                <p className="text-sm font-bold text-foreground">{formatCurrency(combined?.portfolioSummary?.totalBudget)}</p>
              </div>
            </SectionCard>
          </div>
        </div>

        {/* Right Col: Actions & Feed */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <SectionCard title="Quick Actions">
            <div className="grid grid-cols-3 gap-3">
              {quickActions.map((action) => (
                <button key={action.label} onClick={() => setLocation(action.href)}
                  className="flex flex-col items-center justify-center p-3 rounded-[8px] bg-muted/40 hover:bg-orange-50 border border-transparent hover:border-orange-100 transition-all group">
                  <action.icon className="h-5 w-5 text-muted-foreground group-hover:text-[#EA580C] mb-2 transition-colors" />
                  <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground text-center leading-tight">{action.label}</span>
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Escalations Alert */}
          {dashboard?.openEscalations && dashboard.openEscalations.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h3 className="text-sm font-bold text-red-900 tracking-tight">Active Escalations</h3>
              </div>
              <div className="space-y-3">
                {dashboard.openEscalations.slice(0, 3).map((esc: any) => (
                  <div key={esc.id} className="bg-white/60 p-3 rounded-[8px] border border-red-100/50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground leading-snug">{esc.reason}</p>
                      <Badge variant="outline" className="text-[10px] font-bold text-red-600 border-red-200 bg-white shrink-0 uppercase">
                        {esc.severity}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mt-1">{esc.module}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Projects */}
          <SectionCard
            title="Recent Projects"
            actions={
              <Button variant="link" size="sm" className="text-[#EA580C] h-auto p-0 text-xs font-semibold" onClick={() => setLocation("/projects")}>View All</Button>
            }
          >
            <div className="space-y-4">
              {dashboard?.recentProjects?.map((project: any) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="group cursor-pointer">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-bold text-foreground group-hover:text-[#EA580C] transition-colors truncate pr-2">{project.name}</p>
                      <span className="text-xs font-mono font-bold text-muted-foreground">{project.percentComplete ?? 0}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-foreground rounded-full transition-all"
                        style={{ width: `${project.percentComplete ?? 0}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
              {!dashboard?.recentProjects?.length && (
                <p className="text-sm font-medium text-muted-foreground text-center py-4">No active projects</p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </motion.div>
  );
}
