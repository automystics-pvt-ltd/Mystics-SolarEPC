import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
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
  entityRef?: string;
  time?: string;
}

interface AlertsPanelProps {
  alerts: AlertItem[];
}

const severityConfig = {
  critical: {
    dot: "bg-red-500",
    icon: AlertTriangle,
    iconColor: "text-red-500",
    rowBg: "hover:bg-red-50/50 dark:hover:bg-red-950/20",
    border: "border-l-red-500",
    titleColor: "text-red-700 dark:text-red-400",
    badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
  },
  warning: {
    dot: "bg-amber-400",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    rowBg: "hover:bg-amber-50/50 dark:hover:bg-amber-950/20",
    border: "border-l-amber-400",
    titleColor: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  },
  info: {
    dot: "bg-blue-400",
    icon: Info,
    iconColor: "text-blue-500",
    rowBg: "hover:bg-blue-50/50 dark:hover:bg-blue-950/20",
    border: "border-l-blue-400",
    titleColor: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  },
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [, setLocation] = useLocation();

  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[13px] text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="font-medium">All caught up — no urgent items require your attention</span>
      </div>
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const hasCritical = criticalCount > 0;

  return (
    <div
      className={cn(
        "border rounded-xl overflow-hidden",
        hasCritical
          ? "border-red-200 dark:border-red-800"
          : "border-amber-200 dark:border-amber-800"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 cursor-pointer select-none border-b",
          hasCritical
            ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
            : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
        )}
        onClick={() => setCollapsed(!collapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2.5">
          <AlertTriangle
            className={cn("h-4 w-4", hasCritical ? "text-red-500" : "text-amber-500")}
          />
          <span
            className={cn(
              "text-[13px] font-bold",
              hasCritical
                ? "text-red-800 dark:text-red-300"
                : "text-amber-800 dark:text-amber-300"
            )}
          >
            Action Required
          </span>
          <div className="flex items-center gap-1.5">
            {criticalCount > 0 && (
              <Badge className="text-[10px] font-bold px-1.5 py-0 h-5 bg-red-500 hover:bg-red-500 text-white border-0">
                {criticalCount} critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="text-[10px] font-bold px-1.5 py-0 h-5 bg-amber-400 hover:bg-amber-400 text-white border-0">
                {warningCount} warning
              </Badge>
            )}
          </div>
        </div>
        <button
          className={cn(
            "p-0.5 rounded transition-colors",
            hasCritical
              ? "text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40"
              : "text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40"
          )}
          aria-label={collapsed ? "Expand alerts" : "Collapse alerts"}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {/* Alert rows */}
      {!collapsed && (
        <div className="bg-card divide-y divide-border/40">
          {alerts.map((alert) => {
            const cfg = severityConfig[alert.severity];
            const AlertIcon = cfg.icon;
            return (
              <div
                key={alert.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 border-l-[3px] transition-colors",
                  cfg.border,
                  cfg.rowBg,
                  alert.action && "cursor-pointer"
                )}
                onClick={() => alert.action && setLocation(alert.action.href)}
                role={alert.action ? "button" : undefined}
                tabIndex={alert.action ? 0 : undefined}
                onKeyDown={(e) => {
                  if (alert.action && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setLocation(alert.action.href);
                  }
                }}
              >
                <AlertIcon className={cn("h-4 w-4 shrink-0 mt-0.5", cfg.iconColor)} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[13px] font-semibold", cfg.titleColor)}>
                    {alert.title}
                    {alert.entityRef && (
                      <span className="ml-1.5 text-[11px] font-mono opacity-70">
                        {alert.entityRef}
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                    {alert.description}
                  </p>
                </div>
                {alert.time && (
                  <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                    {alert.time}
                  </span>
                )}
                {alert.action && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] shrink-0 gap-1 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(alert.action!.href);
                    }}
                  >
                    {alert.action.label}
                    <ArrowRight className="h-3 w-3" />
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
