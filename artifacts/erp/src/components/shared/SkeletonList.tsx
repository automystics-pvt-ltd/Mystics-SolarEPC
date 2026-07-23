import { cn } from "@/lib/utils";

function SkeletonRow({ cols = 3, className }: { cols?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 px-4 py-3.5 border-b border-border/60 last:border-0", className)}>
      <div className="h-9 w-9 bg-muted rounded-lg animate-pulse shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="h-3.5 bg-muted rounded-full animate-pulse w-1/3" />
        {cols >= 2 && <div className="h-3 bg-muted rounded-full animate-pulse w-2/3" />}
      </div>
      {cols >= 3 && (
        <div className="h-5 w-16 bg-muted rounded-full animate-pulse shrink-0" />
      )}
      {cols >= 4 && (
        <div className="h-5 w-20 bg-muted rounded-full animate-pulse shrink-0 hidden sm:block" />
      )}
    </div>
  );
}

/** Shimmer list skeleton — drop this anywhere data is loading. */
export function SkeletonList({
  rows = 6,
  cols = 3,
  className,
  showHeader = false,
}: {
  rows?: number;
  cols?: number;
  className?: string;
  showHeader?: boolean;
}) {
  return (
    <div className={cn("bg-card border border-border rounded-xl overflow-hidden", className)}>
      {showHeader && (
        <div className="h-12 border-b border-border/60 px-4 flex items-center gap-3">
          <div className="h-3.5 bg-muted rounded-full animate-pulse w-28" />
          <div className="ml-auto h-7 w-20 bg-muted rounded-lg animate-pulse" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </div>
  );
}

/** Shimmer KPI card grid. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 ${count <= 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-3 bg-muted rounded-full animate-pulse w-20" />
            <div className="h-9 w-9 bg-muted rounded-xl animate-pulse" />
          </div>
          <div className="h-7 bg-muted rounded-full animate-pulse w-16" />
        </div>
      ))}
    </div>
  );
}
