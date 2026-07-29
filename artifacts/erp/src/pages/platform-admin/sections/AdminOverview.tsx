import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import {
  Activity, Users, Database, Clock, Server, Cpu, AlertCircle, CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: React.ReactNode; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">{value}</p>
          {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
        </div>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", color)}>
          <Icon className="w-4.5 h-4.5 text-white" />
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={cn("text-xs font-medium text-zinc-200", mono && "font-mono")}>{value}</span>
    </div>
  );
}

export function AdminOverview() {
  const { data: health, isLoading: hLoading } = useQuery({
    queryKey: ["pa-health"],
    queryFn: () => apiGet<any>("/platform-admin/health"),
    refetchInterval: 30_000,
  });
  const { data: stats, isLoading: sLoading } = useQuery({
    queryKey: ["pa-stats"],
    queryFn: () => apiGet<any>("/platform-admin/stats"),
  });

  const dbOk = health?.db?.status === "ok";
  const uptime = health ? Math.round(health.uptime / 60) : null;
  const memMb = health ? Math.round(health.memory?.heapUsed / 1024 / 1024) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">System Overview</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Real-time health & platform metrics</p>
      </div>

      {/* Status Banner */}
      <div className={cn(
        "flex items-center gap-2.5 px-4 py-3 rounded-lg border text-sm",
        dbOk || hLoading
          ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
          : "bg-red-950/40 border-red-800/50 text-red-300"
      )}>
        {hLoading ? (
          <><Activity className="w-4 h-4 animate-pulse" /> Checking system status…</>
        ) : dbOk ? (
          <><CheckCircle2 className="w-4 h-4" /> All systems operational</>
        ) : (
          <><AlertCircle className="w-4 h-4" /> Database connectivity issue detected</>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {sLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-zinc-900 border-zinc-800 p-4">
              <Skeleton className="h-4 w-20 bg-zinc-800 mb-2" />
              <Skeleton className="h-8 w-12 bg-zinc-800" />
            </Card>
          ))
        ) : (
          <>
            <StatCard label="Total Users"    value={stats?.users?.total ?? "—"} sub={`${stats?.users?.active ?? 0} active`} icon={Users}    color="bg-violet-600" />
            <StatCard label="DB Latency"     value={hLoading ? "—" : `${health?.db?.latencyMs ?? "—"}ms`}               icon={Database}  color="bg-blue-600"   />
            <StatCard label="Server Uptime"  value={uptime != null ? `${uptime}m` : "—"}                                 icon={Clock}     color="bg-emerald-600" />
            <StatCard label="Heap Memory"    value={memMb != null ? `${memMb} MB` : "—"}                                 icon={Cpu}       color="bg-amber-600"  />
          </>
        )}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Server Details */}
        <Card className="bg-zinc-900 border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Server</h3>
          </div>
          {hLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full bg-zinc-800" />)}</div>
          ) : (
            <>
              <Row label="Node.js"       value={health?.nodeVersion ?? "—"} mono />
              <Row label="Environment"   value={health?.env ?? "—"} mono />
              <Row label="DB Status"     value={
                <Badge className={cn("text-[10px] px-1.5", dbOk ? "bg-emerald-800 text-emerald-200" : "bg-red-800 text-red-200")}>
                  {dbOk ? "Connected" : "Error"}
                </Badge>
              } />
              <Row label="DB Latency"    value={`${health?.db?.latencyMs ?? "—"} ms`} mono />
              <Row label="Heap Used"     value={`${memMb ?? "—"} MB`} mono />
              <Row label="Heap Total"    value={`${Math.round((health?.memory?.heapTotal ?? 0) / 1024 / 1024)} MB`} mono />
            </>
          )}
        </Card>

        {/* User Breakdown */}
        <Card className="bg-zinc-900 border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-zinc-100">User Breakdown</h3>
          </div>
          {sLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full bg-zinc-800" />)}</div>
          ) : (
            <>
              <Row label="Total Users"    value={stats?.users?.total ?? 0} />
              <Row label="Active Users"   value={stats?.users?.active ?? 0} />
              <Row label="Today's Events" value={stats?.auditToday ?? 0} />
              <div className="mt-3 space-y-1.5">
                {(stats?.roles ?? []).map((r: any) => (
                  <div key={r.role} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-400 w-24 truncate">{r.role}</span>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${Math.round((r.count / (stats?.users?.total || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400 w-4 text-right">{r.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
