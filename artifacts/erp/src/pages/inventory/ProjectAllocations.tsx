import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/fetch";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ClipboardList, Plus, Check, Truck, XCircle, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

const createSchema = z.object({
  projectName: z.string().min(1, "Project required"),
  warehouseId: z.string().min(1, "Warehouse required"),
  materialName: z.string().min(1, "Material required"),
  materialCode: z.string().optional(),
  categoryCode: z.string().optional(),
  uom: z.string().default("Nos"),
  requestedQty: z.string().min(1, "Quantity required"),
  unitCost: z.string().optional(),
  purpose: z.string().optional(),
  requiredDate: z.string().optional(),
  remarks: z.string().optional(),
});

const CATEGORIES = [
  { code: "PANEL", name: "Solar Panels" }, { code: "INVERTER", name: "Inverters" },
  { code: "BATTERY", name: "Battery Storage" }, { code: "MOUNT", name: "Mounting Structures" },
  { code: "CABLE", name: "Cables & Wiring" }, { code: "BOS", name: "BOS Materials" },
  { code: "METER", name: "Meters & Monitoring" }, { code: "SPARE", name: "Spare Parts" },
  { code: "TOOL", name: "Tools & Equipment" }, { code: "CONSUMABLE", name: "Consumables" },
  { code: "CIVIL", name: "Civil Materials" }, { code: "ELECTRICAL", name: "Electrical Components" },
];

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Issued: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PartiallyIssued: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Closed: "bg-slate-100 text-slate-600 dark:bg-slate-800/40",
  Cancelled: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

function AllocationDetail({ alloc, onClose, onAction }: { alloc: any; onClose: () => void; onAction: (act: string, id: number, data?: any) => void }) {
  const [issueQty, setIssueQty] = useState(String(alloc.allocatedQty));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Allocation #", val: alloc.allocationNumber },
          { label: "Status", val: <Badge className={cn("text-[10px] font-bold", STATUS_COLORS[alloc.status] || "")}>{alloc.status}</Badge> },
          { label: "Material", val: alloc.materialName },
          { label: "Project", val: alloc.projectName || "—" },
          { label: "Warehouse", val: alloc.warehouseName || "—" },
          { label: "Category", val: alloc.categoryCode || "—" },
          { label: "Requested Qty", val: `${alloc.requestedQty} ${alloc.uom}` },
          { label: "Allocated Qty", val: `${alloc.allocatedQty} ${alloc.uom}` },
          { label: "Issued Qty", val: `${alloc.issuedQty} ${alloc.uom}` },
          { label: "Required Date", val: alloc.requiredDate || "—" },
          { label: "Purpose", val: alloc.purpose || "—" },
          { label: "Total Value", val: `₹${Number(alloc.totalValue).toLocaleString("en-IN")}` },
        ].map(({ label, val }) => (
          <div key={label}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
            <div className="text-sm font-bold text-foreground">{val}</div>
          </div>
        ))}
      </div>
      {alloc.remarks && (
        <div className="p-3 bg-muted/30 rounded-[8px]">
          <p className="text-xs font-bold text-muted-foreground mb-1">Remarks</p>
          <p className="text-sm text-foreground">{alloc.remarks}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        {alloc.status === "Draft" && (
          <>
            <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[8px]" onClick={() => onAction("approve", alloc.id, { allocatedQty: alloc.requestedQty })}>
              <Check className="h-4 w-4" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="gap-2 font-bold rounded-[8px] text-red-600 border-red-200" onClick={() => onAction("cancel", alloc.id)}>
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          </>
        )}
        {["Approved", "PartiallyIssued"].includes(alloc.status) && (
          <div className="flex items-center gap-2">
            <Input
              type="number" value={issueQty} onChange={e => setIssueQty(e.target.value)}
              className="h-9 w-28 text-sm font-mono"
              placeholder="Issue qty"
            />
            <Button size="sm" className="gap-2 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-[8px]" onClick={() => onAction("issue", alloc.id, { issuedQty: parseFloat(issueQty) })}>
              <Truck className="h-4 w-4" /> Issue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectAllocations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAlloc, setSelectedAlloc] = useState<any>(null);

  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses-enhanced"], queryFn: () => apiGet<any[]>("/inventory/warehouses-enhanced") });

  const { data: allocations = [], isPending } = useQuery({
    queryKey: ["inventory-allocations", statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      return apiGet<any[]>(`/inventory/allocations?${params}`);
    },
  });

  const form = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema), defaultValues: { uom: "Nos" } });

  const createMut = useMutation({
    mutationFn: (d: any) => apiPost("/inventory/allocations", {
      ...d, warehouseId: parseInt(d.warehouseId),
      requestedQty: parseFloat(d.requestedQty),
      unitCost: parseFloat(d.unitCost) || 0,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-allocations"] }); setCreateOpen(false); form.reset(); toast({ title: "Allocation created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const actionMut = useMutation({
    mutationFn: ({ act, id, data }: { act: string; id: number; data?: any }) =>
      apiPost(`/inventory/allocations/${id}/${act}`, data || {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-allocations"] }); setSelectedAlloc(null); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "allocationNumber",
      header: "Allocation #",
      cell: ({ row }) => <span className="font-mono text-xs font-bold text-foreground">{row.original.allocationNumber}</span>,
    },
    {
      accessorKey: "materialName",
      header: "Material",
      cell: ({ row }) => (
        <div>
          <p className="font-bold text-sm text-foreground">{row.original.materialName}</p>
          {row.original.projectName && <p className="text-[10px] text-muted-foreground">{row.original.projectName}</p>}
        </div>
      ),
    },
    {
      accessorKey: "warehouseName",
      header: "Warehouse",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.warehouseName || "—"}</span>,
    },
    {
      id: "qty",
      header: "Qty",
      cell: ({ row }) => (
        <div className="text-sm font-mono">
          <span className="font-black text-foreground">{row.original.requestedQty}</span>
          {row.original.issuedQty > 0 && <span className="text-muted-foreground"> / {row.original.issuedQty} issued</span>}
          <span className="text-muted-foreground ml-1 text-xs">{row.original.uom}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={cn("text-[10px] font-bold border-0", STATUS_COLORS[row.original.status] || "")}>{row.original.status}</Badge>
      ),
    },
    {
      accessorKey: "totalValue",
      header: "Value",
      cell: ({ row }) => <span className="font-mono text-sm font-bold">₹{Number(row.original.totalValue).toLocaleString("en-IN")}</span>,
    },
    {
      accessorKey: "requiredDate",
      header: "Required By",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.requiredDate || "—"}</span>,
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Material Allocations"
        subtitle="Project-wise material allocation and issuance"
        actions={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9 text-sm font-bold rounded-[8px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {["Draft","Approved","PartiallyIssued","Issued","Closed","Cancelled"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-2 rounded-[8px] font-bold bg-[#EA580C] hover:bg-[#C2410C] text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Allocation
            </Button>
          </div>
        }
      />

      <DataTable
        data={allocations}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search allocations..."
        onRowClick={row => setSelectedAlloc(row)}
        emptyIcon={ClipboardList}
        emptyTitle="No allocations"
        emptyDescription="Create material allocations for project sites"
        exportFilename="material-allocations"
      />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-xl font-black">New Material Allocation</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMut.mutate(d))} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="projectName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Project *</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} placeholder="Project name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="warehouseId" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Warehouse *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 bg-muted/30"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="materialName" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Material Name *</FormLabel>
                  <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="requestedQty" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Qty *</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" min="0.001" step="0.001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="uom" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">UOM</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 bg-muted/30"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{["Nos","Kg","Mtr","Ltr","Box","Roll","Set"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="unitCost" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Unit Cost (₹)</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" min="0" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="categoryCode" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 bg-muted/30"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="requiredDate" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Required Date</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="purpose" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Purpose</FormLabel>
                  <FormControl><Input className="h-10 bg-muted/30" {...field} placeholder="Purpose of allocation" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="remarks" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Remarks</FormLabel>
                  <FormControl><Textarea className="bg-muted/30" rows={2} {...field} /></FormControl>
                </FormItem>
              )} />
              <Button type="submit" disabled={createMut.isPending} className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-[8px]">
                {createMut.isPending ? "Creating..." : "Create Allocation"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAlloc} onOpenChange={() => setSelectedAlloc(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Allocation Detail</DialogTitle>
          </DialogHeader>
          {selectedAlloc && (
            <AllocationDetail
              alloc={selectedAlloc}
              onClose={() => setSelectedAlloc(null)}
              onAction={(act, id, data) => actionMut.mutate({ act, id, data })}
            />
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
