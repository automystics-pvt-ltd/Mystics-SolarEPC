import { useState } from "react";
import { useGetAmcContracts, useCreateAmcContract, getGetAmcContractsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { FileCheck, Plus, IndianRupee } from "lucide-react";
import { CanCreate } from "@/lib/permissions";
import { motion } from "framer-motion";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader, StatCard, DataTable, StatusBadge } from "@/components/shared";

const FREQUENCIES = ["Monthly", "Quarterly", "HalfYearly", "Annual"];

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Draft", value: "Draft" },
  { label: "Expired", value: "Expired" },
  { label: "Terminated", value: "Terminated" },
];

type AmcContract = {
  id: number;
  contractNumber: string;
  clientName: string;
  projectId: number;
  startDate: string;
  endDate: string;
  annualValue: number;
  visitFrequency?: string;
  status: string;
};

export default function AmcContractsList() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: contracts = [], isPending } = useGetAmcContracts({}, { query: { queryKey: getGetAmcContractsQueryKey({}) } });
  const createMut = useCreateAmcContract();
  const { register, handleSubmit, setValue, reset } = useForm<any>();

  const onSubmit = (d: any) => {
    createMut.mutate({ data: { ...d, projectId: Number(d.projectId), annualValue: Number(d.annualValue) } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetAmcContractsQueryKey({}) }); setOpen(false); reset(); },
    });
  };

  const totalValue = contracts.reduce((s, c) => s + Number(c.annualValue), 0);
  const active = contracts.filter(c => c.status === "Active").length;

  const columns: ColumnDef<AmcContract, any>[] = [
    {
      accessorKey: "clientName",
      header: "Client Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-emerald-50 flex items-center justify-center shrink-0">
            <FileCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground leading-tight">
              {row.original.clientName}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {row.original.contractNumber}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "projectId",
      header: "Project",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground font-mono">
          #{row.original.projectId}
        </span>
      ),
    },
    {
      accessorKey: "startDate",
      header: "Start Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {row.original.startDate}
        </span>
      ),
    },
    {
      accessorKey: "endDate",
      header: "End Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {row.original.endDate}
        </span>
      ),
    },
    {
      accessorKey: "annualValue",
      header: "Annual Value",
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-sm text-foreground tabular-nums">
          ₹{Number(row.original.annualValue).toLocaleString("en-IN")}/yr
        </span>
      ),
    },
    {
      accessorKey: "visitFrequency",
      header: "Frequency",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.visitFrequency || "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} size="sm" />
      ),
    },
  ];

  const newContractDialog = (
    <CanCreate module="oam">
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
    </CanCreate>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
      <PageHeader
        title="AMC Contracts"
        subtitle="Active maintenance agreements"
        actions={newContractDialog}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Contracts"
          value={contracts.length}
          icon={FileCheck}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Active"
          value={active}
          icon={FileCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Annual Value"
          value={`₹${(totalValue / 100000).toFixed(1)}L`}
          icon={IndianRupee}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      <DataTable
        data={contracts as AmcContract[]}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search contracts..."
        exportFilename="amc-contracts"
        filterOptions={[
          { key: "status", label: "Status", options: STATUS_OPTIONS },
        ]}
        emptyIcon={FileCheck}
        emptyTitle="No AMC contracts yet"
        emptyDescription="Create annual maintenance contracts for commissioned projects"
      />
    </motion.div>
  );
}
