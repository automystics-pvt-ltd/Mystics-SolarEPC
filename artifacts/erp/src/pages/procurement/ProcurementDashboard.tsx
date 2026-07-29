// @refresh reset
import { useState, useMemo, useRef, useEffect, memo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart, AlertTriangle, FileText, TrendingUp, TrendingDown,
  ArrowRight, Zap, Clock, Building2, ChevronRight, CheckCircle2,
  AlertCircle, Boxes, FilePlus, DollarSign, ClipboardList, Calendar,
  Activity, RotateCcw, Minus, ChevronDown, X, Download,
} from "lucide-react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { SkeletonStats, SkeletonList, StatusBadge } from "@/components/shared";
import { apiGet } from "@/lib/fetch";

/* ─── Formatters ─────────────────────────────────────────────────────────── */
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function fmtFull(n: number | null | undefined) {
  if (n == null) return "—";
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function relTime(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)     return "just now";
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function monthLabel(yyyymm: string) {
  const mm = parseInt(yyyymm.split("-")[1] ?? "1", 10);
  return MONTH_LABELS[mm - 1] ?? yyyymm;
}

/* ─── Date range helpers ─────────────────────────────────────────────────── */
type RangePreset = "ytd" | "this-month" | "last-month" | "this-quarter" | "custom";

interface DateRange { preset: RangePreset; from: string; to: string; }

function computePreset(preset: Exclude<RangePreset, "custom">): { from: string; to: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (preset) {
    case "ytd":          return { from: `${y}-01-01`, to: toLocalISO(today) };
    case "this-month":   return { from: toLocalISO(new Date(y, m, 1)), to: toLocalISO(today) };
    case "last-month":   return { from: toLocalISO(new Date(y, m - 1, 1)), to: toLocalISO(new Date(y, m, 0)) };
    case "this-quarter": return { from: toLocalISO(new Date(y, Math.floor(m / 3) * 3, 1)), to: toLocalISO(today) };
  }
}

const PRESETS: { key: Exclude<RangePreset, "custom">; label: string }[] = [
  { key: "ytd",          label: "Year to Date"  },
  { key: "this-month",   label: "This Month"    },
  { key: "last-month",   label: "Last Month"    },
  { key: "this-quarter", label: "This Quarter"  },
];

function rangeLabel(r: DateRange) {
  const found = PRESETS.find(p => p.key === r.preset);
  return found ? found.label : `${fmtDate(r.from)} – ${fmtDate(r.to)}`;
}

function defaultRange(): DateRange {
  const today = new Date();
  return { preset: "ytd", from: `${today.getFullYear()}-01-01`, to: toLocalISO(today) };
}

/* ─── Date Range Picker ──────────────────────────────────────────────────── */
const DateRangePicker = memo(function DateRangePicker({ value, onChange }: {
  value: DateRange; onChange: (r: DateRange) => void;
}) {
  const [open, setOpen]           = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo,   setCustomTo]   = useState(value.to);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function applyPreset(preset: Exclude<RangePreset, "custom">) {
    const { from, to } = computePreset(preset);
    onChange({ preset, from, to });
    setCustomFrom(from); setCustomTo(to);
    setOpen(false);
  }

  function applyCustom() {
    if (!customFrom || !customTo || customFrom > customTo) return;
    onChange({ preset: "custom", from: customFrom, to: customTo });
    setOpen(false);
  }

  const isYTD = value.preset === "ytd";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className={cn(
        "flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-all",
        "bg-card hover:bg-muted border-border shadow-sm",
        open && "ring-1 ring-primary/30",
        !isYTD && "border-primary/40 text-primary bg-primary/5",
      )}>
        <Calendar className="h-3.5 w-3.5 shrink-0" />
        <span>{rangeLabel(value)}</span>
        {!isYTD && (
          <span role="button" tabIndex={0}
            onClick={e => { e.stopPropagation(); onChange(defaultRange()); }}
            onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); onChange(defaultRange()); } }}
            className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors">
            <X className="h-3 w-3" />
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 space-y-0.5">
              {PRESETS.map(p => (
                <button key={p.key} onClick={() => applyPreset(p.key)} className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors",
                  value.preset === p.key ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                )}>{p.label}</button>
              ))}
            </div>
            <div className="border-t border-border p-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Custom range</p>
              <div className="flex flex-col gap-1.5">
                {(["From", "To"] as const).map(lbl => (
                  <div key={lbl}>
                    <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">{lbl}</label>
                    <input type="date"
                      value={lbl === "From" ? customFrom : customTo}
                      max={lbl === "From" ? (customTo || undefined) : undefined}
                      min={lbl === "To" ? (customFrom || undefined) : undefined}
                      onChange={e => lbl === "From" ? setCustomFrom(e.target.value) : setCustomTo(e.target.value)}
                      className="w-full text-[12px] px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                ))}
              </div>
              <Button size="sm" className="w-full h-7 text-xs"
                disabled={!customFrom || !customTo || customFrom > customTo}
                onClick={applyCustom}>Apply</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* ─── Constants ──────────────────────────────────────────────────────────── */
const PIPELINE_STAGES = [
  { key: "Draft",             short: "Draft",   color: "#94a3b8", bg: "bg-slate-100",  border: "border-slate-200",   text: "text-slate-600"   },
  { key: "Issued",            short: "Issued",  color: "#3b82f6", bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700"    },
  { key: "Acknowledged",      short: "Ack'd",   color: "#8b5cf6", bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700"  },
  { key: "PartiallyReceived", short: "Partial", color: "#f97316", bg: "bg-orange-50",  border: "border-orange-200",  text: "text-orange-700"  },
  { key: "FullyReceived",     short: "Rcvd",    color: "#10b981", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  { key: "Closed",            short: "Closed",  color: "#16a34a", bg: "bg-green-50",   border: "border-green-200",   text: "text-green-700"   },
  { key: "Cancelled",         short: "Cxld",    color: "#ef4444", bg: "bg-red-50",     border: "border-red-200",     text: "text-red-700"     },
];
const DONUT_COLORS: Record<string, string> = {
  Draft: "#94a3b8", Issued: "#3b82f6", Acknowledged: "#8b5cf6",
  PartiallyReceived: "#f97316", FullyReceived: "#10b981", Closed: "#16a34a", Cancelled: "#ef4444",
};
const ACTIVITY_META: Record<string, { icon: React.ElementType; label: string; cls: string }> = {
  po:      { icon: ShoppingCart, label: "Purchase Order", cls: "bg-blue-100 text-blue-700"       },
  grn:     { icon: Boxes,        label: "GRN",            cls: "bg-emerald-100 text-emerald-700"  },
  invoice: { icon: FilePlus,     label: "Invoice",        cls: "bg-violet-100 text-violet-700"    },
};

const wrap = { hidden: {}, show: { transition: { staggerChildren: 0.055 } } };
const fade = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" as const } } };

type Accent = "default"|"red"|"amber"|"emerald"|"blue"|"violet";
const ACCENT: Record<Accent, { bg: string; icon: string }> = {
  default: { bg: "from-white to-slate-50/80 border-border",           icon: "bg-primary/10 text-primary"       },
  red:     { bg: "from-red-50 to-rose-50/60 border-red-200",          icon: "bg-red-100 text-red-600"          },
  amber:   { bg: "from-amber-50 to-orange-50/60 border-amber-200",    icon: "bg-amber-100 text-amber-700"      },
  emerald: { bg: "from-emerald-50 to-green-50/60 border-emerald-200", icon: "bg-emerald-100 text-emerald-700"  },
  blue:    { bg: "from-blue-50 to-sky-50/60 border-blue-200",         icon: "bg-blue-100 text-blue-700"        },
  violet:  { bg: "from-violet-50 to-purple-50/60 border-violet-200",  icon: "bg-violet-100 text-violet-700"    },
};
type AlertColor = "red"|"amber"|"blue";
const ALERT_STYLE: Record<AlertColor, { lb: string; bg: string; ib: string; badge: string; bb: string }> = {
  red:   { lb:"border-l-red-500",   bg:"bg-red-50/50",   ib:"bg-red-100 text-red-600",     badge:"bg-red-100 text-red-700",     bb:"border-red-200"   },
  amber: { lb:"border-l-amber-500", bg:"bg-amber-50/50", ib:"bg-amber-100 text-amber-700", badge:"bg-amber-100 text-amber-700", bb:"border-amber-200" },
  blue:  { lb:"border-l-blue-500",  bg:"bg-blue-50/50",  ib:"bg-blue-100 text-blue-700",   badge:"bg-blue-100 text-blue-700",   bb:"border-blue-200"  },
};

/* ─── Pure leaf components (memo'd to prevent unnecessary re-renders) ─────── */
const KPICard = memo(function KPICard({ label, value, sub, trend, trendLabel, icon: Icon, accent = "default", onClick }: {
  label: string; value: string | number; sub?: string;
  trend?: "up"|"down"|"neutral"; trendLabel?: string;
  icon: React.ElementType; accent?: Accent; onClick?: () => void;
}) {
  const a  = ACCENT[accent];
  const TI = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const tc = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-muted-foreground";
  return (
    <div onClick={onClick} className={cn(
      "bg-gradient-to-br border rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 select-none",
      a.bg, onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5"
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground leading-tight">{label}</p>
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", a.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <div className="text-[26px] font-bold text-foreground leading-none tabular-nums">{value}</div>
        {sub && <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{sub}</p>}
      </div>
      {trendLabel && (
        <div className={cn("flex items-center gap-1 text-[11px] font-semibold", tc)}>
          <TI className="h-3 w-3 shrink-0" />{trendLabel}
        </div>
      )}
    </div>
  );
});

const DashCard = memo(function DashCard({ title, sub, actions, children, className }: {
  title: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("bg-card border border-border rounded-xl overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-border/60">
        <div>
          <p className="text-[13px] font-bold text-foreground">{title}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
});

const Pipeline = memo(function Pipeline({ poByStatus, totalPOs, onNav }: {
  poByStatus: Record<string, number>; totalPOs: number; onNav: () => void;
}) {
  const stages = PIPELINE_STAGES.filter(s => s.key !== "Cancelled" || (poByStatus[s.key] ?? 0) > 0);
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
      {stages.map((s, i) => {
        const count = poByStatus[s.key] ?? 0;
        const pct   = totalPOs > 0 ? Math.round((count / totalPOs) * 100) : 0;
        return (
          <div key={s.key} className="flex items-center flex-1 min-w-[72px]">
            <button onClick={onNav} className={cn(
              "flex-1 rounded-xl p-3 text-center transition-all hover:shadow-sm hover:-translate-y-0.5 border",
              s.bg, s.border
            )}>
              <div className={cn("text-xl font-bold tabular-nums", s.text)}>{count}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mt-0.5 leading-tight">{s.short}</div>
              <div className={cn("text-[10px] font-semibold mt-0.5", s.text)}>{pct}%</div>
              <div className="mt-2 h-1 bg-white/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
              </div>
            </button>
            {i < stages.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/20 shrink-0 mx-0.5" />}
          </div>
        );
      })}
    </div>
  );
});

function SpendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p className="text-primary font-bold tabular-nums">{fmtFull(payload[0]?.value)}</p>
    </div>
  );
}

const ActionRow = memo(function ActionRow({ left, right, onClick }: {
  left: React.ReactNode; right: React.ReactNode; onClick: () => void;
}) {
  return (
    <div onClick={onClick} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/30 cursor-pointer border-b border-border/40 last:border-b-0 transition-colors">
      <div className="min-w-0 flex-1">{left}</div>
      <div className="shrink-0 flex items-center gap-2">{right}</div>
    </div>
  );
});

const AlertRow = memo(function AlertRow({ icon: Icon, color, title, sub, count, onClick }: {
  icon: React.ElementType; color: AlertColor; title: string; sub: string; count: number; onClick?: () => void;
}) {
  const c = ALERT_STYLE[color];
  return (
    <div onClick={onClick} className={cn(
      "flex items-center gap-3 px-4 py-3 border-l-[3px] transition-all",
      c.lb, c.bg, onClick && "cursor-pointer hover:opacity-90"
    )}>
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", c.ib)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border", c.badge, c.bb)}>{count}</span>
    </div>
  );
});

const ActivityRow = memo(function ActivityRow({ event }: { event: any }) {
  const meta = ACTIVITY_META[event.type] ?? { icon: Activity, label: event.type, cls: "bg-muted text-muted-foreground" };
  const Icon = meta.icon;
  return (
    <div className="flex gap-3 py-2.5 group">
      <div className="flex flex-col items-center">
        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", meta.cls)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 w-px bg-border/40 mt-1 group-last:hidden" />
      </div>
      <div className="flex-1 pb-2 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-foreground leading-tight truncate">
              {meta.label} · <span className="font-mono">{event.ref}</span>
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{event.vendorName}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StatusBadge status={event.status} />
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">{relTime(event.createdAt)}</span>
          </div>
        </div>
        {event.amount != null && (
          <p className="mt-0.5 text-[11px] font-semibold text-foreground/60 tabular-nums">{fmt(event.amount)}</p>
        )}
      </div>
    </div>
  );
});

function InsightChip({ icon: Icon, text, cls }: { icon: React.ElementType; text: string; cls: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-[12px] font-medium leading-snug", cls)}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />{text}
    </div>
  );
}

/* ─── CSV export ─────────────────────────────────────────────────────────── */
function buildCSV(data: any, dateRange: DateRange): string {
  const d   = data as any;
  const s   = d?.summary ?? {};
  const topVendors: any[]    = d?.topVendors    ?? [];
  const topCategories: any[] = d?.topCategories ?? [];
  const monthlySpend: any[]  = d?.monthlySpend  ?? [];

  const rows: string[][] = [];

  const q = (v: string | number) => {
    const str = String(v ?? "");
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const row = (...cols: (string | number)[]) => rows.push(cols.map(c => q(c)));

  // ── Header ──────────────────────────────────────────────────────────────
  row("Mystics Procurement Dashboard Export");
  row("Period", `${dateRange.from} to ${dateRange.to}`);
  row("Generated", new Date().toISOString());
  rows.push([]);

  // ── KPIs ────────────────────────────────────────────────────────────────
  row("== KPI SUMMARY ==");
  row("Metric", "Value");
  row("Period Spend (₹)", s.ytdSpend ?? 0);
  row("Committed Value (₹)", s.committedValue ?? 0);
  row("Total POs", s.totalPOs ?? 0);
  row("Active POs", s.openPOs ?? 0);
  row("Overdue POs", s.overduePOs ?? 0);
  row("Pending GRNs", s.pendingGRNs ?? 0);
  row("Pending Invoices", s.pendingInvoices ?? 0);
  row("Invoice Mismatch Alerts", s.mismatchCount ?? 0);
  row("Approaching Deadlines (7 days)", s.approachingDeadlines ?? 0);
  row("This Month Spend (₹)", s.thisMonthSpend ?? 0);
  row("Last Month Spend (₹)", s.lastMonthSpend ?? 0);
  rows.push([]);

  // ── PO Status Breakdown ──────────────────────────────────────────────
  row("== PO STATUS BREAKDOWN ==");
  row("Status", "Count");
  for (const [status, count] of Object.entries(s.poByStatus ?? {})) {
    row(status, count as number);
  }
  rows.push([]);

  // ── Monthly Spend ────────────────────────────────────────────────────
  row("== MONTHLY SPEND TREND ==");
  row("Month", "Spend (₹)");
  for (const m of monthlySpend) {
    row(m.month, m.amount ?? 0);
  }
  rows.push([]);

  // ── Top Vendors ──────────────────────────────────────────────────────
  row("== TOP VENDORS ==");
  row("Vendor", "Spend (₹)", "PO Count");
  for (const v of topVendors) {
    row(v.vendorName ?? "Unknown", v.spend ?? 0, v.poCount ?? 0);
  }
  rows.push([]);

  // ── Top Categories ───────────────────────────────────────────────────
  row("== TOP CATEGORIES ==");
  row("Category", "Spend (₹)", "PO Count");
  for (const c of topCategories) {
    row(c.category ?? "Uncategorised", c.spend ?? 0, c.poCount ?? 0);
  }

  return rows.map(r => r.join(",")).join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════════════════ */
export default function ProcurementDashboard() {
  const [, setLocation] = useLocation();
  const [tab, setTab]             = useState<"invoices"|"grns"|"overdue">("invoices");
  const [chartMode, setChartMode] = useState<"vendor"|"category">("vendor");
  const [selectedVendor,   setSelectedVendor]   = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);

  /* ── Single query, cached for 2 minutes ────────────────────────────────── */
  const { data, isPending, isLoading, isError, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["procurement-dashboard", dateRange.from, dateRange.to],
    queryFn:  () => apiGet<any>("/procurement-dashboard", {
      from: dateRange.from,
      to:   dateRange.to,
    }),
    staleTime:            2 * 60_000,  // fresh for 2 min — no refetch on navigation
    gcTime:               10 * 60_000, // keep in cache for 10 min
    refetchOnWindowFocus: false,        // don't surprise users mid-task
    placeholderData:      (prev: any) => prev, // keep stale UI stable during revalidation
    retry:                1,            // only 1 retry on failure (default 3 is too slow)
    retryDelay:           1500,         // fixed 1.5 s retry delay
  });

  const handleRangeChange = useCallback((r: DateRange) => {
    setDateRange(r);
    setSelectedVendor("");
    setSelectedCategory("");
  }, []);

  const handleChartModeChange = useCallback((mode: "vendor" | "category") => {
    setChartMode(mode);
    setSelectedVendor("");
    setSelectedCategory("");
  }, []);

  /* ── Data extraction (safe when data is undefined during initial load) ────── */
  const d   = data as any ?? {};
  const s   = d.summary ?? {};
  const overduePOs: any[]      = d.overduePOs           ?? [];
  const pendingGRNs: any[]     = d.pendingGRNs           ?? [];
  const pendingInvoices: any[] = d.pendingInvoices        ?? [];
  const approaching: any[]     = d.approachingDeadlines   ?? [];
  const topVendors: any[]      = d.topVendors             ?? [];
  const topCategories: any[]   = d.topCategories          ?? [];
  const recentActivity: any[]  = d.recentActivity         ?? [];
  const vendorMonthlySpend: Record<string, any[]>   = d.vendorMonthlySpend   ?? {};
  const categoryMonthlySpend: Record<string, any[]> = d.categoryMonthlySpend ?? {};

  /* ── All derived values are memoised — no recomputation on irrelevant state changes */

  const monthlySpend = useMemo(() =>
    (d.monthlySpend ?? []).map((m: any) => ({ month: monthLabel(m.month), amount: m.amount })),
    [d.monthlySpend],
  );

  const chartData = useMemo((): any[] => {
    if (chartMode === "vendor" && selectedVendor && vendorMonthlySpend[selectedVendor]) {
      return vendorMonthlySpend[selectedVendor].map((m: any) => ({ month: monthLabel(m.month), amount: m.amount }));
    }
    if (chartMode === "category" && selectedCategory && categoryMonthlySpend[selectedCategory]) {
      return categoryMonthlySpend[selectedCategory].map((m: any) => ({ month: monthLabel(m.month), amount: m.amount }));
    }
    return monthlySpend;
  }, [chartMode, selectedVendor, selectedCategory, vendorMonthlySpend, categoryMonthlySpend, monthlySpend]);

  const donutData = useMemo(() =>
    Object.entries(s.poByStatus ?? {})
      .map(([status, count]) => ({ name: status, value: count as number, color: DONUT_COLORS[status] ?? "#94a3b8" }))
      .filter(d => d.value > 0),
    [s.poByStatus],
  );

  const spendDelta = useMemo(() =>
    s.lastMonthSpend > 0
      ? ((s.thisMonthSpend - s.lastMonthSpend) / s.lastMonthSpend) * 100
      : null,
    [s.thisMonthSpend, s.lastMonthSpend],
  );

  const pendingActions   = useMemo(() => (s.pendingGRNs ?? 0) + (s.pendingInvoices ?? 0), [s.pendingGRNs, s.pendingInvoices]);
  const maxVendorSpend   = useMemo(() => topVendors[0]?.spend ?? 1, [topVendors]);
  const maxCategorySpend = useMemo(() => topCategories[0]?.spend ?? 1, [topCategories]);

  const insights = useMemo(() => {
    const chips: { icon: React.ElementType; text: string; cls: string }[] = [];
    if (spendDelta !== null && Math.abs(spendDelta) >= 5)
      chips.push({
        icon: spendDelta > 0 ? TrendingUp : TrendingDown,
        text: `Spend is ${spendDelta > 0 ? "up" : "down"} ${Math.abs(spendDelta).toFixed(0)}% vs last month (${fmt(s.thisMonthSpend)} this month)`,
        cls: spendDelta > 0 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800",
      });
    if (s.overduePOs > 0)
      chips.push({ icon: AlertTriangle, cls: "bg-red-50 border-red-200 text-red-800",
        text: `${s.overduePOs} overdue PO${s.overduePOs > 1 ? "s" : ""} need immediate follow-up with vendors` });
    const staleInv = pendingInvoices.filter((i: any) => daysSince(i.createdAt) > 7);
    if (staleInv.length > 0)
      chips.push({ icon: Clock, cls: "bg-violet-50 border-violet-200 text-violet-800",
        text: `${staleInv.length} invoice${staleInv.length > 1 ? "s" : ""} ${staleInv.length > 1 ? "have" : "has"} been pending for over 7 days` });
    if (topVendors.length > 0 && s.ytdSpend > 0) {
      const pct = Math.round((topVendors[0].spend / s.ytdSpend) * 100);
      if (pct >= 25)
        chips.push({ icon: Building2, cls: "bg-blue-50 border-blue-200 text-blue-800",
          text: `${topVendors[0].vendorName} accounts for ${pct}% of period spend — consider diversifying` });
    }
    if (s.approachingDeadlines > 0)
      chips.push({ icon: Calendar, cls: "bg-orange-50 border-orange-200 text-orange-800",
        text: `${s.approachingDeadlines} PO${s.approachingDeadlines > 1 ? "s" : ""} due within 7 days — confirm delivery with vendors` });
    if (s.mismatchCount > 0)
      chips.push({ icon: AlertCircle, cls: "bg-rose-50 border-rose-200 text-rose-800",
        text: `${s.mismatchCount} invoice${s.mismatchCount > 1 ? "s" : ""} ${s.mismatchCount > 1 ? "have" : "has"} 3-way match mismatches requiring sign-off` });
    if (chips.length === 0)
      chips.push({ icon: CheckCircle2, cls: "bg-emerald-50 border-emerald-200 text-emerald-800",
        text: "All procurement metrics look healthy — no critical issues detected" });
    return chips;
  }, [spendDelta, s, pendingInvoices, topVendors]);

  const isYTD         = dateRange.preset === "ytd";
  const spendKPILabel = isYTD ? "YTD PO Value" : "Period PO Value";
  const receivedSpend = s.receivedSpend ?? 0;
  const now = new Date();

  /* ── Navigation callbacks (stable refs via useCallback) ─────────────────── */
  const navPOs      = useCallback(() => setLocation("/procurement/pos"),      [setLocation]);
  const navGRNs     = useCallback(() => setLocation("/procurement/grns"),     [setLocation]);
  const navInvoices = useCallback(() => setLocation("/procurement/invoices"), [setLocation]);
  const navVendors  = useCallback(() => setLocation("/procurement/vendors"),  [setLocation]);

  /* ── Error state — visible instead of blank on API failure ───────────────── */
  if (isError && !data) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center p-8">
      <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
        <span className="text-red-500 text-xl">!</span>
      </div>
      <div>
        <p className="text-[15px] font-semibold text-foreground">Dashboard failed to load</p>
        <p className="text-[13px] text-muted-foreground mt-1 max-w-sm">
          {(error as Error)?.message ?? "An unexpected error occurred. Please try again."}
        </p>
      </div>
      <button
        onClick={() => refetch()}
        className="text-[13px] px-4 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
      >
        Retry
      </button>
    </div>
  );

  /* ── Skeleton while loading for the first time (after all hooks) ─────────── */
  if (isPending) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
      </div>
      <SkeletonStats count={5} />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {[1,2,3].map(i => <div key={i} className="h-12 bg-muted/50 rounded-xl animate-pulse" />)}
      </div>
      <SkeletonList rows={4} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 bg-muted/50 rounded-xl animate-pulse" />
        <div className="h-72 bg-muted/50 rounded-xl animate-pulse" />
      </div>
      <SkeletonList rows={6} />
    </motion.div>
  );

  return (
    <motion.div variants={wrap} initial="hidden" animate="show" className="space-y-5 pb-10">

      {/* Header */}
      <motion.div variants={fade} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            Procurement Overview
            {isFetching && !isLoading && (
              <span className="inline-block h-2 w-2 rounded-full bg-primary/60 animate-pulse" title="Refreshing…" />
            )}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Pipeline · Spend analytics · Risk signals &nbsp;·&nbsp;
            <span className="tabular-nums">
              {dataUpdatedAt
                ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                : `As of ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={dateRange} onChange={handleRangeChange} />
          {/* Export button — only shown when data is available */}
          {data && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 h-8"
              onClick={() => {
                const filename = `procurement-${dateRange.from}-to-${dateRange.to}.csv`;
                downloadCSV(buildCSV(data, dateRange), filename);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          )}
          {([
            { label: "POs",      icon: ShoppingCart, fn: navPOs      },
            { label: "GRNs",     icon: Boxes,        fn: navGRNs     },
            { label: "Invoices", icon: FilePlus,     fn: navInvoices },
            { label: "Vendors",  icon: Building2,    fn: navVendors  },
          ] as const).map(({ label, icon: Icon, fn }) => (
            <Button key={label} size="sm" variant="outline" className="text-xs gap-1.5 h-8" onClick={fn}>
              <Icon className="h-3.5 w-3.5" />{label}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* KPI Strip */}
      <motion.div variants={fade} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard label={spendKPILabel} value={fmt(s.ytdSpend)} icon={DollarSign} accent="amber"
          sub={receivedSpend > 0 ? `${fmt(receivedSpend)} received · ${fmt(s.committedValue)} open` : s.committedValue > 0 ? `${fmt(s.committedValue)} open pipeline` : "All PO statuses"}
          trend={spendDelta != null ? (spendDelta >= 0 ? "up" : "down") : undefined}
          trendLabel={spendDelta != null ? `${spendDelta > 0 ? "+" : ""}${spendDelta.toFixed(1)}% vs last month` : undefined}
          onClick={navPOs} />
        <KPICard label="Active POs" value={s.openPOs ?? 0} icon={ShoppingCart} accent="blue"
          sub={`of ${s.totalPOs ?? 0} total · ${s.poByStatus?.Draft ?? 0} draft`}
          onClick={navPOs} />
        <KPICard label="Overdue POs" value={s.overduePOs ?? 0} icon={AlertTriangle}
          accent={s.overduePOs > 0 ? "red" : "emerald"}
          sub={s.overduePOs > 0 ? "Needs immediate action" : "All on schedule"}
          onClick={navPOs} />
        <KPICard label="Pending Actions" value={pendingActions} icon={ClipboardList} accent="violet"
          sub={`${s.pendingGRNs ?? 0} GRNs · ${s.pendingInvoices ?? 0} Invoices`}
          onClick={navInvoices} />
        <KPICard label="Mismatch Alerts" value={s.mismatchCount ?? 0} icon={AlertCircle}
          accent={s.mismatchCount > 0 ? "amber" : "emerald"}
          sub={s.mismatchCount > 0 ? "Invoice mismatches" : "All invoices matched"}
          onClick={navInvoices} />
      </motion.div>

      {/* Smart Insights */}
      <motion.div variants={fade}>
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Smart Insights</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {insights.map((ins, i) => <InsightChip key={i} icon={ins.icon} text={ins.text} cls={ins.cls} />)}
        </div>
      </motion.div>

      {/* Pipeline */}
      <motion.div variants={fade}>
        <DashCard title="Procurement Pipeline" sub={`${s.totalPOs ?? 0} total POs across all stages`}>
          <div className="p-4">
            <Pipeline poByStatus={s.poByStatus ?? {}} totalPOs={s.totalPOs ?? 1} onNav={navPOs} />
          </div>
        </DashCard>
      </motion.div>

      {/* Charts row */}
      <motion.div variants={fade} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard
          title="Monthly Spend Trend"
          sub={`${rangeLabel(dateRange)} · ${chartMode === "vendor" ? (selectedVendor || "All vendors") : (selectedCategory || "All categories")}`}
          className="lg:col-span-2"
          actions={
            <div className="flex items-center gap-2">
              <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
                {(["vendor", "category"] as const).map(mode => (
                  <button key={mode} onClick={() => handleChartModeChange(mode)} className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all capitalize",
                    chartMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}>{mode === "vendor" ? "By Vendor" : "By Category"}</button>
                ))}
              </div>
              {chartMode === "vendor" && topVendors.length > 0 && (
                <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}
                  className="text-[11px] font-semibold bg-muted border border-border rounded-lg px-2 py-1 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40 max-w-[130px] truncate">
                  <option value="">All vendors</option>
                  {topVendors.map((v: any) => <option key={v.vendorName} value={v.vendorName}>{v.vendorName}</option>)}
                </select>
              )}
              {chartMode === "category" && topCategories.length > 0 && (
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                  className="text-[11px] font-semibold bg-muted border border-border rounded-lg px-2 py-1 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40 max-w-[140px] truncate">
                  <option value="">All categories</option>
                  {topCategories.map((c: any) => <option key={c.category} value={c.category}>{c.category}</option>)}
                </select>
              )}
            </div>
          }
        >
          <div className="px-4 pt-2 pb-4">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#f97316" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={42}
                  tickFormatter={v => v >= 100_000 ? `${(v/100_000).toFixed(0)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                <Tooltip content={<SpendTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={2} fill="url(#sg)"
                  dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#f97316", strokeWidth: 2, stroke: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashCard>

        <DashCard title="PO Distribution" sub={`${s.totalPOs ?? 0} total · click to filter`}>
          <div className="flex flex-col items-center px-4 py-3">
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={42} outerRadius={66}
                  paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270} cursor="pointer"
                  onClick={(entry: any) => entry?.name && setLocation(`/procurement/pos?status=${entry.name}`)}>
                  {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: any, name: any) => [v, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-1.5 mt-1 pb-2">
              {donutData.map(d => (
                <div key={d.name}
                  onClick={() => setLocation(`/procurement/pos?status=${d.name}`)}
                  className="flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/50 rounded-md px-1 py-0.5 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[11px] text-muted-foreground truncate">{d.name}</span>
                  </div>
                  <span className="text-[11px] font-bold text-foreground tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </DashCard>
      </motion.div>

      {/* Action Queue + Top Vendors/Categories */}
      <motion.div variants={fade} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard title="Pending Actions" sub="Items requiring your attention" className="lg:col-span-2"
          actions={
            <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
              {([
                { key: "invoices", label: "Invoices", count: s.pendingInvoices ?? 0 },
                { key: "grns",     label: "GRNs",     count: s.pendingGRNs ?? 0     },
                { key: "overdue",  label: "Overdue",  count: s.overduePOs ?? 0      },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                  tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}>
                  {t.label}
                  {t.count > 0 && (
                    <span className={cn("text-[10px] font-bold px-1.5 py-px rounded-full leading-none",
                      tab === t.key ? "bg-primary/10 text-primary" : "bg-muted-foreground/20 text-muted-foreground"
                    )}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>
          }
        >
          <div>
            {tab === "invoices" && (pendingInvoices.length === 0
              ? <div className="py-10 text-center text-muted-foreground text-sm">No pending invoices</div>
              : pendingInvoices.map((inv: any) => (
                  <ActionRow key={inv.id} onClick={() => setLocation(`/procurement/invoices/${inv.id}`)}
                    left={<div>
                      <p className="font-mono font-bold text-[13px] text-foreground">{inv.invoiceNumber}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {inv.vendorName}
                        {inv.totalAmount != null && <> · <span className="font-semibold tabular-nums">{fmt(inv.totalAmount)}</span></>}
                        {daysSince(inv.createdAt) > 0 && <span className="text-muted-foreground/50 ml-1">· {daysSince(inv.createdAt)}d old</span>}
                      </p>
                    </div>}
                    right={<div className="flex flex-col items-end gap-1">
                      <StatusBadge status={inv.status} />
                      {inv.matchStatus === "MismatchPending" && <StatusBadge status="MismatchFlagged" />}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                    </div>}
                  />
                ))
            )}
            {tab === "grns" && (pendingGRNs.length === 0
              ? <div className="py-10 text-center text-muted-foreground text-sm">No pending GRNs</div>
              : pendingGRNs.map((g: any) => (
                  <ActionRow key={g.id} onClick={() => setLocation(`/procurement/grns/${g.id}`)}
                    left={<div>
                      <p className="font-mono font-bold text-[13px] text-foreground">{g.grnNumber}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {g.vendorName}<span className="text-muted-foreground/50 ml-1">· {daysSince(g.createdAt)}d old</span>
                      </p>
                    </div>}
                    right={<div className="flex flex-col items-end gap-1">
                      <StatusBadge status={g.status} />
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                    </div>}
                  />
                ))
            )}
            {tab === "overdue" && (overduePOs.length === 0
              ? <div className="py-10 text-center text-muted-foreground text-sm">No overdue POs 🎉</div>
              : overduePOs.map((po: any) => (
                  <ActionRow key={po.id} onClick={() => setLocation(`/procurement/pos/${po.id}`)}
                    left={<div>
                      <p className="font-mono font-bold text-[13px] text-foreground">{po.poNumber}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {po.vendorName}
                        {po.totalAmount != null && <> · <span className="font-semibold tabular-nums">{fmt(po.totalAmount)}</span></>}
                        {po.deliveryDeadline && <span className="ml-1">· Due {po.deliveryDeadline}</span>}
                      </p>
                    </div>}
                    right={<div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">{po.daysOverdue}d overdue</span>
                      <StatusBadge status={po.status} />
                    </div>}
                  />
                ))
            )}
            <div className="px-5 py-3 border-t border-border/40">
              <button onClick={() => setLocation(tab === "invoices" ? "/procurement/invoices" : tab === "grns" ? "/procurement/grns" : "/procurement/pos")}
                className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </DashCard>

        <DashCard title={chartMode === "vendor" ? "Top Vendors by Spend" : "Top Categories by Spend"}
          sub={`${rangeLabel(dateRange)} · click to filter`}>
          {chartMode === "vendor" ? (
            topVendors.length === 0
              ? <div className="py-10 text-center text-muted-foreground text-sm">No spend data yet</div>
              : <>
                  <div className="p-4 space-y-3">
                    {topVendors.map((v: any, i: number) => (
                      <div key={v.vendorName}
                        onClick={() => setLocation(
                          v.vendorId != null
                            ? `/procurement/pos?vendor=${v.vendorId}`
                            : `/procurement/pos?vendor=${encodeURIComponent(v.vendorName)}`
                        )}
                        className="cursor-pointer rounded-lg hover:bg-muted/40 transition-colors p-1.5 -mx-1.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground/40 tabular-nums w-4 shrink-0">#{i+1}</span>
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-primary">{v.vendorName?.[0]?.toUpperCase()}</span>
                          </div>
                          <span className="text-[12px] font-semibold text-foreground truncate flex-1">{v.vendorName}</span>
                          <span className="text-[12px] font-bold text-foreground tabular-nums shrink-0">{fmt(v.spend)}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                        </div>
                        <div className="ml-10 h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round((v.spend / maxVendorSpend) * 100)}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }} />
                        </div>
                        <p className="ml-10 mt-0.5 text-[10px] text-muted-foreground">{v.poCount} PO{v.poCount !== 1 ? "s" : ""}</p>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-border/40">
                    <button onClick={navVendors} className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1">
                      All vendors <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
          ) : (
            topCategories.length === 0
              ? <div className="py-10 text-center text-muted-foreground text-sm">No category data yet</div>
              : <>
                  <div className="p-4 space-y-3">
                    {topCategories.map((c: any, i: number) => (
                      <div key={c.category}
                        onClick={() => setLocation(`/procurement/pos?category=${encodeURIComponent(c.category)}`)}
                        className="cursor-pointer rounded-lg hover:bg-muted/40 transition-colors p-1.5 -mx-1.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground/40 tabular-nums w-4 shrink-0">#{i+1}</span>
                          <div className="h-6 w-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-violet-600">{c.category?.[0]?.toUpperCase()}</span>
                          </div>
                          <span className="text-[12px] font-semibold text-foreground truncate flex-1">{c.category}</span>
                          <span className="text-[12px] font-bold text-foreground tabular-nums shrink-0">{fmt(c.spend)}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                        </div>
                        <div className="ml-10 h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full bg-violet-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round((c.spend / maxCategorySpend) * 100)}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }} />
                        </div>
                        <p className="ml-10 mt-0.5 text-[10px] text-muted-foreground">{c.poCount} PO{c.poCount !== 1 ? "s" : ""}</p>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-border/40">
                    <button onClick={navPOs} className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1">
                      All POs <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
          )}
        </DashCard>
      </motion.div>

      {/* Alerts + Activity */}
      <motion.div variants={fade} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title="Risk & Alerts" sub="Items requiring attention">
          <div className="divide-y divide-border/30">
            {s.overduePOs > 0 && (
              <AlertRow icon={AlertTriangle} color="red"
                title={`${s.overduePOs} Overdue Purchase Order${s.overduePOs > 1 ? "s" : ""}`}
                sub="Past delivery deadline — follow up with vendors"
                count={s.overduePOs} onClick={navPOs} />
            )}
            {s.mismatchCount > 0 && (
              <AlertRow icon={AlertCircle} color="amber"
                title={`${s.mismatchCount} Invoice Mismatch${s.mismatchCount > 1 ? "es" : ""}`}
                sub="3-way match failed — review and sign off"
                count={s.mismatchCount} onClick={navInvoices} />
            )}
            {s.approachingDeadlines > 0 && (
              <AlertRow icon={Calendar} color="blue"
                title={`${s.approachingDeadlines} PO${s.approachingDeadlines > 1 ? "s" : ""} Due This Week`}
                sub="Delivery deadline within 7 days"
                count={s.approachingDeadlines} onClick={navPOs} />
            )}
            {s.pendingApprovalCount > 0 && (
              <AlertRow icon={FileText} color="blue"
                title={`${s.pendingApprovalCount} Invoice${s.pendingApprovalCount > 1 ? "s" : ""} Awaiting Approval`}
                sub="In the finance approval queue"
                count={s.pendingApprovalCount} onClick={navInvoices} />
            )}
            {!s.overduePOs && !s.mismatchCount && !s.approachingDeadlines && !s.pendingApprovalCount && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/40" />
                <p className="text-sm text-muted-foreground">No active alerts — all clear</p>
              </div>
            )}
            {approaching.slice(0, 3).map((po: any) => (
              <div key={po.id} onClick={() => setLocation(`/procurement/pos/${po.id}`)}
                className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-50/40 hover:bg-blue-50/80 cursor-pointer transition-colors">
                <div className="min-w-0">
                  <p className="font-mono text-[12px] font-semibold text-foreground truncate">{po.poNumber}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{po.vendorName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                    {po.daysLeft === 0 ? "Today" : `${po.daysLeft}d left`}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                </div>
              </div>
            ))}
          </div>
        </DashCard>

        <DashCard title="Recent Activity" sub={`Latest procurement events · ${rangeLabel(dateRange)}`}
          actions={
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-7 px-2 gap-1"
              onClick={() => refetch()}>
              <RotateCcw className="h-3 w-3" />Refresh
            </Button>
          }
        >
          <div className="px-4 py-3">
            {recentActivity.length === 0
              ? <div className="py-8 text-center text-muted-foreground text-sm">No activity in this period</div>
              : recentActivity.map((e: any) => <ActivityRow key={`${e.type}-${e.id}`} event={e} />)
            }
          </div>
        </DashCard>
      </motion.div>

    </motion.div>
  );
}
