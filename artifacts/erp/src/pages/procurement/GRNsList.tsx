import { useState } from "react";
import { useGetProcGrns, getGetProcGrnsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Package, Search, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

const STATUS_TABS = ["All", "Draft", "Submitted", "Accepted", "PartiallyAccepted", "Rejected"];

const STATUS_COLOR: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Submitted: "bg-blue-50 text-blue-700 border-blue-200",
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PartiallyAccepted: "bg-amber-50 text-amber-700 border-amber-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

export default function GRNsList() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");

  const handleExport = (filtered: any[]) => {
    exportToCsv(
      `grns-${new Date().toISOString().slice(0, 10)}.csv`,
      ["GRN Number", "Vendor", "PO ID", "Status", "Delivery Date", "Accepted Qty", "Ordered Qty", "Created At"],
      filtered.map(g => [g.grnNumber, g.vendorName, g.poId, g.status, g.deliveryDate ?? "", g.totalAcceptedQty ?? "", g.totalOrderedQty ?? "", new Date(g.createdAt).toLocaleDateString("en-IN")])
    );
  };

  const { data: grns = [], isLoading } = useGetProcGrns(
    tab !== "All" ? { status: tab as any } : {},
    { query: { queryKey: getGetProcGrnsQueryKey(tab !== "All" ? { status: tab as any } : {}) } }
  );

  const filtered = (grns as any[]).filter(g =>
    !search || g.grnNumber?.toLowerCase().includes(search.toLowerCase()) ||
    g.vendorName?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: (grns as any[]).length,
    pending: (grns as any[]).filter((g: any) => ["Draft", "Submitted"].includes(g.status)).length,
    accepted: (grns as any[]).filter((g: any) => ["Accepted", "PartiallyAccepted"].includes(g.status)).length,
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Goods Receipt Notes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record and inspect incoming deliveries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport(filtered)}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button className="gap-2 bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/procurement/grns/new")}>
            <Plus className="w-4 h-4" /> New GRN
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total GRNs", value: stats.total, color: "text-slate-900" },
          { label: "Pending Inspection", value: stats.pending, color: "text-amber-600" },
          { label: "Accepted", value: stats.accepted, color: "text-emerald-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={cn("text-3xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input placeholder="Search GRN number or vendor…" className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-8">
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
            <Package className="w-10 h-10 mb-3 opacity-40" />
            <p className="font-medium">No GRNs found</p>
          </div>
        ) : filtered.map((grn: any) => (
          <div key={grn.id} onClick={() => setLocation(`/procurement/grns/${grn.id}`)}
            className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-orange-200 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{grn.grnNumber}</span>
                    <Badge variant="outline" className={cn("text-xs", STATUS_COLOR[grn.status] ?? "bg-slate-100 text-slate-600")}>{grn.status}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{grn.vendorName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">PO #{grn.poId}</p>
                <p className="text-xs text-slate-400 mt-0.5">{grn.deliveryDate ?? "No delivery date"}</p>
                {grn.totalAcceptedQty != null && (
                  <p className="text-xs text-emerald-600 mt-0.5">Accepted: {grn.totalAcceptedQty} / {grn.totalOrderedQty}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
