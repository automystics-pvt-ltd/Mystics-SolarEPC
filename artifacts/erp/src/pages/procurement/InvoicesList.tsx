import { useState } from "react";
import { useGetProcInvoices, getGetProcInvoicesQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, Search, AlertTriangle, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

const STATUS_TABS = ["All", "Draft", "PendingApproval", "Approved", "OnHold", "Paid", "Cancelled"];

const STATUS_COLOR: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  PendingApproval: "bg-purple-50 text-purple-700 border-purple-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OnHold: "bg-amber-50 text-amber-700 border-amber-200",
  Paid: "bg-green-50 text-green-700 border-green-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

const fmt = (n: number | null | undefined) =>
  n != null ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0 })}` : "—";

export default function InvoicesList() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");

  const handleExport = (filtered: any[]) => {
    exportToCsv(
      `invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Invoice Number", "Vendor Invoice No.", "Vendor", "Status", "Match Status", "Net Payable (₹)", "Due Date", "Created At"],
      filtered.map(i => [i.invoiceNumber, i.vendorInvoiceNumber ?? "", i.vendorName, i.status, i.matchStatus ?? "", i.netPayable ?? i.totalAmount ?? 0, i.dueDate ?? "", new Date(i.createdAt).toLocaleDateString("en-IN")])
    );
  };

  const { data: invoices = [], isLoading } = useGetProcInvoices(
    tab !== "All" ? { status: tab as any } : {},
    { query: { queryKey: getGetProcInvoicesQueryKey(tab !== "All" ? { status: tab as any } : {}) } }
  );

  const filtered = (invoices as any[]).filter(i =>
    !search || i.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
    i.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    i.vendorInvoiceNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: (invoices as any[]).length,
    pending: (invoices as any[]).filter((i: any) => ["Draft", "PendingApproval"].includes(i.status)).length,
    mismatches: (invoices as any[]).filter((i: any) => i.matchStatus === "MismatchPending").length,
    totalValue: (invoices as any[]).reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0),
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">3-way matched invoices — Quotation → PO → GRN → Invoice</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport(filtered)}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button className="gap-2 bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/procurement/invoices/new")}>
            <Plus className="w-4 h-4" /> New Invoice
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: stats.total, color: "text-slate-900" },
          { label: "Pending Approval", value: stats.pending, color: "text-purple-600" },
          { label: "Mismatches", value: stats.mismatches, color: "text-red-600" },
          { label: "Total Value", value: fmt(stats.totalValue), color: "text-emerald-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input placeholder="Search invoice number, vendor…" className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-8 flex-wrap">
            {STATUS_TABS.map(t => (
              <TabsTrigger key={t} value={t} className="text-xs px-3 h-7">{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <FileText className="w-10 h-10 mb-3 opacity-40" />
            <p className="font-medium">No invoices found</p>
          </div>
        ) : filtered.map((inv: any) => (
          <div key={inv.id} onClick={() => setLocation(`/procurement/invoices/${inv.id}`)}
            className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-orange-200 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</span>
                    <Badge variant="outline" className={cn("text-xs", STATUS_COLOR[inv.status] ?? "bg-slate-100 text-slate-600")}>{inv.status}</Badge>
                    {inv.matchStatus === "MismatchPending" && (
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 gap-1">
                        <AlertTriangle className="w-3 h-3" /> Mismatch
                      </Badge>
                    )}
                    {inv.matchStatus === "MismatchApproved" && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Mismatch Approved</Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{inv.vendorName}</p>
                  {inv.vendorInvoiceNumber && <p className="text-xs text-slate-400">Vendor Inv: {inv.vendorInvoiceNumber}</p>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-bold text-slate-900">{fmt(inv.totalAmount)}</p>
                <p className="text-xs text-slate-500 mt-0.5">PO #{inv.poId}</p>
                <p className="text-xs text-slate-400">{new Date(inv.createdAt).toLocaleDateString("en-IN")}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
