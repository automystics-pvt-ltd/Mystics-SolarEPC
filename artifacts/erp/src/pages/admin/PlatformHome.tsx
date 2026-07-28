import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Database, Users, ScrollText, Shield, Server, Activity,
  Table2, Rows3, Clock, CheckCircle2, XCircle, ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { PageHeader, SectionCard } from "@/components/shared";
import { CompactStatCard } from "@/components/shared/StatCard";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlatformStats {
  tableCount: number;
  totalRows: number;
  dbUptimeSeconds: number;
  dbStatus: "connected" | "error";
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUptime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  return `${Math.floor(secs / 86400)}d ${Math.floor((secs % 86400) / 3600)}h`;
}

function fmtNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

// ── Quick-link card ───────────────────────────────────────────────────────────
function AdminCard({
  icon: Icon,
  title,
  description,
  href,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <div className="group relative bg-card border border-border rounded-xl p-5 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden">
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${color} pointer-events-none`} />
        <div className="relative flex items-start gap-4">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color} border border-current/10`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm text-foreground">{title}</h3>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PlatformHome() {
  const { data: stats, isLoading } = useQuery<PlatformStats>({
    queryKey: ["platform-stats"],
    queryFn: () => apiGet<PlatformStats>("/db-admin/platform-stats"),
    refetchInterval: 60_000,
  });

  const isConnected = stats?.dbStatus === "connected";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 pb-10"
    >
      <PageHeader
        title="Platform Administration"
        subtitle="System health, database management, users, access control, and audit trail"
      />

      {/* System Health Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CompactStatCard
          label="Database"
          value={isLoading ? "…" : isConnected ? "Connected" : "Error"}
          icon={isConnected ? CheckCircle2 : XCircle}
          className={isConnected
            ? "border-green-200 dark:border-green-800"
            : "border-red-200 dark:border-red-800"}
        />
        <CompactStatCard
          label="Tables"
          value={isLoading ? "…" : fmtNumber(stats?.tableCount ?? 0)}
          icon={Table2}
        />
        <CompactStatCard
          label="Total Rows"
          value={isLoading ? "…" : fmtNumber(stats?.totalRows ?? 0)}
          icon={Rows3}
        />
        <CompactStatCard
          label="DB Uptime"
          value={isLoading ? "…" : fmtUptime(stats?.dbUptimeSeconds ?? 0)}
          icon={Clock}
        />
      </div>

      {/* DB Connection status detail */}
      {stats?.dbStatus === "error" && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>Database error: {stats.error}</span>
        </div>
      )}

      {/* Admin sections grid */}
      <SectionCard title="Administration Sections">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AdminCard
            icon={Database}
            title="DB Admin"
            description="Browse tables, run SQL queries, inspect schemas, manage data, and run maintenance operations."
            href="/admin/db"
            color="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
          />
          <AdminCard
            icon={Users}
            title="User Management"
            description="Add, edit, and manage team members. Reset passwords and assign roles."
            href="/admin/users"
            color="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
          />
          <AdminCard
            icon={Shield}
            title="Access Control"
            description="Configure role-based permissions for each module and action across the platform."
            href="/admin/rbac"
            color="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <AdminCard
            icon={ScrollText}
            title="Audit Logs"
            description="Review the full system-wide activity trail. Every write action is captured automatically."
            href="/admin/audit-logs"
            color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <AdminCard
            icon={Activity}
            title="System Health"
            description="Monitor DB connection, uptime statistics, and table-level row counts in real time."
            href="/admin/platform"
            color="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
          />
          <AdminCard
            icon={Server}
            title="API Server"
            description="Check the health endpoint and API server status."
            href="/admin/platform"
            color="bg-slate-50 text-slate-600 dark:bg-slate-950/40 dark:text-slate-400"
          />
        </div>
      </SectionCard>

      {/* Quick info */}
      <SectionCard title="Platform Info">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <span className="text-muted-foreground">Environment</span>
            <span className="font-medium">Production</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <span className="text-muted-foreground">Database Status</span>
            <span className={`font-medium ${isConnected ? "text-green-600" : "text-red-600"}`}>
              {isConnected ? "Healthy" : "Error"}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <span className="text-muted-foreground">Tables</span>
            <span className="font-medium">{isLoading ? "…" : fmtNumber(stats?.tableCount ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <span className="text-muted-foreground">Total Records</span>
            <span className="font-medium">{isLoading ? "…" : fmtNumber(stats?.totalRows ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">DB Uptime</span>
            <span className="font-medium">{isLoading ? "…" : fmtUptime(stats?.dbUptimeSeconds ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">App</span>
            <span className="font-medium">Mystics Solar ERP</span>
          </div>
        </div>
      </SectionCard>
    </motion.div>
  );
}
