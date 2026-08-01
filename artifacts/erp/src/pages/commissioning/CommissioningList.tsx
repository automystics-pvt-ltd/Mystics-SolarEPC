import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetCommissioningChecklists,
  useCreateCommissioningChecklist,
  getGetCommissioningChecklistsQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { CanCreate } from "@/lib/permissions";
import { CheckSquare, Plus, Clock, CheckCircle2, Pen } from "lucide-react";
import { motion } from "framer-motion";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader, StatCard, DataTable, StatusBadge } from "@/components/shared";

const STATUS_OPTIONS = [
  { label: "Draft", value: "Draft" },
  { label: "In Progress", value: "InProgress" },
  { label: "Pending Sign-off", value: "PendingClientSignoff" },
  { label: "Completed", value: "Completed" },
];

type CommissioningChecklist = {
  id: number;
  projectId: number;
  status: string;
  commissionedOn?: string | null;
  clientSignatoryName?: string | null;
  remarks?: string | null;
};

export default function CommissioningList() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { data: lists = [], isPending } = useGetCommissioningChecklists({}, { query: { queryKey: getGetCommissioningChecklistsQueryKey({}) } });
  const createMut = useCreateCommissioningChecklist();
  const { register, handleSubmit, reset } = useForm<any>();

  const onSubmit = (d: any) => {
    createMut.mutate({ data: { ...d, projectId: Number(d.projectId) } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCommissioningChecklistsQueryKey({}) }); setOpen(false); reset(); },
    });
  };

  const completed = lists.filter(l => l.status === "Completed").length;
  const pending = lists.filter(l => l.status === "PendingClientSignoff").length;
  const inProgress = lists.filter(l => l.status === "InProgress").length;

  const columns: ColumnDef<CommissioningChecklist, any>[] = [
    {
      accessorKey: "projectId",
      header: "Name / Title",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-amber-50 flex items-center justify-center shrink-0">
            <CheckSquare className="w-4 h-4 text-amber-500" />
          </div>
          <span className="font-semibold text-sm text-foreground">
            Project #{row.original.projectId} Commissioning
          </span>
        </div>
      ),
    },
    {
      id: "project",
      header: "Project",
      enableSorting: false,
      meta: { responsive: "sm" } as any,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground font-mono">
          #{row.original.projectId}
        </span>
      ),
    },
    {
      id: "type",
      header: "Type",
      enableSorting: false,
      cell: () => (
        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-muted/50 text-muted-foreground border-border">
          Checklist
        </Badge>
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
      accessorKey: "clientSignatoryName",
      header: "Assigned To",
      meta: { responsive: "md" } as any,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.clientSignatoryName || "—"}
        </span>
      ),
    },
    {
      accessorKey: "commissionedOn",
      header: "Date",
      meta: { responsive: "sm" } as any,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {row.original.commissionedOn
            ? new Date(row.original.commissionedOn).toLocaleDateString("en-IN")
            : "Date not set"}
        </span>
      ),
    },
  ];

  const newChecklistDialog = (
    <CanCreate module="commissioning">
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" /> New Checklist
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title="Create Commissioning Checklist" maxWidth="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div><Label>Project ID</Label><Input {...register("projectId")} placeholder="e.g. 4" className="mt-1" /></div>
          <div><Label>Commissioned On (optional)</Label><Input {...register("commissionedOn")} type="date" className="mt-1" /></div>
          <div><Label>Remarks</Label><Textarea {...register("remarks")} placeholder="Any notes..." className="mt-1 min-h-[80px]" /></div>
          <p className="text-xs text-muted-foreground">15 standard commissioning items will be seeded automatically.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Creating…" : "Create"}</Button>
          </div>
        </form>
      </ResponsiveDialog>
    </CanCreate>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Commissioning"
        subtitle="Site commissioning and handover checklists"
        actions={newChecklistDialog}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total"
          value={lists.length}
          icon={CheckSquare}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="In Progress"
          value={inProgress}
          icon={Pen}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Pending Sign-off"
          value={pending}
          icon={Clock}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
        <StatCard
          label="Completed"
          value={completed}
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      <DataTable
        data={lists as CommissioningChecklist[]}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search checklists..."
        onRowClick={(row) => setLocation(`/commissioning/${row.id}`)}
        exportFilename="commissioning-checklists"
        filterOptions={[
          { key: "status", label: "Status", options: STATUS_OPTIONS },
        ]}
        emptyIcon={CheckSquare}
        emptyTitle="No commissioning checklists yet"
        emptyDescription="Create one for each project at commissioning stage"
      />
    </motion.div>
  );
}
