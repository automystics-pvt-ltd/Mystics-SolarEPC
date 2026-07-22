import { useGetContractors, useCreateContractor, getGetContractorsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, Star } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contractors Registry</h2>
          <p className="text-muted-foreground mt-1">Manage subcontractors and vendors.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Contractor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Contractor</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMut.mutate({ data: d }))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="trade" render={({ field }) => (
                  <FormItem><FormLabel>Trade / Specialty</FormLabel><FormControl><Input {...field} placeholder="e.g. Electrical, Civil" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="contact" render={({ field }) => (
                  <FormItem><FormLabel>Contact Info</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="rating" render={({ field }) => (
                  <FormItem><FormLabel>Rating (1-5)</FormLabel><FormControl><Input type="number" min="1" max="5" {...field} /></FormControl></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMut.isPending}>Add Contractor</Button>
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
              placeholder="Search by name or trade..." 
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
                  <TableHead>Contractor Name</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Total Contracts Value</TableHead>
                  <TableHead>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.trade}</TableCell>
                    <TableCell className="text-muted-foreground">{c.contact || '-'}</TableCell>
                    <TableCell className="font-medium">${c.contractValue?.toLocaleString() || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-0.5 text-accent">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < (c.rating || 0) ? 'fill-current' : 'text-muted stroke-[1.5px]'}`} />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered?.length && (
                  <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No contractors found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
