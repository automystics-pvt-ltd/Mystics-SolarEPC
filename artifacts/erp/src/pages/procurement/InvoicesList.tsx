import { useGetProcInvoices, getGetProcInvoicesQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, AlertTriangle } from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";
import { PageHeader, DataTable } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";

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

const STATUS_OPTIONS = [
  { label: "Draft", value: "Draft" },
  { label: "Pending Approval", value: "PendingApproval" },
  { label: "Approved", value: "Approved" },
  { label: "On Hold", value: "OnHold" },
  { label: "Paid", value: "Paid" },
  { label: "Cancelled", value: "Cancelled" },
];

export default function InvoicesList() {
  const [, setLocation] = useLocation();

  const { data: invoices = [], isLoading } = useGetProcInvoices(
    {},
    { query: { queryKey: getGetProcInvoicesQueryKey({}) } }
  );

  const handleExport = () => {
    exportToCsv(
      `invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Invoice Number", "Vendor Invoice No.", "Vendor", "Status", "Match Status", "Net Payable (₹)", "Due Date", "Created At"],
      (invoices as any[]).map(i => [i.invoiceNumber, i.vendorInvoiceNumber ?? "", i.vendorName, i.status, i.matchStatus ?? "", i.netPayable ?? i.totalAmount ?? 0, i.dueDate ?? "", new Date(i.createdAt).toLocaleDateString("en-IN")])
    );
  };

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-sm text-foreground">{row.original.invoiceNumber}</span>
      ),
    },
    {
      accessorKey: "vendorName",
      header: "Vendor",
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.vendorName}</span>
      ),
    },
    {
      accessorKey: "poId",
      header: "PO #",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">#{row.original.poId}</span>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: "Amount (₹)",
      cell: ({ row }) => (
        <span className="tabular-nums font-mono text-sm text-foreground">
          {fmt(row.original.totalAmount)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={cn("text-xs", STATUS_COLOR[row.original.status] ?? "bg-slate-100 text-slate-600")}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "matchStatus",
      header: "Match Status",
      enableSorting: false,
      cell: ({ row }) => {
        const inv = row.original;
        if (inv.matchStatus === "MismatchPending") {
          return (
            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 gap-1">
              <AlertTriangle className="w-3 h-3" /> Mismatch
            </Badge>
          );
        }
        if (inv.matchStatus === "MismatchApproved") {
          return (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              Mismatch Approved
            </Badge>
          );
        }
        if (inv.matchStatus) {
          return <span className="text-xs text-muted-foreground">{inv.matchStatus}</span>;
        }
        return <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: "createdAt",
      header: "Invoice Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("en-IN") : "—"}
        </span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <PageHeader
        title="Vendor Invoices"
        subtitle="3-way matched against GRNs and purchase orders"
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
              Export CSV
            </Button>
            <Button className="gap-2 bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/procurement/invoices/new")}>
              <Plus className="w-4 h-4" /> New Invoice
            </Button>
          </>
        }
      />

      <DataTable
        data={invoices as any[]}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search invoice number, vendor…"
        onRowClick={(row) => setLocation(`/procurement/invoices/${row.id}`)}
        exportFilename="invoices"
        filterOptions={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        emptyIcon={FileText}
        emptyTitle="No invoices found"
        emptyDescription="Invoices are 3-way matched against GRNs and purchase orders"
      />
    </motion.div>
  );
}
