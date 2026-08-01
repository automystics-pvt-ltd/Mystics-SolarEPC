import { useGetProcGrns, getGetProcGrnsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus, Package, AlertCircle } from "lucide-react";
import { PageHeader, DataTable, StatusBadge, ExportButton } from "@/components/shared";
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

  const { data: rawGrns, isLoading, isError, error, refetch } = useGetProcGrns(
    {},
    { query: { queryKey: getGetProcGrnsQueryKey({}) } }
  );
  const grns = Array.isArray(rawGrns) ? rawGrns : [];

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "grnNumber",
      header: "GRN #",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-sm text-foreground">{row.original.grnNumber}</span>
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
      accessorKey: "poId",
      header: "PO #",
      meta: { responsive: "sm" } as any,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">#{row.original.poId}</span>
      ),
    },
    {
      accessorKey: "deliveryDate",
      header: "Received",
      meta: { responsive: "md" } as any,
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
            <ExportButton
              config={{
                title: "Goods Receipt Notes",
                module: "procurement",
                filename: "Procurement_GRNs",
                columns: [
                  { header: "GRN Number",      key: "grnNumber"        },
                  { header: "Vendor",           key: "vendorName"       },
                  { header: "PO ID",            key: "poId"             },
                  { header: "Status",           key: "status"           },
                  { header: "Delivery Date",    key: "deliveryDate"     },
                  { header: "Accepted Qty",     key: "totalAcceptedQty" },
                  { header: "Ordered Qty",      key: "totalOrderedQty"  },
                  { header: "Created At",       key: "createdAt", formatter: (v) => v ? new Date(String(v)).toLocaleDateString("en-IN") : "" },
                ],
                getRows: () => grns as unknown as Record<string, unknown>[],
              }}
              size="sm"
            />
            <Button className="gap-2 bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/procurement/grns/new")}>
              <Plus className="w-4 h-4" /> New GRN
            </Button>
          </>
        }
      />

      {isError && (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center p-8 border-2 border-dashed border-red-200 rounded-xl">
          <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground">Failed to load GRNs</p>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-sm">
              {(error as Error)?.message ?? "An unexpected error occurred. Please try again."}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="text-[13px] px-4 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!isError && <DataTable
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
        stickyFirstCol
      />}
    </motion.div>
  );
}
