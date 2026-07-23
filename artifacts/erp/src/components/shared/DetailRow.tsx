import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DetailRowProps {
  label: string;
  value?: ReactNode;
  /** Span full width of the grid */
  fullWidth?: boolean;
  className?: string;
  /** Show — when value is empty */
  fallback?: string;
  /** Monospace font for codes/IDs */
  mono?: boolean;
  /** Copyable value — show copy icon */
  copyable?: boolean;
}

export function DetailRow({
  label,
  value,
  fullWidth,
  className,
  fallback = "—",
  mono,
  copyable,
}: DetailRowProps) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div className={cn("flex flex-col gap-0.5", fullWidth && "col-span-2", className)}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-[13px] text-foreground leading-snug",
          mono && "font-mono text-[12px]",
          isEmpty && "text-muted-foreground/60"
        )}
      >
        {isEmpty ? fallback : value}
      </dd>
    </div>
  );
}

/** Wrap DetailRows in this grid container */
export function DetailGrid({
  children,
  cols = 2,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-8 gap-y-4",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-3",
        cols === 4 && "grid-cols-2 lg:grid-cols-4"
      )}
    >
      {children}
    </dl>
  );
}
