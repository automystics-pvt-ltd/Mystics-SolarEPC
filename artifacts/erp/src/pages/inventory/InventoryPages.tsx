import { useGetGRNs, useGetDeliveryChallans, useGetStockLedger, useGetStockValuation, useGetInventoryAudits } from "@workspace/api-client-react";
import { Boxes, Truck, BookOpen, Scale, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import { formatINR } from "@/lib/currency";
import type { ColumnDef } from "@tanstack/react-table";

// ─── GRNsList ─────────────────────────────────────────────────────────────────

export function GRNsList() {
  const { data, isPending } = useGetGRNs();

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "grnNumber",
      header: "GRN No.",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-mono font-bold text-sm text-foreground">{row.original.grnNumber}</span>
        </div>
      ),
    },
    {
      accessorKey: "poId",
      header: "PO Ref",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-bold text-muted-foreground">PO-{row.original.poId}</span>
      ),
    },
    {
      accessorKey: "warehouseId",
      header: "Warehouse",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-bold text-muted-foreground">WH-{row.original.warehouseId}</span>
      ),
    },
    {
      accessorKey: "receivedDate",
      header: "Received",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{format(new Date(row.original.receivedDate), "MMM d, yyyy")}</span>
      ),
    },
    {
      accessorKey: "qcStatus",
      header: "QC Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.qcStatus ?? "Pending"} size="sm" />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Goods Receipt Notes"
        subtitle="Track inbound material receipts against POs."
      />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search GRNs..."
        exportFilename="grns"
        filterOptions={[
          {
            key: "qcStatus",
            label: "QC Status",
            options: [
              { label: "Approved", value: "Approved" },
              { label: "Rejected", value: "Rejected" },
              { label: "Pending", value: "Pending" },
            ],
          },
        ]}
        emptyIcon={Boxes}
        emptyTitle="No GRNs found"
        emptyDescription="GRNs will appear here once created"
      />
    </motion.div>
  );
}

// ─── DeliveryChallansList ─────────────────────────────────────────────────────

export function DeliveryChallansList() {
  const { data, isPending } = useGetDeliveryChallans();

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "challanNumber",
      header: "DC #",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-mono font-bold text-sm text-foreground">
            {row.original.challanNumber || `DC-${row.original.id}`}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "projectId",
      header: "Source",
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">
          {row.original.projectId ? `PRJ-${row.original.projectId}` : "—"}
        </span>
      ),
    },
    {
      accessorKey: "issuedTo",
      header: "Destination",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground">{row.original.issuedTo}</span>
      ),
    },
    {
      accessorKey: "purpose",
      header: "Items / Purpose",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.purpose}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      enableSorting: false,
      cell: () => (
        <StatusBadge status="Issued" size="sm" />
      ),
    },
    {
      accessorKey: "issuedDate",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.issuedDate), "MMM d, yyyy")}
        </span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Delivery Challans"
        subtitle="Track outbound material dispatches."
      />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search delivery challans..."
        exportFilename="delivery-challans"
        emptyIcon={Truck}
        emptyTitle="No delivery challans found"
        emptyDescription="Delivery challans will appear here once created"
      />
    </motion.div>
  );
}

// ─── StockLedgerList ──────────────────────────────────────────────────────────

export function StockLedgerList() {
  const { data, isPending } = useGetStockLedger();

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "itemName",
      header: "Material",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-bold text-sm text-foreground">{row.original.itemName}</span>
        </div>
      ),
    },
    {
      accessorKey: "warehouseId",
      header: "Warehouse",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-muted-foreground">WH-{row.original.warehouseId}</span>
      ),
    },
    {
      accessorKey: "txnType",
      header: "Txn Type",
      cell: ({ row }) => (
        <StatusBadge status={row.original.txnType} size="sm" />
      ),
    },
    {
      accessorKey: "qty",
      header: "Qty",
      cell: ({ row }) => {
        const l = row.original;
        const color = l.txnType === "Inward" ? "text-emerald-600" : "text-foreground";
        return (
          <span className={`tabular-nums font-mono font-bold text-sm ${color}`}>
            {l.txnType === "Inward" ? "+" : "-"}{l.qty}
          </span>
        );
      },
    },
    {
      accessorKey: "balanceQty",
      header: "Reference / Balance",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-foreground">{row.original.balanceQty}</span>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.date}</span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Stock Ledger"
        subtitle="Chronological log of inventory movements."
      />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search stock ledger..."
        exportFilename="stock-ledger"
        filterOptions={[
          {
            key: "txnType",
            label: "Txn Type",
            options: [
              { label: "Inward", value: "Inward" },
              { label: "Outward", value: "Outward" },
            ],
          },
        ]}
        emptyIcon={BookOpen}
        emptyTitle="No ledger entries"
        emptyDescription="Stock movements will appear here"
      />
    </motion.div>
  );
}

// ─── StockValuationList ───────────────────────────────────────────────────────


export function StockValuationList() {
  const { data, isPending } = useGetStockValuation();

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "itemName",
      header: "Material",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Scale className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-bold text-sm text-foreground">{row.original.itemName}</span>
        </div>
      ),
    },
    {
      accessorKey: "warehouseId",
      header: "Warehouse",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-muted-foreground">WH-{row.original.warehouseId}</span>
      ),
    },
    {
      accessorKey: "balanceQty",
      header: "Qty",
      cell: ({ row }) => (
        <span className="tabular-nums font-mono font-bold text-sm text-foreground">{row.original.balanceQty}</span>
      ),
    },
    {
      accessorKey: "unitValue",
      header: "Unit Cost (₹)",
      cell: ({ row }) => (
        <span className="tabular-nums font-mono text-sm text-muted-foreground">{formatINR(row.original.unitValue)}</span>
      ),
    },
    {
      accessorKey: "totalValue",
      header: "Total Value (₹)",
      cell: ({ row }) => (
        <span className="tabular-nums font-mono font-bold text-sm text-foreground">{formatINR(row.original.totalValue)}</span>
      ),
    },
    {
      accessorKey: "asOfDate",
      header: "As Of",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{format(new Date(row.original.asOfDate), "MMM d, yyyy")}</span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Stock Valuation"
        subtitle="Financial value of inventory on hand."
      />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search stock valuation..."
        exportFilename="stock-valuation"
        emptyIcon={Scale}
        emptyTitle="No valuation data"
        emptyDescription="Stock valuation will appear here"
      />
    </motion.div>
  );
}

// ─── InventoryAuditsList ──────────────────────────────────────────────────────

export function InventoryAuditsList() {
  const { data, isPending } = useGetInventoryAudits();

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "id",
      header: "Audit #",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono font-bold text-sm text-foreground">AUD-{row.original.id}</span>
        </div>
      ),
    },
    {
      accessorKey: "warehouseId",
      header: "Warehouse",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-muted-foreground">WH-{row.original.warehouseId}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status ?? "Pending"} size="sm" />
      ),
    },
    {
      id: "auditor",
      header: "Auditor",
      enableSorting: false,
      cell: () => <span className="text-sm text-muted-foreground">—</span>,
    },
    {
      accessorKey: "auditDate",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{format(new Date(row.original.auditDate), "MMM d, yyyy")}</span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Inventory Audits"
        subtitle="Physical stock reconciliation logs."
      />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search audits..."
        exportFilename="inventory-audits"
        filterOptions={[
          {
            key: "status",
            label: "Status",
            options: [
              { label: "Completed", value: "Completed" },
              { label: "Pending", value: "Pending" },
              { label: "In Progress", value: "In Progress" },
            ],
          },
        ]}
        emptyIcon={ClipboardCheck}
        emptyTitle="No audits found"
        emptyDescription="Inventory audits will appear here"
      />
    </motion.div>
  );
}
