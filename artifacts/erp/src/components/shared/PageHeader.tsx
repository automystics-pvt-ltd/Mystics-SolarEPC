import { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabItem {
  label: string;
  value: string;
  count?: number;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Href for the ← back button */
  backHref?: string;
  /** Tab items rendered below the header */
  tabs?: TabItem[];
  /** Currently active tab value */
  activeTab?: string;
  /** Called when a tab is clicked */
  onTabChange?: (value: string) => void;
  /** Shows skeleton placeholder when true */
  loading?: boolean;
  /** Secondary breadcrumb-style content below subtitle */
  meta?: ReactNode;
}

/**
 * Consistent page-level heading used at the top of every list and detail page.
 * Supports back button, tabs, loading skeleton, and meta content.
 */
export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  className,
  backHref,
  tabs,
  activeTab,
  onTabChange,
  loading,
  meta,
}: PageHeaderProps) {
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className={cn("mb-6", className)} aria-busy="true">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="h-7 w-48 bg-muted rounded-md animate-pulse" />
            <div className="h-4 w-72 bg-muted rounded-md animate-pulse mt-2" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-24 bg-muted rounded-md animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mb-6", className)}>
      {/* Back button */}
      {backHref && (
        <button
          onClick={() => navigate(backHref)}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-3 group"
          aria-label="Go back"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
      )}

      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[20px] sm:text-[22px] font-bold text-foreground leading-tight tracking-tight">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-[13px] text-muted-foreground mt-1 leading-snug max-w-prose">
              {subtitle}
            </p>
          )}
          {meta && (
            <div className="mt-1.5 text-[12px] text-muted-foreground/80 flex items-center gap-1.5 flex-wrap">
              {meta}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Tabs row */}
      {tabs && tabs.length > 0 && (
        <div
          className="flex items-center gap-1 border-b border-border/60 -mx-1 px-1 mt-3 overflow-x-auto scrollbar-none"
          role="tablist"
          aria-label="Page tabs"
        >
          {tabs.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={activeTab === tab.value}
              onClick={() => onTabChange?.(tab.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                activeTab === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "h-4 min-w-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center",
                    activeTab === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {tab.count > 99 ? "99+" : tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
