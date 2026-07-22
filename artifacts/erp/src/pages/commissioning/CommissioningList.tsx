import { useState } from "react";
import { Link } from "wouter";
import {
  useGetCommissioningChecklists,
  useCreateCommissioningChecklist,
  getGetCommissioningChecklistsQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Plus, Clock, CheckCircle2, Pen } from "lucide-react";
import { motion } from "framer-motion";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Draft: { label: "Draft", color: "bg-slate-100 text-slate-600", icon: <Clock className="w-3 h-3" /> },
  InProgress: { label: "In Progress", color: "bg-amber-50 text-amber-700", icon: <Pen className="w-3 h-3" /> },
  PendingClientSignoff: { label: "Pending Sign-off", color: "bg-blue-50 text-blue-700", icon: <Clock className="w-3 h-3" /> },
  Completed: { label: "Completed", color: "bg-emerald-50 text-emerald-700", icon: <CheckCircle2 className="w-3 h-3" /> },
};

export default function CommissioningList() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: lists = [], isLoading } = useGetCommissioningChecklists({}, { query: { queryKey: getGetCommissioningChecklistsQueryKey({}) } });
  const createMut = useCreateCommissioningChecklist();
  const { register, handleSubmit, reset } = useForm<any>();

  const onSubmit = (d: any) => {
    createMut.mutate({ data: { ...d, projectId: Number(d.projectId) } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCommissioningChecklistsQueryKey({}) }); setOpen(false); reset(); },
    });
  };

  const completed = lists.filter(l => l.status === "Completed").length;
  const pending = lists.filter(l => l.status === "PendingClientSignoff").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Commissioning & Handover</h1>
          <p className="text-sm text-slate-500 mt-0.5">Electrical checklists, client sign-offs, and compliance documentation</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> New Checklist</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Create Commissioning Checklist</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <div><Label>Project ID</Label><Input {...register("projectId")} placeholder="e.g. 4" className="mt-1" /></div>
              <div><Label>Commissioned On (optional)</Label><Input {...register("commissionedOn")} type="date" className="mt-1" /></div>
              <div><Label>Remarks</Label><Textarea {...register("remarks")} placeholder="Any notes..." className="mt-1 min-h-[80px]" /></div>
              <p className="text-xs text-slate-400">15 standard commissioning items will be seeded automatically.</p>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Creating…" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: lists.length },
          { label: "In Progress", value: lists.filter(l => l.status === "InProgress").length },
          { label: "Pending Sign-off", value: pending },
          { label: "Completed", value: completed },
        ].map((s, i) => (
          <Card key={i} className="premium-card">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className="text-2xl font-semibold text-slate-900">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : lists.length === 0 ? (
        <Card className="premium-card">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <CheckSquare className="w-10 h-10 text-slate-300" />
            <p className="text-slate-500 font-medium">No commissioning checklists yet</p>
            <p className="text-slate-400 text-sm">Create one for each project at commissioning stage</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {lists.map((item, i) => {
            const s = statusConfig[item.status] ?? statusConfig["Draft"];
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={`/commissioning/${item.id}`}>
                  <Card className="premium-card hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <CheckSquare className="w-4.5 h-4.5 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">Project #{item.projectId} Commissioning</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.commissionedOn ? `Commissioned: ${item.commissionedOn}` : "Date not set"} · 
                          {item.clientSignatoryName ? ` Signed by: ${item.clientSignatoryName}` : " Client sign-off pending"}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
                        {s.icon} {s.label}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
