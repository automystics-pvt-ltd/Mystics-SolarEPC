import { useState } from "react";
import { useGetServiceTickets, useCreateServiceTicket, useResolveServiceTicket, getGetServiceTicketsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Ticket, Plus, Clock, CheckCircle2, AlertTriangle, User } from "lucide-react";
import { motion } from "framer-motion";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader, StatCard, DataTable, StatusBadge } from "@/components/shared";

const CATEGORIES = ["Performance", "Electrical", "Structural", "Inverter", "Module", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

const STATUS_OPTIONS = [
  { label: "Open", value: "Open" },
  { label: "In Progress", value: "InProgress" },
  { label: "Resolved", value: "Resolved" },
  { label: "Closed", value: "Closed" },
];

const PRIORITY_OPTIONS = PRIORITIES.map(p => ({ label: p, value: p }));

type ServiceTicket = {
  id: number;
  ticketNumber: string;
  projectId: number;
  description: string;
  issueCategory: string;
  priority: string;
  status: string;
  raisedBy?: string | null;
  assignedTechnicianName?: string | null;
  slaHours?: number | null;
  resolution?: string | null;
  createdAt?: string;
};

export default function ServiceTicketsList() {
  const [open, setOpen] = useState(false);
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const qc = useQueryClient();

  const queryParams = statusFilter ? { status: statusFilter } : {};
  const { data: tickets = [], isPending } = useGetServiceTickets(queryParams, { query: { queryKey: getGetServiceTicketsQueryKey(queryParams) } });
  const createMut = useCreateServiceTicket();
  const resolveMut = useResolveServiceTicket();
  const { register, handleSubmit, setValue, reset } = useForm<any>();
  const { register: rReg, handleSubmit: rSubmit, reset: rReset } = useForm<any>();

  const onSubmit = (d: any) => {
    createMut.mutate({ data: { ...d, projectId: Number(d.projectId), slaHours: d.slaHours ? Number(d.slaHours) : 48 } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetServiceTicketsQueryKey({}) }); setOpen(false); reset(); },
    });
  };

  const onResolve = (d: any) => {
    if (!resolveId) return;
    resolveMut.mutate({ id: resolveId, data: d }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetServiceTicketsQueryKey({}) }); setResolveId(null); rReset(); },
    });
  };

  const openCount = tickets.filter(t => t.status === "Open").length;
  const critical = tickets.filter(t => t.priority === "Critical" && t.status !== "Resolved" && t.status !== "Closed").length;

  const columns: ColumnDef<ServiceTicket, any>[] = [
    {
      accessorKey: "description",
      header: "Ticket",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${row.original.priority === "Critical" ? "bg-red-50" : row.original.priority === "High" ? "bg-amber-50" : "bg-muted"}`}>
            {row.original.priority === "Critical"
              ? <AlertTriangle className="w-4 h-4 text-red-500" />
              : <Ticket className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground font-mono">{row.original.ticketNumber}</div>
            <div className="font-semibold text-sm text-foreground leading-tight truncate max-w-xs">
              {row.original.description}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "issueCategory",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.issueCategory}</span>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <StatusBadge status={row.original.priority} size="sm" />
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
      accessorKey: "assignedTechnicianName",
      header: "Assigned To",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-muted-foreground/60" />
          {row.original.assignedTechnicianName || "—"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
          {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("en-IN") : "—"}
        </span>
      ),
    },
    {
      id: "resolve",
      header: "",
      enableSorting: false,
      cell: ({ row }) =>
        (row.original.status === "Open" || row.original.status === "InProgress") ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={(e) => { e.stopPropagation(); setResolveId(row.original.id); }}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
          </Button>
        ) : null,
    },
  ];

  const newTicketDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> New Ticket</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Raise Service Ticket</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Project ID</Label><Input {...register("projectId")} placeholder="e.g. 4" className="mt-1" /></div>
            <div><Label>Raised By (Client)</Label><Input {...register("raisedBy")} placeholder="Client contact name" className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Issue Category</Label>
              <Select onValueChange={v => setValue("issueCategory", v)} defaultValue="Performance">
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select onValueChange={v => setValue("priority", v)} defaultValue="Medium">
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Description</Label><Textarea {...register("description")} placeholder="Describe the issue in detail..." className="mt-1 min-h-[80px]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Assigned Technician</Label><Input {...register("assignedTechnicianName")} placeholder="Technician name" className="mt-1" /></div>
            <div><Label>SLA Hours</Label><Input {...register("slaHours")} type="number" defaultValue={48} className="mt-1" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Raising…" : "Raise Ticket"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
      <PageHeader
        title="Service Tickets"
        subtitle="Customer service and breakdown requests"
        actions={newTicketDialog}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={tickets.length} icon={Ticket} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard label="Open" value={openCount} icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatCard label="Critical" value={critical} icon={AlertTriangle} iconBg="bg-orange-50" iconColor="text-orange-600" />
        <StatCard label="Resolved" value={tickets.filter(t => t.status === "Resolved").length} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

      {/* Resolve dialog */}
      <Dialog open={!!resolveId} onOpenChange={v => !v && setResolveId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Resolve Ticket</DialogTitle></DialogHeader>
          <form onSubmit={rSubmit(onResolve)} className="space-y-4 pt-2">
            <div><Label>Resolution</Label><Textarea {...rReg("resolution")} placeholder="Describe what was done to resolve the issue..." className="mt-1 min-h-[100px]" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setResolveId(null)}>Cancel</Button>
              <Button type="submit" disabled={resolveMut.isPending}>{resolveMut.isPending ? "Saving…" : "Mark Resolved"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DataTable
        data={tickets as ServiceTicket[]}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search service tickets..."
        exportFilename="service-tickets"
        filterOptions={[
          { key: "status", label: "Status", options: STATUS_OPTIONS },
          { key: "priority", label: "Priority", options: PRIORITY_OPTIONS },
        ]}
        emptyIcon={Ticket}
        emptyTitle="No service tickets"
        emptyDescription="Raise a service ticket when an issue is reported"
      />
    </motion.div>
  );
}
