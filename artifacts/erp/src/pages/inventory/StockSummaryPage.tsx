import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Package, AlertTriangle, Download, Plus, SlidersHorizontal } from "lucide-react";
import { exportToCsv } from "@/lib/export";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

const addSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse required"),
  materialName: z.string().min(1, "Material name required"),
  materialCode: z.string().optional(),
  categoryCode: z.string().optional(),
  uom: z.string().default("Nos"),
  currentQty: z.string().min(1, "Quantity required"),
  unitCost: z.string().optional(),
  minStockLevel: z.string().optional(),
  maxStockLevel: z.string().optional(),
  reorderQty: z.string().optional(),
  locationBin: z.string().optional(),
});

const editSchema = z.object({
  minStockLevel: z.string().optional(),
  maxStockLevel: z.string().optional(),
  reorderQty: z.string().optional(),
  unitCost: z.string().optional(),
  locationBin: z.string().optional(),
});

const CATEGORIES = [
  { code: "PANEL", name: "Solar Panels" },
  { code: "INVERTER", name: "Inverters" },
  { code: "BATTERY", name: "Battery Storage" },
  { code: "MOUNT", name: "Mounting Structures" },
  { code: "CABLE", name: "Cables & Wiring" },
  { code: "BOS", name: "BOS Materials" },
  { code: "METER", name: "Meters & Monitoring" },
  { code: "SPARE", name: "Spare Parts" },
  { code: "TOOL", name: "Tools & Equipment" },
  { code: "CONSUMABLE", name: "Consumables" },
  { code: "CIVIL", name: "Civil Materials" },
  { code: "ELECTRICAL", name: "Electrical Components" },
];

const UOM_OPTIONS = ["Nos", "Kg", "Mtr", "Ltr", "Box", "Roll", "Set", "Pair", "Bundle", "Sq.Mtr"];

export function StockSummaryPage() {
  const [, nav] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [reorderFilter, setReorderFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-enhanced"],
    queryFn: () => apiGet<any[]>("/inventory/warehouses-enhanced"),
  });

  const { data: stock = [], isPending } = useQuery({
    queryKey: ["stock-levels", categoryFilter, warehouseFilter, reorderFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("categoryCode", categoryFilter);
      if (warehouseFilter !== "all") params.set("warehouseId", warehouseFilter);
      if (reorderFilter === "below") params.set("belowReorder", "true");
      if (reorderFilter === "out") params.set("outOfStock", "true");
      return apiGet<any[]>(`/inventory/stock-levels?${params}`);
    },
  });

  const addForm = useForm<z.infer<typeof addSchema>>({
    resolver: zodResolver(addSchema),
    defaultValues: { uom: "Nos", currentQty: "0" },
  });
  const editForm = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema) });

  const addMut = useMutation({
    mutationFn: (d: any) => apiPost("/inventory/stock-levels", {
      ...d, warehouseId: parseInt(d.warehouseId),
      currentQty: parseFloat(d.currentQty) || 0,
      unitCost: parseFloat(d.unitCost) || 0,
      minStockLevel: parseFloat(d.minStockLevel) || 0,
      maxStockLevel: parseFloat(d.maxStockLevel) || 0,
      reorderQty: parseFloat(d.reorderQty) || 0,
      categoryName: CATEGORIES.find(c => c.code === d.categoryCode)?.name,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      setAddOpen(false);
      addForm.reset();
      toast({ title: "Stock level added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: (d: any) => apiPatch(`/inventory/stock-levels/${editItem?.id}`, {
      minStockLevel: parseFloat(d.minStockLevel) || undefined,
      maxStockLevel: parseFloat(d.maxStockLevel) || undefined,
      reorderQty: parseFloat(d.reorderQty) || undefined,
      unitCost: parseFloat(d.unitCost) || undefined,
      locationBin: d.locationBin || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      setEditItem(null);
      toast({ title: "Stock levels updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalValue = useMemo(() => stock.reduce((s: number, i: any) => s + Number(i.totalValue || 0), 0), [stock]);
  const belowCount = useMemo(() => stock.filter((i: any) => i.isBelowReorder).length, [stock]);

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "materialName",
      header: "Material",
      cell: ({ row }) => (
        <div>
          <p className="font-bold text-sm text-foreground">{row.original.materialName}</p>
          {row.original.materialCode && (
            <p className="text-[10px] font-mono text-muted-foreground">{row.original.materialCode}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "categoryName",
      header: "Category",
      cell: ({ row }) => (
        row.original.categoryName ? (
          <Badge variant="secondary" className="text-[10px] font-bold">{row.original.categoryName}</Badge>
        ) : <span className="text-muted-foreground text-xs">—</span>
      ),
    },
    {
      accessorKey: "warehouseName",
      header: "Warehouse",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.warehouseName}</span>,
    },
    {
      accessorKey: "currentQty",
      header: "Current Qty",
      cell: ({ row }) => (
        <span className={cn(
          "font-mono font-black text-sm",
          row.original.isOutOfStock ? "text-red-600" : row.original.isBelowReorder ? "text-amber-600" : "text-foreground"
        )}>
          {Number(row.original.currentQty).toLocaleString()} <span className="font-normal text-xs text-muted-foreground">{row.original.uom}</span>
        </span>
      ),
    },
    {
      accessorKey: "availableQty",
      header: "Available",
      cell: ({ row }) => (
        <span className="font-mono text-sm text-foreground">
          {Number(row.original.availableQty).toLocaleString()}
        </span>
      ),
    },
    {
      id: "reorder",
      header: "Reorder Status",
      cell: ({ row }) => {
        const r = row.original;
        if (r.isOutOfStock) return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-bold">Out of Stock</Badge>;
        if (r.isBelowReorder) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold">Below Reorder</Badge>;
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-bold">Healthy</Badge>;
      },
    },
    {
      accessorKey: "totalValue",
      header: "Stock Value",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-sm text-foreground">
          ₹{Number(row.original.totalValue || 0).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost" size="sm"
          className="h-7 px-2 text-xs font-bold"
          onClick={() => {
            setEditItem(row.original);
            editForm.reset({
              minStockLevel: row.original.minStockLevel?.toString(),
              maxStockLevel: row.original.maxStockLevel?.toString(),
              reorderQty: row.original.reorderQty?.toString(),
              unitCost: row.original.unitCost?.toString(),
              locationBin: row.original.locationBin,
            });
          }}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 mr-1" /> Levels
        </Button>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Stock Summary"
        subtitle="Current stock levels across all warehouses"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 rounded-[8px] font-bold" onClick={() => exportToCsv(
              "stock-summary.csv",
              ["Material", "Code", "Category", "Warehouse", "Qty", "UOM", "Available", "Min Level", "Unit Cost", "Total Value", "Status"],
              stock.map((s: any) => [s.materialName, s.materialCode, s.categoryName, s.warehouseName, s.currentQty, s.uom, s.availableQty, s.minStockLevel, s.unitCost, s.totalValue, s.isOutOfStock ? "Out of Stock" : s.isBelowReorder ? "Below Reorder" : "Healthy"])
            )}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="sm" className="gap-2 rounded-[8px] font-bold bg-[#EA580C] hover:bg-[#C2410C] text-white" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Stock
            </Button>
          </div>
        }
      />

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-black font-mono text-[#EA580C]">₹{(totalValue / 100000).toFixed(1)}L</p>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Total Stock Value</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-black font-mono text-foreground">{stock.length}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">SKUs Tracked</p>
        </div>
        <div className={cn("bg-card border rounded-xl p-4 text-center", belowCount > 0 ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10" : "border-border")}>
          <p className={cn("text-2xl font-black font-mono", belowCount > 0 ? "text-amber-600" : "text-emerald-600")}>{belowCount}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Below Reorder Point</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44 h-9 text-sm font-bold rounded-[8px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-44 h-9 text-sm font-bold rounded-[8px]">
            <SelectValue placeholder="All Warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={reorderFilter} onValueChange={setReorderFilter}>
          <SelectTrigger className="w-44 h-9 text-sm font-bold rounded-[8px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="below">Below Reorder</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        {(categoryFilter !== "all" || warehouseFilter !== "all" || reorderFilter !== "all") && (
          <Button variant="ghost" size="sm" className="h-9 font-bold text-xs" onClick={() => { setCategoryFilter("all"); setWarehouseFilter("all"); setReorderFilter("all"); }}>
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        data={stock}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search materials..."
        emptyIcon={Package}
        emptyTitle="No stock records found"
        emptyDescription="Add stock levels to get started"
        exportFilename="stock-summary"
      />

      {/* Add Stock Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="text-xl font-black">Add Stock Level</DialogTitle></DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(d => addMut.mutate(d))} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addForm.control} name="warehouseId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Warehouse *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 bg-muted/30"><SelectValue placeholder="Select warehouse" /></SelectTrigger></FormControl>
                      <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="categoryCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 bg-muted/30"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={addForm.control} name="materialName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider">Material Name *</FormLabel>
                  <FormControl><Input className="h-10 bg-muted/30" {...field} placeholder="e.g. Waaree 540W Solar Panel" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={addForm.control} name="materialCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Material Code</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} placeholder="PNL-540" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="currentQty" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Current Qty *</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" min="0" step="0.001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="uom" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">UOM</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 bg-muted/30"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addForm.control} name="unitCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Unit Cost (₹)</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" min="0" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="locationBin" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Location Bin</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} placeholder="A-R1-B10" /></FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
                <FormField control={addForm.control} name="minStockLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Min Level</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" min="0" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="maxStockLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Max Level</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" min="0" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="reorderQty" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Reorder Qty</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" min="0" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <Button type="submit" disabled={addMut.isPending} className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-[8px]">
                {addMut.isPending ? "Adding..." : "Add Stock Level"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Levels Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-lg font-black">Update Reorder Levels</DialogTitle></DialogHeader>
          {editItem && (
            <div className="mb-4 p-3 bg-muted/30 rounded-[8px]">
              <p className="font-bold text-sm">{editItem.materialName}</p>
              <p className="text-xs text-muted-foreground">{editItem.warehouseName} · Current: {editItem.currentQty} {editItem.uom}</p>
            </div>
          )}
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(d => editMut.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <FormField control={editForm.control} name="minStockLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Min Level</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="maxStockLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Max Level</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="reorderQty" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Reorder Qty</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editForm.control} name="unitCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Unit Cost (₹)</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="locationBin" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Location Bin</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <Button type="submit" disabled={editMut.isPending} className="w-full h-11 bg-[#0A0F2C] hover:bg-[#0A0F2C]/90 text-white font-bold rounded-[8px]">
                {editMut.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
