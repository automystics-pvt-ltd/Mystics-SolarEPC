import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Download, ScrollText, Clock } from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

type AuditEntry = {
  id: string;
  timestamp: string;
  module: string;
  docRef: string;
  action: string;
  performedBy: string;
  remarks: string;
};

const MODULE_COLOR: Record<string, string> = {
  "GRN Return": "bg-purple-50 text-purple-700 border-purple-200",
  "Purchase Order": "bg-blue-50 text-blue-700 border-blue-200",
  "GRN": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Invoice": "bg-orange-50 text-orange-700 border-orange-200",
};

const ACTION_COLOR: Record<string, string> = {
  Created: "bg-gray-100 text-gray-600",
  Submitted: "bg-blue-100 text-blue-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Dispatched: "bg-purple-100 text-purple-700",
  Closed: "bg-gray-100 text-gray-500",
  Cancelled: "bg-red-100 text-red-600",
  Rejected: "bg-red-100 text-red-600",
};

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // GRN Returns audit data
  const { data: grnReturns = [], isLoading: rtvLoading } = useQuery({
    queryKey: ["grn-returns-audit"],
    queryFn: () => apiGet<any[]>("/grn-returns"),
    retry: false,
  });

  // PO audit logs
  const { data: poLogs = [], isLoading: poLoading } = useQuery({
    queryKey: ["po-audit-logs"],
    queryFn: () => apiGet<any[]>("/proc-po-audit"),
    retry: false,
  });

  // GRN audit logs
  const { data: grnLogs = [], isLoading: grnLoading } = useQuery({
    queryKey: ["grn-audit-logs"],
    queryFn: () => apiGet<any[]>("/proc-grn-audit"),
    retry: false,
  });

  // Build unified audit entries from GRN Returns
  const rtvEntries: AuditEntry[] = useMemo(() => {
    const entries: AuditEntry[] = [];
    (grnReturns as any[]).forEach(rtv => {
      if (rtv.createdAt) entries.push({
        id: `rtv-${rtv.id}-created`,
        timestamp: rtv.createdAt,
        module: "GRN Return",
        docRef: rtv.returnNumber,
        action: "Created",
        performedBy: rtv.createdByName || "—",
        remarks: `Vendor: ${rtv.vendorName}`,
      });
      if (rtv.submittedAt) entries.push({
        id: `rtv-${rtv.id}-submitted`,
        timestamp: rtv.submittedAt,
        module: "GRN Return",
        docRef: rtv.returnNumber,
        action: "Submitted",
        performedBy: rtv.submittedByName || "—",
        remarks: "Submitted for approval",
      });
      if (rtv.approvedAt) entries.push({
        id: `rtv-${rtv.id}-approved`,
        timestamp: rtv.approvedAt,
        module: "GRN Return",
        docRef: rtv.returnNumber,
        action: "Approved",
        performedBy: rtv.approvedByName || "—",
        remarks: rtv.approvalRemarks || "",
      });
      if (rtv.dispatchedAt) entries.push({
        id: `rtv-${rtv.id}-dispatched`,
        timestamp: rtv.dispatchedAt,
        module: "GRN Return",
        docRef: rtv.returnNumber,
        action: "Dispatched",
        performedBy: rtv.dispatchedByName || "—",
        remarks: "",
      });
      if (rtv.closedAt) entries.push({
        id: `rtv-${rtv.id}-closed`,
        timestamp: rtv.closedAt,
        module: "GRN Return",
        docRef: rtv.returnNumber,
        action: "Closed",
        performedBy: rtv.closedByName || "—",
        remarks: rtv.creditNoteNumber ? `CN: ${rtv.creditNoteNumber}` : "",
      });
    });
    return entries;
  }, [grnReturns]);

  // Build from PO audit logs
  const poEntries: AuditEntry[] = useMemo(() => {
    if (!Array.isArray(poLogs)) return [];
    return (poLogs as any[]).map(l => ({
      id: `po-${l.id}`,
      timestamp: l.createdAt,
      module: "Purchase Order",
      docRef: l.poNumber || `PO#${l.poId}`,
      action: l.action,
      performedBy: l.performedByName || "—",
      remarks: l.remarks || "",
    }));
  }, [poLogs]);

  // Build from GRN audit logs
  const grnEntries: AuditEntry[] = useMemo(() => {
    if (!Array.isArray(grnLogs)) return [];
    return (grnLogs as any[]).map(l => ({
      id: `grn-${l.id}`,
      timestamp: l.createdAt,
      module: "GRN",
      docRef: l.grnNumber || `GRN#${l.grnId}`,
      action: l.action,
      performedBy: l.performedByName || "—",
      remarks: l.remarks || "",
    }));
  }, [grnLogs]);

  const allEntries = useMemo(() => {
    return [...rtvEntries, ...poEntries, ...grnEntries]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [rtvEntries, poEntries, grnEntries]);

  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      if (module !== "All" && e.module !== module) return false;
      if (search && !e.docRef?.toLowerCase().includes(search.toLowerCase()) &&
        !e.performedBy?.toLowerCase().includes(search.toLowerCase()) &&
        !e.action?.toLowerCase().includes(search.toLowerCase())) return false;
      if (fromDate && new Date(e.timestamp) < new Date(fromDate)) return false;
      if (toDate && new Date(e.timestamp) > new Date(toDate + "T23:59:59")) return false;
      return true;
    });
  }, [allEntries, module, search, fromDate, toDate]);

  const isLoading = rtvLoading;
  const modules = ["All", "GRN Return", "Purchase Order", "GRN", "Invoice"];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-0.5">System-wide activity trail across all modules</p>
      </div>

      {/* Filters */}
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <Tabs value={module} onValueChange={setModule}>
            <TabsList className="h-9">
              {modules.map(m => <TabsTrigger key={m} value={m} className="text-xs">{m}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by doc ref, action, or user..." className="pl-9 h-9 text-sm" />
            </div>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9 w-36 text-sm" placeholder="From date" />
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9 w-36 text-sm" placeholder="To date" />
            <Button variant="outline" size="sm" className="gap-1 h-9 text-xs" onClick={() =>
              exportToCsv(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Timestamp", "Module", "Document Ref", "Action", "Performed By", "Remarks"],
                filtered.map(e => [new Date(e.timestamp).toLocaleString("en-IN"), e.module, e.docRef, e.action, e.performedBy, e.remarks]))}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span className="flex items-center gap-1">
          <ScrollText className="h-4 w-4" /> {filtered.length} entries
        </span>
        {(fromDate || toDate) && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600" onClick={() => { setFromDate(""); setToDate(""); }}>
            Clear date filter
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="border-gray-200/60 shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ScrollText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No audit entries found</p>
            <p className="text-gray-400 text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Timestamp", "Module", "Document", "Action", "Performed By", "Remarks"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <motion.tr
                    key={e.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                        <Clock className="h-3 w-3" />
                        {new Date(e.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={cn("text-xs", MODULE_COLOR[e.module] ?? "bg-gray-50 text-gray-600")}>
                        {e.module}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-orange-600">{e.docRef}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", ACTION_COLOR[e.action] ?? "bg-gray-100 text-gray-600")}>
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{e.performedBy}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs max-w-xs truncate">{e.remarks || "—"}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
