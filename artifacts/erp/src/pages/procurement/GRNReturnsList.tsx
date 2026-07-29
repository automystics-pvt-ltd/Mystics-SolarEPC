import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, PackageX } from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { PageHeader, DataTable, StatusBadge, ExportButton } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";

const STATUS_OPTIONS = [
  { label: "Draft", value: "Draft" },
  { label: "Submitted", value: "Submitted" },
  { label: "Approved", value: "Approved" },
  { label: "Dispatched", value: "Dispatched" },
  { label: "Closed", value: "Closed" },
  { label: "Cancelled", value: "Cancelled" },
];

export default function GRNReturnsList() {
  const [, setLocation] = useLocation();

  const { data: returns = [], isPending } = useQuery({
    queryKey: ["grn-returns"],
    queryFn: () => apiGet<any[]>("/grn-returns", {}),
  });

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "returnNumber",
      header: "Return #",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-sm text-foreground">{row.original.returnNumber}</span>
      ),
    },
    {
      accessorKey: "vendorName",
      header: "Vendor",
      cell: ({ row }) => (
        <span className="text-sm text-foreground font-medium">{row.original.vendorName}</span>
      ),
    },
    {
      accessorKey: "grnId",
      header: "GRN ID",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">#{row.original.grnId}</span>
      ),
    },
    {
      accessorKey: "returnType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs font-medium">{row.original.returnType}</Badge>
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
      accessorKey: "totalReturnValue",
      header: "Return Value",
      cell: ({ row }) => (
        <span className="tabular-nums font-mono font-semibold text-sm text-foreground">
          {Number(row.original.totalReturnValue || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(row.original.createdAt).toLocaleDateString("en-IN")}
        </span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="GRN Returns"
        subtitle="Return-to-Vendor (RTV) management"
        actions={
          <>
            <ExportButton
              config={{
                title: "GRN Returns",
                module: "procurement",
                filename: "Procurement_GRNReturns",
                columns: [
                  { header: "Return #",      key: "returnNumber"    },
                  { header: "Vendor",        key: "vendorName"      },
                  { header: "GRN ID",        key: "grnId"           },
                  { header: "Return Type",   key: "returnType"      },
                  { header: "Status",        key: "status"          },
                  { header: "Total Qty",     key: "totalReturnQty"  },
                  { header: "Total Value",   key: "totalReturnValue"},
                  { header: "Created At",    key: "createdAt", formatter: (v) => v ? new Date(String(v)).toLocaleDateString("en-IN") : "" },
                ],
                getRows: () => returns as unknown as Record<string, unknown>[],
              }}
              size="sm"
            />
            <Button className="gap-2 bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/procurement/grn-returns/new")}>
              <Plus className="w-4 h-4" /> New Return
            </Button>
          </>
        }
      />

      <DataTable
        data={returns as any[]}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search by return number or vendor..."
        onRowClick={(row) => setLocation(`/procurement/grn-returns/${row.id}`)}
        exportFilename="grn-returns"
        filterOptions={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        emptyIcon={PackageX}
        emptyTitle="No GRN returns found"
        emptyDescription="Create a new return to get started"
      />
    </motion.div>
  );
}
