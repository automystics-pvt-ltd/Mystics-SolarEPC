import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  noPadding?: boolean;
  /** Accent left-border using brand primary */
  accent?: boolean;
  /** Collapsible header — not yet implemented */
  defaultCollapsed?: boolean;
}

/**
 * White card with optional titled header divider.
 * The standard content container across detail and list pages.
 */
export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
  headerClassName,
  bodyClassName,
  noPadding = false,
  accent = false,
}: SectionCardProps) {
  const hasHeader = title || subtitle || actions;

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl overflow-hidden",
        accent && "border-l-[3px] border-l-primary",
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-5 py-3 border-b border-border/60 bg-muted/30",
            headerClassName
          )}
        >
          <div className="min-w-0">
            {title && (
              <p className="text-[13px] font-bold text-foreground leading-tight">{title}</p>
            )}
            {subtitle && (
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}
      <div className={cn(noPadding ? "" : "p-5", bodyClassName)}>{children}</div>
    </div>
  );
}
