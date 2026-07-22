import { useState } from "react";
import { useLocation } from "wouter";
import { useGetProject, useGetProjectDashboard, getGetProjectQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProjectOverview } from "./tabs/ProjectOverview";
import { ProjectActivities } from "./tabs/ProjectActivities";
import { ProjectMRs } from "./tabs/ProjectMRs";
// Placeholder imports for other tabs
import { ProjectDPRs } from "./tabs/ProjectDPRs";
import { ProjectBudget } from "./tabs/ProjectBudget";
import { ProjectMilestones } from "./tabs/ProjectMilestones";

export function ProjectWorkspace({ id }: { id: string }) {
  const projectId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  
  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  if (isLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!project) return <div>Project not found</div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
              <Badge variant={project.status === 'Active' ? 'default' : 'secondary'} className="uppercase">
                {project.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 font-mono text-sm">
              PRJ-{project.id.toString().padStart(4, '0')} • {project.siteLocation}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="border-b bg-card px-2 pt-2 rounded-t-xl sticky top-0 z-10">
          <TabsList className="w-full justify-start h-auto bg-transparent p-0 flex-wrap gap-x-2">
            <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Overview</TabsTrigger>
            <TabsTrigger value="activities" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Activities (Gantt)</TabsTrigger>
            <TabsTrigger value="mrs" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Material Requests</TabsTrigger>
            <TabsTrigger value="pos" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Purchase Orders</TabsTrigger>
            <TabsTrigger value="dprs" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">DPRs</TabsTrigger>
            <TabsTrigger value="budget" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Budget</TabsTrigger>
            <TabsTrigger value="milestones" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Milestones</TabsTrigger>
          </TabsList>
        </div>
        
        <div className="mt-6">
          <TabsContent value="overview">
            <ProjectOverview projectId={projectId} />
          </TabsContent>
          <TabsContent value="activities">
            <ProjectActivities projectId={projectId} />
          </TabsContent>
          <TabsContent value="mrs">
            <ProjectMRs projectId={projectId} />
          </TabsContent>
          <TabsContent value="pos">
            <div className="p-8 text-center text-muted-foreground bg-card rounded-lg border">PO Tracking under construction.</div>
          </TabsContent>
          <TabsContent value="dprs">
            <ProjectDPRs projectId={projectId} />
          </TabsContent>
          <TabsContent value="budget">
            <ProjectBudget projectId={projectId} />
          </TabsContent>
          <TabsContent value="milestones">
            <ProjectMilestones projectId={projectId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
