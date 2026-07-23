import { useState } from "react";
import { useGetProcInvoices, getGetProcInvoicesQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, FileText, AlertTriangle, Clock, TrendingUp,
  CheckCircle2, DollarSign, BarChart3,
} from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import { apiGet } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";

const fmt = (n: number | null | undefined) =>
  n != null ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0 })}` : "—";

const fmtCompact = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Draft", value: "Draft" },
  { label: "Pending", value: "PendingApproval" },
  { label: "Approved", value: "Approved" },
  { label: "Part. Paid", value: "PartiallyPaid" },
  { label: "Paid", value: "Paid" },
  { label: "On Hold", value: "OnHold" },
  { label: "Disputed", value: "Disputed" },
  { label: "Cancelled", value: "Cancelled" },
];

const STATUS_FILTER_OPTIONS = STATUS_TABS.slice(1).map(s => ({ label: s.label, value: s.value }));

function AgingChip({ agingDays, status }: { agingDays: number | null; status: string }) {
  if (agingDays === null || ["Paid", "Cancelled"].includes(status)) return <span className="text-xs text-muted-foreground">—</span>;
  if (agingDays <= 0) {
    const daysLeft = Math.abs(agingDays);
    if (daysLeft === 0) return <span className="text-xs font-bold text-orange-600">Due today</span>;
    if (daysLeft <= 7) return <span className="text-xs font-medium text-amber-600">Due in {daysLeft}d</span>;
    return <span className="text-xs text-emerald-600">Due in {daysLeft}d</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
      <Clock className="w-3 h-3" /> {agingDays}d overdue
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  if (type === "CreditNote") return <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">CN</span>;
  if (type === "DebitNote") return <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">DN</span>;
  return null;
}

export default function InvoicesList() {
  const [, setLocation] = useLocation();
  const [activeStatus, setActiveStatus] = useState("");

  const params: any = {};
  if (activeStatus) params.status = activeStatus;

  const { data: invoices = [], isLoading } = useGetProcInvoices(params, {
    query: { queryKey: getGetProcInvoicesQueryKey(params) }
  });

  const { data: stats } = useQuery({
    queryKey: ["invoice-stats"],
    queryFn: () => apiGet<any>("/proc-invoices/stats"),
    staleTime: 60000,
  });

  const handleExport = () => {
    exportToCsv(
      `invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Invoice #", "Type", "Vendor Invoice #", "Vendor", "PO #", "Status", "Match Status", "Net Payable (₹)", "Paid (₹)", "Due Date", "Aging (days)", "Created At"],
      (invoices as any[]).map(i => [
        i.invoiceNumber, i.invoiceType ?? "Standard", i.vendorInvoiceNumber ?? "",
        i.vendorName, `#${i.poId}`, i.status, i.matchStatus ?? "",
        i.netPayable ?? 0, i.paidAmount ?? 0, i.dueDate ?? "",
        i.agingDays ?? "", new Date(i.createdAt).toLocaleDateString("en-IN"),
      ])
    );
  };

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-sm text-foreground">{row.original.invoiceNumber}</span>
          <TypeBadge type={row.original.invoiceType ?? "Standard"} />
          {row.original.isDuplicateFlagged && (
            <span title="Duplicate flagged">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "vendorName",
      header: "Vendor",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-foreground">{row.original.vendorName}</p>
          {row.original.vendorInvoiceNumber && (
            <p className="text-[11px] text-muted-foreground font-mono">{row.original.vendorInvoiceNumber}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "poId",
      header: "PO #",
      cell: ({ row }) => <span className="text-sm text-muted-foreground font-mono">#{row.original.poId}</span>,
    },
    {
      accessorKey: "netPayable",
      header: "Net Payable",
      cell: ({ row }) => (
        <div>
          <p className="tabular-nums font-mono font-bold text-sm text-foreground">{fmt(row.original.netPayable)}</p>
          {row.original.paidAmount > 0 && row.original.status !== "Paid" && (
            <p className="text-[11px] text-emerald-600">Paid: {fmt(row.original.paidAmount)}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={row.original.status} size="sm" />
          {row.original.matchStatus === "MismatchPending" && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600">
              <AlertTriangle className="w-3 h-3" /> Mismatch
            </span>
          )}
          {row.original.matchStatus === "Matched" && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600">
              <CheckCircle2 className="w-3 h-3" /> Matched
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Due / Aging",
      cell: ({ row }) => (
        <div>
          {row.original.dueDate && <p className="text-xs text-muted-foreground">{row.original.dueDate}</p>}
          <AgingChip agingDays={row.original.agingDays} status={row.original.status} />
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("en-IN") : "—"}
        </span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-5 pb-10">
      <PageHeader
        title="Vendor Invoices"
        subtitle="3-way matched against GRNs and purchase orders"
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>Export CSV</Button>
            <Button className="gap-2 bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/procurement/invoices/new")}>
              <Plus className="w-4 h-4" /> New Invoice
            </Button>
          </>
        }
      />

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Outstanding", icon: DollarSign,
              value: fmtCompact(stats.outstanding?.amount ?? 0),
              sub: `${stats.outstanding?.count ?? 0} invoices`,
              color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20",
            },
            {
              label: "Overdue", icon: Clock,
              value: fmtCompact(stats.overdue?.amount ?? 0),
              sub: `${stats.overdue?.count ?? 0} invoices`,
              color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20",
              urgent: (stats.overdue?.count ?? 0) > 0,
            },
            {
              label: "Mismatched", icon: AlertTriangle,
              value: String(stats.mismatched ?? 0),
              sub: "need sign-off",
              color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20",
            },
            {
              label: "Paid This Month", icon: TrendingUp,
              value: fmtCompact(stats.paidThisMonth?.amount ?? 0),
              sub: `${stats.paidThisMonth?.count ?? 0} invoices`,
              color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20",
            },
          ].map(s => (
            <div key={s.label} className={cn("rounded-xl border border-border p-4 flex items-start gap-3", s.bg)}>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", s.urgent ? "bg-red-100" : "bg-white/60 dark:bg-white/10")}>
                <s.icon className={cn("w-4 h-4", s.color)} />
              </div>
              <div className="min-w-0">
                <p className={cn("text-xl font-bold font-mono", s.color)}>{s.value}</p>
                <p className="text-[11px] font-semibold text-foreground">{s.label}</p>
                <p className="text-[11px] text-muted-foreground">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-0">
        {STATUS_TABS.map(tab => (
          <button key={tab.value}
            onClick={() => setActiveStatus(tab.value)}
            className={cn(
              "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
              activeStatus === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        data={invoices as any[]}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search invoice number, vendor…"
        onRowClick={(row) => setLocation(`/procurement/invoices/${row.id}`)}
        exportFilename="invoices"
        filterOptions={[{ key: "status", label: "Status", options: STATUS_FILTER_OPTIONS }]}
        emptyIcon={FileText}
        emptyTitle="No invoices found"
        emptyDescription="Invoices are 3-way matched against GRNs and purchase orders"
      />
    </motion.div>
  );
}
