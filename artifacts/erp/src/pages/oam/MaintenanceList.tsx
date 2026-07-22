import { useState } from "react";
import { useGetMaintenanceSchedules, useCreateMaintenanceSchedule, useCompleteMaintenanceSchedule, getGetMaintenanceSchedulesQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus, Calendar, CheckCircle2, User } from "lucide-react";
import { motion } from "framer-motion";

const VISIT_TYPES = ["Preventive", "Corrective", "Emergency"];
const statusColors: Record<string, string> = {
  Scheduled: "bg-blue-50 text-blue-700",
  InProgress: "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-slate-100 text-slate-500",
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

  const upcoming = schedules.filter(s => s.status === "Scheduled").length;
  const overdue = schedules.filter(s => s.status === "Scheduled" && s.scheduledDate < new Date().toISOString().split("T")[0]).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-4 gap-3 flex-1 mr-6">
          {[
            { label: "Total Visits", value: schedules.length },
            { label: "Upcoming", value: upcoming },
            { label: "Overdue", value: overdue },
            { label: "Completed", value: schedules.filter(s => s.status === "Completed").length },
          ].map((s, i) => (
            <Card key={i} className="premium-card">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className={`text-xl font-semibold ${i === 2 && s.value > 0 ? "text-red-600" : "text-slate-900"}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
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

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : schedules.length === 0 ? (
        <Card className="premium-card">
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3">
            <Wrench className="w-10 h-10 text-slate-300" />
            <p className="text-slate-500 font-medium">No maintenance visits scheduled</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {schedules.map((s, i) => {
            const isOverdue = s.status === "Scheduled" && s.scheduledDate < new Date().toISOString().split("T")[0];
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className={`premium-card ${isOverdue ? "border-red-200" : ""}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.visitType === "Emergency" ? "bg-red-50" : "bg-blue-50"}`}>
                      <Wrench className={`w-4.5 h-4.5 ${s.visitType === "Emergency" ? "text-red-500" : "text-blue-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">Project #{s.projectId} — {s.visitType}</p>
                        {isOverdue && <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">Overdue</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-slate-400"><Calendar className="w-3 h-3" /> {s.scheduledDate}</span>
                        {s.assignedTechnicianName && <span className="flex items-center gap-1 text-xs text-slate-400"><User className="w-3 h-3" /> {s.assignedTechnicianName}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[s.status] ?? "bg-slate-100 text-slate-600"}`}>{s.status}</span>
                      {s.status === "Scheduled" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCompleteId(s.id)}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
