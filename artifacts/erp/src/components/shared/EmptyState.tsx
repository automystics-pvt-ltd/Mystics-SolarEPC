import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "outline";
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Consistent empty state — use when a list or section has no data.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  const s = {
    sm: { iconWrap: "h-12 w-12", icon: "h-6 w-6",  title: "text-[13px]", desc: "text-[12px]", py: "py-8" },
    md: { iconWrap: "h-16 w-16", icon: "h-8 w-8",  title: "text-sm",     desc: "text-[13px]", py: "py-12" },
    lg: { iconWrap: "h-20 w-20", icon: "h-10 w-10", title: "text-base",   desc: "text-sm",     py: "py-16" },
  }[size];

  return (
    <div className={cn("flex flex-col items-center text-center", s.py, className)}>
      <div
        className={cn(
          "rounded-2xl bg-muted flex items-center justify-center mb-4",
          s.iconWrap
        )}
      >
        <Icon className={cn(s.icon, "text-muted-foreground/40")} strokeWidth={1.5} />
      </div>
      <p className={cn("font-semibold text-foreground mb-1", s.title)}>{title}</p>
      {description && (
        <p className={cn("text-muted-foreground max-w-[280px] leading-snug", s.desc)}>
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 mt-5 flex-wrap justify-center">
          {action && (
            <Button
              size="sm"
              className={cn(
                "gap-1.5",
                action.variant === "outline"
                  ? "border-border text-foreground hover:bg-muted"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              )}
              variant={action.variant === "outline" ? "outline" : "default"}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground gap-1.5"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
