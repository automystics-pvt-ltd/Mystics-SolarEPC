import { useGetProcGrns, getGetProcGrnsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";

const STATUS_OPTIONS = [
  { label: "Draft", value: "Draft" },
  { label: "Submitted", value: "Submitted" },
  { label: "Accepted", value: "Accepted" },
  { label: "Partially Accepted", value: "PartiallyAccepted" },
  { label: "Rejected", value: "Rejected" },
];

export default function GRNsList() {
  const [, setLocation] = useLocation();

  const { data: grns = [], isLoading } = useGetProcGrns(
    {},
    { query: { queryKey: getGetProcGrnsQueryKey({}) } }
  );

  const handleExport = () => {
    exportToCsv(
      `grns-${new Date().toISOString().slice(0, 10)}.csv`,
      ["GRN Number", "Vendor", "PO ID", "Status", "Delivery Date", "Accepted Qty", "Ordered Qty", "Created At"],
      (grns as any[]).map(g => [g.grnNumber, g.vendorName, g.poId, g.status, g.deliveryDate ?? "", g.totalAcceptedQty ?? "", g.totalOrderedQty ?? "", new Date(g.createdAt).toLocaleDateString("en-IN")])
    );
  };

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "grnNumber",
      header: "GRN #",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-sm text-foreground">{row.original.grnNumber}</span>
      ),
    },
    {
      accessorKey: "poId",
      header: "PO Number",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">#{row.original.poId}</span>
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
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} size="sm" />
      ),
    },
    {
      accessorKey: "deliveryDate",
      header: "Received Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.deliveryDate ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Goods Receipt Notes"
        subtitle="Record and inspect vendor deliveries"
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
              Export CSV
            </Button>
            <Button className="gap-2 bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/procurement/grns/new")}>
              <Plus className="w-4 h-4" /> New GRN
            </Button>
          </>
        }
      />

      <DataTable
        data={grns as any[]}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search GRN number or vendor…"
        onRowClick={(row) => setLocation(`/procurement/grns/${row.id}`)}
        exportFilename="grns"
        filterOptions={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        emptyIcon={Package}
        emptyTitle="No GRNs found"
        emptyDescription="Create a GRN to record an incoming delivery against a purchase order"
      />
    </motion.div>
  );
}
