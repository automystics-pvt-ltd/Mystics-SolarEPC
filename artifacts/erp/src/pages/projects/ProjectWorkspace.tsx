import { useState } from "react";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  LayoutDashboard, Activity, Package, FileText, DollarSign, Milestone,
  AlertOctagon, ClipboardList, PackageSearch, GitBranch, ShieldAlert,
  Users, ClipboardCheck, Zap, HandshakeIcon, ShieldCheck, Archive,
  FolderOpen, ShoppingCart, ChevronRight,
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
import { CrossModuleBar }         from "./components/CrossModuleBar";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SkeletonStats, StatusBadge } from "@/components/shared";

// ── Tab groups — visual separators mark logical boundaries ───────────────────
type TabDef = {
  value: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  groupSep?: true; // render a thin divider before this tab
};

const TAB_CONFIG: TabDef[] = [
  // ── Project core ─────────────────────────────────────────────────────────
  { value: "overview",    label: "Overview",         Icon: LayoutDashboard },
  { value: "activities",  label: "Activities",        Icon: Activity },
  { value: "survey",      label: "Site Survey",       Icon: ClipboardList },
  { value: "boq",         label: "BOQ",               Icon: PackageSearch },
  // ── Commercial / procurement ──────────────────────────────────────────────
  { value: "mrs",         label: "Procurement",       Icon: ShoppingCart,   groupSep: true },
  { value: "budget",      label: "Budget",            Icon: DollarSign },
  { value: "milestones",  label: "Milestones",        Icon: Milestone },
  // ── Field execution ───────────────────────────────────────────────────────
  { value: "resources",   label: "Resources",         Icon: Users,          groupSep: true },
  { value: "dprs",        label: "Daily Reports",     Icon: FileText },
  { value: "inspections", label: "Inspections",       Icon: ClipboardCheck },
  { value: "tc",          label: "T&C",               Icon: Zap },
  { value: "changes",     label: "Change Requests",   Icon: GitBranch },
  { value: "risks",       label: "Risk Register",     Icon: ShieldAlert },
  { value: "snags",       label: "Snag Log",          Icon: AlertOctagon },
  // ── Lifecycle ─────────────────────────────────────────────────────────────
  { value: "handover",    label: "Handover",          Icon: HandshakeIcon,  groupSep: true },
  { value: "warranty",    label: "Warranty",          Icon: ShieldCheck },
  { value: "closure",     label: "Closure",           Icon: Archive },
  { value: "documents",   label: "Documents",         Icon: FolderOpen },
];

export function ProjectWorkspace({ id }: { id: string }) {
  const projectId = parseInt(id, 10);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
        <SkeletonStats count={4} />
      </div>
    );
  }

  if (!project) return <div className="p-6 text-muted-foreground">Project not found</div>;

  const prjCode = `PRJ-${project.id.toString().padStart(4, "0")}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-2 pb-10 h-full flex flex-col"
    >
      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1 text-[11px] text-muted-foreground px-0.5 pt-1 pb-0.5">
        <Link href="/projects" className="hover:text-foreground transition-colors font-medium">
          Projects
        </Link>
        <ChevronRight className="h-3 w-3 opacity-40" />
        <span className="font-mono text-muted-foreground/70">{prjCode}</span>
        <ChevronRight className="h-3 w-3 opacity-40" />
        <span className="font-semibold text-foreground truncate max-w-[260px]">{project.name}</span>
      </nav>

      {/* ── Compact header row ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-bold text-foreground tracking-tight truncate">{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>
        <p className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
          {project.siteLocation ?? "No location"} · {prjCode}
        </p>
      </div>

      {/* ── Phase tracker ───────────────────────────────────────────────────── */}
      <PhaseTracker projectId={projectId} />

      {/* ── Cross-module connected strip ────────────────────────────────────── */}
      <CrossModuleBar
        projectId={projectId}
        clientPoId={project.clientPoId}
        onTabChange={setActiveTab}
      />

      {/* ── Tab workspace ───────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border shadow-xs flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-border/60 px-4 overflow-x-auto scrollbar-none">
          <div className="flex items-center -mb-px pt-1">
            {TAB_CONFIG.map((tab) => (
              <div key={tab.value} className="flex items-center">
                {tab.groupSep && (
                  <div className="w-px h-5 bg-border/50 mx-2 self-center shrink-0" />
                )}
                <button
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-3 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors",
                    activeTab === tab.value
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60",
                  )}
                >
                  <tab.Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-5 flex-1 overflow-y-auto scrollbar-thin">
          {activeTab === "overview"    && <ProjectOverview    projectId={projectId} onTabChange={setActiveTab} />}
          {activeTab === "activities"  && <ProjectActivities  projectId={projectId} />}
          {activeTab === "survey"      && <ProjectSiteSurvey  projectId={projectId} />}
          {activeTab === "boq"         && <ProjectBOQ         projectId={projectId} clientPoId={project.clientPoId} />}
          {activeTab === "mrs"         && <ProjectMRs         projectId={projectId} />}
          {activeTab === "budget"      && <ProjectBudget      projectId={projectId} />}
          {activeTab === "milestones"  && <ProjectMilestones  projectId={projectId} />}
          {activeTab === "resources"   && <ProjectResources   projectId={projectId} />}
          {activeTab === "dprs"        && <ProjectDPRs        projectId={projectId} />}
          {activeTab === "inspections" && <ProjectInspections projectId={projectId} />}
          {activeTab === "tc"          && <ProjectTC          projectId={projectId} />}
          {activeTab === "changes"     && <ProjectChangeRequests projectId={projectId} />}
          {activeTab === "risks"       && <ProjectRisks       projectId={projectId} />}
          {activeTab === "snags"       && <ProjectSnagLog     projectId={projectId} />}
          {activeTab === "handover"    && <ProjectHandover    projectId={projectId} />}
          {activeTab === "warranty"    && <ProjectWarranty    projectId={projectId} />}
          {activeTab === "closure"     && <ProjectClosure     projectId={projectId} />}
          {activeTab === "documents"   && <ProjectDocuments   projectId={projectId} />}
        </div>
      </div>
    </motion.div>
  );
}
