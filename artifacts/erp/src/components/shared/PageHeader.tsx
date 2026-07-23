import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Consistent page-level heading used at the top of every list and detail page.
 */
export function PageHeader({ title, subtitle, badge, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-[22px] font-bold text-foreground leading-tight tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-[13px] text-muted-foreground mt-1 leading-snug max-w-prose">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
