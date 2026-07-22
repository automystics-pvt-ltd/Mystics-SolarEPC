import { useState } from "react";
import { useGetWarehouses, useGetWarehouseLocations, useCreateWarehouseLocation, useGetWarehouseStockSummary } from "@workspace/api-client-react";
import { getGetWarehouseLocationsQueryKey, getGetWarehouseStockSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, ArrowLeft, Package, Grid, MapPin, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";

const locSchema = z.object({
  zone: z.string().min(1),
  rack: z.string().min(1),
  bin: z.string().min(1)
});

export function WarehouseDetail({ id }: { id: string }) {
  const whId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: warehouses } = useGetWarehouses({});
  const wh = warehouses?.find(w => w.id === whId);

  const { data: locations, isLoading: locLoading } = useGetWarehouseLocations(whId, {
    query: { enabled: !!whId, queryKey: getGetWarehouseLocationsQueryKey(whId) }
  });

  const { data: stock, isLoading: stockLoading } = useGetWarehouseStockSummary(whId, {
    query: { enabled: !!whId, queryKey: getGetWarehouseStockSummaryQueryKey(whId) }
  });

  const form = useForm<z.infer<typeof locSchema>>({ resolver: zodResolver(locSchema) });

  const createMut = useCreateWarehouseLocation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWarehouseLocationsQueryKey(whId) });
        setIsOpen(false);
        form.reset();
      }
    }
  });

  if (!wh) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[12px] premium-shadow border border-gray-100 shrink-0">
        <div className="flex items-center gap-5">
          <Button variant="outline" size="icon" onClick={() => setLocation("/inventory/warehouses")} className="h-10 w-10 rounded-[8px] border-gray-200 text-gray-500 hover:text-gray-900 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">{wh.name}</h1>
              <span className="font-bold text-[10px] uppercase tracking-wide border px-2 py-0.5 rounded-[4px] bg-gray-100 text-gray-600 border-gray-200">{wh.type || 'Standard'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-gray-500">
              <span className="font-mono text-xs font-bold text-gray-400 tracking-wider">WH-{wh.id.toString().padStart(4, '0')}</span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {wh.location || 'No location specified'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 flex-1 flex flex-col overflow-hidden">
        <Tabs defaultValue="stock" className="flex-1 flex flex-col">
          <div className="border-b border-gray-100 px-4 pt-4 bg-gray-50/30 sticky top-0 z-10">
            <TabsList className="bg-transparent h-10 p-0 gap-6">
              <TabsTrigger value="stock" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-1 h-10 text-sm font-bold text-gray-500 data-[state=active]:text-gray-900 transition-colors">Stock Summary</TabsTrigger>
              <TabsTrigger value="locations" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-1 h-10 text-sm font-bold text-gray-500 data-[state=active]:text-gray-900 transition-colors">Bin Locations</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="stock" className="m-0 border-none outline-none">
              <div className="p-6 pb-0 flex justify-between items-end mb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Inventory Valuation</h3>
                <div className="flex items-end gap-4">
                  <Button variant="outline" size="sm" className="gap-2 mb-1" onClick={() => {
                    exportToCsv(
                      `stock-${wh.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Item Name", "Balance Qty", "Unit", "Unit Value (₹)", "Total Value (₹)"],
                      (stock?.items ?? []).map((i: any) => [i.itemName, i.balanceQty, i.unit, i.unitValue, i.totalValue])
                    );
                  }}>
                    <Download className="h-4 w-4" /> Export CSV
                  </Button>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Value</p>
                    <p className="text-3xl font-bold tracking-tight text-[#EA580C] font-mono">₹{Number(stock?.totalValue || 0).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6">
                <div className="border border-gray-200 rounded-[12px] overflow-hidden bg-white">
                  {stockLoading ? (
                    <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-gray-100 bg-gray-50/80 hover:bg-gray-50/80">
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 px-5">Item Name</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Balance Qty</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 pl-4">Unit</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Unit Value</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right px-5">Total Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stock?.items?.map(item => (
                          <TableRow key={item.itemId} className="border-b border-gray-50 hover:bg-gray-50/30">
                            <TableCell className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <Package className="h-4 w-4 text-gray-400" />
                                <span className="font-bold text-sm text-gray-900">{item.itemName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-right font-mono font-bold text-[15px] text-gray-900">{item.balanceQty.toLocaleString()}</TableCell>
                            <TableCell className="py-3 pl-4 text-sm font-semibold text-gray-500">{item.unit}</TableCell>
                            <TableCell className="py-3 text-right font-mono font-bold text-sm text-gray-600">₹{Number(item.unitValue).toLocaleString("en-IN")}</TableCell>
                            <TableCell className="px-5 py-3 text-right font-mono font-bold text-[15px] text-[#EA580C]">₹{Number(item.totalValue).toLocaleString("en-IN")}</TableCell>
                        </TableRow>
                        ))}
                        {!stock?.items?.length && (
                          <TableRow><TableCell colSpan={5} className="text-center h-32 text-gray-400 font-medium text-sm">No stock available.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="locations" className="m-0 border-none outline-none">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Warehouse Layout Map</h3>
                  <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-[6px] h-8 shadow-none"><Plus className="h-4 w-4 mr-1.5" /> Add Location Bin</Button>
                    </DialogTrigger>
                    <DialogContent className="p-6">
                      <DialogHeader className="mb-4"><DialogTitle className="text-xl font-bold tracking-tight">New Location</DialogTitle></DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(d => createMut.mutate({ id: whId, data: { ...d, warehouseId: whId } as any }))} className="space-y-5">
                          <div className="grid grid-cols-3 gap-4">
                            <FormField control={form.control} name="zone" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Zone</FormLabel><FormControl><Input className="h-10 bg-gray-50" {...field} placeholder="A" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="rack" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Rack</FormLabel><FormControl><Input className="h-10 bg-gray-50" {...field} placeholder="R1" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="bin" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Bin</FormLabel><FormControl><Input className="h-10 bg-gray-50" {...field} placeholder="B10" /></FormControl></FormItem>
                            )} />
                          </div>
                          <Button type="submit" className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-[8px] mt-2" disabled={createMut.isPending}>Add Bin</Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>

                {locLoading ? (
                  <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {locations?.map(loc => (
                      <div key={loc.id} className="border border-gray-200 rounded-[8px] p-4 bg-white hover:border-[#EA580C] hover:shadow-md transition-all group cursor-default">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-mono font-bold tracking-wider bg-gray-100 text-gray-700 px-2 py-0.5 rounded-[4px] group-hover:bg-orange-50 group-hover:text-[#EA580C] transition-colors">
                            {loc.zone}-{loc.rack}-{loc.bin}
                          </span>
                          <Grid className="h-4 w-4 text-gray-300" />
                        </div>
                        {loc.currentItemId ? (
                          <div className="text-sm font-bold text-gray-900 truncate" title={loc.currentItemName || ''}>
                            {loc.currentItemName}
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-400 font-medium uppercase tracking-widest">Empty Bin</div>
                        )}
                      </div>
                    ))}
                    {!locations?.length && (
                      <div className="col-span-full text-center py-16">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Grid className="h-8 w-8 mb-2 opacity-20" />
                          <span className="text-sm font-medium">No locations defined.</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </motion.div>
  );
}
