import { useState } from "react";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import {
  LayoutDashboard, Activity, Package, FileText, DollarSign, Milestone,
  AlertOctagon, ClipboardList, PackageSearch, GitBranch, ShieldAlert,
  Users, ClipboardCheck, Zap, HandshakeIcon, ShieldCheck, Archive, FolderOpen,
} from "lucide-react";
import { ProjectOverview }        from "./tabs/ProjectOverview";
import { ProjectActivities }      from "./tabs/ProjectActivities";
import { ProjectMRs }             from "./tabs/ProjectMRs";
import { ProjectDPRs }            from "./tabs/ProjectDPRs";
import { ProjectBudget }          from "./tabs/ProjectBudget";
import { ProjectMilestones }      from "./tabs/ProjectMilestones";
import { ProjectSnagLog }         from "./tabs/ProjectSnagLog";
import { ProjectSiteSurvey }      from "./tabs/ProjectSiteSurvey";
import { ProjectBOQ }             from "./tabs/ProjectBOQ";
import { ProjectChangeRequests }  from "./tabs/ProjectChangeRequests";
import { ProjectRisks }           from "./tabs/ProjectRisks";
import { ProjectResources }       from "./tabs/ProjectResources";
import { ProjectInspections }     from "./tabs/ProjectInspections";
import { ProjectTC }              from "./tabs/ProjectTC";
import { ProjectHandover }        from "./tabs/ProjectHandover";
import { ProjectWarranty }        from "./tabs/ProjectWarranty";
import { ProjectClosure }         from "./tabs/ProjectClosure";
import { ProjectDocuments }       from "./tabs/ProjectDocuments";
import { PhaseTracker }           from "./components/PhaseTracker";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PageHeader, SkeletonStats, StatusBadge } from "@/components/shared";

const TAB_CONFIG = [
  { value: "overview",    label: "Overview",          Icon: LayoutDashboard },
  { value: "activities",  label: "Activities",         Icon: Activity },
  { value: "survey",      label: "Site Survey",        Icon: ClipboardList },
  { value: "boq",         label: "BOQ",                Icon: PackageSearch },
  { value: "mrs",         label: "Material Requests",  Icon: Package },
  { value: "budget",      label: "Budget",             Icon: DollarSign },
  { value: "milestones",  label: "Milestones",         Icon: Milestone },
  { value: "resources",   label: "Resources",          Icon: Users },
  { value: "dprs",        label: "Daily Reports",      Icon: FileText },
  { value: "inspections", label: "Inspections",        Icon: ClipboardCheck },
  { value: "tc",          label: "T&C",                Icon: Zap },
  { value: "changes",     label: "Change Requests",    Icon: GitBranch },
  { value: "risks",       label: "Risk Register",      Icon: ShieldAlert },
  { value: "snags",       label: "Snag Log",           Icon: AlertOctagon },
  { value: "handover",    label: "Handover",           Icon: HandshakeIcon },
  { value: "warranty",    label: "Warranty",           Icon: ShieldCheck },
  { value: "closure",     label: "Closure",            Icon: Archive },
  { value: "documents",   label: "Documents",          Icon: FolderOpen },
];

export function ProjectWorkspace({ id }: { id: string }) {
  const projectId = parseInt(id, 10);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
        <SkeletonStats count={4} />
      </div>
    );
  }

  if (!project) return <div className="p-6 text-muted-foreground">Project not found</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-3 pb-10 h-full flex flex-col"
    >
      <PageHeader
        title={project.name}
        subtitle={`PRJ-${project.id.toString().padStart(4, "0")} · ${project.siteLocation ?? "No location"}`}
        badge={<StatusBadge status={project.status} />}
        backHref="/projects"
        actions={null}
      />

      {/* Phase Tracker — always visible above tabs */}
      <PhaseTracker projectId={projectId} />

      <div className="bg-card rounded-xl border border-border shadow-xs flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-border/60 px-4 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-0 -mb-px pt-1">
            {TAB_CONFIG.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-3 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors",
                  activeTab === tab.value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60"
                )}
              >
                <tab.Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-5 flex-1 overflow-y-auto scrollbar-thin">
          {activeTab === "overview"    && <ProjectOverview       projectId={projectId} />}
          {activeTab === "activities"  && <ProjectActivities     projectId={projectId} />}
          {activeTab === "survey"      && <ProjectSiteSurvey     projectId={projectId} />}
          {activeTab === "boq"         && <ProjectBOQ            projectId={projectId} clientPoId={project.clientPoId} />}
          {activeTab === "mrs"         && <ProjectMRs            projectId={projectId} />}
          {activeTab === "budget"      && <ProjectBudget         projectId={projectId} />}
          {activeTab === "milestones"  && <ProjectMilestones     projectId={projectId} />}
          {activeTab === "resources"   && <ProjectResources      projectId={projectId} />}
          {activeTab === "dprs"        && <ProjectDPRs           projectId={projectId} />}
          {activeTab === "inspections" && <ProjectInspections    projectId={projectId} />}
          {activeTab === "tc"          && <ProjectTC             projectId={projectId} />}
          {activeTab === "changes"     && <ProjectChangeRequests projectId={projectId} />}
          {activeTab === "risks"       && <ProjectRisks          projectId={projectId} />}
          {activeTab === "snags"       && <ProjectSnagLog        projectId={projectId} />}
          {activeTab === "handover"    && <ProjectHandover       projectId={projectId} />}
          {activeTab === "warranty"    && <ProjectWarranty       projectId={projectId} />}
          {activeTab === "closure"     && <ProjectClosure        projectId={projectId} />}
          {activeTab === "documents"   && <ProjectDocuments      projectId={projectId} />}
        </div>
      </div>
    </motion.div>
  );
}
