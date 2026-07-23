import { useGetProcurementPOs } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ShoppingCart, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";
import { PageHeader, DataTable } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";

const STATUS_CONFIG: Record<string, { color: string }> = {
  Draft: { color: "bg-slate-100 text-slate-600 border-slate-200" },
  Issued: { color: "bg-blue-50 text-blue-700 border-blue-200" },
  Acknowledged: { color: "bg-amber-50 text-amber-700 border-amber-200" },
  PartiallyReceived: { color: "bg-orange-50 text-orange-700 border-orange-200" },
  FullyReceived: { color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Closed: { color: "bg-slate-100 text-slate-500 border-slate-200" },
  Cancelled: { color: "bg-red-50 text-red-700 border-red-200" },
};

const STATUS_LABELS: Record<string, string> = {
  Draft: "Draft", Issued: "Issued", Acknowledged: "Acknowledged",
  PartiallyReceived: "Partially Received", FullyReceived: "Fully Received",
  Closed: "Closed", Cancelled: "Cancelled",
};

const STATUS_OPTIONS = [
  { label: "Draft", value: "Draft" },
  { label: "Issued", value: "Issued" },
  { label: "Acknowledged", value: "Acknowledged" },
  { label: "Partially Received", value: "PartiallyReceived" },
  { label: "Fully Received", value: "FullyReceived" },
  { label: "Closed", value: "Closed" },
  { label: "Cancelled", value: "Cancelled" },
];

export default function ProcurementPOsList() {
  const [, setLocation] = useLocation();

  const { data: pos = [], isLoading } = useGetProcurementPOs({});

  const handleExport = () => {
    exportToCsv(
      `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ["PO Number", "Vendor", "Status", "Total Amount (₹)", "PO Date", "Delivery Deadline", "Approved By"],
      pos.map(p => [p.poNumber, p.vendorName, p.status, p.totalAmount ?? 0, p.poDate ?? "", (p as any).deliveryDeadline ?? "", p.approvedByName ?? ""])
    );
  };

  const today = new Date().toISOString().split("T")[0];

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "poNumber",
      header: "PO Number",
      cell: ({ row }) => {
        const po = row.original;
        const deadline = po.deliveryDeadline ?? po.expectedDeliveryDate;
        const overdue = po.isOverdue || (deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(po.status ?? ""));
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("font-mono font-bold text-sm", overdue ? "text-red-700" : "text-foreground")}>
              {po.poNumber}
            </span>
            {overdue && (
              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                Overdue
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "vendorName",
      header: "Vendor",
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.vendorName}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const cfg = STATUS_CONFIG[row.original.status ?? "Draft"] ?? STATUS_CONFIG["Draft"];
        return (
          <Badge variant="outline" className={cn("text-xs", cfg.color)}>
            {STATUS_LABELS[row.original.status ?? "Draft"] ?? row.original.status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "totalAmount",
      header: "Total (₹)",
      cell: ({ row }) => (
        <span className="tabular-nums font-mono text-sm text-foreground">
          ₹{Number(row.original.totalAmount ?? 0).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      accessorKey: "poDate",
      header: "PO Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.poDate ? new Date(row.original.poDate).toLocaleDateString("en-IN") : "—"}
        </span>
      ),
    },
    {
      accessorKey: "deliveryDeadline",
      header: "Delivery Deadline",
      cell: ({ row }) => {
        const po = row.original;
        const deadline = po.deliveryDeadline ?? po.expectedDeliveryDate;
        const overdue = po.isOverdue || (deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(po.status ?? ""));
        return deadline ? (
          <span className={cn("text-sm", overdue ? "text-red-600 font-semibold" : "text-muted-foreground")}>
            {overdue ? "⚠ " : ""}{deadline}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      },
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <PageHeader
        title="Purchase Orders"
        subtitle="Auto-generated from approved vendor quotations"
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        }
      />

      <DataTable
        data={pos}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search by PO number or vendor…"
        onRowClick={(row) => setLocation(`/procurement/pos/${row.id}`)}
        exportFilename="purchase-orders"
        filterOptions={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        emptyIcon={ShoppingCart}
        emptyTitle="No purchase orders found"
        emptyDescription="POs are auto-generated when a quotation is approved"
      />
    </motion.div>
  );
}
