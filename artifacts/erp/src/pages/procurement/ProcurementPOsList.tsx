import { useState } from "react";
import { useGetProcurementPOs } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Search, ShoppingCart, ChevronRight, CheckCircle2, Truck, XCircle, Clock, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { color: string }> = {
  Draft: { color: "bg-slate-100 text-slate-600 border-slate-200" },
  Issued: { color: "bg-blue-50 text-blue-700 border-blue-200" },
  Acknowledged: { color: "bg-amber-50 text-amber-700 border-amber-200" },
  PartiallyReceived: { color: "bg-orange-50 text-orange-700 border-orange-200" },
  FullyReceived: { color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Closed: { color: "bg-slate-100 text-slate-500 border-slate-200" },
  Cancelled: { color: "bg-red-50 text-red-700 border-red-200" },
};

const TABS = ["All", "Draft", "Issued", "Acknowledged", "PartiallyReceived", "FullyReceived", "Closed"];

export default function ProcurementPOsList() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");

  const handleExport = (pos: any[], filtered: any[]) => {
    exportToCsv(
      `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ["PO Number", "Vendor", "Status", "Total Amount (₹)", "PO Date", "Delivery Deadline", "Approved By"],
      filtered.map(p => [p.poNumber, p.vendorName, p.status, p.totalAmount ?? 0, p.poDate ?? "", p.deliveryDeadline ?? "", p.approvedByName ?? ""])
    );
  };

  const { data: pos = [], isLoading } = useGetProcurementPOs({
    status: activeTab !== "All" ? activeTab : undefined,
  });

  const filtered = pos.filter(p =>
    !search ||
    p.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
    p.vendorName?.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = pos.reduce((s, p) => s + Number(p.totalAmount ?? 0), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Auto-generated from approved vendor quotations</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport(pos, filtered)}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === tab ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300")}>
            {tab === "PartiallyReceived" ? "Partial" : tab === "FullyReceived" ? "Received" : tab}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by PO number or vendor…" className="pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total POs", value: pos.length },
          { label: "Total Value", value: `₹${totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
          { label: "Fully Received", value: pos.filter(p => p.status === "FullyReceived").length, color: "text-emerald-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={cn("text-xl font-bold mt-1", (s as any).color ?? "text-slate-900")}>{s.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 border-2 border-dashed border-slate-200 rounded-xl">
          <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No purchase orders found</p>
          <p className="text-slate-400 text-sm mt-1">POs are auto-generated when a quotation is approved</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((po, i) => {
            const cfg = STATUS_CONFIG[po.status ?? "Draft"] ?? STATUS_CONFIG["Draft"];
            return (
              <motion.div key={po.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div onClick={() => setLocation(`/procurement/pos/${po.id}`)}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-orange-200 hover:shadow-sm transition-all group">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-slate-900 text-sm">{po.poNumber}</span>
                      <Badge variant="outline" className={cn("text-xs", cfg.color)}>{po.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{po.vendorName}</span>
                      {po.poDate && <span>· {new Date(po.poDate).toLocaleDateString("en-IN")}</span>}
                      {po.approvedByName && <span>· Approved by {po.approvedByName}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-900 font-mono">₹{Number(po.totalAmount ?? 0).toLocaleString("en-IN")}</p>
                    {po.deliveryDeadline && <p className="text-xs text-slate-400 mt-0.5">Deliver by {po.deliveryDeadline}</p>}
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
