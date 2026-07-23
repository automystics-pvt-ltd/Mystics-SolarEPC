import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface KbdProps {
  children: ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono text-[10px] font-medium",
        "bg-muted border border-border text-muted-foreground leading-none",
        className
      )}
    >
      {children}
    </kbd>
  );
}
