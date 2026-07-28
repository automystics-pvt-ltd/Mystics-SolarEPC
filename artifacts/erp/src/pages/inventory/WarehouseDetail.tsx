import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/fetch";
import { useGetWarehouses, useGetWarehouseLocations, useCreateWarehouseLocation, useGetWarehouseStockSummary } from "@workspace/api-client-react";
import { getGetWarehouseLocationsQueryKey, getGetWarehouseStockSummaryQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2, Plus, Package, Grid, MapPin, Download, Phone, Mail,
  Building2, Edit2, TrendingUp, AlertTriangle, Package2, LayoutGrid, ArrowRightLeft
} from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@/lib/zodResolver";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { PageHeader, SectionCard } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const locSchema = z.object({ zone: z.string().min(1), rack: z.string().min(1), bin: z.string().min(1) });
const editWhSchema = z.object({
  warehouseCode: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
  managerName: z.string().optional(),
  description: z.string().optional(),
});

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value || "—"}</p>
    </div>
  );
}

export function WarehouseDetail({ id }: { id: string }) {
  const whId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: warehouses } = useGetWarehouses({});
  const wh = warehouses?.find(w => w.id === whId);

  const { data: whEnhanced } = useQuery({
    queryKey: ["warehouses-enhanced", whId],
    queryFn: () => apiGet<any[]>("/inventory/warehouses-enhanced").then(data => data.find((w: any) => w.id === whId)),
  });

  const { data: locations, isLoading: locLoading } = useGetWarehouseLocations(whId, {
    query: { enabled: !!whId, queryKey: getGetWarehouseLocationsQueryKey(whId) }
  });

  const { data: stock, isLoading: stockLoading } = useGetWarehouseStockSummary(whId, {
    query: { enabled: !!whId, queryKey: getGetWarehouseStockSummaryQueryKey(whId) }
  });

  const { data: stockLevels = [], isLoading: levelsLoading } = useQuery({
    queryKey: ["stock-levels-wh", whId],
    queryFn: () => apiGet<any[]>(`/inventory/stock-levels?warehouseId=${whId}`),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers-wh", whId],
    queryFn: () => apiGet<any[]>(`/stock-transfers?limit=20`).catch(() => []),
  });

  const form = useForm<z.infer<typeof locSchema>>({ resolver: zodResolver(locSchema) });
  const editForm = useForm<z.infer<typeof editWhSchema>>({
    resolver: zodResolver(editWhSchema),
    defaultValues: {
      warehouseCode: whEnhanced?.warehouseCode || "",
      contactPerson: whEnhanced?.contactPerson || "",
      phone: whEnhanced?.phone || "",
      email: whEnhanced?.email || "",
      address: whEnhanced?.address || "",
      gstNumber: whEnhanced?.gstNumber || "",
      managerName: whEnhanced?.managerName || "",
      description: whEnhanced?.description || "",
    }
  });

  const createLocMut = useCreateWarehouseLocation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetWarehouseLocationsQueryKey(whId) });
        setIsOpen(false);
        form.reset();
        toast({ title: "Location added" });
      }
    }
  });

  const editWhMut = useMutation({
    mutationFn: (d: any) => apiPatch(`/inventory/warehouses-enhanced/${whId}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses-enhanced"] });
      setEditOpen(false);
      toast({ title: "Warehouse details updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!wh) return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const displayWh = whEnhanced || wh;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10 h-full flex flex-col">
      <PageHeader
        title={wh.name}
        subtitle={`${displayWh?.warehouseCode ? `${displayWh.warehouseCode} · ` : ""}WH-${wh.id.toString().padStart(4, "0")} · ${wh.location || "No location specified"}`}
        backHref="/inventory/warehouses"
        badge={
          <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">{wh.type || "Standard"}</Badge>
        }
        meta={
          <div className="flex items-center gap-3 text-muted-foreground text-sm flex-wrap">
            {wh.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {wh.location}</span>}
            {displayWh?.contactPerson && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {displayWh.contactPerson}</span>}
          </div>
        }
        actions={
          <Button variant="outline" size="sm" className="gap-2 rounded-[8px] font-bold" onClick={() => {
            editForm.reset({
              warehouseCode: whEnhanced?.warehouseCode || "",
              contactPerson: whEnhanced?.contactPerson || "",
              phone: whEnhanced?.phone || "",
              email: whEnhanced?.email || "",
              address: whEnhanced?.address || "",
              gstNumber: whEnhanced?.gstNumber || "",
              managerName: whEnhanced?.managerName || "",
              description: whEnhanced?.description || "",
            });
            setEditOpen(true);
          }}>
            <Edit2 className="h-4 w-4" /> Edit Details
          </Button>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total SKUs", value: whEnhanced?.skuCount ?? stockLevels.length, icon: Package2, color: "text-foreground" },
          { label: "Stock Value", value: `₹${((whEnhanced?.totalValue ?? Number(stock?.totalValue ?? 0)) / 100000).toFixed(1)}L`, icon: TrendingUp, color: "text-[#EA580C]" },
          { label: "Bin Locations", value: locations?.length ?? 0, icon: Grid, color: "text-foreground" },
          { label: "Reorder Alerts", value: whEnhanced?.belowReorderCount ?? 0, icon: AlertTriangle, color: whEnhanced?.belowReorderCount > 0 ? "text-amber-600" : "text-emerald-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn("h-4 w-4", color)} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            </div>
            <p className={cn("text-xl font-black font-mono", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border flex-1 flex flex-col overflow-hidden">
        <Tabs defaultValue="stock" className="flex-1 flex flex-col">
          <div className="border-b border-border px-4 pt-4 bg-muted/30 sticky top-0 z-10">
            <TabsList className="bg-transparent h-10 p-0 gap-6">
              {[
                { value: "stock", label: "Stock Summary" },
                { value: "levels", label: "Material Levels" },
                { value: "locations", label: "Bin Locations" },
                { value: "info", label: "Info" },
              ].map(t => (
                <TabsTrigger key={t.value} value={t.value} className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-1 h-10 text-sm font-bold text-muted-foreground data-[state=active]:text-foreground transition-colors">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Stock Summary Tab */}
            <TabsContent value="stock" className="m-0 border-none outline-none">
              <div className="p-6 pb-0 flex justify-between items-end mb-4">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Inventory Valuation</h3>
                <div className="flex items-end gap-4">
                  <Button variant="outline" size="sm" className="gap-2 mb-1" onClick={() => exportToCsv(
                    `stock-${wh.name.replace(/\s+/g, "-").toLowerCase()}.csv`,
                    ["Item Name", "Balance Qty", "Unit", "Unit Value", "Total Value"],
                    (stock?.items ?? []).map((i: any) => [i.itemName, i.balanceQty, i.unit, i.unitValue, i.totalValue])
                  )}>
                    <Download className="h-4 w-4" /> Export
                  </Button>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Value</p>
                    <p className="text-3xl font-bold tracking-tight text-[#EA580C] font-mono">₹{Number(stock?.totalValue || 0).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6">
                <div className="border border-border rounded-[12px] overflow-hidden bg-card">
                  {stockLoading ? (
                    <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-5">Item Name</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Balance Qty</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground pl-4">Unit</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Unit Value</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right px-5">Total Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stock?.items?.map((item: any) => (
                          <TableRow key={item.itemId} className="border-b border-border hover:bg-muted/20">
                            <TableCell className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span className="font-bold text-sm text-foreground">{item.itemName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-right font-mono font-bold text-[15px] text-foreground">{item.balanceQty.toLocaleString()}</TableCell>
                            <TableCell className="py-3 pl-4 text-sm font-semibold text-muted-foreground">{item.unit}</TableCell>
                            <TableCell className="py-3 text-right font-mono font-bold text-sm text-muted-foreground">₹{Number(item.unitValue).toLocaleString("en-IN")}</TableCell>
                            <TableCell className="px-5 py-3 text-right font-mono font-bold text-[15px] text-[#EA580C]">₹{Number(item.totalValue).toLocaleString("en-IN")}</TableCell>
                          </TableRow>
                        ))}
                        {!stock?.items?.length && (
                          <TableRow><TableCell colSpan={5} className="text-center h-32 text-muted-foreground font-medium text-sm">No stock data.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Material Levels Tab */}
            <TabsContent value="levels" className="m-0 border-none outline-none">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Material Stock Levels</h3>
                  <Button variant="outline" size="sm" className="gap-2 rounded-[8px] font-bold" onClick={() => setLocation("/inventory/stock-levels")}>
                    <Package className="h-4 w-4" /> Manage All
                  </Button>
                </div>
                {levelsLoading ? (
                  <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded" />)}</div>
                ) : stockLevels.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-medium">No material levels tracked yet</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/inventory/stock-levels")}>Add Stock Level</Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stockLevels.map((sl: any) => (
                      <div key={sl.id} className={cn(
                        "flex items-center gap-4 p-4 rounded-[10px] border",
                        sl.isOutOfStock ? "border-red-200 bg-red-50/30 dark:bg-red-950/10"
                          : sl.isBelowReorder ? "border-amber-200 bg-amber-50/30 dark:bg-amber-950/10"
                          : "border-border bg-card"
                      )}>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-foreground truncate">{sl.materialName}</p>
                          <p className="text-xs text-muted-foreground">{sl.categoryName || sl.categoryCode || "—"} · {sl.locationBin || "No bin"}</p>
                        </div>
                        <div className="text-center shrink-0">
                          <p className={cn("font-mono font-black text-lg", sl.isOutOfStock ? "text-red-600" : sl.isBelowReorder ? "text-amber-600" : "text-foreground")}>
                            {Number(sl.currentQty).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{sl.uom}</p>
                        </div>
                        <div className="text-center shrink-0">
                          <p className="font-mono text-sm text-muted-foreground">{Number(sl.minStockLevel).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">Min</p>
                        </div>
                        <div className="shrink-0">
                          {sl.isOutOfStock
                            ? <Badge className="bg-red-100 text-red-700 text-[10px] font-bold border-0">Out of Stock</Badge>
                            : sl.isBelowReorder
                            ? <Badge className="bg-amber-100 text-amber-700 text-[10px] font-bold border-0">Low Stock</Badge>
                            : <Badge className="bg-emerald-100 text-emerald-700 text-[10px] font-bold border-0">OK</Badge>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Bin Locations Tab */}
            <TabsContent value="locations" className="m-0 border-none outline-none">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Warehouse Layout</h3>
                  <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <Button size="sm" className="bg-muted hover:bg-muted/80 text-foreground font-bold rounded-[6px] h-8 shadow-none" onClick={() => setIsOpen(true)}>
                      <Plus className="h-4 w-4 mr-1.5" /> Add Location Bin
                    </Button>
                    <DialogContent className="p-6">
                      <DialogHeader className="mb-4"><DialogTitle className="text-xl font-bold tracking-tight">New Location</DialogTitle></DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(d => createLocMut.mutate({ id: whId, data: { ...d, warehouseId: whId } as any }))} className="space-y-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField control={form.control} name="zone" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs font-bold uppercase">Zone</FormLabel><FormControl><Input className="h-10 bg-muted/50" {...field} placeholder="A" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="rack" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs font-bold uppercase">Rack</FormLabel><FormControl><Input className="h-10 bg-muted/50" {...field} placeholder="R1" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="bin" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs font-bold uppercase">Bin</FormLabel><FormControl><Input className="h-10 bg-muted/50" {...field} placeholder="B10" /></FormControl></FormItem>
                            )} />
                          </div>
                          <Button type="submit" className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-[8px]" disabled={createLocMut.isPending}>Add Bin</Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
                {locLoading ? (
                  <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {locations?.map(loc => (
                      <div key={loc.id} className="border border-border rounded-[8px] p-4 bg-card hover:border-[#EA580C] hover:shadow-md transition-all group cursor-default">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-mono font-bold tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-[4px] group-hover:bg-orange-50 group-hover:text-[#EA580C] transition-colors">
                            {loc.zone}-{loc.rack}-{loc.bin}
                          </span>
                          <LayoutGrid className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                        {loc.currentItemId ? (
                          <div className="text-sm font-bold text-foreground truncate" title={loc.currentItemName || ""}>{loc.currentItemName}</div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">Empty Bin</div>
                        )}
                      </div>
                    ))}
                    {!locations?.length && (
                      <div className="col-span-full text-center py-16 text-muted-foreground">
                        <Grid className="h-8 w-8 mb-2 mx-auto opacity-20" />
                        <span className="text-sm font-medium">No locations defined.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Info Tab */}
            <TabsContent value="info" className="m-0 border-none outline-none">
              <div className="p-6 space-y-6">
                <SectionCard title="Warehouse Details">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
                    <InfoRow label="Warehouse Code" value={displayWh?.warehouseCode} />
                    <InfoRow label="Type" value={wh.type} />
                    <InfoRow label="Capacity" value={wh.capacity} />
                    <InfoRow label="Manager" value={displayWh?.managerName} />
                    <InfoRow label="Location" value={wh.location} />
                    <InfoRow label="GST Number" value={displayWh?.gstNumber} />
                  </div>
                </SectionCard>
                <SectionCard title="Contact Information">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
                    <InfoRow label="Contact Person" value={displayWh?.contactPerson} />
                    <InfoRow label="Phone" value={displayWh?.phone} />
                    <InfoRow label="Email" value={displayWh?.email} />
                    <InfoRow label="Address" value={displayWh?.address} />
                  </div>
                </SectionCard>
                {displayWh?.description && (
                  <SectionCard title="Description">
                    <p className="text-sm text-foreground">{displayWh.description}</p>
                  </SectionCard>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Edit Warehouse Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-xl font-black">Edit Warehouse Details</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(d => editWhMut.mutate(d))} className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={editForm.control} name="warehouseCode" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase">Code</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} placeholder="WH-001" /></FormControl></FormItem>
                )} />
                <FormField control={editForm.control} name="managerName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase">Manager</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={editForm.control} name="contactPerson" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase">Contact Person</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={editForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase">Phone</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={editForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase">Email</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={editForm.control} name="gstNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase">GST Number</FormLabel>
                    <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="address" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">Address</FormLabel>
                  <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={editForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">Description</FormLabel>
                  <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl></FormItem>
              )} />
              <Button type="submit" disabled={editWhMut.isPending} className="w-full h-11 bg-[#0A0F2C] hover:bg-[#0A0F2C]/90 text-white font-bold rounded-[8px]">
                {editWhMut.isPending ? "Saving..." : "Save Details"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
