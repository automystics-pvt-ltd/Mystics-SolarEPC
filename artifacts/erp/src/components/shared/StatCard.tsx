import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number | ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}

/** KPI / stat card for dashboards and module headers. */
export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  trend,
  trendLabel,
  onClick,
  className,
  compact = false,
}: StatCardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
      ? "text-red-500 dark:text-red-400"
      : "text-muted-foreground";

  const El = onClick ? "button" : "div";

  return (
    <El
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className={cn(
        "bg-card border border-border rounded-xl text-left transition-all",
        compact ? "p-3.5" : "p-4",
        onClick && "cursor-pointer hover:shadow-md hover:border-border/80",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground mb-1 truncate">
            {label}
          </p>
          <div
            className={cn(
              "font-bold text-foreground leading-tight tabular-nums break-words",
              compact ? "text-[18px] sm:text-[20px]" : "text-[20px] sm:text-[24px]"
            )}
          >
            {value}
          </div>
          {trendLabel && (
            <div className={cn("flex items-center gap-1 mt-1.5", trendColor)}>
              <TrendIcon className="h-3 w-3 shrink-0" />
              <span className="text-[11px] font-medium">{trendLabel}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "rounded-xl flex items-center justify-center shrink-0",
              iconBg,
              compact ? "h-9 w-9" : "h-11 w-11"
            )}
          >
            <Icon className={cn("shrink-0", iconColor, compact ? "h-4 w-4" : "h-5 w-5")} />
          </div>
        )}
      </div>
    </El>
  );
}

interface CompactStatCardProps {
  label: string;
  value: string | number | ReactNode;
  icon?: LucideIcon;
  className?: string;
}

/** Compact KPI chip — for dense sections and sidebar summaries. */
export function CompactStatCard({ label, value, icon: Icon, className }: CompactStatCardProps) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-3 flex items-center gap-3", className)}>
      {Icon && (
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {label}
        </p>
        <div className="text-[18px] font-bold text-foreground tabular-nums leading-tight">
          {value}
        </div>
      </div>
    </div>
  );
}
