import { useState, useEffect } from "react";
import { useGetProcurementPOs } from "@workspace/api-client-react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Search, ShoppingCart, ChevronRight, Clock, XCircle, Download, X, AlertCircle } from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  Draft:             { color: "bg-slate-100 text-slate-600 border-slate-200",   label: "Draft" },
  Submitted:         { color: "bg-purple-50 text-purple-700 border-purple-200", label: "Submitted" },
  PendingApproval:   { color: "bg-purple-50 text-purple-700 border-purple-200", label: "Pending Approval" },
  Approved:          { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Approved" },
  Rejected:          { color: "bg-red-50 text-red-700 border-red-200",          label: "Rejected" },
  OnHold:            { color: "bg-amber-50 text-amber-700 border-amber-200",    label: "On Hold" },
  Revised:           { color: "bg-slate-100 text-slate-600 border-slate-200",   label: "Revised" },
  Issued:            { color: "bg-blue-50 text-blue-700 border-blue-200",       label: "Issued" },
  Acknowledged:      { color: "bg-amber-50 text-amber-700 border-amber-200",    label: "Acknowledged" },
  PartiallyReceived: { color: "bg-orange-50 text-orange-700 border-orange-200", label: "Partially Received" },
  FullyReceived:     { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Fully Received" },
  InvoiceMatched:    { color: "bg-teal-50 text-teal-700 border-teal-200",       label: "Invoice Matched" },
  PaymentPending:    { color: "bg-yellow-50 text-yellow-700 border-yellow-200", label: "Payment Pending" },
  Paid:              { color: "bg-green-50 text-green-700 border-green-200",    label: "Paid" },
  Closed:            { color: "bg-slate-100 text-slate-500 border-slate-200",   label: "Closed" },
  Cancelled:         { color: "bg-red-50 text-red-700 border-red-200",          label: "Cancelled" },
};

const SLA_CONFIG: Record<string, { color: string }> = {
  OnTrack: { color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DueSoon: { color: "bg-amber-50 text-amber-700 border-amber-200" },
  Breached:{ color: "bg-red-50 text-red-700 border-red-200" },
};

const STATUS_TABS = ["All", "Draft", "Submitted", "Approved", "Issued", "Acknowledged", "PartiallyReceived", "FullyReceived", "Closed", "Cancelled"];
const STATUS_LABELS: Record<string, string> = {
  PartiallyReceived: "Partial", FullyReceived: "Received",
  Submitted: "Submitted", Approved: "Approved",
};

export default function ProcurementPOsList() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const urlStatus    = params.get("status")    ?? "";
  const urlVendor    = params.get("vendor")    ?? "";
  const urlCategory  = params.get("category")  ?? "";
  const urlProjectId = params.get("projectId") ?? "";

  const validStatuses = ["All", ...Object.keys(STATUS_CONFIG)];
  const initialTab = validStatuses.includes(urlStatus) ? urlStatus : "All";

  const [activeTab, setActiveTab]           = useState(initialTab);
  const [search, setSearch]                 = useState("");
  const [vendorFilter, setVendorFilter]     = useState(urlVendor);
  const [categoryFilter, setCategoryFilter] = useState(urlCategory);
  const [projectIdFilter, setProjectIdFilter] = useState(urlProjectId);

  useEffect(() => {
    const p = new URLSearchParams(searchStr);
    const s  = p.get("status")    ?? "";
    const v  = p.get("vendor")    ?? "";
    const c  = p.get("category")  ?? "";
    const pi = p.get("projectId") ?? "";
    if (s && validStatuses.includes(s)) setActiveTab(s);
    setVendorFilter(v);
    setCategoryFilter(c);
    setProjectIdFilter(pi);
  }, [searchStr]);

  const vendorIdNum = vendorFilter ? Number(vendorFilter) : NaN;
  const isNumericVendorFilter = vendorFilter !== "" && !isNaN(vendorIdNum);
  const projectIdNum = projectIdFilter ? Number(projectIdFilter) : NaN;
  const hasProjectFilter = projectIdFilter !== "" && !isNaN(projectIdNum);

  const { data: pos = [], isLoading, isError, error, refetch } = useGetProcurementPOs({
    status:    activeTab !== "All" ? activeTab : undefined,
    vendorId:  isNumericVendorFilter ? vendorIdNum : undefined,
    vendor:    !isNumericVendorFilter && vendorFilter ? vendorFilter : undefined,
    category:  categoryFilter || undefined,
    projectId: hasProjectFilter ? projectIdNum : undefined,
  });

  const filtered = pos.filter(p =>
    !search ||
    p.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
    p.vendorName?.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = pos.reduce((s, p) => s + Number(p.totalAmount ?? 0), 0);
  const pendingApproval = pos.filter(p => ["Submitted", "PendingApproval"].includes(p.status ?? "")).length;

  const handleExport = () => {
    exportToCsv(
      `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ["PO Number", "Vendor", "Status", "Total Amount (₹)", "PO Date", "Delivery Deadline", "Approved By"],
      filtered.map(p => [p.poNumber, p.vendorName, p.status, p.totalAmount ?? 0, p.poDate ?? "", p.deliveryDeadline ?? "", p.approvedByName ?? ""])
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Full lifecycle from draft through approval, issuance, and payment</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === tab ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300")}>
            {STATUS_LABELS[tab] ?? tab}
          </button>
        ))}
      </div>

      {/* Active Filters */}
      {(vendorFilter || categoryFilter || projectIdFilter) && (
        <div className="flex items-center gap-2 flex-wrap">
          {vendorFilter && (
            <>
              <span className="text-xs text-slate-500">Vendor:</span>
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full border border-primary/20">
                {isNumericVendorFilter
                  ? (pos.find(p => p.vendorId === vendorIdNum)?.vendorName ?? `Vendor #${vendorFilter}`)
                  : vendorFilter}
                <button onClick={() => setVendorFilter("")} aria-label="Clear vendor filter" className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            </>
          )}
          {categoryFilter && (
            <>
              <span className="text-xs text-slate-500">Category:</span>
              <span className="flex items-center gap-1.5 bg-violet-100 text-violet-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-violet-200">
                {categoryFilter}
                <button onClick={() => setCategoryFilter("")} aria-label="Clear category filter" className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            </>
          )}
          {projectIdFilter && (
            <>
              <span className="text-xs text-slate-500">Project:</span>
              <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                Project #{projectIdFilter}
                <button onClick={() => setProjectIdFilter("")} aria-label="Clear project filter" className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            </>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by PO number or vendor…" className="pl-9" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total POs",        value: pos.length },
          { label: "Total Value",      value: `₹${totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
          { label: "Pending Approval", value: pendingApproval, color: pendingApproval > 0 ? "text-purple-600" : "text-slate-900" },
          { label: "Fully Received",   value: pos.filter(p => p.status === "FullyReceived").length, color: "text-emerald-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={cn("text-xl font-bold mt-1", (s as any).color ?? "text-slate-900")}>{s.value}</p>
          </div>
        ))}
      </div>

      {isError ? (
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
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({length: 4}).map((_, i) => <div key={i} className="h-20 rounded-xl shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
          <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <ShoppingCart className="w-7 h-7 text-gray-400" />
          </div>
          <p className="font-bold text-gray-700 mb-1">No purchase orders found</p>
          <p className="text-sm text-gray-400">Create a PO manually or approve a vendor quotation</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((po, i) => {
            const cfg = STATUS_CONFIG[po.status ?? "Draft"] ?? STATUS_CONFIG["Draft"]!;
            const today = new Date().toISOString().split("T")[0];
            const deadline = (po as any).deliveryDeadline ?? (po as any).expectedDeliveryDate;
            const overdue = (po as any).isOverdue || (deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(po.status ?? ""));
            const slaStatus = (po as any).slaStatus as string | undefined;
            const isPendingApproval = ["Submitted", "PendingApproval"].includes(po.status ?? "");
            const isRejected = po.status === "Rejected";

            return (
              <motion.div key={po.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div
                  onClick={() => setLocation(`/procurement/pos/${po.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setLocation(`/procurement/pos/${po.id}`); }}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "bg-white border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-sm transition-all group",
                    overdue    ? "border-red-200 hover:border-red-300" :
                    isRejected ? "border-red-100 hover:border-red-200" :
                    isPendingApproval ? "border-purple-200 hover:border-purple-300" :
                    "border-slate-200 hover:border-orange-200"
                  )}>
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    overdue ? "bg-red-50" : isPendingApproval ? "bg-purple-50" : "bg-slate-100")}>
                    <ShoppingCart className={cn("w-5 h-5", overdue ? "text-red-400" : isPendingApproval ? "text-purple-400" : "text-slate-400")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono font-bold text-slate-900 text-sm">{po.poNumber}</span>
                      <Badge variant="outline" className={cn("text-xs", cfg.color)}>{cfg.label}</Badge>
                      {overdue && <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">Overdue</Badge>}
                      {slaStatus && slaStatus !== "OnTrack" && (
                        <Badge variant="outline" className={cn("text-xs", SLA_CONFIG[slaStatus]?.color ?? "")}>
                          SLA: {slaStatus}
                        </Badge>
                      )}
                      {isRejected && <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 flex items-center gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span>{po.vendorName}</span>
                      {po.poDate && <span>· {new Date(po.poDate).toLocaleDateString("en-IN")}</span>}
                      {po.approvedByName && <span>· Approved by {po.approvedByName}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-900 font-mono">₹{Number(po.totalAmount ?? 0).toLocaleString("en-IN")}</p>
                    {isPendingApproval && <p className="text-xs mt-0.5 text-purple-600 font-semibold">⏳ Awaiting approval</p>}
                    {!isPendingApproval && deadline && (
                      <p className={cn("text-xs mt-0.5", overdue ? "text-red-600 font-semibold" : "text-slate-400")}>
                        {overdue ? "⚠ " : ""}Deliver by {deadline}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-400 shrink-0" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
