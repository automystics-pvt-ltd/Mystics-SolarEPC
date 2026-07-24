import { useGetContractors, useCreateContractor, getGetContractorsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, HardHat, Star, Phone } from "lucide-react";
import { CanCreate } from "@/lib/permissions";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader, DataTable } from "@/components/shared";

const formSchema = z.object({
  name: z.string().min(1, "Name required"),
  trade: z.string().min(1, "Trade required"),
  contact: z.string().optional(),
  rating: z.coerce.number().min(1).max(5).optional()
});

type Contractor = {
  id: number;
  name: string;
  trade: string;
  contact?: string | null;
  contractValue?: number | null;
  rating?: number | null;
};

export function ContractorsList() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isPending } = useGetContractors();

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

  const columns: ColumnDef<Contractor, any>[] = [
    {
      accessorKey: "name",
      header: "Contractor Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
            <HardHat className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground leading-tight">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "trade",
      header: "Type / Specialization",
      cell: ({ row }) => (
        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px]">
          {row.original.trade}
        </Badge>
      ),
    },
    {
      accessorKey: "contact",
      header: "Contact",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-muted-foreground/60" />
          {row.original.contact || "—"}
        </span>
      ),
    },
    {
      accessorKey: "rating",
      header: "Rating",
      cell: ({ row }) => (
        <div className="flex gap-0.5 text-amber-500">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${i < (row.original.rating || 0) ? 'fill-current' : 'text-muted-foreground/20 stroke-muted-foreground/30'}`}
            />
          ))}
        </div>
      ),
    },
  ];

  const addContractorDialog = (
    <CanCreate module="projects">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold tracking-wide rounded-[8px] h-9 px-4 shadow-sm">
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
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Company Name</FormLabel>
                <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="trade" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trade / Specialty</FormLabel>
                <FormControl><Input className="h-10 bg-muted/30" {...field} placeholder="e.g. Electrical, Civil" /></FormControl>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="contact" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Info</FormLabel>
                  <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="rating" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rating (1-5)</FormLabel>
                  <FormControl><Input className="h-10 bg-muted/30 font-mono" type="number" min="1" max="5" {...field} /></FormControl>
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
    </CanCreate>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Contractors"
        subtitle="Registered contractors and subcontractors"
        actions={addContractorDialog}
      />

      <DataTable
        data={(data ?? []) as Contractor[]}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search by name or trade..."
        exportFilename="contractors"
        emptyIcon={HardHat}
        emptyTitle="No contractors yet"
        emptyDescription="Add your first contractor to get started"
      />
    </motion.div>
  );
}
