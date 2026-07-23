import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";

interface SystemStatusBarProps {
  lastRefresh: Date;
}

function formatRefreshTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function SystemStatusBar({ lastRefresh }: SystemStatusBarProps) {
  const { isLoading, isError, isSuccess } = useQuery({
    queryKey: ["api-health-ping"],
    queryFn: () => apiGet<unknown>("/dashboard"),
    staleTime: 30_000,
    retry: 1,
  });

  const status = isError
    ? { dot: "bg-red-500", label: "API Degraded", pulse: false }
    : isLoading
    ? { dot: "bg-amber-400", label: "Connecting", pulse: true }
    : isSuccess
    ? { dot: "bg-emerald-500", label: "API Online", pulse: true }
    : { dot: "bg-muted-foreground", label: "Unknown", pulse: false };

  return (
    <div className="px-0 py-2 flex items-center gap-4 text-[11px] text-muted-foreground border-b border-border/60">
      {/* API Status */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2 shrink-0">
          {status.pulse && !isError && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status.dot}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${status.dot}`} />
        </span>
        <span className={isError ? "text-red-500 font-medium" : isLoading ? "text-amber-500 font-medium" : "font-medium text-emerald-600"}>
          {status.label}
        </span>
      </div>

      <span className="text-border">·</span>

      {/* Version */}
      <div className="flex items-center gap-1">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/40" />
        </span>
        <span>v2.4.0</span>
      </div>

      <span className="text-border">·</span>

      {/* Last refresh */}
      <span>Last refresh: {formatRefreshTime(lastRefresh)}</span>

      <span className="text-border">·</span>

      {/* FY */}
      <span className="font-medium">FY 2025-26</span>
    </div>
  );
}
