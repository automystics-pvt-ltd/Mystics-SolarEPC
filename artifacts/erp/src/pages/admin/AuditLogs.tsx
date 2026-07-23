import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clock, Download, ScrollText } from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";
import { PageHeader, DataTable } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";

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
  Created: "bg-muted text-muted-foreground",
  Submitted: "bg-blue-100 text-blue-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Dispatched: "bg-purple-100 text-purple-700",
  Closed: "bg-muted text-muted-foreground",
  Cancelled: "bg-red-100 text-red-600",
  Rejected: "bg-red-100 text-red-600",
};

const MODULE_OPTIONS = ["GRN Return", "Purchase Order", "GRN", "Invoice"].map(m => ({ label: m, value: m }));
const ACTION_OPTIONS = ["Created", "Submitted", "Approved", "Dispatched", "Closed", "Cancelled", "Rejected"].map(a => ({ label: a, value: a }));

export default function AuditLogs() {
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

  // Date-filtered entries (module/action/search handled by DataTable)
  const dateFiltered = useMemo(() => {
    return allEntries.filter(e => {
      if (fromDate && new Date(e.timestamp) < new Date(fromDate)) return false;
      if (toDate && new Date(e.timestamp) > new Date(toDate + "T23:59:59")) return false;
      return true;
    });
  }, [allEntries, fromDate, toDate]);

  const isLoading = rtvLoading || poLoading || grnLoading;

  const columns: ColumnDef<AuditEntry, any>[] = [
    {
      accessorKey: "timestamp",
      header: "Timestamp",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <Clock className="h-3 w-3" />
          {new Date(row.original.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
        </div>
      ),
    },
    {
      accessorKey: "performedBy",
      header: "User",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground">{row.original.performedBy}</span>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", ACTION_COLOR[row.original.action] ?? "bg-muted text-muted-foreground")}>
          {row.original.action}
        </span>
      ),
    },
    {
      accessorKey: "module",
      header: "Entity Type",
      cell: ({ row }) => (
        <Badge variant="outline" className={cn("text-xs", MODULE_COLOR[row.original.module] ?? "bg-muted text-muted-foreground")}>
          {row.original.module}
        </Badge>
      ),
    },
    {
      accessorKey: "docRef",
      header: "Entity Ref",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-orange-600">{row.original.docRef}</span>
      ),
    },
    {
      accessorKey: "remarks",
      header: "Remarks",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground max-w-xs truncate block">{row.original.remarks || "—"}</span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <PageHeader
        title="Audit Logs"
        subtitle="System-wide change trail and compliance history"
        actions={
          <Button variant="outline" size="sm" className="gap-1 h-9 text-xs" onClick={() =>
            exportToCsv(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
              ["Timestamp", "Module", "Document Ref", "Action", "Performed By", "Remarks"],
              dateFiltered.map(e => [new Date(e.timestamp).toLocaleString("en-IN"), e.module, e.docRef, e.action, e.performedBy, e.remarks]))}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        }
      />

      {/* Date range filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground font-medium">Date range:</span>
        <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9 w-36 text-sm" />
        <span className="text-muted-foreground text-sm">to</span>
        <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9 w-36 text-sm" />
        {(fromDate || toDate) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600" onClick={() => { setFromDate(""); setToDate(""); }}>
            Clear
          </Button>
        )}
        <span className="flex items-center gap-1 text-sm text-muted-foreground ml-auto">
          <ScrollText className="h-4 w-4" /> {dateFiltered.length} entries
        </span>
      </div>

      <DataTable
        data={dateFiltered}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search by doc ref, action, or user..."
        exportFilename="audit-logs"
        filterOptions={[
          {
            key: "action",
            label: "Action",
            options: ACTION_OPTIONS,
          },
          {
            key: "module",
            label: "Entity Type",
            options: MODULE_OPTIONS,
          },
        ]}
        emptyIcon={ScrollText}
        emptyTitle="No audit entries found"
        emptyDescription="Try adjusting your filters"
        noSelection
      />
    </motion.div>
  );
}
