import { useState } from "react";
import { useGetProcurementQuotations } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Plus, Search, FileText, ChevronRight, Star, Clock, CheckCircle2, XCircle, AlertCircle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  Draft: { color: "bg-slate-100 text-slate-600 border-slate-200", icon: FileText },
  Submitted: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
  UnderReview: { color: "bg-amber-50 text-amber-700 border-amber-200", icon: Eye },
  RevisionRequested: { color: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertCircle },
  Approved: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  Rejected: { color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
};

const TABS = ["All", "Draft", "Submitted", "UnderReview", "RevisionRequested", "Approved", "Rejected"];

export default function ProcurementQuotationsList() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");

  const { data: quotations = [], isLoading } = useGetProcurementQuotations({
    status: activeTab !== "All" ? activeTab : undefined,
  });

  const filtered = quotations.filter(q =>
    !search ||
    q.referenceId?.toLowerCase().includes(search.toLowerCase()) ||
    q.vendorSnapshotName?.toLowerCase().includes(search.toLowerCase())
  );

  const counts = TABS.reduce((acc, t) => {
    acc[t] = t === "All" ? quotations.length : quotations.filter(q => q.status === t).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Quotations</h1>
          <p className="text-sm text-gray-500 mt-1">Procurement quotation workflow with approval tracking and L1 analysis</p>
        </div>
        <Button onClick={() => setLocation("/procurement/quotations/new")} className="gap-2">
          <Plus className="w-4 h-4" /> New Quotation
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === tab
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            )}
          >
            {tab === "UnderReview" ? "Under Review" : tab === "RevisionRequested" ? "Revision Req." : tab}
            {counts[tab] > 0 && <span className="ml-1.5 bg-current/20 rounded-full px-1.5 py-0.5">{counts[tab]}</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by reference ID or vendor name…" className="pl-9" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: quotations.length },
          { label: "Approved", value: counts["Approved"], color: "text-emerald-600" },
          { label: "Pending Review", value: (counts["Submitted"] ?? 0) + (counts["UnderReview"] ?? 0), color: "text-amber-600" },
          { label: "PO Generated", value: quotations.filter(q => q.poGenerated).length, color: "text-blue-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={cn("text-2xl font-bold mt-1", s.color ?? "text-slate-900")}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 border-2 border-dashed border-slate-200 rounded-xl">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No quotations found</p>
          <Button size="sm" variant="link" className="text-orange-600 mt-2" onClick={() => setLocation("/procurement/quotations/new")}>Create the first quotation</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q, i) => {
            const cfg = STATUS_CONFIG[q.status ?? "Draft"] ?? STATUS_CONFIG["Draft"];
            const Icon = cfg.icon;
            return (
              <motion.div key={q.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div
                  onClick={() => setLocation(`/procurement/quotations/${q.id}`)}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-orange-200 hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-slate-900 text-sm">{q.referenceId}</span>
                      <Badge variant="outline" className={cn("text-xs", cfg.color)}>{q.status === "UnderReview" ? "Under Review" : q.status === "RevisionRequested" ? "Revision Req." : q.status}</Badge>
                      {q.isL1 && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200"><Star className="w-2.5 h-2.5 mr-0.5" /> L1</Badge>}
                      {q.poGenerated && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">PO Generated</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{q.vendorSnapshotName ?? "No vendor"}</span>
                      {q.mrId && <span>· MR #{q.mrId}</span>}
                      <span>· v{q.version}</span>
                      <span>· {new Date(q.createdAt!).toLocaleDateString("en-IN")}</span>
                      {q.createdByName && <span>· by {q.createdByName}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-900 font-mono">₹{Number(q.totalAmount ?? 0).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{q.validityDate ? `Valid till ${q.validityDate}` : "No expiry"}</p>
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
