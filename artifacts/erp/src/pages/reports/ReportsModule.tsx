import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, TrendingUp, TrendingDown, Package, FileText,
  BarChart3, Boxes, FolderKanban, Users, AlertTriangle,
  CalendarDays, RotateCcw, Star, CheckCircle, Clock,
} from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { PageHeader, StatusBadge } from "@/components/shared";
import { ExportButton } from "@/components/shared/ExportButton";
import { motion } from "framer-motion";
import { formatINR } from "@/lib/currency";
import { format, subDays, subMonths, startOfYear } from "date-fns";

/* ── Brand palette ─────────────────────────────────────────────────────────── */
const C = {
  orange:  "#E85C0D",
  navy:    "#0A0F2C",
  blue:    "#3B82F6",
  emerald: "#10B981",
  violet:  "#8B5CF6",
  amber:   "#F59E0B",
  red:     "#EF4444",
  cyan:    "#06B6D4",
  rose:    "#F43F5E",
  lime:    "#84CC16",
};
const PALETTE = [C.orange, C.blue, C.emerald, C.violet, C.amber, C.red, C.cyan, C.rose];

/* ── Date range ─────────────────────────────────────────────────────────────── */
type DateRange = { from: string; to: string };
const fmt = (d: Date) => format(d, "yyyy-MM-dd");
const TODAY = fmt(new Date());

const PRESETS = [
  { label: "7d",  from: () => fmt(subDays(new Date(), 7)),    to: () => TODAY },
  { label: "30d", from: () => fmt(subDays(new Date(), 30)),   to: () => TODAY },
  { label: "90d", from: () => fmt(subDays(new Date(), 90)),   to: () => TODAY },
  { label: "1yr", from: () => fmt(subDays(new Date(), 365)),  to: () => TODAY },
  { label: "YTD", from: () => fmt(startOfYear(new Date())),   to: () => TODAY },
  { label: "All", from: () => "",                             to: () => "" },
];

function DateFilter({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const activePreset = PRESETS.find(p => p.from() === range.from && p.to() === range.to)?.label;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex items-center gap-1">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => onChange({ from: p.from(), to: p.to() })}
            className={cn(
              "h-7 px-2.5 rounded-md text-xs font-medium transition-all",
              activePreset === p.label
                ? "bg-[#E85C0D] text-white shadow-sm"
                : "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 ml-1">
        <input
          type="date" value={range.from} max={range.to || TODAY}
          onChange={e => onChange({ ...range, from: e.target.value })}
          className="h-7 text-xs border border-border rounded-md px-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#E85C0D]"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="date" value={range.to} min={range.from} max={TODAY}
          onChange={e => onChange({ ...range, to: e.target.value })}
          className="h-7 text-xs border border-border rounded-md px-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#E85C0D]"
        />
      </div>
      {range.from && (
        <button onClick={() => onChange({ from: "", to: "" })}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────────────────────────────────── */
interface KPIProps {
  label: string; value: string | number;
  sub?: string; icon: React.ElementType;
  color?: "orange" | "blue" | "emerald" | "violet" | "amber" | "red";
  trend?: "up" | "down" | "neutral";
}
function KPICard({ label, value, sub, icon: Icon, color = "orange", trend }: KPIProps) {
  const cfg = {
    orange:  { bg: "bg-orange-50 dark:bg-orange-950/30",  ic: "text-[#E85C0D]",  ring: "ring-orange-200 dark:ring-orange-900/50" },
    blue:    { bg: "bg-blue-50 dark:bg-blue-950/30",     ic: "text-blue-600",    ring: "ring-blue-200 dark:ring-blue-900/50" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", ic: "text-emerald-600", ring: "ring-emerald-200 dark:ring-emerald-900/50" },
    violet:  { bg: "bg-violet-50 dark:bg-violet-950/30", ic: "text-violet-600",  ring: "ring-violet-200 dark:ring-violet-900/50" },
    amber:   { bg: "bg-amber-50 dark:bg-amber-950/30",   ic: "text-amber-600",   ring: "ring-amber-200 dark:ring-amber-900/50" },
    red:     { bg: "bg-red-50 dark:bg-red-950/30",       ic: "text-red-600",     ring: "ring-red-200 dark:ring-red-900/50" },
  }[color];
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
      <div className={cn("p-2.5 rounded-lg ring-1 shrink-0", cfg.bg, cfg.ring)}>
        <Icon className={cn("w-4 h-4", cfg.ic)} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-lg font-bold text-foreground leading-tight mt-0.5 tabular-nums">{value}</p>
        {sub && (
          <div className="flex items-center gap-1 mt-0.5">
            {trend === "up"   && <TrendingUp   className="w-3 h-3 text-emerald-500 shrink-0" />}
            {trend === "down" && <TrendingDown  className="w-3 h-3 text-red-500 shrink-0" />}
            <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Chart card ─────────────────────────────────────────────────────────────── */
function ChartCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ── Data table shell ───────────────────────────────────────────────────────── */
function TableCard({ title, children, exportConfig }: { title: string; children: React.ReactNode; exportConfig?: Parameters<typeof ExportButton>[0]["config"] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {exportConfig && <ExportButton config={exportConfig} className="h-7 text-xs gap-1.5" label="Export" />}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

/* ── Tooltip ────────────────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-xl p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-foreground mb-2 border-b border-border pb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-semibold text-foreground tabular-nums">
            {currency && typeof p.value === "number" ? formatINR(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Shared loading/error ───────────────────────────────────────────────────── */
function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-64 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
      <div className="h-72 bg-muted rounded-xl" />
    </div>
  );
}
function ReportError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
      <AlertTriangle className="w-8 h-8 text-amber-500" />
      <p className="text-sm font-medium">Failed to load report data</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5"><RotateCcw className="w-3 h-3" /> Retry</Button>
    </div>
  );
}

/* ── PROCUREMENT ─────────────────────────────────────────────────────────────── */
function ProcurementReport({ dateRange }: { dateRange: DateRange }) {
  const params = dateRange.from ? `?from=${dateRange.from}&to=${dateRange.to}` : "";
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["reports-procurement", dateRange.from, dateRange.to],
    queryFn:  () => apiGet<any>(`/reports/procurement${params}`),
  });
  if (isPending) return <ReportSkeleton />;
  if (isError)   return <ReportError onRetry={refetch} />;
  const { summary, byStatus = [], byVendor = [], monthly = [] } = data ?? {};
  const filtersLabel = dateRange.from ? `${dateRange.from} to ${dateRange.to}` : "All time";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total POs"    value={summary?.total ?? 0}                       icon={FileText}   color="orange" />
        <KPICard label="Total Value"  value={formatINR(summary?.totalValue ?? 0)}       icon={TrendingUp} color="blue"   />
        <KPICard label="Open Value"   value={formatINR(summary?.openValue ?? 0)}        icon={Package}    color="amber"  sub="Active POs" />
        <KPICard label="Avg PO Value" value={formatINR(summary?.avgPOValue ?? 0)}       icon={BarChart3}  color="violet" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Monthly PO Value Trend">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.orange} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={C.orange} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTip currency />} />
              <Area dataKey="value" name="PO Value" stroke={C.orange} strokeWidth={2} fill="url(#gradOrange)" dot={false} activeDot={{ r: 4, fill: C.orange }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="PO Status Distribution">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                paddingAngle={2} label={({ name, percent }) => percent > 0.06 ? `${(percent*100).toFixed(0)}%` : ""} labelLine={false}>
                {byStatus.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [v + " POs", n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <TableCard
        title="Top Vendors by Spend"
        exportConfig={{
          title: "Procurement — Vendor Spend Report",
          module: "procurement",
          filename: "Procurement_VendorSpend",
          filters: filtersLabel,
          columns: [
            { header: "Vendor",         key: "vendor", width: 30 },
            { header: "PO Count",       key: "count",  width: 12 },
            { header: "Total Value (₹)",key: "value",  width: 22, formatter: v => formatINR(Number(v)) },
          ],
          getRows: () => byVendor,
        }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">#</th>
              <th className="text-left px-4 py-2.5 font-medium">Vendor</th>
              <th className="text-center px-4 py-2.5 font-medium">POs</th>
              <th className="text-right px-4 py-2.5 font-medium">Total Value</th>
              <th className="text-right px-4 py-2.5 font-medium">% of Spend</th>
            </tr>
          </thead>
          <tbody>
            {byVendor.map((v: any, i: number) => {
              const totalSpend = byVendor.reduce((s: number, x: any) => s + Number(x.value), 0);
              const pct = totalSpend > 0 ? ((v.value / totalSpend) * 100).toFixed(1) : "0";
              return (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{v.vendor}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">{v.count}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground tabular-nums">{formatINR(v.value)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-[#E85C0D] rounded-full" style={{ width: `${Math.min(100, Number(pct))}%` }} />
                      </div>
                      <span className="text-muted-foreground w-8 text-right">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>

      <TableCard
        title="Monthly Breakdown"
        exportConfig={{
          title: "Procurement — Monthly Trend",
          module: "procurement",
          filename: "Procurement_MonthlyTrend",
          filters: filtersLabel,
          columns: [
            { header: "Month",       key: "month", width: 14 },
            { header: "PO Count",    key: "count", width: 12 },
            { header: "PO Value (₹)",key: "value", width: 22, formatter: v => formatINR(Number(v)) },
          ],
          getRows: () => monthly,
        }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">Month</th>
              <th className="text-center px-4 py-2.5 font-medium">PO Count</th>
              <th className="text-right px-4 py-2.5 font-medium">Total Value</th>
            </tr>
          </thead>
          <tbody>
            {[...monthly].reverse().map((m: any, i: number) => (
              <tr key={i} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-mono text-foreground">{m.month}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">{m.count}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{formatINR(m.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

/* ── GRN ANALYSIS ────────────────────────────────────────────────────────────── */
function GRNReport({ dateRange }: { dateRange: DateRange }) {
  const params = dateRange.from ? `?from=${dateRange.from}&to=${dateRange.to}` : "";
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["reports-grn", dateRange.from, dateRange.to],
    queryFn:  () => apiGet<any>(`/reports/grn${params}`),
  });
  if (isPending) return <ReportSkeleton />;
  if (isError)   return <ReportError onRetry={refetch} />;
  const { summary, byStatus = [], vendorRejections = [], monthly = [] } = data ?? {};
  const filtersLabel = dateRange.from ? `${dateRange.from} to ${dateRange.to}` : "All time";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total GRNs"     value={summary?.totalGRNs ?? 0}                              icon={Package}  color="orange" />
        <KPICard label="Total Received" value={(summary?.totalReceived ?? 0).toLocaleString("en-IN")} icon={Boxes}    color="blue"   />
        <KPICard label="Acceptance Rate"value={`${summary?.acceptanceRate ?? 0}%`}                   icon={CheckCircle} color="emerald" sub={`${(summary?.totalAccepted ?? 0).toFixed(0)} units accepted`} />
        <KPICard label="Total Rejected" value={(summary?.totalRejected ?? 0).toLocaleString("en-IN")} icon={AlertTriangle} color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Monthly GRN Activity">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip content={<ChartTip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="accepted" name="Accepted" fill={C.emerald} radius={[2, 2, 0, 0]} stackId="a" />
              <Bar dataKey="rejected" name="Rejected" fill={C.red}     radius={[2, 2, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vendor Rejection Rates">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={vendorRejections.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} />
              <YAxis dataKey="vendor" type="category" tick={{ fontSize: 9 }} width={88} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: any) => [`${v}%`, "Rejection Rate"]} />
              <Bar dataKey="rejectionRate" name="Rejection %" radius={[0, 3, 3, 0]}>
                {vendorRejections.slice(0, 8).map((_: any, i: number) => (
                  <Cell key={i} fill={Number(vendorRejections[i]?.rejectionRate) > 10 ? C.red : C.amber} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <TableCard
        title="Vendor Quality Analysis"
        exportConfig={{
          title: "GRN Analysis — Vendor Quality",
          module: "procurement",
          filename: "GRN_VendorQuality",
          filters: filtersLabel,
          columns: [
            { header: "Vendor",          key: "vendor",        width: 30 },
            { header: "GRNs",            key: "grns",          width: 10 },
            { header: "Received",        key: "received",      width: 14, formatter: v => Number(v).toFixed(1) },
            { header: "Rejected",        key: "rejected",      width: 14, formatter: v => Number(v).toFixed(1) },
            { header: "Rejection Rate %",key: "rejectionRate", width: 18 },
          ],
          getRows: () => vendorRejections,
        }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">Vendor</th>
              <th className="text-center px-4 py-2.5 font-medium">GRNs</th>
              <th className="text-right px-4 py-2.5 font-medium">Received</th>
              <th className="text-right px-4 py-2.5 font-medium">Rejected</th>
              <th className="text-right px-4 py-2.5 font-medium">Rejection Rate</th>
              <th className="text-center px-4 py-2.5 font-medium">Grade</th>
            </tr>
          </thead>
          <tbody>
            {vendorRejections.map((v: any, i: number) => {
              const rate = Number(v.rejectionRate);
              const grade = rate === 0 ? "A+" : rate < 2 ? "A" : rate < 5 ? "B" : rate < 10 ? "C" : "F";
              const gradeColor = grade === "A+" || grade === "A" ? "text-emerald-600 bg-emerald-50" : grade === "B" ? "text-blue-600 bg-blue-50" : grade === "C" ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
              return (
                <tr key={i} className={cn("border-b border-border/40 hover:bg-muted/20 transition-colors", rate > 10 && "bg-red-50/30 dark:bg-red-950/10")}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{v.vendor}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">{v.grns}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{Number(v.received).toFixed(1)}</td>
                  <td className={cn("px-4 py-2.5 text-right font-medium tabular-nums", rate > 0 ? "text-red-600" : "text-muted-foreground")}>{Number(v.rejected).toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", rate > 10 ? "bg-red-500" : rate > 5 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${Math.min(100, rate * 3)}%` }} />
                      </div>
                      <span className="tabular-nums text-foreground font-semibold w-10 text-right">{rate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", gradeColor)}>{grade}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

/* ── INVOICES ────────────────────────────────────────────────────────────────── */
function InvoiceReport({ dateRange }: { dateRange: DateRange }) {
  const params = dateRange.from ? `?from=${dateRange.from}&to=${dateRange.to}` : "";
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["reports-invoices", dateRange.from, dateRange.to],
    queryFn:  () => apiGet<any>(`/reports/invoices${params}`),
  });
  if (isPending) return <ReportSkeleton />;
  if (isError)   return <ReportError onRetry={refetch} />;
  const { summary, aging, byVendor = [], monthly = [] } = data ?? {};
  const filtersLabel = dateRange.from ? `${dateRange.from} to ${dateRange.to}` : "All time";
  const agingData = [
    { period: "Not Due",    value: aging?.current ?? 0, fill: C.emerald },
    { period: "1–30 Days",  value: aging?.days30  ?? 0, fill: C.amber   },
    { period: "31–60 Days", value: aging?.days60  ?? 0, fill: C.orange  },
    { period: "61–90 Days", value: aging?.days90  ?? 0, fill: C.red     },
    { period: "90+ Days",   value: aging?.over90  ?? 0, fill: "#7F1D1D" },
  ];
  const totalAging = agingData.reduce((s, a) => s + a.value, 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total Invoices" value={summary?.total ?? 0}                        icon={FileText}   color="orange" />
        <KPICard label="Total Payable"  value={formatINR(summary?.totalPayable ?? 0)}      icon={TrendingUp} color="blue"   />
        <KPICard label="Amount Paid"    value={formatINR(summary?.totalPaid ?? 0)}         icon={CheckCircle} color="emerald" sub="Settled" />
        <KPICard label="Outstanding"    value={formatINR(summary?.totalPending ?? 0)}      icon={AlertTriangle} color="amber" sub="Pending clearance" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Invoice Aging Analysis">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agingData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis dataKey="period" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTip currency />} />
              <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                {agingData.map((a, i) => <Cell key={i} fill={a.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Invoice vs Paid Trend">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.blue}    stopOpacity={0.15} />
                  <stop offset="95%" stopColor={C.blue}    stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="gradEmerald" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.emerald} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={C.emerald} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTip currency />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Area dataKey="invoiced" name="Invoiced" stroke={C.blue}    strokeWidth={2} fill="url(#gradBlue)"    dot={false} />
              <Area dataKey="paid"     name="Paid"     stroke={C.emerald} strokeWidth={2} fill="url(#gradEmerald)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Aging breakdown strip */}
      {totalAging > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Aging Distribution — {formatINR(totalAging)} outstanding</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {agingData.filter(a => a.value > 0).map((a, i) => (
              <div key={i} title={`${a.period}: ${formatINR(a.value)}`}
                style={{ width: `${(a.value / totalAging) * 100}%`, background: a.fill }}
                className="h-full rounded-sm transition-all" />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {agingData.filter(a => a.value > 0).map((a, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: a.fill }} />
                <span className="text-muted-foreground">{a.period}:</span>
                <span className="font-semibold text-foreground tabular-nums">{formatINR(a.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <TableCard
        title="Outstanding by Vendor"
        exportConfig={{
          title: "Invoices — Outstanding by Vendor",
          module: "finance",
          filename: "Invoices_VendorOutstanding",
          filters: filtersLabel,
          columns: [
            { header: "Vendor",          key: "vendor",  width: 30 },
            { header: "Invoices",        key: "count",   width: 10 },
            { header: "Total (₹)",       key: "total",   width: 22, formatter: v => formatINR(Number(v)) },
            { header: "Paid (₹)",        key: "paid",    width: 22, formatter: v => formatINR(Number(v)) },
            { header: "Outstanding (₹)", key: "pending", width: 22, formatter: v => formatINR(Number(v)) },
          ],
          getRows: () => byVendor,
        }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">Vendor</th>
              <th className="text-center px-4 py-2.5 font-medium">Invoices</th>
              <th className="text-right px-4 py-2.5 font-medium">Total</th>
              <th className="text-right px-4 py-2.5 font-medium">Paid</th>
              <th className="text-right px-4 py-2.5 font-medium">Outstanding</th>
              <th className="text-right px-4 py-2.5 font-medium">% Paid</th>
            </tr>
          </thead>
          <tbody>
            {byVendor.map((v: any, i: number) => {
              const pctPaid = v.total > 0 ? Math.round((v.paid / v.total) * 100) : 0;
              return (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground">{v.vendor}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">{v.count}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{formatINR(v.total)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600 font-medium tabular-nums">{formatINR(v.paid)}</td>
                  <td className={cn("px-4 py-2.5 text-right font-semibold tabular-nums", v.pending > 0 ? "text-[#E85C0D]" : "text-muted-foreground")}>{formatINR(v.pending)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pctPaid}%` }} />
                      </div>
                      <span className="tabular-nums text-muted-foreground w-8 text-right">{pctPaid}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

/* ── INVENTORY ───────────────────────────────────────────────────────────────── */
function InventoryReport({ dateRange }: { dateRange: DateRange }) {
  const params = dateRange.from ? `?from=${dateRange.from}&to=${dateRange.to}` : "";
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["reports-inventory", dateRange.from, dateRange.to],
    queryFn:  () => apiGet<any>(`/reports/inventory${params}`),
  });
  if (isPending) return <ReportSkeleton />;
  if (isError)   return <ReportError onRetry={refetch} />;
  const { summary, lowStock = [], txnByType = [], topByValue = [], byWarehouse = [] } = data ?? {};
  const filtersLabel = dateRange.from ? `${dateRange.from} to ${dateRange.to}` : "All time";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total Items"         value={summary?.totalItems ?? 0}                  icon={Boxes}        color="orange" />
        <KPICard label="Total Value"         value={formatINR(summary?.totalValue ?? 0)}       icon={TrendingUp}   color="blue"   />
        <KPICard label="Warehouses"          value={summary?.warehouses ?? 0}                  icon={Package}      color="emerald" />
        <KPICard label="Low Stock Items"     value={summary?.lowStockItems ?? 0}               icon={AlertTriangle} color={summary?.lowStockItems > 0 ? "red" : "emerald"} sub={summary?.lowStockItems > 0 ? "Below 10 units" : "All items healthy"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Transaction Types">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={txnByType} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                paddingAngle={2} label={({ name, percent }) => percent > 0.08 ? `${(percent*100).toFixed(0)}%` : ""} labelLine={false}>
                {txnByType.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [v, n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Warehouse Value Distribution">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byWarehouse} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis dataKey="warehouseId" tick={{ fontSize: 10 }} tickFormatter={v => `WH ${v}`} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTip currency />} formatter={(v: any) => [formatINR(v), "Stock Value"]} />
              <Bar dataKey="totalValue" name="Stock Value" fill={C.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TableCard
          title={`⚠ Low Stock Items (${lowStock.length})`}
          exportConfig={{
            title: "Inventory — Low Stock Items",
            module: "inventory",
            filename: "Inventory_LowStock",
            filters: filtersLabel,
            columns: [
              { header: "Item",         key: "itemName",   width: 35 },
              { header: "Balance Qty",  key: "balanceQty", width: 14 },
              { header: "Value (₹)",    key: "totalValue", width: 20, formatter: v => formatINR(Number(v)) },
            ],
            getRows: () => lowStock,
          }}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Item</th>
                <th className="text-right px-4 py-2.5 font-medium">Balance</th>
                <th className="text-right px-4 py-2.5 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-xs">No low stock items ✓</td></tr>
              ) : lowStock.map((item: any, i: number) => (
                <tr key={i} className={cn("border-b border-border/40 hover:bg-muted/20 transition-colors", Number(item.balanceQty) === 0 && "bg-red-50/30 dark:bg-red-950/10")}>
                  <td className="px-4 py-2 font-medium text-foreground">{item.itemName}</td>
                  <td className="px-4 py-2 text-right">
                    <Badge variant="outline" className={cn("text-[10px] font-mono tabular-nums", Number(item.balanceQty) === 0 ? "border-red-300 text-red-600 bg-red-50" : "border-amber-300 text-amber-600 bg-amber-50")}>
                      {Number(item.balanceQty).toFixed(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">{formatINR(item.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <TableCard
          title="Top Items by Value"
          exportConfig={{
            title: "Inventory — Top Items by Value",
            module: "inventory",
            filename: "Inventory_TopByValue",
            filters: filtersLabel,
            columns: [
              { header: "Item",        key: "itemName",   width: 35 },
              { header: "Balance Qty", key: "balanceQty", width: 14 },
              { header: "Value (₹)",   key: "totalValue", width: 20, formatter: v => formatINR(Number(v)) },
            ],
            getRows: () => topByValue,
          }}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Item</th>
                <th className="text-right px-4 py-2.5 font-medium">Qty</th>
                <th className="text-right px-4 py-2.5 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {topByValue.map((item: any, i: number) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2 font-medium text-foreground">{item.itemName}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">{Number(item.balanceQty).toFixed(1)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-foreground tabular-nums">{formatINR(item.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </div>
    </div>
  );
}

/* ── PROJECTS ────────────────────────────────────────────────────────────────── */
function ProjectsReport({ dateRange }: { dateRange: DateRange }) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["reports-projects"],
    queryFn:  () => apiGet<any>("/reports/projects"),
  });
  if (isPending) return <ReportSkeleton />;
  if (isError)   return <ReportError onRetry={refetch} />;
  const { summary, byStatus = [], projects = [] } = data ?? {};
  const chartData = projects.slice(0, 8).map((p: any) => ({
    name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name,
    Budget: p.budget, Expenses: p.expenses, POValue: p.poValue,
  }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total Projects" value={summary?.total ?? 0}                       icon={FolderKanban} color="orange" />
        <KPICard label="Total Budget"   value={formatINR(summary?.totalBudget ?? 0)}      icon={TrendingUp}   color="blue"   />
        <KPICard label="Total Expenses" value={formatINR(summary?.totalExpenses ?? 0)}    icon={BarChart3}    color="violet" sub={summary?.totalBudget > 0 ? `${((summary.totalExpenses / summary.totalBudget) * 100).toFixed(0)}% utilization` : ""} />
        <KPICard label="PO Value"       value={formatINR(summary?.totalPOValue ?? 0)}     icon={Package}      color="emerald" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <ChartCard title="Budget vs Expenses by Project">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTip currency />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Budget"   name="Budget"   fill={C.blue}    radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expenses" name="Expenses" fill={C.orange}  radius={[3, 3, 0, 0]} />
                <Bar dataKey="POValue"  name="PO Value" fill={C.violet}  radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <ChartCard title="By Status">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                paddingAngle={2} label={({ name, percent }) => percent > 0.08 ? `${(percent*100).toFixed(0)}%` : ""} labelLine={false}>
                {byStatus.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [v + " projects", n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <TableCard
        title="Project Cost Breakdown"
        exportConfig={{
          title: "Projects — Cost & Budget Report",
          module: "projects",
          filename: "Projects_CostBreakdown",
          columns: [
            { header: "Project",        key: "name",        width: 35 },
            { header: "Status",         key: "status",      width: 16 },
            { header: "Budget (₹)",     key: "budget",      width: 20, formatter: v => formatINR(Number(v)) },
            { header: "Expenses (₹)",   key: "expenses",    width: 20, formatter: v => formatINR(Number(v)) },
            { header: "PO Value (₹)",   key: "poValue",     width: 20, formatter: v => formatINR(Number(v)) },
            { header: "Remaining (₹)",  key: "remaining",   width: 20, formatter: v => formatINR(Number(v)) },
            { header: "Utilization %",  key: "utilization", width: 16 },
          ],
          getRows: () => projects,
        }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">Project</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-right px-4 py-2.5 font-medium">Budget</th>
              <th className="text-right px-4 py-2.5 font-medium">Expenses</th>
              <th className="text-right px-4 py-2.5 font-medium">Remaining</th>
              <th className="text-right px-4 py-2.5 font-medium w-28">Utilization</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p: any, i: number) => {
              const util = Number(p.utilization);
              const overBudget = p.remaining < 0;
              return (
                <tr key={i} className={cn("border-b border-border/40 hover:bg-muted/20 transition-colors", overBudget && "bg-red-50/30 dark:bg-red-950/10")}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{formatINR(p.budget)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{formatINR(p.expenses)}</td>
                  <td className={cn("px-4 py-2.5 text-right font-semibold tabular-nums", overBudget ? "text-red-600" : "text-emerald-600")}>{formatINR(p.remaining)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", util > 100 ? "bg-red-500" : util > 85 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${Math.min(100, util)}%` }} />
                      </div>
                      <span className={cn("tabular-nums font-semibold text-[11px] w-10 text-right", util > 100 ? "text-red-600" : "text-foreground")}>{util}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

/* ── VENDOR PERFORMANCE ──────────────────────────────────────────────────────── */
function VendorReport({ dateRange }: { dateRange: DateRange }) {
  const params = dateRange.from ? `?from=${dateRange.from}&to=${dateRange.to}` : "";
  const [search, setSearch] = useState("");
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["reports-vendors", dateRange.from, dateRange.to],
    queryFn:  () => apiGet<any>(`/reports/vendor-performance${params}`),
  });
  if (isPending) return <ReportSkeleton />;
  if (isError)   return <ReportError onRetry={refetch} />;
  const vendors = (data?.vendors ?? []) as any[];
  const filtered = search ? vendors.filter((v: any) => v.name.toLowerCase().includes(search.toLowerCase())) : vendors;
  const filtersLabel = dateRange.from ? `${dateRange.from} to ${dateRange.to}` : "All time";
  const avgScore = vendors.length ? Math.round(vendors.reduce((s: number, v: any) => s + v.score, 0) / vendors.length) : 0;
  const top3 = vendors.slice(0, 3);
  const scoreData = vendors.slice(0, 10).map((v: any) => ({ name: v.name.length > 14 ? v.name.slice(0, 14) + "…" : v.name, score: v.score, acceptanceRate: v.acceptanceRate, onTimeRate: v.onTimeRate }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Vendors Tracked" value={vendors.length}      icon={Users}      color="orange" />
        <KPICard label="Average Score"   value={`${avgScore}/100`}   icon={Star}       color={avgScore >= 80 ? "emerald" : avgScore >= 60 ? "amber" : "red"} sub="Acceptance × On-time" />
        <KPICard label="Top Score"       value={`${vendors[0]?.score ?? 0}/100`} icon={TrendingUp} color="blue" sub={vendors[0]?.name ?? "—"} />
        <KPICard label="Needs Attention" value={vendors.filter((v: any) => v.score < 60).length} icon={AlertTriangle} color="amber" sub="Score below 60" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Top 10 — Vendor Score">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={96} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: any) => [`${v}/100`, "Score"]} />
              <ReferenceLine x={80} stroke={C.emerald} strokeDasharray="4 4" />
              <Bar dataKey="score" name="Score" radius={[0, 3, 3, 0]}>
                {scoreData.map((v: any, i: number) => (
                  <Cell key={i} fill={v.score >= 80 ? C.emerald : v.score >= 60 ? C.amber : C.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 — Acceptance vs On-Time Rate">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} width={34} />
              <Tooltip formatter={(v: any, n: any) => [`${v}%`, n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="acceptanceRate" name="Acceptance %" fill={C.emerald} radius={[3, 3, 0, 0]} />
              <Bar dataKey="onTimeRate"     name="On-Time %"    fill={C.blue}    radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <TableCard
        title="Vendor Scorecard"
        exportConfig={{
          title: "Vendor Performance Scorecard",
          module: "procurement",
          filename: "VendorPerformance_Scorecard",
          filters: filtersLabel,
          columns: [
            { header: "Vendor",            key: "name",            width: 30 },
            { header: "Score (/100)",      key: "score",           width: 12 },
            { header: "Acceptance %",      key: "acceptanceRate",  width: 16 },
            { header: "On-Time %",         key: "onTimeRate",      width: 14 },
            { header: "Rejection %",       key: "rejectionRate",   width: 14 },
            { header: "Total POs",         key: "totalPOs",        width: 12 },
            { header: "Total Spend (₹)",   key: "totalSpend",      width: 22, formatter: v => formatINR(Number(v)) },
          ],
          getRows: () => filtered,
        }}
      >
        {/* Search */}
        <div className="px-4 py-2.5 border-b border-border/40">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search vendor…"
            className="w-full max-w-xs h-7 text-xs border border-border rounded-md px-2.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#E85C0D]"
          />
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">#</th>
              <th className="text-left px-4 py-2.5 font-medium">Vendor</th>
              <th className="text-center px-4 py-2.5 font-medium">Score</th>
              <th className="text-right px-4 py-2.5 font-medium">Acceptance</th>
              <th className="text-right px-4 py-2.5 font-medium">On-Time</th>
              <th className="text-right px-4 py-2.5 font-medium">Rejection</th>
              <th className="text-right px-4 py-2.5 font-medium">POs</th>
              <th className="text-right px-4 py-2.5 font-medium">Total Spend</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v: any, i: number) => {
              const scoreColor = v.score >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : v.score >= 60 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-red-700 bg-red-50 border-red-200";
              return (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{v.name}</span>
                      {!v.linked && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-zinc-300 text-zinc-500">Unlinked</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded border", scoreColor)}>{v.score}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn("font-semibold tabular-nums", v.acceptanceRate >= 95 ? "text-emerald-600" : v.acceptanceRate >= 80 ? "text-amber-600" : "text-red-600")}>{v.acceptanceRate}%</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn("font-semibold tabular-nums", v.onTimeRate >= 90 ? "text-emerald-600" : v.onTimeRate >= 70 ? "text-amber-600" : "text-red-600")}>{v.onTimeRate}%</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn("tabular-nums", v.rejectionRate > 5 ? "text-red-600 font-semibold" : "text-muted-foreground")}>{v.rejectionRate}%</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{v.totalPOs}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground tabular-nums">{formatINR(v.totalSpend)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">No vendors match your search</td></tr>
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────────── */
export default function ReportsModule() {
  const [tab, setTab]         = useState("procurement");
  const [dateRange, setRange] = useState<DateRange>({ from: fmt(subDays(new Date(), 90)), to: TODAY });

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <PageHeader
          title="Reports & Analytics"
          subtitle="Operational insights · six modules · all formats"
        />
        <div className="shrink-0">
          <DateFilter range={dateRange} onChange={setRange} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-9 flex-wrap gap-0.5 mb-5 bg-muted/50">
          <TabsTrigger value="procurement" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Procurement</TabsTrigger>
          <TabsTrigger value="grn"         className="gap-1.5 text-xs"><Package className="h-3.5 w-3.5" />GRN</TabsTrigger>
          <TabsTrigger value="invoices"    className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" />Invoices</TabsTrigger>
          <TabsTrigger value="inventory"   className="gap-1.5 text-xs"><Boxes className="h-3.5 w-3.5" />Inventory</TabsTrigger>
          <TabsTrigger value="projects"    className="gap-1.5 text-xs"><FolderKanban className="h-3.5 w-3.5" />Projects</TabsTrigger>
          <TabsTrigger value="vendors"     className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" />Vendors</TabsTrigger>
        </TabsList>
        <TabsContent value="procurement"><ProcurementReport dateRange={dateRange} /></TabsContent>
        <TabsContent value="grn">        <GRNReport        dateRange={dateRange} /></TabsContent>
        <TabsContent value="invoices">   <InvoiceReport    dateRange={dateRange} /></TabsContent>
        <TabsContent value="inventory">  <InventoryReport  dateRange={dateRange} /></TabsContent>
        <TabsContent value="projects">   <ProjectsReport   dateRange={dateRange} /></TabsContent>
        <TabsContent value="vendors">    <VendorReport     dateRange={dateRange} /></TabsContent>
      </Tabs>
    </motion.div>
  );
}
