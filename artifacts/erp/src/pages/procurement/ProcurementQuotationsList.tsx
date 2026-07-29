import { useState } from "react";
import { useGetProcurementQuotations } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Plus, Search, FileText, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, StatusBadge, ExportButton } from "@/components/shared";

const TABS = ["All", "Draft", "Submitted", "UnderReview", "RevisionRequested", "Approved", "Rejected"];

export default function ProcurementQuotationsList() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");

  const { data: quotations = [], isPending } = useGetProcurementQuotations({
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
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Vendor Quotations"
        subtitle="Procurement quotation workflow with approval tracking and L1 analysis"
        actions={
          <div className="flex items-center gap-2">
            <ExportButton
              config={{
                title: "Vendor Quotations",
                module: "procurement",
                filename: "Procurement_VendorQuotations",
                columns: [
                  { header: "Reference ID",  key: "referenceId"        },
                  { header: "Status",        key: "status"             },
                  { header: "Vendor",        key: "vendorSnapshotName" },
                  { header: "Total (₹)",     key: "totalAmount"        },
                  { header: "Version",       key: "version"            },
                  { header: "L1",            key: "isL1", formatter: (v) => v ? "Yes" : "No" },
                  { header: "PO Generated",  key: "poGenerated", formatter: (v) => v ? "Yes" : "No" },
                  { header: "Valid Till",    key: "validityDate"       },
                  { header: "Created",       key: "createdAt"          },
                  { header: "Created By",    key: "createdByName"      },
                ],
                getRows: () => filtered as unknown as Record<string, unknown>[],
              }}
              size="sm"
            />
            <Button onClick={() => setLocation("/procurement/quotations/new")} className="gap-2">
              <Plus className="w-4 h-4" /> New Quotation
            </Button>
          </div>
        }
      />

      {/* Status tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === tab
                ? "bg-foreground text-background"
                : "bg-card border border-border text-muted-foreground hover:border-border/80"
            )}
          >
            {tab === "UnderReview" ? "Under Review" : tab === "RevisionRequested" ? "Revision Req." : tab}
            {counts[tab] > 0 && <span className="ml-1.5 bg-current/20 rounded-full px-1.5 py-0.5">{counts[tab]}</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("text-2xl font-bold mt-1", s.color ?? "text-foreground")}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {isPending ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 border-2 border-dashed border-border rounded-xl">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No quotations found</p>
          <Button size="sm" variant="link" className="text-orange-600 mt-2" onClick={() => setLocation("/procurement/quotations/new")}>Create the first quotation</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q, i) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <div
                onClick={() => setLocation(`/procurement/quotations/${q.id}`)}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-orange-200 hover:shadow-sm transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-foreground text-sm">{q.referenceId}</span>
                    <StatusBadge status={q.status ?? "Draft"} size="sm" />
                    {q.isL1 && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200"><Star className="w-2.5 h-2.5 mr-0.5" /> L1</Badge>}
                    {q.poGenerated && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">PO Generated</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{q.vendorSnapshotName ?? "No vendor"}</span>
                    {q.mrId && <span>· MR #{q.mrId}</span>}
                    <span>· v{q.version}</span>
                    <span>· {new Date(q.createdAt!).toLocaleDateString("en-IN")}</span>
                    {q.createdByName && <span>· by {q.createdByName}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-foreground font-mono">₹{Number(q.totalAmount ?? 0).toLocaleString("en-IN")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{q.validityDate ? `Valid till ${q.validityDate}` : "No expiry"}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-orange-400 shrink-0" />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
