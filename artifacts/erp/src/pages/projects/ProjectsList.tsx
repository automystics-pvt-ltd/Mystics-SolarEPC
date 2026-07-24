import { useState } from "react";
import { useGetProjects, useCreateProject, useGetPortfolioSummary, getGetProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FolderKanban, MapPin, UserCircle } from "lucide-react";
import { CanCreate } from "@/lib/permissions";
import { SkeletonList, EmptyState } from "@/components/shared";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { formatINRCompact } from "@/lib/currency";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  siteLocation: z.string().optional(),
  contractValue: z.coerce.number().optional(),
  startDate: z.string().optional(),
  plannedEnd: z.string().optional(),
});


function getStatusColor(status: string) {
  switch (status) {
    case 'Active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Completed': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'On Hold': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function ProjectsList() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: projects, isPending } = useGetProjects({}, {
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

  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.siteLocation?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Project Hub</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Manage execution, budgets, and site milestones.</p>
        </div>
        
        <CanCreate module="projects">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0C1445] hover:bg-[#0A0F2C] text-white font-bold tracking-wide rounded-[8px] h-10 px-5 shadow-sm">
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
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Project Name</FormLabel>
                    <FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="siteLocation" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Site Location</FormLabel>
                    <FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="contractValue" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Contract Value (₹)</FormLabel>
                    <FormControl><Input className="h-10 bg-gray-50 font-mono" type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Start Date</FormLabel>
                      <FormControl><Input className="h-10 bg-gray-50" type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="plannedEnd" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Planned End</FormLabel>
                      <FormControl><Input className="h-10 bg-gray-50" type="date" {...field} /></FormControl>
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
          </CanCreate>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 p-5 flex flex-col justify-between h-[100px]">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Active Projects</p>
          <p className="text-3xl font-bold tracking-tight text-gray-900">{summary?.activeProjects || 0}</p>
        </div>
        <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 p-5 flex flex-col justify-between h-[100px]">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Total Budget</p>
          <p className="text-2xl font-bold tracking-tight text-gray-900 font-mono">{formatINRCompact(summary?.totalBudget)}</p>
        </div>
        <div className="bg-emerald-50 rounded-[12px] border border-emerald-100 p-5 flex flex-col justify-between h-[100px]">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">On Track</p>
          <p className="text-3xl font-bold tracking-tight text-emerald-700">{summary?.onTrackCount || 0}</p>
        </div>
        <div className="bg-red-50 rounded-[12px] border border-red-100 p-5 flex flex-col justify-between h-[100px]">
          <p className="text-[11px] font-bold text-red-600 uppercase tracking-widest">Delayed</p>
          <p className="text-3xl font-bold tracking-tight text-red-700">{summary?.delayedCount || 0}</p>
        </div>
      </div>

      {/* List Area */}
      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search projects by name or location..." 
              className="pl-9 h-10 bg-white border-gray-200 text-sm focus-visible:ring-[#EA580C] shadow-sm rounded-[8px]"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {isPending ? (
            <SkeletonList rows={5} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5 w-[300px]">Project</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Location</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white text-right">Value</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-6">Status</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white w-[140px] text-center">Progress</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5">Manager</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects?.map((project) => (
                  <TableRow key={project.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                    <TableCell className="px-5 py-4">
                      <Link href={`/projects/${project.id}`} className="block">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-md bg-orange-50 text-[#EA580C] flex items-center justify-center shrink-0">
                            <FolderKanban className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm group-hover:text-[#EA580C] transition-colors leading-tight">{project.name}</div>
                            <div className="text-[11px] font-bold text-gray-400 font-mono mt-0.5 uppercase tracking-wider">PRJ-{project.id.toString().padStart(4, '0')}</div>
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="py-4">
                      <Link href={`/projects/${project.id}`} className="block text-sm font-bold text-gray-600 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" /> {project.siteLocation || 'HQ'}
                      </Link>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <Link href={`/projects/${project.id}`} className="block font-mono font-bold text-[15px] text-gray-900">
                        {formatINRCompact(project.contractValue ?? undefined)}
                      </Link>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Link href={`/projects/${project.id}`} className="block">
                        <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wide border px-2 py-0.5 rounded-[4px] ${getStatusColor(project.status)}`}>
                          {project.status}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="py-4">
                      <Link href={`/projects/${project.id}`} className="flex justify-center">
                        <div className="flex items-center gap-2 w-full">
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#0C1445]" 
                              style={{ width: `${project.percentComplete || 0}%` }} 
                            />
                          </div>
                          <span className="text-[11px] font-bold font-mono text-gray-600 w-8 text-right">{project.percentComplete || 0}%</span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <Link href={`/projects/${project.id}`} className="block text-sm font-bold text-gray-600 flex items-center gap-1.5">
                        <UserCircle className="h-4 w-4 text-gray-400" /> {project.pmOwnerName || 'Unassigned'}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredProjects?.length && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState icon={FolderKanban} heading="No projects found" message="Create your first project to get started." />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </motion.div>
  );
}
