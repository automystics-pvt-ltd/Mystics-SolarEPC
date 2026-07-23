import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DetailRowProps {
  label: string;
  value?: ReactNode;
  mono?: boolean;
  colSpan?: number;
  /** Span across both columns (alias for colSpan={2}) */
  fullWidth?: boolean;
  valueClassName?: string;
}

export function DetailRow({ label, value, mono, colSpan, fullWidth, valueClassName }: DetailRowProps) {
  const span = fullWidth ? 2 : colSpan;
  return (
    <div className={cn(span === 2 && "col-span-2", span === 4 && "col-span-4")}>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <div className={cn(
        "text-[13px] font-semibold text-foreground leading-snug",
        mono && "font-mono",
        valueClassName
      )}>
        {value ?? <span className="text-muted-foreground font-normal">—</span>}
      </div>
    </div>
  );
}

interface DetailGridProps {
  cols?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}

const COL_CLASSES: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

export function DetailGrid({ cols = 4, children, className }: DetailGridProps) {
  return (
    <div className={cn("grid gap-x-6 gap-y-4", COL_CLASSES[cols], className)}>
      {children}
    </div>
  );
}
