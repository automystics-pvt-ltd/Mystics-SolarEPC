/**
 * RecentlyAccessed — Shows the last N pages visited by the user,
 * sourced from the shared recentHistory library (also used by Cmd+K).
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { Clock, LayoutDashboard } from "lucide-react";
import { getRecentEntries } from "@/lib/recentHistory";
import { HREF_META } from "@/components/layout/NavRail";
import { SectionCard, EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface RecentlyAccessedProps {
  maxItems?: number;
}

export function RecentlyAccessed({ maxItems = 6 }: RecentlyAccessedProps) {
  const { user } = useAuth();
  const entries = useMemo(
    () => (user?.id ? getRecentEntries(user.id) : []).slice(0, maxItems),
    [user?.id, maxItems]
  );

  return (
    <SectionCard
      title="Recently Accessed"
      subtitle="Your last visited pages"
    >
      {entries.length === 0 ? (
        <EmptyState
          icon={Clock}
          heading="No recent pages"
          message="Pages you visit will appear here for quick access."
          size="sm"
        />
      ) : (
        <div className="space-y-0.5 -mx-1">
          {entries.map((entry) => {
            const meta = HREF_META[entry.href];
            const Icon = meta?.icon ?? LayoutDashboard;
            return (
              <Link key={entry.href} href={entry.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer group",
                    "hover:bg-muted/60"
                  )}
                >
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate leading-snug">
                      {entry.label}
                    </p>
                    {entry.section && (
                      <p className="text-[11px] text-muted-foreground truncate">{entry.section}</p>
                    )}
                  </div>
                  <span className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors text-[13px] shrink-0">
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
