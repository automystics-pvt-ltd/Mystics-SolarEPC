/**
 * FavoriteModules — Quick-nav chips for pages the user has starred in the NavRail.
 * Reads from localStorage["mystics_nav_favorites"] (set by NavRail).
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { Star, LayoutDashboard } from "lucide-react";
import { HREF_META } from "@/components/layout/nav-meta";
import { SectionCard, EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";

const FAVORITES_KEY = "mystics_nav_favorites";

function readFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]"); }
  catch { return []; }
}

export function FavoriteModules() {
  const favorites = useMemo(() => readFavorites(), []);

  return (
    <SectionCard
      title="Favorites"
      subtitle="Your pinned pages"
    >
      {favorites.length === 0 ? (
        <EmptyState
          icon={Star}
          heading="No favorites yet"
          message={`Pin any page by hovering it in the nav rail and clicking ★`}
          size="sm"
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {favorites.slice(0, 12).map((href) => {
            const meta = HREF_META[href];
            const Icon = meta?.icon ?? LayoutDashboard;
            const name = meta?.name ?? href;
            return (
              <Link key={href} href={href}>
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border",
                    "bg-muted/50 hover:bg-muted hover:border-foreground/20 transition-all cursor-pointer",
                    "text-[12px] font-medium text-foreground/80 hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {name}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
