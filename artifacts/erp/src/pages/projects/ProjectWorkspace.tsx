import { useState, lazy, Suspense, useEffect } from "react";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Activity, PackageSearch, DollarSign, Milestone,
  AlertOctagon, ClipboardList, GitBranch, ShieldAlert, Users, ClipboardCheck,
  Zap, HandshakeIcon, ShieldCheck, Archive, FolderOpen, ShoppingCart,
  ChevronRight, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Check,
  Plus,
} from "lucide-react";
import { SkeletonStats, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ProjectSidebar } from "./components/ProjectSidebar";

// ─── Lazy-load every tab panel — only fetches JS when first visited ───────────
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

// ─── Tab configuration ──────────────────────────────────────────────────────────
type TabDef = { value: string; label: string; Icon: React.ComponentType<{ className?: string }> };

/** 7 tabs always visible in the bar */
const PRIMARY_TABS: TabDef[] = [
  { value: "overview",   label: "Overview",    Icon: LayoutDashboard },
  { value: "activities", label: "Activities",  Icon: Activity },
  { value: "boq",        label: "BOQ",         Icon: PackageSearch },
  { value: "budget",     label: "Budget",      Icon: DollarSign },
  { value: "milestones", label: "Milestones",  Icon: Milestone },
  { value: "mrs",        label: "Procurement", Icon: ShoppingCart },
  { value: "documents",  label: "Documents",   Icon: FolderOpen },
];

/** Extra tabs live in a "More" dropdown, grouped by domain */
const MORE_GROUPS: { group: string; tabs: TabDef[] }[] = [
  {
    group: "Field Operations",
    tabs: [
      { value: "resources",   label: "Resources",         Icon: Users },
      { value: "dprs",        label: "Daily Reports",     Icon: ClipboardList },
      { value: "inspections", label: "Inspections",       Icon: ClipboardCheck },
      { value: "tc",          label: "Testing & Comm.",   Icon: Zap },
      { value: "changes",     label: "Change Requests",   Icon: GitBranch },
      { value: "risks",       label: "Risk Register",     Icon: ShieldAlert },
      { value: "snags",       label: "Snag Log",          Icon: AlertOctagon },
    ],
  },
  {
    group: "Lifecycle",
    tabs: [
      { value: "survey",   label: "Site Survey", Icon: ClipboardList },
      { value: "handover", label: "Handover",    Icon: HandshakeIcon },
      { value: "warranty", label: "Warranty",    Icon: ShieldCheck },
      { value: "closure",  label: "Closure",     Icon: Archive },
    ],
  },
];

const ALL_MORE_TABS = MORE_GROUPS.flatMap(g => g.tabs);

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

/* ── Main component ──────────────────────────────────────────────────────────── */
export function ProjectWorkspace({ id }: { id: string }) {
  const projectId = parseInt(id, 10);
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);    // desktop sidebar
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false); // mobile sheet

  const { data: project, isPending } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  // Close desktop sidebar on small screens by default
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    if (mq.matches) setSidebarOpen(false);
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setSidebarOpen(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (isPending) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 h-12 bg-muted/40 border-b border-border/60 animate-pulse" />
        <div className="shrink-0 h-10 bg-muted/20 border-b border-border/40 animate-pulse" />
        <div className="flex-1 p-6">
          <TabSkeleton />
        </div>
      </div>
    );
  }

  if (!project) {
    return <div className="p-8 text-muted-foreground">Project not found.</div>;
  }

  const prjCode = `PRJ-${project.id.toString().padStart(4, "0")}`;
  const pct = project.percentComplete ?? 0;
  const activeInMore = ALL_MORE_TABS.find(t => t.value === activeTab);

  function switchTab(tab: string) {
    setActiveTab(tab);
    setMobileSheetOpen(false);
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── COMMAND BAR (sticky) ─────────────────────────────────────────────── */}
      <header className="shrink-0 bg-background/95 backdrop-blur-sm border-b border-border/60 px-3 py-2 flex items-center gap-2 sm:gap-3 z-10">
        {/* Sidebar toggle */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Desktop toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hidden lg:flex"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Collapse info panel" : "Expand info panel"}
          >
            {sidebarOpen
              ? <PanelLeftClose className="h-4 w-4" />
              : <PanelLeftOpen  className="h-4 w-4" />}
          </Button>
          {/* Mobile toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 lg:hidden"
            onClick={() => setMobileSheetOpen(true)}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>

        {/* Breadcrumb */}
        <nav className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
          <Link href="/projects" className="hover:text-foreground font-medium">Projects</Link>
          <ChevronRight className="h-3 w-3 opacity-40" />
          <span className="font-mono text-muted-foreground/60">{prjCode}</span>
        </nav>

        {/* Project name + status */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-[15px] font-bold text-foreground truncate leading-none">{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>

        {/* Progress bar + quick actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Compact progress */}
          <div className="hidden md:flex items-center gap-2">
            <div className="w-[72px] h-1.5 bg-muted rounded-full overflow-hidden">
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
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[12px] hidden sm:flex"
            onClick={() => switchTab("dprs")}
          >
            <Plus className="h-3.5 w-3.5" /> DPR
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-7 gap-1 text-[12px]"
            onClick={() => switchTab("mrs")}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Procurement</span>
          </Button>
        </div>
      </header>

      {/* ── TAB BAR ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-background border-b border-border/60 px-2 sm:px-4 overflow-x-auto scrollbar-none">
        <div className="flex items-center -mb-px">
          {PRIMARY_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => switchTab(tab.value)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors shrink-0",
                activeTab === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/50"
              )}
            >
              <tab.Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}

          {/* ── More dropdown for overflow tabs ──────────────────────────── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors shrink-0",
                  activeInMore
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/50"
                )}
              >
                {activeInMore ? (
                  <>
                    <activeInMore.Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{activeInMore.label}</span>
                  </>
                ) : (
                  <>
                    <MoreHorizontal className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">More</span>
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {MORE_GROUPS.map((group, gi) => (
                <div key={group.group}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold px-2 py-1.5">
                    {group.group}
                  </DropdownMenuLabel>
                  {group.tabs.map(tab => (
                    <DropdownMenuItem
                      key={tab.value}
                      onClick={() => switchTab(tab.value)}
                      className={cn(
                        "text-[12px] gap-2 cursor-pointer",
                        activeTab === tab.value && "text-primary bg-primary/5"
                      )}
                    >
                      <tab.Icon className="h-3.5 w-3.5" />
                      {tab.label}
                      {activeTab === tab.value && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── BODY: sidebar + scrollable content ──────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Desktop sidebar (animated) ──────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 248, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="hidden lg:block shrink-0 overflow-hidden border-r border-border/60 bg-muted/10"
            >
              <div className="w-[248px] h-full overflow-y-auto scrollbar-thin">
                <ProjectSidebar
                  project={project}
                  projectId={projectId}
                  onTabChange={switchTab}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Mobile sidebar sheet ────────────────────────────────────────── */}
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent side="left" className="w-72 p-0 overflow-y-auto">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/60">
              <SheetTitle className="text-[13px] font-bold">{project.name}</SheetTitle>
            </SheetHeader>
            <ProjectSidebar
              project={project}
              projectId={projectId}
              onTabChange={switchTab}
            />
          </SheetContent>
        </Sheet>

        {/* ── Tab content ────────────────────────────────────────────────── */}
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
