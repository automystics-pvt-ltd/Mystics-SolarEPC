// @refresh reset
import { useState, lazy, Suspense, useEffect } from "react";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  PanelLeftClose, PanelLeftOpen, Plus, ShoppingCart, ChevronRight, Menu,
} from "lucide-react";
import { SkeletonStats, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProjectSidebar } from "./components/ProjectSidebar";

// ─── Lazy-load every tab panel ────────────────────────────────────────────────
const ProjectOverview       = lazy(() => import("./tabs/ProjectOverview").then(m => ({ default: m.ProjectOverview })));
const ProjectActivities     = lazy(() => import("./tabs/ProjectActivities").then(m => ({ default: m.ProjectActivities })));
const ProjectSiteSurvey     = lazy(() => import("./tabs/ProjectSiteSurvey").then(m => ({ default: m.ProjectSiteSurvey })));
const ProjectBOQ            = lazy(() => import("./tabs/ProjectBOQ").then(m => ({ default: m.ProjectBOQ })));
const ProjectMRs            = lazy(() => import("./tabs/ProjectMRs").then(m => ({ default: m.ProjectMRs })));
const ProjectBudget         = lazy(() => import("./tabs/ProjectBudget").then(m => ({ default: m.ProjectBudget })));
const ProjectMilestones     = lazy(() => import("./tabs/ProjectMilestones").then(m => ({ default: m.ProjectMilestones })));
const ProjectResources      = lazy(() => import("./tabs/ProjectResources").then(m => ({ default: m.ProjectResources })));
const ProjectDPRs           = lazy(() => import("./tabs/ProjectDPRs").then(m => ({ default: m.ProjectDPRs })));
const ProjectInspections    = lazy(() => import("./tabs/ProjectInspections").then(m => ({ default: m.ProjectInspections })));
const ProjectTC             = lazy(() => import("./tabs/ProjectTC").then(m => ({ default: m.ProjectTC })));
const ProjectChangeRequests = lazy(() => import("./tabs/ProjectChangeRequests").then(m => ({ default: m.ProjectChangeRequests })));
const ProjectRisks          = lazy(() => import("./tabs/ProjectRisks").then(m => ({ default: m.ProjectRisks })));
const ProjectSnagLog        = lazy(() => import("./tabs/ProjectSnagLog").then(m => ({ default: m.ProjectSnagLog })));
const ProjectHandover       = lazy(() => import("./tabs/ProjectHandover").then(m => ({ default: m.ProjectHandover })));
const ProjectWarranty       = lazy(() => import("./tabs/ProjectWarranty").then(m => ({ default: m.ProjectWarranty })));
const ProjectClosure        = lazy(() => import("./tabs/ProjectClosure").then(m => ({ default: m.ProjectClosure })));
const ProjectDocuments      = lazy(() => import("./tabs/ProjectDocuments").then(m => ({ default: m.ProjectDocuments })));

// ─── Tab labels (for breadcrumb display) ─────────────────────────────────────
const TAB_LABELS: Record<string, string> = {
  overview: "Overview", activities: "Activities", survey: "Site Survey",
  boq: "BOQ", mrs: "Procurement", budget: "Budget", milestones: "Milestones",
  resources: "Resources", dprs: "Daily Reports", inspections: "Inspections",
  tc: "Testing & Comm.", changes: "Change Requests", risks: "Risk Register",
  snags: "Snag Log", handover: "Handover", warranty: "Warranty",
  closure: "Closure", documents: "Documents",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function TabSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonStats count={4} />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map(i => (
          <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ProjectWorkspace({ id }: { id: string }) {
  const projectId = parseInt(id, 10);

  const [activeTab,        setActiveTab]        = useState("overview");
  const [sidebarExpanded,  setSidebarExpanded]  = useState(true);   // expanded vs icon-rail (desktop)
  const [mobileSheetOpen,  setMobileSheetOpen]  = useState(false);

  const { data: project, isPending } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  // Default to icon-rail on screens < 1280px
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    if (mq.matches) setSidebarExpanded(false);
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setSidebarExpanded(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Loading ──
  if (isPending) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 h-12 bg-muted/40 border-b border-border/60 animate-pulse" />
        <div className="flex-1 p-6"><TabSkeleton /></div>
      </div>
    );
  }

  if (!project) {
    return <div className="p-8 text-muted-foreground">Project not found.</div>;
  }

  const prjCode = `PRJ-${project.id.toString().padStart(4, "0")}`;
  const pct     = project.percentComplete ?? 0;
  const tabLabel = TAB_LABELS[activeTab] ?? activeTab;

  function switchTab(tab: string) {
    setActiveTab(tab);
    setMobileSheetOpen(false);
  }

  // ── Sidebar content (shared between desktop + mobile sheet) ──
  const sidebarContent = (
    <ProjectSidebar
      project={project}
      projectId={projectId}
      activeTab={activeTab}
      onTabChange={switchTab}
      collapsed={false}
    />
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── COMMAND BAR ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-background/95 backdrop-blur-sm border-b border-border/60 px-3 py-0 flex items-stretch gap-2 sm:gap-3 z-10 min-h-[44px]">

        {/* Sidebar toggle */}
        <div className="flex items-center gap-1 shrink-0 py-2">
          {/* Desktop: expand ↔ icon-rail */}
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 hidden lg:flex"
            onClick={() => setSidebarExpanded(e => !e)}
            title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarExpanded
              ? <PanelLeftClose className="h-4 w-4" />
              : <PanelLeftOpen  className="h-4 w-4" />}
          </Button>
          {/* Mobile: open sheet */}
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={() => setMobileSheetOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* Breadcrumb + current section */}
        <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 py-2">
          <Link href="/projects" className="hover:text-foreground font-medium transition-colors">
            Projects
          </Link>
          <ChevronRight className="h-3 w-3 opacity-40" />
          <span className="font-mono text-muted-foreground/60">{prjCode}</span>
          {activeTab !== "overview" && (
            <>
              <ChevronRight className="h-3 w-3 opacity-40" />
              <span className="text-foreground/70 font-medium">{tabLabel}</span>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-border/60 my-2 shrink-0" />

        {/* Project name + status */}
        <div className="flex items-center gap-2 min-w-0 flex-1 py-2">
          <h1 className="text-[14px] sm:text-[15px] font-bold text-foreground truncate leading-none">
            {project.name}
          </h1>
          <StatusBadge status={project.status} />
          {project.pmOwnerName && (
            <div className="hidden sm:flex items-center gap-1 min-w-0 pl-2 border-l border-border/60 shrink-0">
              <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[8px] font-black text-primary leading-none">
                  {project.pmOwnerName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
                {project.pmOwnerName.split(" ")[0]}
              </span>
            </div>
          )}
        </div>

        {/* Progress + quick actions */}
        <div className="flex items-center gap-2 shrink-0 py-2">
          {/* Progress mini-bar */}
          <div className="hidden md:flex items-center gap-2">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-blue-500" : "bg-amber-500"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[12px] font-bold text-muted-foreground tabular-nums">{pct}%</span>
          </div>

          {/* Quick actions */}
          <Button
            variant="outline" size="sm"
            className="h-7 gap-1 text-[12px] hidden sm:flex"
            onClick={() => switchTab("dprs")}
          >
            <Plus className="h-3.5 w-3.5" /> DPR
          </Button>
          <Button
            variant="default" size="sm"
            className="h-7 gap-1 text-[12px]"
            onClick={() => switchTab("mrs")}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Procurement</span>
          </Button>
        </div>
      </header>

      {/* ── BODY ──────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Desktop sidebar — always visible; animates between 260px (expanded) and 48px (icon rail) */}
        <motion.aside
          animate={{ width: sidebarExpanded ? 260 : 48 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="hidden lg:block shrink-0 border-r border-border/60 bg-muted/10 overflow-hidden"
        >
          <ProjectSidebar
            project={project}
            projectId={projectId}
            activeTab={activeTab}
            onTabChange={switchTab}
            collapsed={!sidebarExpanded}
          />
        </motion.aside>

        {/* Mobile sidebar sheet */}
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent side="left" className="w-72 p-0 overflow-y-auto">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/60">
              <SheetTitle className="text-[13px] font-bold truncate">{project.name}</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>

        {/* ── Tab content ────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 sm:p-5 max-w-screen-2xl">
            <Suspense fallback={<TabSkeleton />}>
              {activeTab === "overview"    && <ProjectOverview       projectId={projectId} onTabChange={switchTab} />}
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
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
