import { Calendar, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard, SkeletonList } from "@/components/shared";

export interface UpcomingItem {
  id: string | number;
  title: string;
  dueDate?: string;
  project?: string;
  type: "milestone" | "task" | "deadline";
  overdue?: boolean;
}

interface UpcomingTasksPanelProps {
  items: UpcomingItem[];
  isLoading?: boolean;
}

function formatDueDate(date?: string): string {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    }).format(new Date(date));
  } catch {
    return date;
  }
}

export function UpcomingTasksPanel({ items, isLoading }: UpcomingTasksPanelProps) {
  if (isLoading) {
    return (
      <SectionCard title="Upcoming" subtitle="Next 30 days">
        <SkeletonList rows={4} cols={2} className="border-0 rounded-none" />
      </SectionCard>
    );
  }

  // Sort: overdue first, then by date
  const sorted = [...items]
    .sort((a, b) => {
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    })
    .slice(0, 6);

  return (
    <SectionCard title="Upcoming" subtitle="Next 30 days">
      {sorted.length === 0 ? (
        <p className="text-[13px] text-muted-foreground text-center py-8">
          No upcoming tasks in the next 30 days.
        </p>
      ) : (
        <div className="divide-y divide-border/60 -mx-5">
          {sorted.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className={cn(
                "flex items-center gap-3 px-5 py-3",
                item.overdue && "bg-red-50/60"
              )}
            >
              {/* Icon */}
              <div className="shrink-0">
                {item.overdue ? (
                  <Flag className="h-4 w-4 text-red-500" />
                ) : (
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-[13px] font-medium leading-snug",
                    item.overdue ? "text-red-700" : "text-foreground"
                  )}
                >
                  {item.title}
                </p>
                {item.project && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {item.project}
                  </p>
                )}
              </div>

              {/* Date chip */}
              {item.dueDate && (
                <span
                  className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0",
                    item.overdue
                      ? "bg-red-50 text-red-600 border border-red-200"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.overdue && "Overdue · "}
                  {formatDueDate(item.dueDate)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
