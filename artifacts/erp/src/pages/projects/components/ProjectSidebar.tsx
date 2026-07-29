// @refresh reset
import { useState } from "react";
import {
  useGetProjectDashboard,
  getGetProjectDashboardQueryKey,
  useUpdateProject,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  TooltipProvider, Tooltip, TooltipTrigger, TooltipContent,
} from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  LayoutDashboard, Activity, PackageSearch, DollarSign, Milestone,
  ShoppingCart, FolderOpen, Users, ClipboardList, ClipboardCheck,
  Zap, GitBranch, ShieldAlert, AlertOctagon, HandshakeIcon,
  ShieldCheck, Archive, MapPin, Calendar, User, TrendingUp,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2,
  Pencil, Check, Loader2,
} from "lucide-react";
import { StatusBadge } from "@/components/shared";
import { usePermissions } from "@/lib/permissions";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  project:    any;
  projectId:  number;
  activeTab:  string;
  onTabChange: (tab: string) => void;
  collapsed?: boolean;   // true = 48px icon-rail mode
}

interface NavItem {
  value: string;
  label: string;
  Icon:  React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
}

interface NavGroup {
  group: string | null;
  items: NavItem[];
}

// ── Currency helper ───────────────────────────────────────────────────────────
function fmtINR(v: number): string {
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)}L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

// ── Badge pill ─────────────────────────────────────────────────────────────────
function NavBadge({
  value, color = "amber",
}: {
  value: React.ReactNode;
  color?: "amber" | "red" | "blue" | "emerald" | "muted";
}) {
  const cls = {
    amber:   "bg-amber-100  text-amber-700  dark:bg-amber-950/50  dark:text-amber-400",
    red:     "bg-red-100    text-red-700    dark:bg-red-950/50    dark:text-red-400",
    blue:    "bg-blue-100   text-blue-700   dark:bg-blue-950/50   dark:text-blue-400",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
    muted:   "bg-muted text-muted-foreground",
  }[color];
  return (
    <span className={cn("ml-auto shrink-0 text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full leading-none", cls)}>
      {value}
    </span>
  );
}

// ── Single nav item ────────────────────────────────────────────────────────────
function NavItemButton({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const btn = (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "w-full flex items-center rounded-md transition-all duration-100 text-left group/navitem",
        collapsed
          ? "justify-center h-9 w-9 mx-auto p-0"
          : "gap-2.5 px-2.5 py-1.5",
        isActive
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <item.Icon className={cn(
        "shrink-0 transition-colors",
        collapsed ? "h-4 w-4" : "h-3.5 w-3.5",
        isActive ? "text-primary" : "text-muted-foreground group-hover/navitem:text-foreground"
      )} />
      {!collapsed && (
        <>
          <span className="text-[12px] truncate flex-1 leading-none">{item.label}</span>
          {item.badge}
        </>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" className="text-[12px] font-medium">
          {item.label}
          {item.badge && <span className="ml-1.5 opacity-70">(has updates)</span>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return btn;
}

// ── Collapsible section header ─────────────────────────────────────────────────
function SectionHeader({
  label, open, onToggle,
}: {
  label: string; open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-2.5 pt-3 pb-1 group/sec"
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground/50 group-hover/sec:text-muted-foreground/80 transition-colors">
        {label}
      </span>
      {open
        ? <ChevronDown  className="h-2.5 w-2.5 text-muted-foreground/30 group-hover/sec:text-muted-foreground/60" />
        : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/30 group-hover/sec:text-muted-foreground/60" />}
    </button>
  );
}

// ── Icon-rail section divider ──────────────────────────────────────────────────
function RailDivider() {
  return <div className="my-1.5 mx-3 h-px bg-border/40" />;
}

// ── Progress mini-bar ─────────────────────────────────────────────────────────
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main sidebar
// ─────────────────────────────────────────────────────────────────────────────
export function ProjectSidebar({ project, projectId, activeTab, onTabChange, collapsed = false }: Props) {
  // Section collapse state — all open by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Core: true, "Field Ops": true, Lifecycle: false,
  });

  const toggleSection = (label: string) =>
    setOpenSections(s => ({ ...s, [label]: !s[label] }));

  // ── Inline PM reassignment ──
  const [pmOpen, setPmOpen] = useState(false);
  const [pmSearch, setPmSearch] = useState("");
  const { canEdit } = usePermissions("projects");
  const queryClient = useQueryClient();

  const { data: pmCandidates = [] } = useQuery<{ id: number; name: string; role: string }[]>({
    queryKey: ["pm-candidates"],
    queryFn: () => apiGet("/projects/pm-candidates"),
    staleTime: 5 * 60_000,
    enabled: pmOpen,
  });

  const updatePm = useUpdateProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        setPmOpen(false);
        setPmSearch("");
      },
    },
  });

  const filteredCandidates = pmCandidates.filter(c =>
    c.name.toLowerCase().includes(pmSearch.toLowerCase())
  );

  // ── Dashboard data for badges ──
  const { data: dashboard } = useGetProjectDashboard(projectId, {
    query: {
      queryKey: getGetProjectDashboardQueryKey(projectId),
      staleTime: 2 * 60_000,
      enabled: !!projectId,
    },
  });

  const { data: milestoneData } = useQuery<{ overallCompletionPct: number }>({
    queryKey: ["milestones-critical-path", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/milestones/critical-path`),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  });

  const d            = dashboard as any;
  const openMRs      = d?.openMRsCount       ?? 0;
  const pendingPOs   = d?.pendingPOsCount     ?? 0;
  const openIssues   = d?.openEscalationsCount ?? 0;
  const bg           = d?.budgetSummary;
  const isOverBudget = bg ? bg.totalVariance < 0 : false;

  const pct          = milestoneData?.overallCompletionPct ?? project.percentComplete ?? 0;
  const totalBudget  = bg?.totalBudgeted ?? 0;
  const totalActual  = bg?.totalActual   ?? 0;
  const budgetPct    = totalBudget > 0 ? Math.min(Math.round((totalActual / totalBudget) * 100), 100) : 0;

  const prjCode = `PRJ-${project.id.toString().padStart(4, "0")}`;

  // ── Build nav groups with live badges ──
  const NAV_GROUPS: NavGroup[] = [
    {
      group: null,
      items: [
        { value: "overview", label: "Overview", Icon: LayoutDashboard },
      ],
    },
    {
      group: "Core",
      items: [
        { value: "activities",  label: "Activities",  Icon: Activity },
        { value: "boq",         label: "BOQ",         Icon: PackageSearch },
        {
          value: "budget", label: "Budget", Icon: DollarSign,
          badge: isOverBudget
            ? <NavBadge value="Over" color="red" />
            : undefined,
        },
        { value: "milestones",  label: "Milestones",  Icon: Milestone },
        {
          value: "mrs", label: "Procurement", Icon: ShoppingCart,
          badge: (openMRs + pendingPOs) > 0
            ? <NavBadge value={`${openMRs + pendingPOs}`} color="amber" />
            : undefined,
        },
        { value: "documents",   label: "Documents",   Icon: FolderOpen },
      ],
    },
    {
      group: "Field Ops",
      items: [
        { value: "resources",   label: "Resources",       Icon: Users },
        { value: "dprs",        label: "Daily Reports",   Icon: ClipboardList },
        { value: "inspections", label: "Inspections",     Icon: ClipboardCheck },
        { value: "tc",          label: "Testing & Comm.", Icon: Zap },
        { value: "changes",     label: "Change Requests", Icon: GitBranch },
        {
          value: "risks", label: "Risk Register", Icon: ShieldAlert,
          badge: openIssues > 0
            ? <NavBadge value={openIssues} color="red" />
            : undefined,
        },
        { value: "snags",       label: "Snag Log",        Icon: AlertOctagon },
      ],
    },
    {
      group: "Lifecycle",
      items: [
        { value: "survey",   label: "Site Survey", Icon: ClipboardList },
        { value: "handover", label: "Handover",    Icon: HandshakeIcon },
        { value: "warranty", label: "Warranty",    Icon: ShieldCheck },
        { value: "closure",  label: "Closure",     Icon: Archive },
      ],
    },
  ];

  // ── Progress bar colour ──
  const progColor = pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-blue-500" : "bg-amber-500";
  const budgetColor = isOverBudget ? "bg-red-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-emerald-500";

  // ─────────────────────────────────────────────────────────────────────────
  // COLLAPSED (icon-rail) mode
  // ─────────────────────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-col items-center py-2 h-full overflow-y-auto scrollbar-none">

          {/* Status dot */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-9 h-9 flex items-center justify-center mb-1 cursor-default">
                <div className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  project.status === "Active"    ? "bg-emerald-500 ring-2 ring-emerald-300/40 dark:ring-emerald-700/40" :
                  project.status === "On Hold"   ? "bg-amber-500" :
                  project.status === "Completed" ? "bg-violet-500" :
                  project.status === "Cancelled" ? "bg-red-400" :
                  "bg-blue-500"
                )} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[11px]">
              {prjCode} · {project.status} · {pct}%
            </TooltipContent>
          </Tooltip>

          {/* All nav items flattened, with group dividers */}
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="w-full">
              {gi > 0 && <RailDivider />}
              <div className="flex flex-col items-center gap-0.5 px-1.5">
                {group.items.map(item => (
                  <div key={item.value} className="relative w-full flex justify-center">
                    {/* Active dot indicator */}
                    {activeTab === item.value && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                    )}
                    <NavItemButton
                      item={item}
                      isActive={activeTab === item.value}
                      collapsed={true}
                      onClick={() => onTabChange(item.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </TooltipProvider>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPANDED mode
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">

        {/* ── Project vitals card ───────────────────────────────────────────── */}
        <div className="px-3 pt-3 pb-3 border-b border-border/40 space-y-2.5">

          {/* Code + status */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-muted-foreground/50 tracking-wider">
              {prjCode}
            </span>
            <StatusBadge status={project.status} />
          </div>

          {/* Overall progress */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Progress</span>
              <span className={cn(
                "text-[11px] font-bold tabular-nums",
                pct >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                pct >= 40 ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"
              )}>
                {pct}%
              </span>
            </div>
            <MiniBar pct={pct} color={progColor} />
          </div>

          {/* Budget burn (if configured) */}
          {totalBudget > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Budget</span>
                <span className={cn(
                  "text-[10px] font-bold",
                  isOverBudget ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                )}>
                  {isOverBudget ? "⚠ Over" : `${budgetPct}% used`}
                </span>
              </div>
              <MiniBar pct={budgetPct} color={budgetColor} />
            </div>
          )}

          {/* Site info */}
          {project.siteLocation && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 opacity-50" />
              <span className="truncate">{project.siteLocation}</span>
            </div>
          )}

          {/* PM + dates */}
          <div className="space-y-1">
            {/* PM row — click to reassign if permitted */}
            {canEdit ? (
              <Popover open={pmOpen} onOpenChange={v => { setPmOpen(v); if (!v) setPmSearch(""); }}>
                <PopoverTrigger asChild>
                  <button className="group flex items-center gap-1.5 text-[11px] text-muted-foreground w-full hover:text-foreground transition-colors rounded px-0.5 -mx-0.5">
                    <User className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-70" />
                    <span className="truncate flex-1 text-left">{project.pmOwnerName ?? "Unassigned"}</span>
                    <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-40 shrink-0 transition-opacity" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-56 p-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1 pb-1.5">
                    Reassign PM
                  </p>
                  <input
                    className="w-full text-[12px] border border-border/60 rounded px-2 py-1 mb-1.5 bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    placeholder="Search…"
                    value={pmSearch}
                    onChange={e => setPmSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="max-h-44 overflow-y-auto space-y-0.5">
                    {filteredCandidates.length === 0 && (
                      <p className="text-[11px] text-muted-foreground text-center py-2">No match</p>
                    )}
                    {filteredCandidates.map(c => (
                      <button
                        key={c.id}
                        disabled={updatePm.isPending}
                        onClick={() => updatePm.mutate({ id: projectId, data: { pmOwnerId: c.id } })}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[12px] transition-colors",
                          c.id === project.pmOwnerId
                            ? "bg-primary/10 text-primary font-semibold"
                            : "hover:bg-accent text-foreground"
                        )}
                      >
                        {c.id === project.pmOwnerId
                          ? (updatePm.isPending
                              ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                              : <Check className="h-3 w-3 shrink-0" />)
                          : <span className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{c.name}</span>
                        <span className="ml-auto text-[9px] text-muted-foreground/60 capitalize shrink-0">{c.role}</span>
                      </button>
                    ))}
                  </div>
                  {updatePm.isPending && (
                    <p className="text-[10px] text-muted-foreground text-center pt-1.5 flex items-center justify-center gap-1">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving…
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <User className="h-3 w-3 shrink-0 opacity-50" />
                <span className="truncate">{project.pmOwnerName ?? "Unassigned"}</span>
              </div>
            )}
            {project.plannedEnd && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0 opacity-50" />
                <span>Target: {format(new Date(project.plannedEnd), "dd MMM yyyy")}</span>
              </div>
            )}
          </div>

          {/* Quick health indicators */}
          {(openMRs > 0 || pendingPOs > 0 || openIssues > 0 || isOverBudget) && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {(openMRs + pendingPOs) > 0 && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                  <ShoppingCart className="h-2.5 w-2.5" />
                  {openMRs}MR · {pendingPOs}PO
                </span>
              )}
              {openIssues > 0 && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {openIssues} issue{openIssues > 1 ? "s" : ""}
                </span>
              )}
              {isOverBudget && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                  <TrendingUp className="h-2.5 w-2.5" />
                  Over budget
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Navigation ───────────────────────────────────────────────────── */}
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {/* Group header (collapsible) */}
              {group.group !== null && (
                <SectionHeader
                  label={group.group}
                  open={openSections[group.group] ?? true}
                  onToggle={() => toggleSection(group.group!)}
                />
              )}

              {/* Items */}
              {(group.group === null || (openSections[group.group] ?? true)) && (
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <div key={item.value} className="relative">
                      {/* Active left accent */}
                      {activeTab === item.value && (
                        <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-primary rounded-r-full" />
                      )}
                      <div className={activeTab === item.value ? "pl-[3px]" : ""}>
                        <NavItemButton
                          item={item}
                          isActive={activeTab === item.value}
                          collapsed={false}
                          onClick={() => onTabChange(item.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* ── Footer: contract value + quick links ──────────────────────────── */}
        {project.contractValue && (
          <div className="px-3 py-2.5 border-t border-border/40">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-0.5">
              Contract Value
            </p>
            <p className="text-[13px] font-bold font-mono text-foreground">
              {fmtINR(Number(project.contractValue))}
            </p>
          </div>
        )}

        {/* Quick budget view link */}
        {totalBudget > 0 && (
          <div className="px-3 pb-3 flex items-center gap-3">
            <button
              onClick={() => onTabChange("budget")}
              className="flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline"
            >
              <TrendingUp className="h-3 w-3" /> Full budget
            </button>
            <button
              onClick={() => onTabChange("milestones")}
              className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium hover:text-foreground hover:underline"
            >
              <CheckCircle2 className="h-3 w-3" /> Milestones
            </button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
