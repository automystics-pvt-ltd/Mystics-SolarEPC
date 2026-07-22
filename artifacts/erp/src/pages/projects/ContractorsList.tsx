import { useGetContractors, useCreateContractor, getGetContractorsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, Star, HardHat, Phone } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  name: z.string().min(1, "Name required"),
  trade: z.string().min(1, "Trade required"),
  contact: z.string().optional(),
  rating: z.coerce.number().min(1).max(5).optional()
});

export function ContractorsList() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetContractors();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { rating: 3 }
  });

  const createMut = useCreateContractor({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetContractorsQueryKey() });
        setIsOpen(false);
        form.reset();
      }
    }
  });

  const filtered = data?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.trade.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Contractors Registry</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Manage subcontractors, vendors, and tradesmen.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold tracking-wide rounded-[8px] h-10 px-5 shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Add Contractor
            </Button>
          </DialogTrigger>
          <DialogContent className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-bold tracking-tight">New Contractor</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMut.mutate({ data: d }))} className="space-y-5">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Company Name</FormLabel>
                    <FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="trade" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Trade / Specialty</FormLabel>
                    <FormControl><Input className="h-10 bg-gray-50" {...field} placeholder="e.g. Electrical, Civil" /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="contact" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Contact Info</FormLabel>
                      <FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="rating" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Rating (1-5)</FormLabel>
                      <FormControl><Input className="h-10 bg-gray-50 font-mono" type="number" min="1" max="5" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full h-11 bg-[#0A0F2C] hover:bg-[#0A0F2C]/90 text-white font-bold rounded-[8px] mt-2" disabled={createMut.isPending}>
                  {createMut.isPending ? "Adding..." : "Add Contractor"}
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
              placeholder="Search by name or trade..." 
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
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5">Contractor Name</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Trade</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Contact</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white text-right">Total Contracts</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((c) => (
                  <TableRow key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                          <HardHat className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-sm text-gray-900 leading-tight">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px]">{c.trade}</Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-bold text-gray-600 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-gray-400" /> {c.contact || '-'}</span>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <span className="font-mono font-bold text-[15px] text-gray-900">${c.contractValue?.toLocaleString() || 0}</span>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <div className="flex gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < (c.rating || 0) ? 'fill-current' : 'text-gray-200 stroke-gray-300'}`} />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered?.length && (
                  <TableRow><TableCell colSpan={5} className="text-center h-32 text-gray-500 font-medium">No contractors found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </motion.div>
  );
}
