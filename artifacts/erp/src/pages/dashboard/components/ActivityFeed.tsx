import { useLocation } from "wouter";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SectionCard, EmptyState, SkeletonList } from "@/components/shared";

export interface ActivityItem {
  id: string | number;
  type: "lead" | "project" | "po" | "grn" | "invoice" | "milestone";
  title: string;
  subtitle?: string;
  timestamp?: string;
  status?: string;
  href?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  isLoading?: boolean;
}

const typeColors: Record<ActivityItem["type"], string> = {
  lead: "bg-blue-500",
  project: "bg-emerald-500",
  po: "bg-orange-500",
  grn: "bg-violet-500",
  invoice: "bg-amber-500",
  milestone: "bg-cyan-500",
};

function formatTimestamp(ts?: string): string {
  if (!ts) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <SectionCard title="Recent Activity">
        <SkeletonList rows={5} cols={3} className="border-0 rounded-none" />
      </SectionCard>
    );
  }

  const visible = items.slice(0, 8);

  return (
    <SectionCard title="Recent Activity">
      {visible.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No recent activity"
          description="Activity from leads, projects, and procurement will appear here."
          size="sm"
        />
      ) : (
        <div className="relative">
          {visible.map((item, idx) => {
            const dotColor = typeColors[item.type] ?? "bg-muted-foreground";
            const isLast = idx === visible.length - 1;

            return (
              <div key={`${item.id}-${idx}`} className="flex gap-3">
                {/* Timeline column */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ring-2 ring-background",
                      dotColor
                    )}
                  />
                  {!isLast && (
                    <div className="w-px flex-1 bg-border/60 mt-1 mb-1" />
                  )}
                </div>

                {/* Content */}
                <div className={cn("flex-1 pb-4 min-w-0", isLast && "pb-0")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {item.href ? (
                        <button
                          className="text-[13px] font-medium text-foreground hover:text-orange-500 transition-colors text-left leading-snug"
                          onClick={() => setLocation(item.href!)}
                        >
                          {item.title}
                        </button>
                      ) : (
                        <p className="text-[13px] font-medium text-foreground leading-snug">
                          {item.title}
                        </p>
                      )}
                      {item.subtitle && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status && (
                        <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0.5 h-auto">
                          {item.status}
                        </Badge>
                      )}
                      {item.timestamp && (
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(item.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
