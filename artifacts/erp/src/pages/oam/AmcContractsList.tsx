import { useState } from "react";
import { useGetAmcContracts, useCreateAmcContract, getGetAmcContractsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { FileCheck, Plus, Calendar, IndianRupee } from "lucide-react";
import { motion } from "framer-motion";

const FREQUENCIES = ["Monthly", "Quarterly", "HalfYearly", "Annual"];

const statusColors: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Draft: "bg-slate-100 text-slate-600",
  Expired: "bg-red-50 text-red-700",
  Terminated: "bg-stone-50 text-stone-600",
};

export default function AmcContractsList() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: contracts = [], isLoading } = useGetAmcContracts({}, { query: { queryKey: getGetAmcContractsQueryKey({}) } });
  const createMut = useCreateAmcContract();
  const { register, handleSubmit, setValue, reset } = useForm<any>();

  const onSubmit = (d: any) => {
    createMut.mutate({ data: { ...d, projectId: Number(d.projectId), annualValue: Number(d.annualValue) } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetAmcContractsQueryKey({}) }); setOpen(false); reset(); },
    });
  };

  const totalValue = contracts.reduce((s, c) => s + Number(c.annualValue), 0);
  const active = contracts.filter(c => c.status === "Active").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1 mr-6">
          {[
            { label: "Total Contracts", value: contracts.length },
            { label: "Active", value: active },
            { label: "Annual Value", value: `₹${(totalValue / 100000).toFixed(1)}L` },
          ].map((s, i) => (
            <Card key={i} className="premium-card">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className="text-xl font-semibold text-slate-900">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 shrink-0"><Plus className="w-3.5 h-3.5" /> New AMC Contract</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>New AMC Contract</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Project ID</Label><Input {...register("projectId")} placeholder="e.g. 4" className="mt-1" /></div>
                <div><Label>Client Name</Label><Input {...register("clientName")} placeholder="Client company name" className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input {...register("startDate")} type="date" className="mt-1" /></div>
                <div><Label>End Date</Label><Input {...register("endDate")} type="date" className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Annual Value (₹)</Label><Input {...register("annualValue")} type="number" placeholder="e.g. 75000" className="mt-1" /></div>
                <div>
                  <Label>Visit Frequency</Label>
                  <Select onValueChange={v => setValue("visitFrequency", v)} defaultValue="Quarterly">
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Terms & Conditions</Label><Textarea {...register("terms")} placeholder="Scope of work, exclusions, etc." className="mt-1 min-h-[80px]" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Creating…" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : contracts.length === 0 ? (
        <Card className="premium-card">
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3">
            <FileCheck className="w-10 h-10 text-slate-300" />
            <p className="text-slate-500 font-medium">No AMC contracts yet</p>
            <p className="text-slate-400 text-sm">Create annual maintenance contracts for commissioned projects</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {contracts.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="premium-card hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                    <FileCheck className="w-4.5 h-4.5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{c.clientName}</p>
                      <span className="font-mono text-xs text-slate-400">{c.contractNumber}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="w-3 h-3" /> {c.startDate} → {c.endDate}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <IndianRupee className="w-3 h-3" /> {Number(c.annualValue).toLocaleString("en-IN")}/yr · {c.visitFrequency}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[c.status] ?? "bg-slate-100 text-slate-600"}`}>{c.status}</span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
