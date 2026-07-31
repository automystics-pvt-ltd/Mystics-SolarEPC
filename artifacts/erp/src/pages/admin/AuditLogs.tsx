import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Activity, AlertTriangle, Clock, LogIn, ScrollText, Shield, Users,
  X,
} from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { PageHeader, DataTable, SectionCard, StatusBadge, ExportButton } from "@/components/shared";
import { CompactStatCard } from "@/components/shared/StatCard";
import type { ColumnDef } from "@tanstack/react-table";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuditLog {
  id:           number;
  user_id:      number | null;
  user_name:    string | null;
  user_role:    string | null;
  action:       string;
  module:       string;
  entity_type:  string | null;
  entity_id:    string | null;
  entity_label: string | null;
  description:  string | null;
  old_values:   unknown;
  new_values:   unknown;
  ip_address:   string | null;
  user_agent:   string | null;
  status:       "success" | "failure" | "error";
  error_message: string | null;
  duration_ms:  number | null;
  created_at:   string;
}

interface AuditStats {
  todayCount:  number;
  uniqueUsers: number;
  failures:    number;
}

interface AuditListResponse {
  data:       AuditLog[];
  total:      number;
  page:       number;
  totalPages: number;
}

interface UserOption { label: string; value: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const MODULE_OPTIONS = [
  "auth","crm","projects","procurement","inventory",
  "engineering","commissioning","oam","approvals","admin",
];

const ACTION_OPTIONS = [
  "login","create","update","delete","approve","reject",
  "submit","cancel","accept","close","issue","acknowledge",
  "reopen","reverse","dispatch","pay","assign","lock","unlock",
];

// ── Badge helpers ─────────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  login:       "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  logout:      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  create:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  update:      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  delete:      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  approve:     "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  reject:      "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  submit:      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  cancel:      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  accept:      "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  close:       "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  issue:       "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  acknowledge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  reopen:      "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  reverse:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  dispatch:    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  pay:         "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  assign:      "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
  lock:        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  unlock:      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {action}
    </span>
  );
}

const MODULE_COLORS: Record<string, string> = {
  auth:          "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300",
  crm:           "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  projects:      "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  procurement:   "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  inventory:     "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  engineering:   "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  commissioning: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  oam:           "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  approvals:     "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  admin:         "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

function ModuleBadge({ module }: { module: string }) {
  const cls = MODULE_COLORS[module] ?? "bg-gray-50 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {module}
    </span>
  );
}

const STATUS_CLASSES: Record<string, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  failure: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  error:   "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_CLASSES[status] ?? ""}`}>
      {status}
    </span>
  );
}

// ── Timestamp formatter ───────────────────────────────────────────────────────
function fmtTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
}

// ── JSON pretty-print section ─────────────────────────────────────────────────
function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <pre className="text-xs bg-muted/60 rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-64 leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AuditLogs() {
  const [module,   setModule]   = useState("all");
  const [action,   setAction]   = useState("all");
  const [userId,   setUserId]   = useState("all");
  const [status,   setStatus]   = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  // Build query params
  const params = useMemo(() => {
    const p: Record<string, string> = { limit: "200" };
    if (module   !== "all") p.module  = module;
    if (action   !== "all") p.action  = action;
    if (userId   !== "all") p.userId  = userId;
    if (status   !== "all") p.status  = status;
    if (fromDate)           p.from    = fromDate;
    if (toDate)             p.to      = toDate;
    if (search)             p.search  = search;
    return p;
  }, [module, action, userId, status, fromDate, toDate, search]);

  const queryString = new URLSearchParams(params).toString();

  const { data: listResp, isLoading } = useQuery<AuditListResponse>({
    queryKey: ["audit-logs", queryString],
    queryFn:  () => apiGet<AuditListResponse>(`/audit-logs?${queryString}`),
    refetchInterval: 30_000,  // soft live-poll every 30 s
  });

  const { data: stats } = useQuery<AuditStats>({
    queryKey: ["audit-logs-stats"],
    queryFn:  () => apiGet<AuditStats>("/audit-logs/stats"),
    refetchInterval: 30_000,
  });

  const { data: userOptions = [] } = useQuery<UserOption[]>({
    queryKey: ["audit-logs-users"],
    queryFn:  () => apiGet<UserOption[]>("/audit-logs/users"),
  });

  const logs = listResp?.data ?? [];

  const clearFilters = useCallback(() => {
    setModule("all"); setAction("all"); setUserId("all"); setStatus("all");
    setFromDate(""); setToDate(""); setSearch("");
  }, []);

  const hasFilters = module !== "all" || action !== "all" || userId !== "all" ||
    status !== "all" || fromDate || toDate || search;

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: ColumnDef<AuditLog, any>[] = useMemo(() => [
    {
      accessorKey: "created_at",
      header: "Timestamp",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs whitespace-nowrap">
          <Clock className="h-3 w-3 flex-shrink-0" />
          {fmtTs(row.original.created_at)}
        </div>
      ),
    },
    {
      accessorKey: "user_name",
      header: "User",
      cell: ({ row }) => {
        const { user_name, user_role } = row.original;
        return (
          <div className="flex flex-col gap-0.5 min-w-[110px]">
            <span className="text-sm font-medium text-foreground leading-tight">
              {user_name ?? <span className="text-muted-foreground italic">System</span>}
            </span>
            {user_role && (
              <span className="text-[11px] text-muted-foreground capitalize">{user_role}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => <ActionBadge action={row.original.action} />,
    },
    {
      accessorKey: "module",
      header: "Module",
      meta: { responsive: "sm" } as any,
      cell: ({ row }) => <ModuleBadge module={row.original.module} />,
    },
    {
      accessorKey: "entity_label",
      header: "Entity",
      cell: ({ row }) => {
        const { entity_type, entity_label, entity_id } = row.original;
        return (
          <div className="flex flex-col gap-0.5 min-w-[120px]">
            {entity_type && (
              <span className="text-[11px] text-muted-foreground capitalize">
                {entity_type.replace(/_/g, " ")}
              </span>
            )}
            {(entity_label || entity_id) && (
              <span className="font-mono text-xs font-semibold text-orange-600 dark:text-orange-400 truncate max-w-[160px]">
                {entity_label ?? `#${entity_id}`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "ip_address",
      header: "IP / Device",
      meta: { responsive: "lg" } as any,
      cell: ({ row }) => {
        const ip = row.original.ip_address;
        const ua = row.original.user_agent ?? "";
        const browser =
          /Edg\//i.test(ua)    ? "Edge"    :
          /OPR|Opera/i.test(ua) ? "Opera"   :
          /Chrome\//i.test(ua)  ? "Chrome"  :
          /Firefox\//i.test(ua) ? "Firefox" :
          /Safari\//i.test(ua) && !/Chrome/i.test(ua) ? "Safari" : null;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs text-muted-foreground">{ip ?? "—"}</span>
            {browser && (
              <span className="text-[11px] text-muted-foreground">{browser}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
  ], []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 pb-10"
    >
      <PageHeader
        title="Audit Logs"
        subtitle="System-wide activity trail — every write action captured automatically"
        actions={
          <ExportButton
            config={{
              title: "Audit Logs",
              module: "admin",
              filename: "Admin_AuditLogs",
              columns: [
                { header: "Timestamp",   key: "created_at",   formatter: (v) => fmtTs(String(v ?? "")) },
                { header: "User",        key: "user_name",    formatter: (v) => String(v ?? "—") },
                { header: "Role",        key: "user_role",    formatter: (v) => String(v ?? "—") },
                { header: "Action",      key: "action"        },
                { header: "Module",      key: "module"        },
                { header: "Entity Type", key: "entity_type",  formatter: (v) => String(v ?? "—") },
                { header: "Entity",      key: "entity_label", formatter: (v) => String(v ?? "—") },
                { header: "IP Address",  key: "ip_address",   formatter: (v) => String(v ?? "—") },
                { header: "Status",      key: "status"        },
                { header: "Description", key: "description",  formatter: (v) => String(v ?? "—") },
              ],
              getRows: () => logs as unknown as Record<string, unknown>[],
            }}
            size="sm"
            className="h-9 text-xs"
          />
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CompactStatCard
          label="Events Today"
          value={stats?.todayCount ?? "—"}
          icon={Activity}
        />
        <CompactStatCard
          label="Active Users Today"
          value={stats?.uniqueUsers ?? "—"}
          icon={Users}
        />
        <CompactStatCard
          label="Failures Today"
          value={stats?.failures ?? "—"}
          icon={AlertTriangle}
          className={(stats?.failures ?? 0) > 0 ? "border-amber-200 dark:border-amber-700" : ""}
        />
      </div>

      {/* Filter bar */}
      <SectionCard title="Filters" className="pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 items-end">
          {/* Module */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Module</label>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {MODULE_OPTIONS.map(m => (
                  <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Action</label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTION_OPTIONS.map(a => (
                  <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">User</label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {userOptions.map(u => (
                  <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* From date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">From</label>
            <Input
              type="date" value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* To date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">To</label>
            <Input
              type="date" value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* Clear */}
          {hasFilters && (
            <div className="flex flex-col justify-end">
              <Button
                variant="ghost" size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={clearFilters}
              >
                <X className="h-3 w-3" /> Clear
              </Button>
            </div>
          )}
        </div>

        {/* Inline search */}
        <div className="mt-3">
          <Input
            placeholder="Search by user, entity, or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs max-w-sm"
          />
        </div>
      </SectionCard>

      {/* Entry count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground -mt-2">
        <ScrollText className="h-4 w-4" />
        {isLoading
          ? "Loading…"
          : `${logs.length.toLocaleString()} entries${listResp && listResp.total > logs.length ? ` (showing first ${logs.length} of ${listResp.total.toLocaleString()})` : ""}`}
      </div>

      {/* Table */}
      <SectionCard title="Activity Log" noPadding>
        <DataTable
          data={logs}
          columns={columns}
          loading={isLoading}
          searchPlaceholder="Search table…"
          emptyIcon={ScrollText}
          emptyTitle="No audit entries found"
          emptyDescription={hasFilters ? "Try adjusting your filters" : "Actions will appear here as users interact with the system"}
          noSelection
          onRowClick={row => setSelected(row)}
          pageSize={50}
          stickyFirstCol
        />
      </SectionCard>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Audit Entry #{selected?.id}
            </SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="space-y-5 text-sm">
              {/* Who / When */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <Row label="Timestamp">
                  <span className="font-mono text-xs">{fmtTs(selected.created_at)}</span>
                </Row>
                <Row label="User">
                  <span className="font-medium">{selected.user_name ?? "—"}</span>
                  {selected.user_role && (
                    <span className="ml-2 text-xs text-muted-foreground capitalize">({selected.user_role})</span>
                  )}
                </Row>
                <Row label="Action">
                  <ActionBadge action={selected.action} />
                </Row>
                <Row label="Module">
                  <ModuleBadge module={selected.module} />
                </Row>
                <Row label="Status">
                  <StatusChip status={selected.status} />
                </Row>
              </div>

              {/* What */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                {selected.description && (
                  <Row label="Description">
                    <span>{selected.description}</span>
                  </Row>
                )}
                {selected.entity_type && (
                  <Row label="Entity Type">
                    <span className="capitalize">{selected.entity_type.replace(/_/g, " ")}</span>
                  </Row>
                )}
                {(selected.entity_label || selected.entity_id) && (
                  <Row label="Entity Ref">
                    <span className="font-mono text-xs font-semibold text-orange-600 dark:text-orange-400">
                      {selected.entity_label ?? `#${selected.entity_id}`}
                    </span>
                  </Row>
                )}
              </div>

              {/* Where / How */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                {selected.ip_address && (
                  <Row label="IP Address">
                    <span className="font-mono text-xs">{selected.ip_address}</span>
                  </Row>
                )}
                {selected.user_agent && (
                  <Row label="User Agent">
                    <span className="text-xs text-muted-foreground break-all leading-relaxed">
                      {selected.user_agent}
                    </span>
                  </Row>
                )}
                {selected.duration_ms != null && (
                  <Row label="Duration">
                    <span className="text-xs">{selected.duration_ms} ms</span>
                  </Row>
                )}
              </div>

              {/* Error */}
              {selected.error_message && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">
                    Error
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200">{selected.error_message}</p>
                </div>
              )}

              {/* Old / New values */}
              {(selected.old_values != null || selected.new_values != null) && (
                <div className="space-y-3">
                  <JsonBlock label="Previous Values" value={selected.old_values} />
                  <JsonBlock label="New Values"      value={selected.new_values} />
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

// ── Small helper ─────────────────────────────────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-muted-foreground font-medium w-24 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
