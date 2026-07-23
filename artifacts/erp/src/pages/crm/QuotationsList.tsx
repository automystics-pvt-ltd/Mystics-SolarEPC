import { useGetQuotations, getGetQuotationsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { PageHeader, DataTable } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "wouter";

function getStatusColor(status: string) {
  switch (status) {
    case 'Approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Rejected': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function StatusBadge({ status }: { status: string }) {
  const Icon = status === 'Approved' ? CheckCircle2 : status === 'Rejected' ? XCircle : Clock;
  return (
    <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] flex items-center gap-1 w-fit ${getStatusColor(status)}`}>
      <Icon className="h-3 w-3" /> {status}
    </Badge>
  );
}

const STATUS_FILTER_OPTIONS = [
  { label: 'Draft', value: 'Draft' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
];

export function QuotationsList() {
  const [, setLocation] = useLocation();

  const { data: quotations, isLoading } = useGetQuotations({}, {
    query: { queryKey: getGetQuotationsQueryKey({}) }
  });

  type Quotation = NonNullable<typeof quotations>[number];

  const columns: ColumnDef<Quotation, any>[] = [
    {
      accessorKey: 'id',
      header: 'Quote #',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-orange-50 text-[#EA580C] flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <span className="font-mono font-bold text-sm text-foreground">QTN-{row.original.id.toString().padStart(4, '0')}</span>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Version {row.original.version}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'leadId',
      header: 'Lead Ref',
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          href={`/crm/leads/${row.original.leadId}`}
          className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-[#EA580C] bg-muted hover:bg-orange-50 px-2.5 py-1 rounded-[6px] transition-colors"
          onClick={e => e.stopPropagation()}
        >
          LD-{row.original.leadId.toString().padStart(4, '0')}
        </Link>
      ),
    },
    {
      accessorKey: 'totalAmount',
      header: 'Total Value (₹)',
      cell: ({ row }) => (
        <span className="font-mono font-bold text-foreground text-[15px] tabular-nums">
          ₹{Number(row.original.totalAmount || 0).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      accessorKey: 'approvalStatus',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.approvalStatus} />,
    },
    {
      accessorKey: 'validTill',
      header: 'Valid Until',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.validTill ? format(new Date(row.original.validTill), 'MMM d, yyyy') : <span className="text-muted-foreground/40">—</span>}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(row.original.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <PageHeader
        title="CRM Quotations"
        subtitle="Client-facing proposals and cost estimates"
        actions={
          <Button
            onClick={() => setLocation("/crm/quotations/new")}
            className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold tracking-wide rounded-[8px] h-9 px-4 shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" /> Create Quotation
          </Button>
        }
      />

      <DataTable
        data={quotations ?? []}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search quotations..."
        onRowClick={(row) => setLocation(`/crm/quotations/${row.id}`)}
        exportFilename="crm-quotations"
        filterOptions={[
          { key: 'approvalStatus', label: 'Status', options: STATUS_FILTER_OPTIONS },
        ]}
        emptyIcon={FileText}
        emptyTitle="No quotations yet"
        emptyDescription="Create a quotation to send a proposal to your client"
      />
    </motion.div>
  );
}
