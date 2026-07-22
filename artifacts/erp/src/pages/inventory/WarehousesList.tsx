import { useState } from "react";
import { useGetWarehouses, useCreateWarehouse, getGetWarehousesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, MapPin, Warehouse } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Warehouses</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Manage physical locations and site stores.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold tracking-wide rounded-[8px] h-10 px-5 shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Add Warehouse
            </Button>
          </DialogTrigger>
          <DialogContent className="p-6">
            <DialogHeader className="mb-4"><DialogTitle className="text-xl font-bold tracking-tight">New Warehouse</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMut.mutate({ data: d }))} className="space-y-5">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Name</FormLabel>
                    <FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Type</FormLabel>
                    <FormControl><Input className="h-10 bg-gray-50" {...field} placeholder="Main, Site, Yard..." /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Location / Address</FormLabel>
                    <FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="capacity" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Capacity</FormLabel>
                    <FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl>
                  </FormItem>
                )} />
                <Button type="submit" className="w-full h-11 bg-[#0A0F2C] hover:bg-[#0A0F2C]/90 text-white font-bold rounded-[8px] mt-2" disabled={createMut.isPending}>
                  {createMut.isPending ? "Adding..." : "Add Warehouse"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search warehouses..." 
              className="pl-9 h-10 bg-white border-gray-200 text-sm font-medium focus-visible:ring-[#EA580C] shadow-sm rounded-[8px]"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5">Warehouse Name</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Type</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Location</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Capacity</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5">Linked Project</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((w) => (
                  <TableRow key={w.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer group" onClick={() => setLocation(`/inventory/warehouses/${w.id}`)}>
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                          <Warehouse className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-sm text-gray-900 group-hover:text-[#EA580C] transition-colors">{w.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px]">{w.type || 'Standard'}</Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" /> {w.location || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-sm font-medium text-gray-600">{w.capacity || '-'}</TableCell>
                    <TableCell className="px-5 py-4">
                      <span className="font-mono text-xs font-bold text-gray-500">{w.projectId ? `PRJ-${w.projectId.toString().padStart(4, '0')}` : '-'}</span>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered?.length && (
                  <TableRow><TableCell colSpan={5} className="text-center h-32 text-gray-500 font-medium">No warehouses found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </motion.div>
  );
}
