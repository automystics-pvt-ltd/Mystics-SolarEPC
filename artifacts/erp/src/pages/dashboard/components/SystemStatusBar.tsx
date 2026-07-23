import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { RefreshCw } from "lucide-react";

interface SystemStatusBarProps {
  lastRefresh: Date;
  isRefreshing?: boolean;
}

function formatRefreshTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function getFY(): string {
  const today = new Date();
  const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `FY ${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`;
}

export function SystemStatusBar({ lastRefresh, isRefreshing }: SystemStatusBarProps) {
  const { isLoading, isError, isSuccess } = useQuery({
    queryKey: ["api-health-ping"],
    queryFn: () => apiGet<unknown>("/dashboard"),
    staleTime: 30_000,
    retry: 1,
  });

  const status = isError
    ? { dot: "bg-red-500", label: "API Degraded", cls: "text-red-500" }
    : isLoading
    ? { dot: "bg-amber-400", label: "Connecting…", cls: "text-amber-500" }
    : isSuccess
    ? { dot: "bg-emerald-500", label: "All Systems Operational", cls: "text-emerald-600 dark:text-emerald-400" }
    : { dot: "bg-muted-foreground", label: "Unknown", cls: "text-muted-foreground" };

  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
      {/* API Status */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2 shrink-0">
          {isSuccess && !isError && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${status.dot}`} />
        </span>
        <span className={`font-medium ${status.cls}`}>{status.label}</span>
      </div>

      <span className="text-border/60">·</span>

      {/* Last refresh */}
      <div className="flex items-center gap-1.5">
        {isRefreshing ? (
          <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : null}
        <span>Last updated: {formatRefreshTime(lastRefresh)}</span>
      </div>

      <span className="text-border/60">·</span>

      {/* FY indicator */}
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
        <span className="font-semibold text-foreground/70">{getFY()}</span>
      </div>

      <span className="text-border/60">·</span>

      <span>v2.4.0</span>
    </div>
  );
}
