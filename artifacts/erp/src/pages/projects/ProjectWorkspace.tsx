import { useState } from "react";
import { useLocation } from "wouter";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { ProjectOverview } from "./tabs/ProjectOverview";
import { ProjectActivities } from "./tabs/ProjectActivities";
import { ProjectMRs } from "./tabs/ProjectMRs";
import { ProjectDPRs } from "./tabs/ProjectDPRs";
import { ProjectBudget } from "./tabs/ProjectBudget";
import { ProjectMilestones } from "./tabs/ProjectMilestones";
import { motion } from "framer-motion";

function getStatusColor(status: string) {
  switch (status) {
    case 'Active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Completed': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'On Hold': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function ProjectWorkspace({ id }: { id: string }) {
  const projectId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  
  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  if (isLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;
  }

  if (!project) return <div>Project not found</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[12px] premium-shadow border border-gray-100 shrink-0">
        <div className="flex items-center gap-5">
          <Button variant="outline" size="icon" onClick={() => setLocation("/projects")} className="h-10 w-10 rounded-[8px] border-gray-200 text-gray-500 hover:text-gray-900 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">{project.name}</h1>
              <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wide border px-2 py-0.5 rounded-[4px] ${getStatusColor(project.status)}`}>
                {project.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-gray-500">
              <span className="font-mono text-xs font-bold text-gray-400 tracking-wider">PRJ-{project.id.toString().padStart(4, '0')}</span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {project.siteLocation}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 flex-1 flex flex-col overflow-hidden">
        <Tabs defaultValue="overview" className="flex-1 flex flex-col">
          <div className="border-b border-gray-100 px-4 pt-4 bg-gray-50/30 sticky top-0 z-10 overflow-x-auto scrollbar-none">
            <TabsList className="bg-transparent h-10 p-0 gap-6 flex whitespace-nowrap">
              <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-1 h-10 text-sm font-bold text-gray-500 data-[state=active]:text-gray-900 transition-colors shrink-0">Overview</TabsTrigger>
              <TabsTrigger value="activities" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-1 h-10 text-sm font-bold text-gray-500 data-[state=active]:text-gray-900 transition-colors shrink-0">Activities (Gantt)</TabsTrigger>
              <TabsTrigger value="mrs" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-1 h-10 text-sm font-bold text-gray-500 data-[state=active]:text-gray-900 transition-colors shrink-0">Material Requests</TabsTrigger>
              <TabsTrigger value="dprs" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-1 h-10 text-sm font-bold text-gray-500 data-[state=active]:text-gray-900 transition-colors shrink-0">DPRs</TabsTrigger>
              <TabsTrigger value="budget" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-1 h-10 text-sm font-bold text-gray-500 data-[state=active]:text-gray-900 transition-colors shrink-0">Budget</TabsTrigger>
              <TabsTrigger value="milestones" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-1 h-10 text-sm font-bold text-gray-500 data-[state=active]:text-gray-900 transition-colors shrink-0">Milestones</TabsTrigger>
            </TabsList>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto">
            <TabsContent value="overview" className="m-0 border-none outline-none">
              <ProjectOverview projectId={projectId} />
            </TabsContent>
            <TabsContent value="activities" className="m-0 border-none outline-none">
              <ProjectActivities projectId={projectId} />
            </TabsContent>
            <TabsContent value="mrs" className="m-0 border-none outline-none">
              <ProjectMRs projectId={projectId} />
            </TabsContent>
            <TabsContent value="dprs" className="m-0 border-none outline-none">
              <ProjectDPRs projectId={projectId} />
            </TabsContent>
            <TabsContent value="budget" className="m-0 border-none outline-none">
              <ProjectBudget projectId={projectId} />
            </TabsContent>
            <TabsContent value="milestones" className="m-0 border-none outline-none">
              <ProjectMilestones projectId={projectId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </motion.div>
  );
}
