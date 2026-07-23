import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface TimelineItem {
  id: string | number;
  title: string;
  description?: ReactNode;
  timestamp?: string;
  user?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  badge?: ReactNode;
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cn("relative", className)}>
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isLast = idx === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-4 pb-5 last:pb-0">
            {/* Vertical line */}
            {!isLast && (
              <div className="absolute left-[14px] top-7 bottom-0 w-px bg-border/60" />
            )}
            {/* Icon bubble */}
            <div
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center shrink-0 ring-2 ring-background z-[1]",
                item.iconClassName ?? "bg-muted text-muted-foreground"
              )}
            >
              {Icon ? (
                <Icon className="h-3.5 w-3.5" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-current" />
              )}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <p className="text-[13px] font-medium text-foreground leading-snug">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {item.badge}
                  {item.timestamp && (
                    <time className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {item.timestamp}
                    </time>
                  )}
                </div>
              </div>
              {item.description && (
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                  {item.description}
                </p>
              )}
              {item.user && (
                <p className="text-[11px] text-muted-foreground/70 mt-1">by {item.user}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
