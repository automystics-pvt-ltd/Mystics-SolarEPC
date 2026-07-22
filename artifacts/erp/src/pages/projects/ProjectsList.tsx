import { useState } from "react";
import { useGetProjects, useCreateProject, useGetPortfolioSummary, getGetProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Filter, FolderKanban } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  siteLocation: z.string().optional(),
  contractValue: z.coerce.number().optional(),
  startDate: z.string().optional(),
  plannedEnd: z.string().optional(),
});

function formatCurrency(amount?: number) {
  if (!amount) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function ProjectsList() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useGetProjects({}, {
    query: { queryKey: getGetProjectsQueryKey({}) }
  });

  const { data: summary } = useGetPortfolioSummary();

  const form = useForm<z.infer<typeof createProjectSchema>>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
    }
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
    <div className="space-y-4 pb-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Project Portfolio</h2>
          <p className="text-muted-foreground mt-1">Manage execution, budgets, and milestones.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate({ data: d }))} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="siteLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Location</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contractValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Value ($)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="plannedEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Planned End</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Project"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm font-medium">Active Projects</p>
            <p className="text-2xl font-bold mt-1">{summary?.activeProjects || 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm font-medium">Total Budget</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.totalBudget)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-emerald-500/20">
          <CardContent className="p-4 bg-emerald-500/5">
            <p className="text-emerald-700 dark:text-emerald-400 text-sm font-medium">On Track</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{summary?.onTrackCount || 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-destructive/20">
          <CardContent className="p-4 bg-destructive/5">
            <p className="text-destructive text-sm font-medium">Delayed</p>
            <p className="text-2xl font-bold text-destructive mt-1">{summary?.delayedCount || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="p-4 border-b">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search projects..." 
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
                  <TableHead className="w-[300px]">Project Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Manager</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects?.map((project) => (
                  <TableRow key={project.id} className="hover:bg-muted/30 cursor-pointer transition-colors">
                    <TableCell>
                      <Link href={`/projects/${project.id}`} className="block">
                        <div className="font-medium text-foreground">{project.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">PRJ-{project.id.toString().padStart(4, '0')}</div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/projects/${project.id}`} className="block text-sm text-muted-foreground">
                        {project.siteLocation || 'HQ'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/projects/${project.id}`} className="block font-medium">
                        {formatCurrency(project.contractValue)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/projects/${project.id}`} className="block">
                        <Badge variant={
                          project.status === 'Completed' ? 'default' : 
                          project.status === 'On Hold' ? 'destructive' : 'secondary'
                        }>
                          {project.status}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/projects/${project.id}`} className="block">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${project.percentComplete || 0}%` }} 
                            />
                          </div>
                          <span className="text-xs font-mono">{project.percentComplete || 0}%</span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/projects/${project.id}`} className="block text-sm">
                        {project.pmOwnerName || 'Unassigned'}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredProjects?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No projects found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
