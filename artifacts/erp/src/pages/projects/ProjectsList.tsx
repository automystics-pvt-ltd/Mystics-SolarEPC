import { useState } from "react";
import { useGetProjects, useCreateProject, useGetPortfolioSummary, getGetProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, FolderKanban, MapPin, UserCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader, StatCard, DataTable } from "@/components/shared";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  siteLocation: z.string().optional(),
  contractValue: z.coerce.number().optional(),
  startDate: z.string().optional(),
  plannedEnd: z.string().optional(),
});

function formatCurrency(amount?: number) {
  if (!amount) return "₹0";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  return `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Completed': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'On Hold': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

type Project = {
  id: number;
  name: string;
  siteLocation?: string | null;
  contractValue?: number | null;
  status: string;
  percentComplete?: number | null;
  pmOwnerName?: string | null;
  startDate?: string | null;
};

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "On Hold", value: "On Hold" },
  { label: "Completed", value: "Completed" },
  { label: "Cancelled", value: "Cancelled" },
];

export function ProjectsList() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useGetProjects({}, {
    query: { queryKey: getGetProjectsQueryKey({}) }
  });

  const { data: summary } = useGetPortfolioSummary();

  const form = useForm<z.infer<typeof createProjectSchema>>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "" }
  });

  const createMutation = useCreateProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectsQueryKey({}) });
        setIsCreateOpen(false);
        form.reset();
      }
    }
  });

  const columns: ColumnDef<Project, any>[] = [
    {
      accessorKey: "name",
      header: "Project",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <FolderKanban className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm leading-tight">{row.original.name}</div>
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5 uppercase tracking-wider">
              PRJ-{row.original.id.toString().padStart(4, '0')}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "siteLocation",
      header: "Location",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground/60" />
          {row.original.siteLocation || "HQ"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wide border px-2 py-0.5 rounded-[4px] ${getStatusColor(row.original.status)}`}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "contractValue",
      header: "Value",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-sm text-foreground tabular-nums">
          {formatCurrency(row.original.contractValue ?? undefined)}
        </span>
      ),
    },
    {
      accessorKey: "pmOwnerName",
      header: "PM",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          <UserCircle className="h-4 w-4 text-muted-foreground/60" />
          {row.original.pmOwnerName || "Unassigned"}
        </span>
      ),
    },
    {
      accessorKey: "startDate",
      header: "Start Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {row.original.startDate
            ? new Date(row.original.startDate).toLocaleDateString("en-IN")
            : "—"}
        </span>
      ),
    },
  ];

  const newProjectDialog = (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#0C1445] hover:bg-[#0A0F2C] text-white font-bold tracking-wide rounded-[8px] h-9 px-4 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold tracking-tight">Create New Project</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => createMutation.mutate({ data: d }))} className="space-y-5">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project Name</FormLabel>
                <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="siteLocation" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Site Location</FormLabel>
                <FormControl><Input className="h-10 bg-muted/30" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="contractValue" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contract Value (₹)</FormLabel>
                <FormControl><Input className="h-10 bg-muted/30 font-mono" type="number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Date</FormLabel>
                  <FormControl><Input className="h-10 bg-muted/30" type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="plannedEnd" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Planned End</FormLabel>
                  <FormControl><Input className="h-10 bg-muted/30" type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-[8px] mt-2" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <PageHeader
        title="Projects Hub"
        subtitle="End-to-end solar EPC project tracking"
        actions={newProjectDialog}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Projects"
          value={summary?.activeProjects || 0}
          icon={FolderKanban}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Total Budget"
          value={formatCurrency(summary?.totalBudget)}
          icon={FolderKanban}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
        <StatCard
          label="On Track"
          value={summary?.onTrackCount || 0}
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Delayed"
          value={summary?.delayedCount || 0}
          icon={AlertTriangle}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
      </div>

      <DataTable
        data={(projects ?? []) as Project[]}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search projects by name or location..."
        onRowClick={(row) => setLocation(`/projects/${row.id}`)}
        exportFilename="projects"
        filterOptions={[
          { key: "status", label: "Status", options: STATUS_OPTIONS }
        ]}
        emptyIcon={FolderKanban}
        emptyTitle="No projects yet"
        emptyDescription="Create your first project to get started"
      />
    </motion.div>
  );
}
