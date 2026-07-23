import { useState } from "react";
import { useGetWarehouses, useCreateWarehouse, getGetWarehousesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Warehouse } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { PageHeader, DataTable } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";

const formSchema = z.object({
  name: z.string().min(1, "Name required"),
  location: z.string().optional(),
  type: z.string().min(1, "Type required"),
  capacity: z.string().optional(),
});

const TYPE_COLOR: Record<string, string> = {
  Main: "bg-blue-50 text-blue-700 border-blue-200",
  Site: "bg-amber-50 text-amber-700 border-amber-200",
  Yard: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function WarehousesList() {
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

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.location || "—"}</span>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.type || "Standard";
        return (
          <Badge variant="outline" className={TYPE_COLOR[type] ?? "bg-muted text-muted-foreground border-border"}>
            {type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "capacity",
      header: "Total Items / Capacity",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.capacity || "—"}</span>
      ),
    },
    {
      accessorKey: "projectId",
      header: "Manager / Project",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.projectId ? `PRJ-${row.original.projectId.toString().padStart(4, "0")}` : "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      enableSorting: false,
      cell: () => (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          Active
        </Badge>
      ),
    },
  ];

  const addDialog = (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold tracking-wide rounded-[8px] h-10 px-5 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Add Warehouse
        </Button>
      </DialogTrigger>
      <DialogContent className="p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold tracking-tight">New Warehouse</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => createMut.mutate({ data: d }))} className="space-y-5">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</FormLabel>
                <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</FormLabel>
                <FormControl><Input className="h-10 bg-muted/30" {...field} placeholder="Main, Site, Yard..." /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="location" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location / Address</FormLabel>
                <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="capacity" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Capacity</FormLabel>
                <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
              </FormItem>
            )} />
            <Button type="submit" className="w-full h-11 bg-[#0A0F2C] hover:bg-[#0A0F2C]/90 text-white font-bold rounded-[8px] mt-2" disabled={createMut.isPending}>
              {createMut.isPending ? "Adding..." : "Add Warehouse"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <PageHeader
        title="Warehouses"
        subtitle="Storage facilities and material inventory"
        actions={addDialog}
      />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search warehouses..."
        onRowClick={(row) => setLocation(`/inventory/warehouses/${row.id}`)}
        exportFilename="warehouses"
        filterOptions={[
          {
            key: "type",
            label: "Type",
            options: [
              { label: "Main", value: "Main" },
              { label: "Site", value: "Site" },
              { label: "Yard", value: "Yard" },
            ],
          },
        ]}
        emptyIcon={Warehouse}
        emptyTitle="No warehouses found"
        emptyDescription="Add a warehouse to get started"
      />
    </motion.div>
  );
}
