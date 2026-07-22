import { useState } from "react";
import { useGetWarehouses, useCreateWarehouse, getGetWarehousesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, MapPin } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  name: z.string().min(1, "Name required"),
  location: z.string().optional(),
  type: z.string().min(1, "Type required"),
  capacity: z.string().optional(),
});

export function WarehousesList() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetWarehouses({}, {
    query: { queryKey: getGetWarehousesQueryKey({}) }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: "Main" }
  });

  const createMut = useCreateWarehouse({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWarehousesQueryKey({}) });
        setIsOpen(false);
        form.reset();
      }
    }
  });

  const filtered = data?.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase()) || 
    w.location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Warehouses</h2>
          <p className="text-muted-foreground mt-1">Manage physical locations and site stores.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Warehouse</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Warehouse / Store</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMut.mutate({ data: d }))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Type</FormLabel><FormControl><Input {...field} placeholder="Main, Site, Yard..." /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Location / Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="capacity" render={({ field }) => (
                  <FormItem><FormLabel>Capacity</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMut.isPending}>Add Warehouse</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="p-4 border-b">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search warehouses..." 
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Warehouse Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Linked Project</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((w) => (
                  <TableRow key={w.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setLocation(`/inventory/warehouses/${w.id}`)}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell><Badge variant="outline">{w.type || 'Standard'}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {w.location || '-'}</div>
                    </TableCell>
                    <TableCell>{w.capacity || '-'}</TableCell>
                    <TableCell>{w.projectId ? `Project #${w.projectId}` : '-'}</TableCell>
                  </TableRow>
                ))}
                {!filtered?.length && (
                  <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No warehouses found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
