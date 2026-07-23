import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export interface AlertItem {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  action?: { label: string; href: string };
}

interface AlertsPanelProps {
  alerts: AlertItem[];
}

const severityConfig = {
  critical: {
    dot: "bg-red-500",
    border: "border-l-red-500",
    titleColor: "text-red-700",
    bg: "bg-red-50",
    outerBg: "bg-red-50 border-red-200",
  },
  warning: {
    dot: "bg-amber-400",
    border: "border-l-amber-400",
    titleColor: "text-amber-700",
    bg: "bg-amber-50",
    outerBg: "bg-amber-50 border-amber-200",
  },
  info: {
    dot: "bg-blue-400",
    border: "border-l-blue-400",
    titleColor: "text-blue-700",
    bg: "bg-blue-50",
    outerBg: "bg-blue-50 border-blue-200",
  },
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [, setLocation] = useLocation();

  if (!alerts || alerts.length === 0) return null;

  const hasCritical = alerts.some((a) => a.severity === "critical");
  const panelBg = hasCritical
    ? "bg-red-50 border-red-200"
    : "bg-amber-50 border-amber-200";
  const headerColor = hasCritical ? "text-red-800" : "text-amber-800";

  return (
    <div className={cn("border rounded-xl overflow-hidden", panelBg)}>
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 cursor-pointer select-none",
          hasCritical ? "bg-red-100/60 border-b border-red-200" : "bg-amber-100/60 border-b border-amber-200"
        )}
        onClick={() => setCollapsed(!collapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className={cn("text-[13px] font-bold", headerColor)}>
            Attention Required
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
              hasCritical
                ? "text-red-700 border-red-300 bg-white/70"
                : "text-amber-700 border-amber-300 bg-white/70"
            )}
          >
            {alerts.length}
          </Badge>
        </div>
        <button
          className={cn("p-0.5 rounded", hasCritical ? "text-red-600" : "text-amber-600")}
          aria-label={collapsed ? "Expand alerts" : "Collapse alerts"}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {/* Alert rows */}
      {!collapsed && (
        <div className="divide-y divide-border/40">
          {alerts.map((alert) => {
            const cfg = severityConfig[alert.severity];
            return (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 border-l-[3px]",
                  alert.severity === "critical" ? "border-l-red-500 bg-white/40" : alert.severity === "warning" ? "border-l-amber-400 bg-white/40" : "border-l-blue-400 bg-white/40"
                )}
              >
                {/* Dot */}
                <div className="pt-1 shrink-0">
                  <span className={cn("inline-flex h-2 w-2 rounded-full", cfg.dot)} />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[13px] font-semibold", cfg.titleColor)}>
                    {alert.title}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                    {alert.description}
                  </p>
                </div>
                {/* Action */}
                {alert.action && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] shrink-0 border-border/60"
                    onClick={() => setLocation(alert.action!.href)}
                  >
                    {alert.action.label}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
