import { useState } from "react";
import { useGetMaintenanceSchedules, useCreateMaintenanceSchedule, useCompleteMaintenanceSchedule, getGetMaintenanceSchedulesQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus, Calendar, CheckCircle2, User } from "lucide-react";
import { motion } from "framer-motion";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader, StatCard, DataTable } from "@/components/shared";

const VISIT_TYPES = ["Preventive", "Corrective", "Emergency"];
const statusColors: Record<string, string> = {
  Scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  InProgress: "bg-amber-50 text-amber-700 border-amber-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUS_OPTIONS = [
  { label: "Scheduled", value: "Scheduled" },
  { label: "In Progress", value: "InProgress" },
  { label: "Completed", value: "Completed" },
  { label: "Cancelled", value: "Cancelled" },
];

type MaintenanceSchedule = {
  id: number;
  projectId: number;
  visitType: string;
  status: string;
  scheduledDate: string;
  assignedTechnicianName?: string | null;
  amcContractId?: number | null;
};

export default function MaintenanceList() {
  const [open, setOpen] = useState(false);
  const [completeId, setCompleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: schedules = [], isLoading } = useGetMaintenanceSchedules({}, { query: { queryKey: getGetMaintenanceSchedulesQueryKey({}) } });
  const createMut = useCreateMaintenanceSchedule();
  const completeMut = useCompleteMaintenanceSchedule();
  const { register, handleSubmit, setValue, reset } = useForm<any>();
  const { register: cReg, handleSubmit: cSubmit, reset: cReset } = useForm<any>();

  const onSubmit = (d: any) => {
    createMut.mutate({ data: { ...d, projectId: Number(d.projectId), amcContractId: d.amcContractId ? Number(d.amcContractId) : undefined } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetMaintenanceSchedulesQueryKey({}) }); setOpen(false); reset(); },
    });
  };

  const onComplete = (d: any) => {
    if (!completeId) return;
    completeMut.mutate({ id: completeId, data: d }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetMaintenanceSchedulesQueryKey({}) }); setCompleteId(null); cReset(); },
    });
  };

  const today = new Date().toISOString().split("T")[0];
  const upcoming = schedules.filter(s => s.status === "Scheduled").length;
  const overdue = schedules.filter(s => s.status === "Scheduled" && s.scheduledDate < today).length;

  const columns: ColumnDef<MaintenanceSchedule, any>[] = [
    {
      accessorKey: "visitType",
      header: "Visit Type",
      cell: ({ row }) => {
        const isOverdue = row.original.status === "Scheduled" && row.original.scheduledDate < today;
        return (
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${row.original.visitType === "Emergency" ? "bg-red-50" : "bg-blue-50"}`}>
              <Wrench className={`w-4 h-4 ${row.original.visitType === "Emergency" ? "text-red-500" : "text-blue-500"}`} />
            </div>
            <div>
              <div className="font-semibold text-sm text-foreground leading-tight">
                Project #{row.original.projectId} — {row.original.visitType}
              </div>
              {isOverdue && (
                <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Overdue</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "projectId",
      header: "Project",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground font-mono">#{row.original.projectId}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${statusColors[row.original.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
          {row.original.status}
        </Badge>
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
      accessorKey: "scheduledDate",
      header: "Scheduled Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground flex items-center gap-1.5 tabular-nums">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
          {row.original.scheduledDate}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.status === "Scheduled" ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={(e) => { e.stopPropagation(); setCompleteId(row.original.id); }}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
          </Button>
        ) : null,
    },
  ];

  const scheduleVisitDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 shrink-0"><Plus className="w-3.5 h-3.5" /> Schedule Visit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Schedule Maintenance Visit</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Project ID</Label><Input {...register("projectId")} placeholder="e.g. 4" className="mt-1" /></div>
            <div><Label>AMC Contract ID</Label><Input {...register("amcContractId")} placeholder="Optional" className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Visit Type</Label>
              <Select onValueChange={v => setValue("visitType", v)} defaultValue="Preventive">
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{VISIT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Scheduled Date</Label><Input {...register("scheduledDate")} type="date" className="mt-1" /></div>
          </div>
          <div><Label>Assigned Technician</Label><Input {...register("assignedTechnicianName")} placeholder="Technician name" className="mt-1" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Scheduling…" : "Schedule"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <PageHeader
        title="Maintenance Schedule"
        subtitle="Scheduled preventive maintenance"
        actions={scheduleVisitDialog}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Visits" value={schedules.length} icon={Wrench} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard label="Upcoming" value={upcoming} icon={Calendar} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard label="Overdue" value={overdue} icon={Wrench} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatCard label="Completed" value={schedules.filter(s => s.status === "Completed").length} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

      {/* Complete dialog */}
      <Dialog open={!!completeId} onOpenChange={v => !v && setCompleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Mark Visit Completed</DialogTitle></DialogHeader>
          <form onSubmit={cSubmit(onComplete)} className="space-y-4 pt-2">
            <div><Label>Completed Date</Label><Input {...cReg("completedDate")} type="date" className="mt-1" /></div>
            <div><Label>Work Done</Label><Textarea {...cReg("workDone")} placeholder="Summary of work performed..." className="mt-1 min-h-[80px]" /></div>
            <div><Label>Observations</Label><Textarea {...cReg("observations")} placeholder="Plant health, issues noticed..." className="mt-1" /></div>
            <div><Label>Next Scheduled Date</Label><Input {...cReg("nextScheduledDate")} type="date" className="mt-1" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCompleteId(null)}>Cancel</Button>
              <Button type="submit" disabled={completeMut.isPending}>{completeMut.isPending ? "Saving…" : "Mark Complete"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DataTable
        data={schedules as MaintenanceSchedule[]}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search maintenance visits..."
        exportFilename="maintenance-schedules"
        filterOptions={[
          { key: "status", label: "Status", options: STATUS_OPTIONS },
          { key: "visitType", label: "Type", options: VISIT_TYPES.map(t => ({ label: t, value: t })) },
        ]}
        emptyIcon={Wrench}
        emptyTitle="No maintenance visits scheduled"
        emptyDescription="Schedule preventive maintenance visits for your projects"
      />
    </motion.div>
  );
}
