import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
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
  /** Enable collapse toggle */
  collapsible?: boolean;
  /** Initial collapsed state (only used when collapsible=true) */
  defaultCollapsed?: boolean;
  /** Badge displayed in header next to title */
  badge?: ReactNode;
  /** Content rendered below body with a divider */
  footer?: ReactNode;
  /** Shows skeleton rows in body when true */
  isLoading?: boolean;
}

/**
 * White card with optional titled header divider.
 * The standard content container across detail and list pages.
 * Supports collapsing, badge, footer, and loading skeleton.
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
  collapsible = false,
  defaultCollapsed = false,
  badge,
  footer,
  isLoading = false,
}: SectionCardProps) {
  const [collapsed, setCollapsed] = useState(collapsible ? defaultCollapsed : false);

  const hasHeader = title || subtitle || actions || badge;

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
            collapsible && collapsed && "border-b-0",
            collapsible && "cursor-pointer select-none",
            headerClassName
          )}
          onClick={collapsible ? () => setCollapsed((c) => !c) : undefined}
          role={collapsible ? "button" : undefined}
          aria-expanded={collapsible ? !collapsed : undefined}
          tabIndex={collapsible ? 0 : undefined}
          onKeyDown={
            collapsible
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setCollapsed((c) => !c);
                  }
                }
              : undefined
          }
        >
          <div className="min-w-0 flex items-center gap-2">
            <div className="min-w-0">
              {title && (
                <p className="text-[13px] font-bold text-foreground leading-tight">{title}</p>
              )}
              {subtitle && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{subtitle}</p>
              )}
            </div>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actions && (
              <div
                className="flex items-center gap-2"
                onClick={(e) => collapsible && e.stopPropagation()}
              >
                {actions}
              </div>
            )}
            {collapsible && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  collapsed && "-rotate-90"
                )}
              />
            )}
          </div>
        </div>
      )}

      {!collapsed && (
        <>
          <div className={cn(noPadding ? "" : "p-5", bodyClassName)}>
            {isLoading ? (
              <div className="space-y-3" aria-busy="true">
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
              </div>
            ) : (
              children
            )}
          </div>
          {footer && !isLoading && (
            <div className="border-t border-border/60 px-5 py-3 bg-muted/20">
              {footer}
            </div>
          )}
        </>
      )}
    </div>
  );
}
