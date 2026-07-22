import { useGetCombinedDashboard, useGetDashboard } from "@workspace/api-client-react";
import {
  Loader2, TrendingUp, Users, FolderKanban, AlertCircle, FileCheck,
  CircleDollarSign, CheckCircle2, ChevronRight, FileText, Package,
  ClipboardList, Boxes, BarChart3, HardHat, Warehouse, Zap,
  ArrowUpRight, ArrowDownRight, LayoutTemplate
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

function formatCurrency(amount?: number | null) {
  if (!amount) return "$0";
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
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
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#EA580C]" />
          <span className="text-sm font-medium text-gray-500">Loading metrics...</span>
        </div>
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-10"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, <span className="font-semibold text-gray-700">{user?.name?.split(" ")[0]}</span>. Here's what's happening today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-white px-3 py-1 font-mono text-xs text-gray-500 rounded-[6px]">
            {dateRange}
          </Badge>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Active Projects"
          value={dashboard?.activeProjectsCount ?? 0}
          icon={FolderKanban}
          trend="+2 this month"
          trendUp={true}
        />
        <KpiCard
          title="Contract Value"
          value={formatCurrency(dashboard?.totalContractValue)}
          icon={TrendingUp}
          trend="vs Last Year"
          trendUp={true}
        />
        <KpiCard
          title="A/R Outstanding"
          value={formatCurrency(dashboard?.invoiceOutstanding)}
          icon={CircleDollarSign}
          trend="12 Invoices"
          trendUp={false}
          alert={true}
        />
        <KpiCard
          title="Open Escalations"
          value={dashboard?.openEscalations?.length ?? 0}
          icon={AlertCircle}
          trend={`${dashboard?.overdueTasksCount ?? 0} Overdue Tasks`}
          trendUp={false}
          alert={(dashboard?.openEscalations?.length ?? 0) > 0}
        />
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left Col: Charts & Pipeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[12px] premium-shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">Sales Pipeline</h3>
                <p className="text-sm text-gray-500">{combined?.pipeline?.totalLeads ?? 0} active leads</p>
              </div>
              <Button variant="ghost" size="sm" className="text-[#EA580C] hover:text-[#C2410C] hover:bg-orange-50 font-semibold" onClick={() => setLocation("/crm/leads")}>
                View Pipeline <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
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
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-[12px] premium-shadow p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <LayoutTemplate className="h-5 w-5 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">Portfolio Health</h3>
                </div>
                <div className="flex items-baseline gap-2 mt-4">
                  <span className="text-3xl font-bold tracking-tight text-gray-900">{combined?.portfolioSummary?.activeProjects ?? 0}</span>
                  <span className="text-sm font-medium text-gray-500">Active</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">On Track</p>
                  <p className="text-lg font-bold text-emerald-600">{combined?.portfolioSummary?.onTrackCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Delayed</p>
                  <p className="text-lg font-bold text-red-500">{combined?.portfolioSummary?.delayedCount ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[12px] premium-shadow p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CircleDollarSign className="h-5 w-5 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">Budget vs Spend</h3>
                </div>
                <div className="flex items-baseline gap-2 mt-4">
                  <span className="text-3xl font-bold tracking-tight text-gray-900">{formatCurrency(combined?.portfolioSummary?.totalActualSpend)}</span>
                </div>
                <p className="text-sm font-medium text-gray-500 mt-1">Total Actual Spend</p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Budget</p>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(combined?.portfolioSummary?.totalBudget)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Actions & Feed */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-[12px] premium-shadow p-5">
            <h3 className="text-sm font-bold text-gray-900 tracking-tight mb-4">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-3">
              {quickActions.map((action) => (
                <button key={action.label} onClick={() => setLocation(action.href)}
                  className="flex flex-col items-center justify-center p-3 rounded-[8px] bg-gray-50 hover:bg-orange-50 border border-transparent hover:border-orange-100 transition-all group">
                  <action.icon className="h-5 w-5 text-gray-400 group-hover:text-[#EA580C] mb-2 transition-colors" />
                  <span className="text-[11px] font-bold text-gray-600 group-hover:text-gray-900 text-center leading-tight">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Escalations Alert */}
          {dashboard?.openEscalations && dashboard.openEscalations.length > 0 && (
            <div className="bg-red-50 rounded-[12px] border border-red-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h3 className="text-sm font-bold text-red-900 tracking-tight">Active Escalations</h3>
              </div>
              <div className="space-y-3">
                {dashboard.openEscalations.slice(0,3).map((esc: any) => (
                  <div key={esc.id} className="bg-white/60 p-3 rounded-[8px] border border-red-100/50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{esc.reason}</p>
                      <Badge variant="outline" className="text-[10px] font-bold text-red-600 border-red-200 bg-white shrink-0 uppercase">
                        {esc.severity}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-gray-500 mt-1">{esc.module}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-white rounded-[12px] premium-shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 tracking-tight">Recent Projects</h3>
              <Button variant="link" size="sm" className="text-[#EA580C] h-auto p-0 text-xs font-semibold" onClick={() => setLocation("/projects")}>View All</Button>
            </div>
            <div className="space-y-4">
              {dashboard?.recentProjects?.map((project: any) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="group cursor-pointer">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-bold text-gray-900 group-hover:text-[#EA580C] transition-colors truncate pr-2">{project.name}</p>
                      <span className="text-xs font-mono font-bold text-gray-500">{project.percentComplete ?? 0}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-900 rounded-full transition-all"
                        style={{ width: `${project.percentComplete ?? 0}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
              {!dashboard?.recentProjects?.length && (
                <p className="text-sm font-medium text-gray-400 text-center py-4">No active projects</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}

function KpiCard({ title, value, icon: Icon, trend, trendUp, alert }: any) {
  return (
    <div className="bg-white rounded-[12px] premium-shadow p-5 relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <div className={`h-10 w-10 rounded-[8px] flex items-center justify-center ${alert ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-900'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-[6px] ${
          alert ? 'bg-red-50 text-red-600' : 
          trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'
        }`}>
          {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend}
        </span>
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
        <p className="text-sm font-medium text-gray-500 mt-1">{title}</p>
      </div>
      {/* Subtle decorative element */}
      <div className="absolute -bottom-6 -right-6 text-gray-50/50 pointer-events-none">
        <Icon className="h-24 w-24" />
      </div>
    </div>
  );
}
