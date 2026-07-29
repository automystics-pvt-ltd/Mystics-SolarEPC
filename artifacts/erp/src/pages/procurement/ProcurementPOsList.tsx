// @refresh reset
import { useState, useEffect, useMemo } from "react";
import { useGetProcurementPOs } from "@workspace/api-client-react";
import { useLocation, useSearch } from "wouter";
import { CanCreate } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShoppingCart, ChevronRight, XCircle, Download, X,
  AlertCircle, Plus, LayoutGrid, List, Clock, AlertTriangle,
  CheckCircle2, TrendingUp, PackageCheck,
} from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";
import { formatINRCompact } from "@/lib/currency";
import { EmptyState, SkeletonCards } from "@/components/shared";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { dot: string; pill: string; border: string; label: string }> = {
  Draft:             { dot: "bg-slate-400",    pill: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700",          border: "border-l-slate-400",    label: "Draft"              },
  Submitted:         { dot: "bg-purple-500",   pill: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",    border: "border-l-purple-500",   label: "Submitted"          },
  PendingApproval:   { dot: "bg-purple-500",   pill: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",    border: "border-l-purple-500",   label: "Pending Approval"   },
  Approved:          { dot: "bg-emerald-500",  pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800", border: "border-l-emerald-500", label: "Approved"           },
  Rejected:          { dot: "bg-red-500",      pill: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",                      border: "border-l-red-500",      label: "Rejected"           },
  OnHold:            { dot: "bg-amber-500",    pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",          border: "border-l-amber-500",    label: "On Hold"            },
  Revised:           { dot: "bg-slate-400",    pill: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700",          border: "border-l-slate-400",    label: "Revised"            },
  Issued:            { dot: "bg-blue-500",     pill: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",               border: "border-l-blue-500",     label: "Issued"             },
  Acknowledged:      { dot: "bg-amber-500",    pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",          border: "border-l-amber-500",    label: "Acknowledged"       },
  PartiallyReceived: { dot: "bg-orange-500",   pill: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",    border: "border-l-orange-500",   label: "Partially Received" },
  FullyReceived:     { dot: "bg-emerald-500",  pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800", border: "border-l-emerald-500", label: "Fully Received"     },
  InvoiceMatched:    { dot: "bg-teal-500",     pill: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800",               border: "border-l-teal-500",     label: "Invoice Matched"    },
  PaymentPending:    { dot: "bg-yellow-500",   pill: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-800",    border: "border-l-yellow-500",   label: "Payment Pending"    },
  Paid:              { dot: "bg-green-500",    pill: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800",          border: "border-l-green-500",    label: "Paid"               },
  Closed:            { dot: "bg-slate-400",    pill: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700",          border: "border-l-slate-400",    label: "Closed"             },
  Cancelled:         { dot: "bg-red-400",      pill: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",                      border: "border-l-red-400",      label: "Cancelled"          },
};
const DEFAULT_STATUS_CFG = { dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground border-border", border: "border-l-muted-foreground/30", label: "Unknown" };
function getStatusCfg(s: string) { return STATUS_CONFIG[s] ?? DEFAULT_STATUS_CFG; }

const SLA_CONFIG: Record<string, string> = {
  OnTrack: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DueSoon: "bg-amber-50 text-amber-700 border-amber-200",
  Breached: "bg-red-50 text-red-700 border-red-200",
};

// Filter pills: "All" + the meaningful statuses in lifecycle order
const STATUS_FILTERS = [
  "all",
  "Draft", "Submitted", "PendingApproval", "Approved",
  "Issued", "Acknowledged", "PartiallyReceived", "FullyReceived",
  "InvoiceMatched", "PaymentPending", "Paid",
  "OnHold", "Rejected", "Closed", "Cancelled",
] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

type ViewMode = "cards" | "list";

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, colorClass, iconBg, mono,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  colorClass: string;
  iconBg: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border p-4 flex items-start gap-3", colorClass)}>
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", iconBg)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-2">
          {label}
        </p>
        <p className={cn("leading-none font-bold", mono ? "text-[17px] font-mono" : "text-[24px]")}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ── PO Card (grid view) ───────────────────────────────────────────────────────
function POCard({ po }: { po: Record<string, any> }) {
  const [, setLocation] = useLocation();
  const cfg = getStatusCfg(po.status ?? "Draft");
  const today = new Date().toISOString().split("T")[0];
  const deadline = po.deliveryDeadline ?? po.expectedDeliveryDate;
  const overdue = po.isOverdue || (deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(po.status ?? ""));
  const isPendingApproval = ["Submitted", "PendingApproval"].includes(po.status ?? "");
  const isRejected = po.status === "Rejected";
  const slaStatus = po.slaStatus as string | undefined;

  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      onClick={() => setLocation(`/procurement/pos/${po.id}`)}
      className={cn(
        "group flex flex-col bg-card border rounded-xl overflow-hidden cursor-pointer",
        "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]",
        "transition-shadow duration-200 border-l-[3px]",
        overdue ? "border-l-red-500" : isRejected ? "border-l-red-400" : cfg.border,
      )}
    >
      {/* ── Card body ── */}
      <div className="p-4 flex-1">
        {/* Top row: icon + status */}
        <div className="flex items-start justify-between gap-2 mb-3.5">
          <div className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
            overdue ? "bg-red-50 dark:bg-red-950/40" : isPendingApproval ? "bg-purple-50 dark:bg-purple-950/40" : "bg-muted",
          )}>
            <ShoppingCart className={cn("h-[18px] w-[18px]", overdue ? "text-red-400" : isPendingApproval ? "text-purple-400" : "text-muted-foreground")} />
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pt-0.5 flex-wrap justify-end">
            {overdue && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full border bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                <AlertTriangle className="h-2.5 w-2.5" />
                Overdue
              </span>
            )}
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full border",
              cfg.pill,
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* PO Number */}
        <h3 className="text-[14px] font-black font-mono text-foreground leading-snug group-hover:text-primary transition-colors mb-1">
          {po.poNumber}
        </h3>

        {/* Vendor */}
        <p className="text-[13px] text-foreground/80 truncate mb-2">{po.vendorName ?? "—"}</p>

        {/* SLA badge */}
        {slaStatus && slaStatus !== "OnTrack" && (
          <span className={cn(
            "inline-flex items-center text-[10px] font-bold px-2 py-[3px] rounded-full border",
            SLA_CONFIG[slaStatus] ?? "bg-muted text-muted-foreground border-border",
          )}>
            SLA: {slaStatus}
          </span>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold font-mono text-foreground">
          {formatINRCompact(Number(po.totalAmount ?? 0))}
        </span>

        <div className="flex flex-col items-end gap-0.5">
          {isPendingApproval && (
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">⏳ Awaiting approval</span>
          )}
          {!isPendingApproval && deadline && (
            <span className={cn("text-[10px] font-bold", overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
              {overdue ? "⚠ " : ""}By {deadline}
            </span>
          )}
          {po.poDate && (
            <span className="text-[10px] text-muted-foreground/60">
              {new Date(po.poDate).toLocaleDateString("en-IN")}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── PO Row (list view) ────────────────────────────────────────────────────────
function PORow({ po }: { po: Record<string, any> }) {
  const [, setLocation] = useLocation();
  const cfg = getStatusCfg(po.status ?? "Draft");
  const today = new Date().toISOString().split("T")[0];
  const deadline = po.deliveryDeadline ?? po.expectedDeliveryDate;
  const overdue = po.isOverdue || (deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(po.status ?? ""));
  const isPendingApproval = ["Submitted", "PendingApproval"].includes(po.status ?? "");
  const isRejected = po.status === "Rejected";
  const slaStatus = po.slaStatus as string | undefined;

  return (
    <div
      onClick={() => setLocation(`/procurement/pos/${po.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setLocation(`/procurement/pos/${po.id}`); }}
      role="button"
      tabIndex={0}
      className="group flex items-center gap-4 px-4 py-3.5 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
    >
      {/* Left status stripe */}
      <div className={cn("h-9 w-[3px] rounded-full shrink-0", overdue ? "bg-red-500" : cfg.dot)} />

      {/* Icon */}
      <div className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 hidden sm:flex",
        overdue ? "bg-red-50 dark:bg-red-950/40" : isPendingApproval ? "bg-purple-50 dark:bg-purple-950/40" : "bg-muted",
      )}>
        <ShoppingCart className={cn("h-4 w-4", overdue ? "text-red-400" : isPendingApproval ? "text-purple-400" : "text-muted-foreground")} />
      </div>

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-mono font-bold text-[13px] text-foreground group-hover:text-primary transition-colors">
            {po.poNumber}
          </span>
          {overdue && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-[2px] rounded-full border bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800 shrink-0">
              <AlertTriangle className="h-2.5 w-2.5" />
              Overdue
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-[2px] rounded-full border bg-red-50 text-red-700 border-red-200 shrink-0">
              <XCircle className="h-2.5 w-2.5" />
              Rejected
            </span>
          )}
          {slaStatus && slaStatus !== "OnTrack" && (
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-[2px] rounded-full border shrink-0",
              SLA_CONFIG[slaStatus] ?? "bg-muted text-muted-foreground border-border",
            )}>
              SLA: {slaStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground flex-wrap">
          <span className="truncate">{po.vendorName ?? "—"}</span>
          {po.poDate && <span>· {new Date(po.poDate).toLocaleDateString("en-IN")}</span>}
          {po.approvedByName && <span className="hidden md:inline">· Approved by {po.approvedByName}</span>}
        </div>
      </div>

      {/* Status pill */}
      <span className={cn(
        "hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full border shrink-0",
        cfg.pill,
      )}>
        <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
        {cfg.label}
      </span>

      {/* Amount */}
      <span className="hidden md:block text-[13px] font-bold font-mono text-foreground shrink-0 w-24 text-right">
        {formatINRCompact(Number(po.totalAmount ?? 0))}
      </span>

      {/* Deadline */}
      <div className="hidden lg:flex justify-end w-24 shrink-0">
        {isPendingApproval ? (
          <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">⏳ Awaiting</span>
        ) : deadline ? (
          <span className={cn("text-[10px] font-bold", overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
            {overdue ? "⚠ " : ""}By {deadline}
          </span>
        ) : null}
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/25 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProcurementPOsList() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();

  const params = new URLSearchParams(searchStr);
  const urlStatus    = params.get("status")    ?? "";
  const urlVendor    = params.get("vendor")    ?? "";
  const urlCategory  = params.get("category")  ?? "";
  const urlProjectId = params.get("projectId") ?? "";

  const knownApiStatuses = new Set(Object.keys(STATUS_CONFIG));

  // Normalise a raw URL status string to an internal StatusFilter value.
  // "All" and "" both become "all"; any unrecognised value becomes "all".
  function normaliseStatus(raw: string): StatusFilter {
    if (!raw || raw.toLowerCase() === "all") return "all";
    return knownApiStatuses.has(raw) ? (raw as StatusFilter) : "all";
  }

  const [activeStatus, setActiveStatus] = useState<StatusFilter>(normaliseStatus(urlStatus));
  const [search, setSearch]               = useState("");
  const [viewMode, setViewMode]           = useState<ViewMode>("cards");
  const [vendorFilter, setVendorFilter]   = useState(urlVendor);
  const [categoryFilter, setCategoryFilter] = useState(urlCategory);
  const [projectIdFilter, setProjectIdFilter] = useState(urlProjectId);

  useEffect(() => {
    const p = new URLSearchParams(searchStr);
    const s  = p.get("status")    ?? "";
    const v  = p.get("vendor")    ?? "";
    const c  = p.get("category")  ?? "";
    const pi = p.get("projectId") ?? "";
    setActiveStatus(normaliseStatus(s));
    setVendorFilter(v);
    setCategoryFilter(c);
    setProjectIdFilter(pi);
  }, [searchStr]); // normaliseStatus is a stable inner function — no extra dep needed

  const vendorIdNum = vendorFilter ? Number(vendorFilter) : NaN;
  const isNumericVendorFilter = vendorFilter !== "" && !isNaN(vendorIdNum);
  const projectIdNum = projectIdFilter ? Number(projectIdFilter) : NaN;
  const hasProjectFilter = projectIdFilter !== "" && !isNaN(projectIdNum);

  const { data: pos = [], isLoading, isError, error, refetch } = useGetProcurementPOs({
    status:    activeStatus !== "all" ? activeStatus : undefined,
    vendorId:  isNumericVendorFilter ? vendorIdNum : undefined,
    vendor:    !isNumericVendorFilter && vendorFilter ? vendorFilter : undefined,
    category:  categoryFilter || undefined,
    projectId: hasProjectFilter ? projectIdNum : undefined,
  });

  const filtered = useMemo(() => pos.filter(p =>
    !search ||
    p.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
    p.vendorName?.toLowerCase().includes(search.toLowerCase())
  ), [pos, search]);

  // ── Stat counts (from full unfiltered fetch) ──
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const openStatuses = ["Approved", "Issued", "Acknowledged", "PartiallyReceived"];
    const open = pos.filter(p => openStatuses.includes(p.status ?? "")).length;
    const pendingApproval = pos.filter(p => ["Submitted", "PendingApproval"].includes(p.status ?? "")).length;
    const overdue = pos.filter(p => {
      const deadline = (p as any).deliveryDeadline ?? (p as any).expectedDeliveryDate;
      return (p as any).isOverdue || (deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(p.status ?? ""));
    }).length;
    const totalValue = pos.reduce((s, p) => s + Number(p.totalAmount ?? 0), 0);
    return { open, pendingApproval, overdue, totalValue };
  }, [pos]);

  // ── Counts per status (for pills) ──
  const counts = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const result: Record<string, number> = {};
    for (const s of STATUS_FILTERS.slice(1)) {
      result[s] = pos.filter(p => p.status === s).length;
    }
    return result;
  }, [pos]);

  const handleExport = () => {
    exportToCsv(
      `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ["PO Number", "Vendor", "Status", "Total Amount (₹)", "PO Date", "Delivery Deadline", "Approved By"],
      filtered.map(p => [p.poNumber, p.vendorName, p.status, p.totalAmount ?? 0, p.poDate ?? "", (p as any).deliveryDeadline ?? "", p.approvedByName ?? ""])
    );
  };

  const hasUrlFilters = vendorFilter || categoryFilter || projectIdFilter;
  const hasFilters = search.length > 0 || activeStatus !== "all";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 pb-12"
    >
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-[20px] sm:text-[24px] font-bold text-foreground tracking-tight leading-none">
            Purchase Orders
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Full lifecycle from draft through approval, issuance, and payment
          </p>
        </div>
        <div className="flex gap-2 shrink-0 self-start sm:self-auto">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[13px]" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <CanCreate module="procurement">
            <Button
              size="sm"
              className="h-9 px-4 gap-1.5 text-[13px] font-bold bg-primary hover:bg-primary/90 text-white"
              onClick={() => setLocation("/procurement/quotations")}
            >
              <Plus className="h-4 w-4" />
              New PO
            </Button>
          </CanCreate>
        </div>
      </div>

      {/* ── Stat bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Open POs"
          value={<span className="text-blue-700 dark:text-blue-400">{stats.open}</span>}
          icon={ShoppingCart}
          colorClass="bg-blue-50 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-900/60"
          iconBg="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Pending Approval"
          value={
            <span className={stats.pendingApproval > 0 ? "text-purple-700 dark:text-purple-400" : ""}>
              {stats.pendingApproval}
            </span>
          }
          icon={Clock}
          colorClass={stats.pendingApproval > 0
            ? "bg-purple-50 dark:bg-purple-950/30 border-purple-200/60 dark:border-purple-900/60"
            : "bg-card border-border"}
          iconBg={stats.pendingApproval > 0
            ? "bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400"
            : "bg-muted text-muted-foreground"}
        />
        <StatCard
          label="Overdue"
          value={
            <span className={stats.overdue > 0 ? "text-red-600 dark:text-red-400" : ""}>
              {stats.overdue}
            </span>
          }
          icon={AlertTriangle}
          colorClass={stats.overdue > 0
            ? "bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-900/60"
            : "bg-card border-border"}
          iconBg={stats.overdue > 0
            ? "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400"
            : "bg-muted text-muted-foreground"}
        />
        <StatCard
          label="Total Value"
          value={<span className="text-foreground">{formatINRCompact(stats.totalValue)}</span>}
          icon={TrendingUp}
          colorClass="bg-card border-border"
          iconBg="bg-muted text-muted-foreground"
          mono
        />
      </div>

      {/* ── Active URL filters (vendor / category / project) ── */}
      {hasUrlFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {vendorFilter && (
            <>
              <span className="text-[12px] text-muted-foreground">Vendor:</span>
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary text-[12px] font-semibold px-2.5 py-1 rounded-full border border-primary/20">
                {isNumericVendorFilter
                  ? (pos.find(p => p.vendorId === vendorIdNum)?.vendorName ?? `Vendor #${vendorFilter}`)
                  : vendorFilter}
                <button onClick={() => setVendorFilter("")} aria-label="Clear vendor filter" className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            </>
          )}
          {categoryFilter && (
            <>
              <span className="text-[12px] text-muted-foreground">Category:</span>
              <span className="flex items-center gap-1.5 bg-violet-100 text-violet-700 text-[12px] font-semibold px-2.5 py-1 rounded-full border border-violet-200">
                {categoryFilter}
                <button onClick={() => setCategoryFilter("")} aria-label="Clear category filter" className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            </>
          )}
          {projectIdFilter && (
            <>
              <span className="text-[12px] text-muted-foreground">Project:</span>
              <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[12px] font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                Project #{projectIdFilter}
                <button onClick={() => setProjectIdFilter("")} aria-label="Clear project filter" className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="space-y-2.5">
        {/* Search + view toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by PO number or vendor…"
              className="h-8 pl-8 pr-8 text-[13px] bg-background border-border/60"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 border border-border/60 rounded-lg shrink-0">
            {([
              { mode: "cards", Icon: LayoutGrid, label: "Card view" },
              { mode: "list",  Icon: List,       label: "List view" },
            ] as const).map(({ mode, Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-all",
                  viewMode === mode
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => {
            const isActive = activeStatus === s;
            const count    = s === "all" ? pos.length : (counts[s] ?? 0);
            const cfg      = s !== "all" ? getStatusCfg(s) : null;

            return (
              <button
                key={s}
                onClick={() => setActiveStatus(s)}
                className={cn(
                  "h-7 px-2.5 rounded-full text-[12px] font-medium transition-all flex items-center gap-1.5 border",
                  isActive
                    ? "bg-foreground text-background border-foreground shadow-sm font-semibold"
                    : "bg-background text-muted-foreground border-border/60 hover:border-border hover:text-foreground",
                )}
              >
                {cfg && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />}
                <span>{s === "all" ? "All" : cfg?.label ?? s}</span>
                <span className={cn(
                  "text-[10px] font-bold tabular-nums",
                  isActive ? "text-background/60" : "text-muted-foreground/50",
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Error state ── */}
      {isError && (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center p-8 border-2 border-dashed border-red-200 rounded-xl">
          <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground">Failed to load purchase orders</p>
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
      )}

      {/* ── Content area ── */}
      {!isError && (
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SkeletonCards count={6} />
            </motion.div>

          ) : filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={ShoppingCart}
                heading={hasFilters ? "No matching purchase orders" : "No purchase orders found"}
                message={hasFilters ? "Try adjusting your search or status filter." : "Create a PO manually or approve a vendor quotation."}
                action={!hasFilters ? { label: "Create via Quotations", onClick: () => setLocation("/procurement/quotations") } : undefined}
              />
            </motion.div>

          ) : viewMode === "cards" ? (
            <motion.div
              key="cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              {filtered.map((po, i) => (
                <motion.div
                  key={po.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(i * 0.05, 0.4) }}
                >
                  <POCard po={po as any} />
                </motion.div>
              ))}
            </motion.div>

          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              {/* List header */}
              <div className="hidden md:flex items-center gap-4 px-4 py-2.5 border-b border-border/60 bg-muted/30">
                <div className="w-[3px] shrink-0" />
                <div className="w-8 shrink-0 hidden sm:block" />
                <div className="flex-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  PO
                </div>
                <div className="w-32 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hidden sm:block">
                  Status
                </div>
                <div className="w-24 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hidden md:block text-right">
                  Value
                </div>
                <div className="w-24 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hidden lg:block text-right">
                  Deadline
                </div>
                <div className="w-4 shrink-0" />
              </div>

              {filtered.map(po => (
                <PORow key={po.id} po={po as any} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── Count footer ── */}
      {!isLoading && !isError && filtered.length > 0 && (
        <p className="text-[12px] text-muted-foreground/50 text-center">
          Showing {filtered.length} of {pos.length} purchase order{pos.length !== 1 ? "s" : ""}
          {activeStatus !== "all" && ` · ${getStatusCfg(activeStatus).label}`}
          {search && ` · "${search}"`}
        </p>
      )}
    </motion.div>
  );
}
