import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetProjectDashboard,
  getGetProjectDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  MapPin, Calendar, User, DollarSign, ChevronDown, ChevronRight,
  ShoppingCart, Package2, AlertTriangle, CheckSquare, FileText,
  ExternalLink, TrendingUp, Activity, Zap, Target, ClipboardList,
  Shield,
} from "lucide-react";
import { StatusBadge } from "@/components/shared";

interface Props {
  project: any;
  projectId: number;
  onTabChange: (tab: string) => void;
}

/* ── Collapsible section ──────────────────────────────────────────────────────── */
function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        {title}
        {open
          ? <ChevronDown className="h-3 w-3 opacity-60" />
          : <ChevronRight className="h-3 w-3 opacity-60" />}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

/* ── Inline data row ─────────────────────────────────────────────────────────── */
function DataRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 px-4 py-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-[1px]" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className={cn("text-[12px] font-medium text-foreground leading-snug break-words", mono && "font-mono")}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ── Module quick-link row ───────────────────────────────────────────────────── */
function ModuleRow({
  icon: Icon,
  label,
  badge,
  badgeColor,
  onClick,
  onExternalClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string | number;
  badgeColor?: "amber" | "red" | "emerald" | "blue" | "muted";
  onClick?: () => void;
  onExternalClick?: () => void;
}) {
  const badgeCls = {
    amber:   "bg-amber-100  text-amber-700  dark:bg-amber-950/40  dark:text-amber-400",
    red:     "bg-red-100    text-red-700    dark:bg-red-950/40    dark:text-red-400",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    blue:    "bg-blue-100   text-blue-700   dark:bg-blue-950/40   dark:text-blue-400",
    muted:   "bg-muted      text-muted-foreground",
  }[badgeColor ?? "muted"];

  return (
    <div className="group/mr flex items-center gap-1 px-2 mx-2">
      <button
        onClick={onClick}
        className="flex items-center gap-2 flex-1 min-w-0 rounded-md px-2 py-1.5 hover:bg-accent transition-colors text-left"
      >
        <div className={cn("h-5 w-5 rounded flex items-center justify-center shrink-0", badgeCls)}>
          <Icon className="h-2.5 w-2.5" />
        </div>
        <span className="text-[12px] font-medium text-foreground truncate">{label}</span>
        {badge !== undefined && badge !== "" && (
          <span className={cn(
            "ml-auto text-[10px] font-bold tabular-nums shrink-0 px-1 py-0.5 rounded",
            badgeCls,
          )}>
            {badge}
          </span>
        )}
      </button>
      {onExternalClick && (
        <button
          onClick={onExternalClick}
          className="opacity-0 group-hover/mr:opacity-50 hover:!opacity-100 p-1 text-muted-foreground transition-opacity shrink-0"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ── Progress bar sub-component ─────────────────────────────────────────────── */
function MiniBar({
  label, pct, color,
}: {
  label: string; pct: number; color: "emerald" | "blue" | "amber" | "red";
}) {
  const bar = {
    emerald: "bg-emerald-500",
    blue:    "bg-blue-500",
    amber:   "bg-amber-500",
    red:     "bg-red-500",
  }[color];
  return (
    <div className="px-4 py-1">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-[11px] font-bold text-foreground tabular-nums">{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", bar)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ── Currency formatter ─────────────────────────────────────────────────────── */
function fmtINR(v: number): string {
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)}Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(2)}L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

/* ── Main sidebar ────────────────────────────────────────────────────────────── */
export function ProjectSidebar({ project, projectId, onTabChange }: Props) {
  const [, navigate] = useLocation();

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

  const d = dashboard as any;
  const openMRs    = d?.openMRsCount    ?? 0;
  const pendingPOs = d?.pendingPOsCount ?? 0;
  const openIssues = d?.openEscalationsCount ?? 0;
  const bg         = d?.budgetSummary;

  const overallPct   = milestoneData?.overallCompletionPct ?? project.percentComplete ?? 0;
  const totalBudget  = bg?.totalBudgeted ?? 0;
  const totalActual  = bg?.totalActual   ?? 0;
  const isOverBudget = totalBudget > 0 && totalActual > totalBudget;
  const budgetPct    = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  const overallColor: "emerald" | "blue" | "amber" =
    overallPct >= 80 ? "emerald" : overallPct >= 40 ? "blue" : "amber";
  const budgetColor: "emerald" | "amber" | "red" =
    isOverBudget ? "red" : budgetPct >= 80 ? "amber" : "emerald";

  return (
    <div className="py-1">

      {/* ── Project vitals ─────────────────────────────────────────────────── */}
      <Section title="Project Info">
        {/* Status row */}
        <div className="px-4 pb-1 flex items-center gap-2">
          <StatusBadge status={project.status} />
          <span className="text-[11px] font-mono text-muted-foreground/60">
            PRJ-{project.id.toString().padStart(4, "0")}
          </span>
        </div>

        <DataRow icon={MapPin}   label="Location"     value={project.siteLocation} />
        <DataRow icon={User}     label="PM Owner"     value={project.pmOwnerName ?? "Not assigned"} />
        <DataRow icon={Calendar} label="Start Date"   value={project.startDate ? format(new Date(project.startDate), "dd MMM yyyy") : null} />
        <DataRow icon={Calendar} label="Target End"   value={project.plannedEnd ? format(new Date(project.plannedEnd), "dd MMM yyyy") : null} />
        <DataRow icon={DollarSign} label="Contract Value"
          value={project.contractValue ? fmtINR(Number(project.contractValue)) : null}
          mono
        />
      </Section>

      {/* ── Progress ──────────────────────────────────────────────────────── */}
      <Section title="Progress & Budget">
        <MiniBar label="Completion" pct={overallPct}   color={overallColor} />
        {totalBudget > 0 && (
          <>
            <MiniBar label="Budget Burn" pct={budgetPct} color={budgetColor} />
            <div className="flex justify-between px-4 mt-0.5 mb-1">
              <span className="text-[10px] text-muted-foreground">
                Spent {fmtINR(totalActual)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                of {fmtINR(totalBudget)}
              </span>
            </div>
          </>
        )}
        <div className="px-4 mt-2 space-y-0.5">
          <button
            onClick={() => onTabChange("budget")}
            className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
          >
            <TrendingUp className="h-3 w-3" /> View full budget
          </button>
          <button
            onClick={() => onTabChange("milestones")}
            className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
          >
            <Target className="h-3 w-3" /> Payment milestones
          </button>
        </div>
      </Section>

      {/* ── Connected modules ─────────────────────────────────────────────── */}
      <Section title="Connected Modules">
        <ModuleRow
          icon={ShoppingCart}
          label="Procurement"
          badge={openMRs + pendingPOs > 0 ? `${openMRs}MR · ${pendingPOs}PO` : undefined}
          badgeColor={openMRs + pendingPOs > 0 ? "amber" : "muted"}
          onClick={() => onTabChange("mrs")}
          onExternalClick={() => navigate("/procurement/pos")}
        />
        <ModuleRow
          icon={Package2}
          label="Inventory"
          badgeColor="blue"
          onClick={() => navigate("/inventory/allocations")}
          onExternalClick={() => navigate("/inventory/allocations")}
        />
        <ModuleRow
          icon={AlertTriangle}
          label="Issues"
          badge={openIssues > 0 ? openIssues : undefined}
          badgeColor={openIssues > 0 ? "red" : "muted"}
          onClick={() => navigate("/crm/escalations")}
          onExternalClick={() => navigate("/crm/escalations")}
        />
        <ModuleRow
          icon={CheckSquare}
          label="Approvals"
          badgeColor="blue"
          onClick={() => navigate("/approvals")}
          onExternalClick={() => navigate("/approvals")}
        />
        {project.clientPoId && (
          <ModuleRow
            icon={FileText}
            label={`Client PO · ${String(project.clientPoId).padStart(5, "0")}`}
            badgeColor="blue"
            onClick={() => navigate("/crm/client-pos")}
            onExternalClick={() => navigate("/crm/client-pos")}
          />
        )}
      </Section>

      {/* ── Quick tab links ────────────────────────────────────────────────── */}
      <Section title="Workspace" defaultOpen={false}>
        {[
          { value: "activities",  label: "Activities / WBS", Icon: Activity },
          { value: "dprs",        label: "Daily Reports",    Icon: ClipboardList },
          { value: "inspections", label: "Inspections",      Icon: Shield },
          { value: "tc",          label: "Testing & Comm.",  Icon: Zap },
          { value: "handover",    label: "Handover",         Icon: CheckSquare },
          { value: "warranty",    label: "Warranty",         Icon: Shield },
          { value: "closure",     label: "Closure",          Icon: CheckSquare },
        ].map(t => (
          <ModuleRow
            key={t.value}
            icon={t.Icon}
            label={t.label}
            badgeColor="muted"
            onClick={() => onTabChange(t.value)}
          />
        ))}
      </Section>
    </div>
  );
}
