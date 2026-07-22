import { useGetCombinedDashboard, useGetDashboard } from "@workspace/api-client-react";
import { Loader2, TrendingUp, Users, FolderKanban, AlertCircle, FileCheck, CircleDollarSign, CheckCircle2, ChevronRight, Plus, FileText, Package, ClipboardList, Boxes, BarChart3, HardHat, Warehouse } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

function formatCurrency(amount?: number | null) {
  if (!amount) return "₹0";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: dashboard, isLoading: isDashboardLoading } = useGetDashboard();
  const { data: combined, isLoading: isCombinedLoading } = useGetCombinedDashboard();

  const today = new Date();
  const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fyEnd = fyStart + 1;
  const dateRange = `${fyStart}-04-01 → ${fyEnd}-03-31`;

  if (isDashboardLoading || isCombinedLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500/50" />
      </div>
    );
  }

  const pipelineData = combined?.pipeline?.stages || [];

  const quickActions = [
    { label: "New Lead", icon: Users, color: "#6366f1", bg: "#eef2ff", href: "/crm/leads" },
    { label: "New Quotation", icon: FileText, color: "#0891b2", bg: "#ecfeff", href: "/crm/quotations/new" },
    { label: "Log Client PO", icon: FileCheck, color: "#059669", bg: "#ecfdf5", href: "/crm/client-pos" },
    { label: "New MR", icon: Package, color: "#d97706", bg: "#fffbeb", href: "/inventory/grns" },
    { label: "Create DPR", icon: ClipboardList, color: "#7c3aed", bg: "#f5f3ff", href: "/projects" },
    { label: "Add GRN", icon: Boxes, color: "#db2777", bg: "#fdf2f8", href: "/inventory/grns" },
    { label: "Contractors", icon: HardHat, color: "#0369a1", bg: "#eff6ff", href: "/projects/contractors" },
    { label: "Reports", icon: BarChart3, color: "#f59e0b", bg: "#fffbeb", href: "/crm/invoices" },
  ];

  return (
    <div className="space-y-5 pb-10">
      {/* Page heading */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Welcome back, <span className="font-semibold text-gray-700">{user?.name?.split(" ")[0]}</span> — here's your FY {fyStart}-{String(fyEnd).slice(-2)} at a glance.
          </p>
        </div>
        <span className="hidden sm:block text-[12px] text-gray-400 font-mono pt-1">{dateRange}</span>
      </div>

      {/* 4 Gradient Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <GradientCard
          gradient="linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)"
          icon={<FolderKanban className="h-5 w-5 text-white" />}
          label="Active Projects"
          value={String(dashboard?.activeProjectsCount ?? 0)}
          sub={`${combined?.portfolioSummary?.onTrackCount ?? 0} on track · ${combined?.portfolioSummary?.delayedCount ?? 0} delayed`}
          trend="+2 this month"
        />
        <GradientCard
          gradient="linear-gradient(135deg, #0ea5e9 0%, #0891b2 100%)"
          icon={<TrendingUp className="h-5 w-5 text-white" />}
          label="Contract Value"
          value={formatCurrency(dashboard?.totalContractValue)}
          sub={`Spend: ${formatCurrency(combined?.portfolioSummary?.totalActualSpend)}`}
          trend="Active"
        />
        <GradientCard
          gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          icon={<FileCheck className="h-5 w-5 text-white" />}
          label="Pending Approvals"
          value={String(dashboard?.pendingApprovalsCount ?? 0)}
          sub="Vendor quotations & expenses"
        />
        <GradientCard
          gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          icon={<AlertCircle className="h-5 w-5 text-white" />}
          label="Open Escalations"
          value={String(dashboard?.openEscalations?.length ?? 0)}
          sub={`${dashboard?.overdueTasksCount ?? 0} tasks overdue`}
          urgent={!!dashboard?.openEscalations?.length}
        />
      </div>

      {/* 6 Mini Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <MiniStatCard icon={<Users className="h-4 w-4" />} iconColor="text-orange-500" iconBg="bg-orange-50" label="Active Leads" value={dashboard?.leadsCount ?? 0} href="/crm/leads" />
        <MiniStatCard icon={<FileText className="h-4 w-4" />} iconColor="text-sky-500" iconBg="bg-sky-50" label="Quotations" value={0} href="/crm/quotations" />
        <MiniStatCard icon={<FileCheck className="h-4 w-4" />} iconColor="text-emerald-500" iconBg="bg-emerald-50" label="Client POs" value={0} href="/crm/client-pos" />
        <MiniStatCard icon={<AlertCircle className="h-4 w-4" />} iconColor="text-red-500" iconBg="bg-red-50" label="Overdue Tasks" value={dashboard?.overdueTasksCount ?? 0} href="/crm/tasks" />
        <MiniStatCard icon={<HardHat className="h-4 w-4" />} iconColor="text-violet-500" iconBg="bg-violet-50" label="Contractors" value={0} href="/projects/contractors" />
        <MiniStatCard icon={<Warehouse className="h-4 w-4" />} iconColor="text-teal-500" iconBg="bg-teal-50" label="Warehouses" value={0} href="/inventory/warehouses" />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Quick Actions</p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => setLocation(action.href)}
              className="flex flex-col items-center gap-2 py-3 px-2 rounded-lg hover:bg-gray-50 transition-colors group cursor-pointer"
            >
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ backgroundColor: action.bg }}
              >
                <action.icon className="h-5 w-5" style={{ color: action.color }} />
              </div>
              <span className="text-[11px] text-gray-600 font-medium text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Sales Pipeline */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-semibold text-gray-800">Sales Pipeline</h3>
              <p className="text-[12px] text-gray-400">{combined?.pipeline?.totalLeads ?? 0} active leads across all stages</p>
            </div>
            <Link href="/crm/leads">
              <span className="text-[12px] text-indigo-600 font-medium hover:underline flex items-center gap-0.5">
                View All <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 11 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "#f3f4f6" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08)" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {pipelineData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.stage === "Closed Won" ? "#4f46e5" : "#a5b4fc"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-semibold text-gray-800">Project Portfolio</h3>
              <p className="text-[12px] text-gray-400">Execution health & budget</p>
            </div>
            <Link href="/projects">
              <span className="text-[12px] text-indigo-600 font-medium hover:underline flex items-center gap-0.5">
                All Projects <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <p className="text-[11px] text-gray-500 mb-1">Total Budget</p>
                <p className="text-[18px] font-bold text-gray-900">{formatCurrency(combined?.portfolioSummary?.totalBudget)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <p className="text-[11px] text-gray-500 mb-1">Actual Spend</p>
                <p className="text-[18px] font-bold text-gray-900">{formatCurrency(combined?.portfolioSummary?.totalActualSpend)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-[11px] font-medium text-emerald-700">On Track</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{combined?.portfolioSummary?.onTrackCount ?? 0}</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-[11px] font-medium text-red-600">Delayed</span>
                </div>
                <p className="text-2xl font-bold text-red-500">{combined?.portfolioSummary?.delayedCount ?? 0}</p>
              </div>
            </div>

            {/* A/R Outstanding */}
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-indigo-600 font-medium">A/R Outstanding</p>
                  <p className="text-[20px] font-bold text-indigo-700">{formatCurrency(dashboard?.invoiceOutstanding)}</p>
                </div>
                <CircleDollarSign className="h-7 w-7 text-indigo-300" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Items Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Recent Leads */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-semibold text-gray-800">Recent Leads</h3>
            <Link href="/crm/leads">
              <span className="text-[12px] text-indigo-600 hover:underline">View All</span>
            </Link>
          </div>
          <div className="space-y-2">
            {dashboard?.recentLeads?.map((lead: any) => (
              <Link key={lead.id} href={`/crm/leads/${lead.id}`}>
                <div className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <div>
                    <p className="text-[13px] font-medium text-gray-800">{lead.companyName || "Unknown"}</p>
                    <p className="text-[11px] text-gray-400">{lead.contactName}</p>
                  </div>
                  <Badge variant={lead.status === "Closed Won" ? "default" : "secondary"} className="text-[10px] px-1.5">
                    {lead.status}
                  </Badge>
                </div>
              </Link>
            ))}
            {!dashboard?.recentLeads?.length && (
              <p className="text-[12px] text-gray-400 text-center py-4">No recent leads</p>
            )}
          </div>
        </div>

        {/* Active Projects */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-semibold text-gray-800">Active Projects</h3>
            <Link href="/projects">
              <span className="text-[12px] text-indigo-600 hover:underline">View All</span>
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard?.recentProjects?.map((project: any) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="py-2 px-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[13px] font-medium text-gray-800 truncate pr-2">{project.name}</p>
                    <span className="text-[11px] font-semibold text-indigo-600 whitespace-nowrap">{project.percentComplete ?? 0}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${project.percentComplete ?? 0}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
            {!dashboard?.recentProjects?.length && (
              <p className="text-[12px] text-gray-400 text-center py-4">No active projects</p>
            )}
          </div>
        </div>

        {/* Open Escalations */}
        <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-semibold text-gray-800 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Open Escalations
            </h3>
          </div>
          <div className="space-y-2">
            {dashboard?.openEscalations?.map((esc: any) => (
              <div key={esc.id} className="rounded-lg border border-red-100 bg-red-50/50 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12px] font-medium text-gray-800 leading-tight">{esc.reason}</p>
                  <Badge variant={esc.severity === "Critical" ? "destructive" : "secondary"} className="text-[9px] px-1.5 shrink-0">
                    {esc.severity}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-400">{esc.module}</span>
                  <span className="text-[10px] text-gray-400">{format(new Date(esc.createdAt), "MMM d")}</span>
                </div>
              </div>
            ))}
            {!dashboard?.openEscalations?.length && (
              <div className="flex flex-col items-center justify-center py-5">
                <CheckCircle2 className="h-7 w-7 text-emerald-300 mb-1.5" />
                <p className="text-[12px] text-gray-400">No active escalations</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */

function GradientCard({
  gradient, icon, label, value, sub, trend, urgent,
}: {
  gradient: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  urgent?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-5 text-white shadow-sm relative overflow-hidden"
      style={{ background: gradient }}
    >
      {/* Background glow */}
      <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -right-2 top-0 h-16 w-16 rounded-full bg-white/5" />

      <div className="relative z-10 flex items-start justify-between mb-3">
        <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
          {icon}
        </div>
        {trend && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
            {trend}
          </span>
        )}
      </div>

      <p className="relative z-10 text-[12px] font-medium text-white/80 mb-1">{label}</p>
      <p className="relative z-10 text-[28px] font-bold leading-tight tracking-tight">{value}</p>
      {sub && <p className="relative z-10 text-[11px] text-white/70 mt-1 truncate">{sub}</p>}
    </div>
  );
}

function MiniStatCard({
  icon, iconColor, iconBg, label, value, href,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group">
        <div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-gray-400 leading-tight">{label}</p>
          <p className="text-[18px] font-bold text-gray-900 leading-tight">{value}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
      </div>
    </Link>
  );
}
