import { useGetProjectDashboard, getGetProjectDashboardQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { ShoppingCart, Package2, CheckSquare, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface CrossModuleBarProps {
  projectId: number;
  clientPoId?: number | null;
  onTabChange: (tab: string) => void;
}

export function CrossModuleBar({ projectId, clientPoId, onTabChange }: CrossModuleBarProps) {
  const [, navigate] = useLocation();

  const { data } = useGetProjectDashboard(projectId, {
    query: {
      queryKey: getGetProjectDashboardQueryKey(projectId),
      staleTime: 2 * 60_000,
      enabled: !!projectId,
    },
  });

  const openMRs     = (data as any)?.openMRsCount ?? 0;
  const pendingPOs  = (data as any)?.pendingPOsCount ?? 0;
  const openIssues  = (data as any)?.openEscalationsCount ?? 0;

  const hasProcurement = openMRs > 0 || pendingPOs > 0;

  return (
    <div className="flex items-center gap-2 py-2.5 px-1 overflow-x-auto scrollbar-none">
      <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.12em] shrink-0">
        Connected
      </span>

      {/* Procurement */}
      <Pill
        icon={ShoppingCart}
        label="Procurement"
        metric={hasProcurement ? `${openMRs} MR · ${pendingPOs} PO` : "No open records"}
        active={hasProcurement}
        colorClass={hasProcurement
          ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400"
          : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"}
        onClick={() => onTabChange("mrs")}
        onExternalClick={() => navigate("/procurement/pos")}
      />

      {/* Inventory */}
      <Pill
        icon={Package2}
        label="Inventory"
        metric="Allocations"
        active={false}
        colorClass="bg-muted/30 border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        onClick={() => navigate("/inventory/allocations")}
        onExternalClick={() => navigate("/inventory/allocations")}
      />

      {/* Approvals */}
      <Pill
        icon={CheckSquare}
        label="Approvals"
        metric={openIssues > 0 ? `${openIssues} open` : "Up to date"}
        active={openIssues > 0}
        colorClass={openIssues > 0
          ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-400"
          : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"}
        onClick={() => navigate("/approvals")}
        onExternalClick={() => navigate("/approvals")}
      />

      {/* Client PO / Quotation */}
      {!!clientPoId && (
        <Pill
          icon={FileText}
          label="Client PO"
          metric={`PO-${String(clientPoId).padStart(4, "0")}`}
          active
          colorClass="bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/30 dark:border-violet-700 dark:text-violet-400"
          onClick={() => navigate("/crm/client-pos")}
          onExternalClick={() => navigate("/crm/client-pos")}
        />
      )}
    </div>
  );
}

function Pill({
  icon: Icon,
  label,
  metric,
  active,
  colorClass,
  onClick,
  onExternalClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  metric: string;
  active: boolean;
  colorClass: string;
  onClick: () => void;
  onExternalClick: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center rounded-full border text-[11px] font-medium whitespace-nowrap transition-all hover:shadow-sm overflow-hidden cursor-pointer select-none",
        colorClass
      )}
    >
      {/* main click area: switches tab */}
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 pl-3 pr-2 py-1.5"
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="font-semibold">{label}</span>
        <span className={cn("text-[10px]", active ? "opacity-80" : "opacity-60")}>{metric}</span>
      </button>

      {/* external link: navigates to module */}
      <button
        onClick={(e) => { e.stopPropagation(); onExternalClick(); }}
        className="flex items-center px-2 py-1.5 border-l border-current/20 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
        title={`Open ${label} module`}
      >
        <ExternalLink className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
