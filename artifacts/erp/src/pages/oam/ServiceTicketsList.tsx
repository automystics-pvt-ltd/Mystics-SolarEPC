import { useState } from "react";
import { useGetServiceTickets, useCreateServiceTicket, useResolveServiceTicket, getGetServiceTicketsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Ticket, Plus, Clock, CheckCircle2, AlertTriangle, User } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Performance", "Electrical", "Structural", "Inverter", "Module", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

const priorityColors: Record<string, string> = {
  Low: "bg-slate-100 text-slate-600",
  Medium: "bg-blue-50 text-blue-700",
  High: "bg-amber-50 text-amber-700",
  Critical: "bg-red-50 text-red-700",
};

const statusColors: Record<string, string> = {
  Open: "bg-red-50 text-red-700",
  InProgress: "bg-amber-50 text-amber-700",
  Resolved: "bg-emerald-50 text-emerald-700",
  Closed: "bg-slate-100 text-slate-500",
};

export default function ServiceTicketsList() {
  const [open, setOpen] = useState(false);
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const qc = useQueryClient();

  const queryParams = statusFilter ? { status: statusFilter } : {};
  const { data: tickets = [], isLoading } = useGetServiceTickets(queryParams, { query: { queryKey: getGetServiceTicketsQueryKey(queryParams) } });
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

  const open_ = tickets.filter(t => t.status === "Open").length;
  const critical = tickets.filter(t => t.priority === "Critical" && t.status !== "Resolved" && t.status !== "Closed").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="grid grid-cols-4 gap-3 flex-1">
          {[
            { label: "Total", value: tickets.length },
            { label: "Open", value: open_, color: open_ > 0 ? "text-red-600" : "text-slate-900" },
            { label: "Critical", value: critical, color: critical > 0 ? "text-red-600" : "text-slate-900" },
            { label: "Resolved", value: tickets.filter(t => t.status === "Resolved").length },
          ].map((s, i) => (
            <Card key={i} className="premium-card">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className={`text-xl font-semibold ${(s as any).color ?? "text-slate-900"}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex gap-2 shrink-0">
          <Select onValueChange={v => setStatusFilter(v === "all" ? "" : v)} defaultValue="all">
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="InProgress">In Progress</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
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
        </div>
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

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : tickets.length === 0 ? (
        <Card className="premium-card">
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3">
            <Ticket className="w-10 h-10 text-slate-300" />
            <p className="text-slate-500 font-medium">No service tickets</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className={cn("premium-card", t.priority === "Critical" && t.status === "Open" ? "border-red-200" : "")}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    t.priority === "Critical" ? "bg-red-50" : t.priority === "High" ? "bg-amber-50" : "bg-slate-100")}>
                    {t.priority === "Critical" ? <AlertTriangle className="w-4.5 h-4.5 text-red-500" /> : <Ticket className="w-4.5 h-4.5 text-slate-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-slate-400">{t.ticketNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[t.priority] ?? "bg-slate-100 text-slate-600"}`}>{t.priority}</span>
                      <span className="text-xs text-slate-500">{t.issueCategory}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 mt-1">{t.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {t.raisedBy && <span className="flex items-center gap-1 text-xs text-slate-400"><User className="w-3 h-3" /> {t.raisedBy}</span>}
                      <span className="flex items-center gap-1 text-xs text-slate-400"><Clock className="w-3 h-3" /> SLA: {t.slaHours}h · {new Date(t.createdAt!).toLocaleDateString("en-IN")}</span>
                      {t.assignedTechnicianName && <span className="text-xs text-slate-400">→ {t.assignedTechnicianName}</span>}
                    </div>
                    {t.resolution && <p className="text-xs text-emerald-600 mt-1 bg-emerald-50 px-2 py-1 rounded">✓ {t.resolution}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[t.status] ?? "bg-slate-100 text-slate-600"}`}>{t.status}</span>
                    {(t.status === "Open" || t.status === "InProgress") && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResolveId(t.id)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
