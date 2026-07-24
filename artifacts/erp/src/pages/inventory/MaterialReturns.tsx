import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/fetch";
import { motion } from "framer-motion";
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
import { RotateCcw, Plus, PackageCheck, XCircle, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

const returnSchema = z.object({
  projectName: z.string().optional(),
  fromSite: z.string().min(1, "Site required"),
  toWarehouseId: z.string().min(1, "Warehouse required"),
  returnDate: z.string().optional(),
  reason: z.string().optional(),
  condition: z.string().default("Good"),
  remarks: z.string().optional(),
});

const itemSchema = z.object({
  materialName: z.string().min(1, "Material required"),
  qty: z.string().min(1, "Qty required"),
  uom: z.string().default("Nos"),
  unitCost: z.string().optional(),
  batchNumber: z.string().optional(),
  condition: z.string().default("Good"),
});

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  InTransit: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Received: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  Inspected: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function ReturnDetail({ ret, onAction }: { ret: any; onAction: (act: string, id: number) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Return #", val: ret.returnNumber },
          { label: "Status", val: <Badge className={cn("text-[10px] font-bold border-0", STATUS_COLORS[ret.status] || "")}>{ret.status}</Badge> },
          { label: "From Site", val: ret.fromSite || "—" },
          { label: "To Warehouse", val: ret.toWarehouseName || "—" },
          { label: "Project", val: ret.projectName || "—" },
          { label: "Condition", val: ret.condition || "—" },
          { label: "Return Date", val: ret.returnDate || "—" },
          { label: "Received Date", val: ret.receivedDate || "—" },
        ].map(({ label, val }) => (
          <div key={label}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
            <div className="text-sm font-bold text-foreground">{val}</div>
          </div>
        ))}
      </div>
      {ret.reason && (
        <div className="p-3 bg-muted/30 rounded-[8px]">
          <p className="text-xs font-bold text-muted-foreground mb-1">Reason</p>
          <p className="text-sm text-foreground">{ret.reason}</p>
        </div>
      )}
      {/* Items */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Return Items ({ret.items?.length || 0})</p>
        {ret.items?.length > 0 ? (
          <div className="space-y-2">
            {ret.items.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-muted/20 rounded-[8px] border border-border/50">
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">{item.materialName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.qty} {item.uom} · {item.condition || "Good"}
                    {item.batchNumber && ` · Batch: ${item.batchNumber}`}
                  </p>
                </div>
                {item.unitCost && (
                  <span className="text-sm font-mono font-bold text-foreground">₹{Number(item.unitCost * item.qty).toLocaleString("en-IN")}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No items recorded</p>
        )}
      </div>
      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border">
        {ret.status === "Draft" && (
          <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[8px]" onClick={() => onAction("receive", ret.id)}>
            <PackageCheck className="h-4 w-4" /> Mark Received
          </Button>
        )}
        {ret.status === "Received" && (
          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-[8px]" onClick={() => onAction("close", ret.id)}>
            <PackageCheck className="h-4 w-4" /> Close Return
          </Button>
        )}
      </div>
    </div>
  );
}

export function MaterialReturns() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRet, setSelectedRet] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [addingItem, setAddingItem] = useState(false);

  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses-enhanced"], queryFn: () => apiGet<any[]>("/inventory/warehouses-enhanced") });

  const { data: returns = [], isPending } = useQuery({
    queryKey: ["inventory-returns", statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      return apiGet<any[]>(`/inventory/returns?${params}`);
    },
  });

  const returnForm = useForm<z.infer<typeof returnSchema>>({ resolver: zodResolver(returnSchema), defaultValues: { condition: "Good" } });
  const itemForm = useForm<z.infer<typeof itemSchema>>({ resolver: zodResolver(itemSchema), defaultValues: { uom: "Nos", condition: "Good" } });

  const createMut = useMutation({
    mutationFn: (d: any) => apiPost("/inventory/returns", {
      ...d, toWarehouseId: parseInt(d.toWarehouseId),
      toWarehouseName: warehouses.find((w: any) => w.id === parseInt(d.toWarehouseId))?.name,
      items,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-returns"] }); setCreateOpen(false); returnForm.reset(); setItems([]); toast({ title: "Return created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const actionMut = useMutation({
    mutationFn: ({ act, id }: { act: string; id: number }) => apiPost(`/inventory/returns/${id}/${act}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-returns"] }); setSelectedRet(null); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "returnNumber",
      header: "Return #",
      cell: ({ row }) => <span className="font-mono text-xs font-bold text-foreground">{row.original.returnNumber}</span>,
    },
    {
      accessorKey: "fromSite",
      header: "From Site",
      cell: ({ row }) => (
        <div>
          <p className="font-bold text-sm text-foreground">{row.original.fromSite || "—"}</p>
          {row.original.projectName && <p className="text-[10px] text-muted-foreground">{row.original.projectName}</p>}
        </div>
      ),
    },
    {
      accessorKey: "toWarehouseName",
      header: "To Warehouse",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.toWarehouseName || "—"}</span>,
    },
    {
      accessorKey: "totalItems",
      header: "Items",
      cell: ({ row }) => <span className="font-mono font-bold text-sm">{row.original.totalItems}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={cn("text-[10px] font-bold border-0", STATUS_COLORS[row.original.status] || "")}>{row.original.status}</Badge>
      ),
    },
    {
      accessorKey: "condition",
      header: "Condition",
      cell: ({ row }) => (
        <Badge variant="outline" className={cn(
          "text-[10px] font-bold",
          row.original.condition === "Good" ? "text-emerald-700" : row.original.condition === "Damaged" ? "text-red-600" : "text-amber-600"
        )}>
          {row.original.condition || "Good"}
        </Badge>
      ),
    },
    {
      accessorKey: "returnDate",
      header: "Return Date",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.returnDate || "—"}</span>,
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Material Returns"
        subtitle="Materials returned from project sites to warehouses"
        actions={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9 text-sm font-bold rounded-[8px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {["Draft","InTransit","Received","Inspected","Closed"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-2 rounded-[8px] font-bold bg-[#EA580C] hover:bg-[#C2410C] text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Return
            </Button>
          </div>
        }
      />

      <DataTable
        data={returns}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search returns..."
        onRowClick={row => setSelectedRet(row)}
        emptyIcon={RotateCcw}
        emptyTitle="No returns found"
        emptyDescription="Record material returns from project sites"
        exportFilename="material-returns"
      />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { returnForm.reset(); setItems([]); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl font-black">New Material Return</DialogTitle></DialogHeader>
          <Form {...returnForm}>
            <form onSubmit={returnForm.handleSubmit(d => createMut.mutate(d))} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={returnForm.control} name="fromSite" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">From Site *</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} placeholder="Site name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={returnForm.control} name="toWarehouseId" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">To Warehouse *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 bg-muted/30"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={returnForm.control} name="projectName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Project</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={returnForm.control} name="returnDate" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Return Date</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={returnForm.control} name="condition" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Condition</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 bg-muted/30"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Partially Damaged">Partially Damaged</SelectItem>
                        <SelectItem value="Damaged">Damaged</SelectItem>
                        <SelectItem value="Unusable">Unusable</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={returnForm.control} name="reason" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Reason</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} placeholder="Excess / Unused / Defective" /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={returnForm.control} name="remarks" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Remarks</FormLabel>
                  <FormControl><Textarea className="bg-muted/30" rows={2} {...field} /></FormControl>
                </FormItem>
              )} />

              {/* Items */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground">Return Items ({items.length})</p>
                  <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs font-bold rounded-[6px]" onClick={() => setAddingItem(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                  </Button>
                </div>
                {items.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-[8px]">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-foreground">{item.materialName}</p>
                          <p className="text-xs text-muted-foreground">{item.qty} {item.uom} · {item.condition}</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" disabled={createMut.isPending} className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-[8px]">
                {createMut.isPending ? "Creating..." : "Create Return"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={addingItem} onOpenChange={setAddingItem}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-lg font-black">Add Return Item</DialogTitle></DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(d => {
              setItems(prev => [...prev, { ...d, qty: parseFloat(d.qty), unitCost: parseFloat(d.unitCost || "0") }]);
              setAddingItem(false);
              itemForm.reset({ uom: "Nos", condition: "Good" });
            })} className="space-y-4 mt-2">
              <FormField control={itemForm.control} name="materialName" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Material *</FormLabel>
                  <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={itemForm.control} name="qty" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Quantity *</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" min="0.001" step="0.001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={itemForm.control} name="uom" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">UOM</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 bg-muted/30"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{["Nos","Kg","Mtr","Ltr","Box","Roll","Set"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={itemForm.control} name="condition" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Condition</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 bg-muted/30"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Partially Damaged">Partially Damaged</SelectItem>
                        <SelectItem value="Damaged">Damaged</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={itemForm.control} name="unitCost" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Unit Cost (₹)</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" min="0" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={itemForm.control} name="batchNumber" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Batch / Serial #</FormLabel>
                  <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
                </FormItem>
              )} />
              <Button type="submit" className="w-full h-11 bg-[#0A0F2C] hover:bg-[#0A0F2C]/90 text-white font-bold rounded-[8px]">Add Item</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRet} onOpenChange={() => setSelectedRet(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl font-black">Return Detail</DialogTitle></DialogHeader>
          {selectedRet && (
            <ReturnDetail
              ret={selectedRet}
              onAction={(act, id) => actionMut.mutate({ act, id })}
            />
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
