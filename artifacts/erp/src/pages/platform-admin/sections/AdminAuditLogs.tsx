import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ScrollText, Filter, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type AuditRow = {
  id:           number;
  user_name:    string | null;
  user_role:    string | null;
  action:       string;
  module:       string;
  entity_type:  string | null;
  entity_label: string | null;
  description:  string | null;
  ip_address:   string | null;
  user_agent:   string | null;
  status:       "success" | "failure" | "error";
  duration_ms:  number | null;
  created_at:   string;
};

type AuditResponse = {
  data:       AuditRow[];
  total:      number;
  page:       number;
  totalPages: number;
};

type AuditStats = { todayCount: number; uniqueUsers: number; failures: number };

/* ── Constants ─────────────────────────────────────────────────────────────── */
const ACTION_COLORS: Record<string, string> = {
  create:  "bg-blue-900/60 text-blue-300",
  update:  "bg-amber-900/60 text-amber-300",
  delete:  "bg-red-900/60 text-red-300",
  approve: "bg-emerald-900/60 text-emerald-300",
  reject:  "bg-rose-900/60 text-rose-300",
  submit:  "bg-sky-900/60 text-sky-300",
  cancel:  "bg-zinc-700 text-zinc-300",
  login:   "bg-violet-900/60 text-violet-300",
  issue:   "bg-teal-900/60 text-teal-300",
  pay:     "bg-lime-900/60 text-lime-300",
};

const STATUS_COLORS: Record<string, string> = {
  success: "text-emerald-400",
  failure: "text-amber-400",
  error:   "text-red-400",
};

const MODULE_OPTIONS = [
  "auth", "crm", "projects", "procurement", "inventory",
  "engineering", "commissioning", "oam", "finance", "admin",
];

const ACTION_OPTIONS = [
  "create", "update", "delete", "approve", "reject",
  "submit", "cancel", "login", "issue", "pay", "close",
];

function parseBrowser(ua: string | null): string {
  if (!ua) return "—";
  if (/Edg\//i.test(ua))    return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return "Browser";
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export function AdminAuditLogs() {
  const [page,          setPage]          = useState(1);
  const [search,        setSearch]        = useState("");
  const [moduleFilter,  setModuleFilter]  = useState<string>("");
  const [actionFilter,  setActionFilter]  = useState<string>("");
  const [statusFilter,  setStatusFilter]  = useState<string>("");
  const [showFilters,   setShowFilters]   = useState(false);
  const limit = 50;

  const hasFilters = !!(moduleFilter || actionFilter || statusFilter);

  const queryParams: Record<string, string | number | boolean | undefined> = {
    page, limit,
    ...(search       ? { search }             : {}),
    ...(moduleFilter ? { module: moduleFilter } : {}),
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["pa-audit-logs", page, search, moduleFilter, actionFilter, statusFilter],
    queryFn:  () => apiGet<AuditResponse>("/audit-logs", queryParams),
  });

  const { data: stats } = useQuery({
    queryKey: ["pa-audit-stats"],
    queryFn:  () => apiGet<AuditStats>("/audit-logs/stats"),
    refetchInterval: 60_000,
  });

  const logs:       AuditRow[] = data?.data       ?? [];
  const total:      number     = data?.total      ?? 0;
  const totalPages: number     = data?.totalPages ?? 1;

  const resetFilters = () => {
    setModuleFilter(""); setActionFilter(""); setStatusFilter(""); setPage(1);
  };

  return (
    <div className="space-y-4">

      {/* Header + stats */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Audit Logs</h2>
          <p className="text-xs text-zinc-500">Full system event trail · every write captured automatically</p>
        </div>
        {stats && (
          <div className="flex gap-3">
            {[
              { label: "Today",   value: stats.todayCount,  color: "text-zinc-200" },
              { label: "Users",   value: stats.uniqueUsers, color: "text-violet-300" },
              { label: "Failures", value: stats.failures,  color: stats.failures > 0 ? "text-red-400" : "text-zinc-500" },
            ].map(s => (
              <div key={s.label} className="text-center bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 min-w-[72px]">
                <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search user, entity, description…"
            className="pl-8 h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          className={`h-8 text-xs gap-1.5 ${showFilters ? "text-violet-300 bg-violet-900/30" : "text-zinc-400"}`}
          onClick={() => setShowFilters(f => !f)}
        >
          <Filter className="w-3 h-3" />
          Filters
          {hasFilters && <span className="bg-violet-600 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">!</span>}
        </Button>
        {hasFilters && (
          <Button size="sm" variant="ghost" className="h-8 text-xs text-zinc-500 gap-1" onClick={resetFilters}>
            <X className="w-3 h-3" />Clear
          </Button>
        )}
      </div>

      {/* Expanded filter row */}
      {showFilters && (
        <div className="flex gap-2 flex-wrap">
          <Select value={moduleFilter || "all"} onValueChange={v => { setModuleFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-8 w-[140px] text-xs bg-zinc-800 border-zinc-700 text-zinc-200">
              <SelectValue placeholder="All modules" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
              <SelectItem value="all" className="text-xs">All modules</SelectItem>
              {MODULE_OPTIONS.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={actionFilter || "all"} onValueChange={v => { setActionFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-8 w-[140px] text-xs bg-zinc-800 border-zinc-700 text-zinc-200">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
              <SelectItem value="all" className="text-xs">All actions</SelectItem>
              {ACTION_OPTIONS.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={statusFilter || "all"} onValueChange={v => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-8 w-[140px] text-xs bg-zinc-800 border-zinc-700 text-zinc-200">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              <SelectItem value="success" className="text-xs">Success</SelectItem>
              <SelectItem value="failure" className="text-xs">Failure</SelectItem>
              <SelectItem value="error" className="text-xs">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Table */}
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">Time</th>
                <th className="text-left px-4 py-2.5 font-medium">Action</th>
                <th className="text-left px-4 py-2.5 font-medium">What</th>
                <th className="text-left px-4 py-2.5 font-medium">User</th>
                <th className="text-left px-4 py-2.5 font-medium">Module</th>
                <th className="text-left px-4 py-2.5 font-medium">IP</th>
                <th className="text-left px-4 py-2.5 font-medium">Device</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-800/50">
                      {[80, 60, 200, 100, 70, 90, 80, 50].map((w, j) => (
                        <td key={j} className="px-4 py-2.5">
                          <Skeleton className="h-3 bg-zinc-800" style={{ width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : logs.length === 0
                ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <ScrollText className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-zinc-500">No audit logs found</p>
                        {hasFilters && (
                          <button onClick={resetFilters} className="mt-2 text-violet-400 text-xs hover:underline">
                            Clear filters
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                : logs.map(l => (
                    <tr
                      key={l.id}
                      className={cn(
                        "border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors",
                        l.status === "error"   && "bg-red-950/10",
                        l.status === "failure" && "bg-amber-950/10",
                      )}
                    >
                      <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                        <span title={format(new Date(l.created_at), "dd MMM yyyy HH:mm:ss")}>
                          {format(new Date(l.created_at), "dd MMM HH:mm:ss")}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Badge className={cn("text-[10px] font-mono px-1.5", ACTION_COLORS[l.action] ?? "bg-zinc-800 text-zinc-300")}>
                          {l.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-zinc-300 max-w-[220px]">
                        <p className="truncate" title={l.description ?? l.entity_label ?? ""}>
                          {l.description ?? l.entity_label ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">
                        {l.user_name ?? <span className="text-zinc-600">system</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                          {l.module}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-zinc-500">{l.ip_address ?? "—"}</td>
                      <td className="px-4 py-2 text-zinc-500">{parseBrowser(l.user_agent)}</td>
                      <td className="px-4 py-2">
                        <span className={cn("font-mono text-[10px]", STATUS_COLORS[l.status] ?? "text-zinc-500")}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-800">
            <span className="text-xs text-zinc-500">
              Page {page} of {totalPages} · {total.toLocaleString()} total events
            </span>
            <div className="flex gap-2">
              <Button
                size="sm" variant="ghost" disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="h-6 text-xs text-zinc-400 hover:text-zinc-200"
              >
                ← Prev
              </Button>
              <Button
                size="sm" variant="ghost" disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="h-6 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
