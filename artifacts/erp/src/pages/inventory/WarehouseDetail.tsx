import { useState } from "react";
import { useGetWarehouses, useGetWarehouseLocations, useCreateWarehouseLocation, useGetWarehouseStockSummary } from "@workspace/api-client-react";
import { getGetWarehouseLocationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, ArrowLeft, Package, Grid } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    query: { enabled: !!whId }
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

  if (!wh) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/inventory/warehouses")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{wh.name}</h2>
            <p className="text-muted-foreground mt-1">{wh.location || 'No location specified'}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="stock" className="w-full">
        <TabsList>
          <TabsTrigger value="stock">Stock Summary</TabsTrigger>
          <TabsTrigger value="locations">Bin Locations</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-6">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Inventory Valuation</CardTitle>
              <div className="text-2xl font-bold text-primary">
                ${stock?.totalValue?.toLocaleString() || 0}
              </div>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="text-right">Balance Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Unit Value</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stock?.items?.map(item => (
                      <TableRow key={item.itemId}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {item.itemName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">{item.balanceQty.toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                        <TableCell className="text-right">${item.unitValue.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">${item.totalValue.toLocaleString()}</TableCell>
                    </TableRow>
                    ))}
                    {!stock?.items?.length && (
                      <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No stock available.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="mt-6">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Warehouse Layout Map</CardTitle>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Location Bin</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Location</DialogTitle></DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(d => createMut.mutate({ data: { ...d, warehouseId: whId } as any }))} className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="zone" render={({ field }) => (
                          <FormItem><FormLabel>Zone</FormLabel><FormControl><Input {...field} placeholder="A" /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="rack" render={({ field }) => (
                          <FormItem><FormLabel>Rack</FormLabel><FormControl><Input {...field} placeholder="R1" /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="bin" render={({ field }) => (
                          <FormItem><FormLabel>Bin</FormLabel><FormControl><Input {...field} placeholder="B10" /></FormControl></FormItem>
                        )} />
                      </div>
                      <Button type="submit" className="w-full" disabled={createMut.isPending}>Add Bin</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {locLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {locations?.map(loc => (
                    <div key={loc.id} className="border rounded-lg p-3 bg-muted/10 hover:bg-muted/30 transition-colors border-l-4 border-l-primary">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold bg-muted px-1.5 py-0.5 rounded">
                          {loc.zone}-{loc.rack}-{loc.bin}
                        </span>
                        <Grid className="h-3 w-3 text-muted-foreground" />
                      </div>
                      {loc.currentItemId ? (
                        <div className="text-sm font-medium text-foreground truncate">
                          {loc.currentItemName}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic">Empty</div>
                      )}
                    </div>
                  ))}
                  {!locations?.length && (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                      No locations defined.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
