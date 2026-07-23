import { useGetClientPOs, useGetCrmInvoices, useGetTasks, useGetEscalations } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { FileCheck, DollarSign, CheckSquare, AlertTriangle, ListTodo } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { PageHeader, DataTable } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";

/* ─────────────────────────────────────────────
   ClientPOsList
───────────────────────────────────────────── */
export function ClientPOsList() {
  const { data, isLoading } = useGetClientPOs();

  type ClientPO = NonNullable<typeof data>[number];

  const columns: ColumnDef<ClientPO, any>[] = [
    {
      accessorKey: 'clientPoNumber',
      header: 'PO #',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FileCheck className="h-4 w-4" />
          </div>
          <span className="font-mono font-bold text-sm text-foreground">{row.original.clientPoNumber}</span>
        </div>
      ),
    },
    {
      accessorKey: 'contractValue',
      header: 'Amount (₹)',
      cell: ({ row }) => (
        <span className="font-mono font-bold text-foreground text-[15px] tabular-nums">
          ₹{Number(row.original.contractValue ?? 0).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${row.original.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground border-border'}`}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'projectId',
      header: 'Project',
      enableSorting: false,
      cell: ({ row }) => (
        row.original.projectId ? (
          <Link
            href={`/projects/${row.original.projectId}`}
            className="inline-flex items-center text-sm font-bold text-muted-foreground hover:text-[#EA580C] bg-muted hover:bg-orange-50 px-2.5 py-1 rounded-[6px] transition-colors"
            onClick={e => e.stopPropagation()}
          >
            PRJ-{row.original.projectId.toString().padStart(4, '0')}
          </Link>
        ) : (
          <span className="text-muted-foreground/40 font-bold">—</span>
        )
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
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
        title="Client POs"
        subtitle="Purchase orders received from clients"
      />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search PO number..."
        exportFilename="client-pos"
        emptyIcon={FileCheck}
        emptyTitle="No client POs yet"
        emptyDescription="Client purchase orders will appear here once received"
      />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   CrmInvoicesList
───────────────────────────────────────────── */
export function CrmInvoicesList() {
  const { data, isLoading } = useGetCrmInvoices();

  type CrmInvoice = NonNullable<typeof data>[number];

  function getPaymentStatusColor(status: string) {
    switch (status) {
      case 'Paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Overdue': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  }

  const STATUS_OPTIONS = [
    { label: 'Paid', value: 'Paid' },
    { label: 'Pending', value: 'Pending' },
    { label: 'Overdue', value: 'Overdue' },
  ];

  const columns: ColumnDef<CrmInvoice, any>[] = [
    {
      accessorKey: 'id',
      header: 'Invoice #',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <DollarSign className="h-4 w-4" />
          </div>
          <span className="font-mono font-bold text-sm text-foreground">INV-{row.original.id.toString().padStart(4, '0')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-sm font-bold text-muted-foreground">{row.original.type}</span>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount (₹)',
      cell: ({ row }) => (
        <span className="font-mono font-bold text-foreground text-[15px] tabular-nums">
          ₹{Number(row.original.amount).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.dueDate ? format(new Date(row.original.dueDate), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'paymentStatus',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${getPaymentStatusColor(row.original.paymentStatus)}`}>
          {row.original.paymentStatus}
        </Badge>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <PageHeader
        title="Client Invoices"
        subtitle="Accounts receivable and payment tracking"
      />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search invoices..."
        exportFilename="crm-invoices"
        filterOptions={[
          { key: 'paymentStatus', label: 'Status', options: STATUS_OPTIONS },
        ]}
        emptyIcon={DollarSign}
        emptyTitle="No invoices yet"
        emptyDescription="Client invoices will appear here once created"
      />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   TasksList
───────────────────────────────────────────── */
export function TasksList() {
  const { data, isLoading } = useGetTasks();

  type Task = NonNullable<typeof data>[number];

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'High': return 'bg-red-50 text-red-700 border-red-200';
      case 'Medium': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  }

  const STATUS_OPTIONS = [
    { label: 'Open', value: 'Open' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Done', value: 'Done' },
    { label: 'Cancelled', value: 'Cancelled' },
  ];

  const PRIORITY_OPTIONS = [
    { label: 'High', value: 'High' },
    { label: 'Medium', value: 'Medium' },
    { label: 'Low', value: 'Low' },
  ];

  const columns: ColumnDef<Task, any>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className="flex items-start gap-3">
          <CheckSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <span className="font-semibold text-sm text-foreground leading-tight">{row.original.title}</span>
        </div>
      ),
    },
    {
      accessorKey: 'ownerName',
      header: 'Assigned To',
      cell: ({ row }) => (
        <span className="text-sm font-bold text-foreground">{row.original.ownerName}</span>
      ),
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => (
        <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${getPriorityColor(row.original.priority ?? '')}`}>
          {row.original.priority || 'Normal'}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className="text-sm font-bold text-muted-foreground">{row.original.status}</span>
      ),
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.dueDate ? format(new Date(row.original.dueDate), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <PageHeader
        title="Tasks"
        subtitle="To-dos and action items"
      />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search tasks..."
        exportFilename="tasks"
        filterOptions={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS },
          { key: 'priority', label: 'Priority', options: PRIORITY_OPTIONS },
        ]}
        emptyIcon={ListTodo}
        emptyTitle="No tasks yet"
        emptyDescription="Tasks and action items will appear here"
      />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   EscalationsList
───────────────────────────────────────────── */
export function EscalationsList() {
  const { data, isLoading } = useGetEscalations();

  type Escalation = NonNullable<typeof data>[number];

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'Critical': return 'bg-red-600 text-white border-red-700';
      default: return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  }

  const PRIORITY_OPTIONS = [
    { label: 'Critical', value: 'Critical' },
    { label: 'High', value: 'High' },
    { label: 'Medium', value: 'Medium' },
  ];

  const STATUS_OPTIONS = [
    { label: 'Open', value: 'Open' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Resolved', value: 'Resolved' },
    { label: 'Closed', value: 'Closed' },
  ];

  const columns: ColumnDef<Escalation, any>[] = [
    {
      accessorKey: 'reason',
      header: 'Title',
      cell: ({ row }) => (
        <span className="font-bold text-sm text-foreground leading-tight block">{row.original.reason}</span>
      ),
    },
    {
      accessorKey: 'module',
      header: 'Module',
      cell: ({ row }) => (
        <span className="text-sm font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-[6px]">{row.original.module}</span>
      ),
    },
    {
      accessorKey: 'severity',
      header: 'Priority',
      cell: ({ row }) => (
        <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${getSeverityColor(row.original.severity)}`}>
          {row.original.severity}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className="text-sm font-bold text-muted-foreground">{row.original.status}</span>
      ),
    },
    {
      accessorKey: 'raisedByName',
      header: 'Raised By',
      cell: ({ row }) => (
        <span className="text-sm font-bold text-foreground">{row.original.raisedByName}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
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
        title="Escalations"
        subtitle="Issues requiring immediate attention"
      />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search escalations..."
        exportFilename="escalations"
        filterOptions={[
          { key: 'severity', label: 'Priority', options: PRIORITY_OPTIONS },
          { key: 'status', label: 'Status', options: STATUS_OPTIONS },
        ]}
        emptyIcon={AlertTriangle}
        emptyTitle="No active escalations"
        emptyDescription="All clear — no escalations require attention right now"
      />
    </motion.div>
  );
}
