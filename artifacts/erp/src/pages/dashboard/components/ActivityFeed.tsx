import { useLocation } from "wouter";
import {
  Activity,
  Users,
  FolderKanban,
  ShoppingCart,
  Package,
  FileText,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard, EmptyState, SkeletonList } from "@/components/shared";

export interface ActivityItem {
  id: string | number;
  type: "lead" | "project" | "po" | "grn" | "invoice" | "milestone";
  title: string;
  subtitle?: string;
  timestamp?: string;
  status?: string;
  href?: string;
  actor?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  isLoading?: boolean;
}

const typeConfig: Record<
  ActivityItem["type"],
  { bg: string; icon: typeof Users; label: string }
> = {
  lead: { bg: "bg-blue-500", icon: Users, label: "Lead" },
  project: { bg: "bg-emerald-500", icon: FolderKanban, label: "Project" },
  po: { bg: "bg-orange-500", icon: ShoppingCart, label: "PO" },
  grn: { bg: "bg-violet-500", icon: Package, label: "GRN" },
  invoice: { bg: "bg-amber-500", icon: FileText, label: "Invoice" },
  milestone: { bg: "bg-cyan-500", icon: Flag, label: "Milestone" },
};

function timeAgo(ts?: string): string {
  if (!ts) return "";
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(
      new Date(ts)
    );
  } catch {
    return "";
  }
}

function getInitials(name?: string): string {
  if (!name) return "•";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <SectionCard title="Activity Feed" subtitle="Recent events across all modules">
        <SkeletonList rows={6} cols={3} className="border-0 rounded-none" />
      </SectionCard>
    );
  }

  const visible = items.slice(0, 10);

  return (
    <SectionCard title="Activity Feed" subtitle="Recent events across all modules">
      {visible.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No recent activity"
          description="Events from leads, projects, and procurement will appear here."
          size="sm"
        />
      ) : (
        <div className="space-y-1 -mx-1">
          {visible.map((item, idx) => {
            const cfg = typeConfig[item.type] ?? typeConfig.milestone;
            const TypeIcon = cfg.icon;
            const initials = getInitials(item.actor ?? item.subtitle);
            const ago = timeAgo(item.timestamp);

            return (
              <div
                key={`${item.id}-${idx}`}
                className={cn(
                  "flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                  item.href && "cursor-pointer hover:bg-muted/50"
                )}
                onClick={() => item.href && setLocation(item.href)}
                role={item.href ? "button" : undefined}
                tabIndex={item.href ? 0 : undefined}
                onKeyDown={(e) => {
                  if (item.href && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setLocation(item.href);
                  }
                }}
              >
                {/* Avatar circle */}
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-[11px]",
                    cfg.bg
                  )}
                >
                  {initials !== "•" ? initials : <TypeIcon className="h-3.5 w-3.5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground leading-snug">
                    <span className="font-semibold">{item.actor ?? cfg.label}</span>{" "}
                    <span className="text-muted-foreground">{item.title}</span>
                  </p>
                  {item.subtitle && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {item.subtitle}
                    </p>
                  )}
                </div>

                {/* Time + arrow */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {ago && (
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {ago}
                    </span>
                  )}
                  {item.href && (
                    <span className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors text-[11px]">
                      →
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
