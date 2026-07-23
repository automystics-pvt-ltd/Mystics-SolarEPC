/**
 * KPIRow — Executive KPI cards with trend direction indicators.
 * Each card shows a metric, a trend label, and a coloured icon chip.
 */

import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  FolderKanban, ClipboardCheck, AlertCircle, ShoppingCart,
  TrendingUp, TrendingDown, Minus, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface KPICardDef {
  id: string;
  label: string;
  value: string | number;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  href?: string;
  icon: React.ElementType;
  iconBg: string;      // tailwind bg class
  iconColor: string;   // tailwind text class
  accent: string;      // tailwind border-t class (colored top strip)
}

interface KPIRowProps {
  cards: KPICardDef[];
  isLoading?: boolean;
}

const TrendIcon = ({ dir }: { dir?: "up" | "down" | "flat" }) => {
  if (dir === "up")   return <TrendingUp   className="h-3 w-3 text-emerald-500" />;
  if (dir === "down") return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground/60" />;
};

function KPICard({ card, index }: { card: KPICardDef; index: number }) {
  const Icon = card.icon;
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-5 flex flex-col gap-4",
        "shadow-sm hover:shadow-md transition-shadow duration-200",
        card.href && "cursor-pointer"
      )}
    >
      {/* coloured top accent strip */}
      <div className={cn("absolute top-0 left-0 right-0 h-[3px]", card.accent)} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", card.iconBg)}>
          <Icon className={cn("h-5 w-5", card.iconColor)} />
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <TrendIcon dir={card.trend} />
          {card.trendLabel && (
            <span className={cn(
              "text-[11px] font-medium",
              card.trend === "up"   ? "text-emerald-600 dark:text-emerald-400" :
              card.trend === "down" ? "text-red-600 dark:text-red-400" :
              "text-muted-foreground"
            )}>
              {card.trendLabel}
            </span>
          )}
        </div>
      </div>

      {/* Value */}
      <div>
        <p className="text-2xl font-bold text-foreground tracking-tight leading-none">
          {card.value}
        </p>
        <p className="text-[13px] text-muted-foreground mt-1.5 leading-snug">{card.label}</p>
      </div>
    </motion.div>
  );

  if (card.href) {
    return <Link href={card.href}>{inner}</Link>;
  }
  return inner;
}

function KPISkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div>
        <Skeleton className="h-7 w-20 mb-2" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}

export function KPIRow({ cards, isLoading }: KPIRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <KPISkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <KPICard key={card.id} card={card} index={i} />
      ))}
    </div>
  );
}

/* ── Helpers for building the standard Mystics KPI set ── */

function formatCurrency(v?: number | null): string {
  if (!v) return "₹0";
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)      return `₹${(v / 1_000).toFixed(0)}k`;
  return `₹${v}`;
}

export interface KPIData {
  activeProjects: number;
  revenuePipeline: number;
  pendingApprovals: number;
  overdueTaskCount: number;
  draftPOs: number;
}

export function buildKPICards(data: KPIData): KPICardDef[] {
  return [
    {
      id: "active-projects",
      label: "Active Projects",
      value: data.activeProjects,
      trend: data.activeProjects > 0 ? "up" : "flat",
      trendLabel: data.activeProjects > 0 ? "Live" : "None",
      href: "/projects",
      icon: FolderKanban,
      iconBg: "bg-blue-50 dark:bg-blue-950/40",
      iconColor: "text-blue-600 dark:text-blue-400",
      accent: "bg-blue-500",
    },
    {
      id: "revenue-pipeline",
      label: "Revenue Pipeline",
      value: formatCurrency(data.revenuePipeline),
      trend: data.revenuePipeline > 0 ? "up" : "flat",
      trendLabel: "This FY",
      href: "/crm/quotations",
      icon: DollarSign,
      iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      accent: "bg-emerald-500",
    },
    {
      id: "pending-approvals",
      label: "Pending Approvals",
      value: data.pendingApprovals,
      trend: data.pendingApprovals > 5 ? "down" : data.pendingApprovals > 0 ? "flat" : "up",
      trendLabel: data.pendingApprovals > 0 ? "Need action" : "All clear",
      href: "/procurement/grns",
      icon: ClipboardCheck,
      iconBg: "bg-amber-50 dark:bg-amber-950/40",
      iconColor: "text-amber-600 dark:text-amber-400",
      accent: data.pendingApprovals > 0 ? "bg-amber-500" : "bg-emerald-500",
    },
    {
      id: "overdue-tasks",
      label: "Overdue Tasks",
      value: data.overdueTaskCount,
      trend: data.overdueTaskCount === 0 ? "up" : "down",
      trendLabel: data.overdueTaskCount === 0 ? "On track" : "Overdue",
      href: "/projects",
      icon: AlertCircle,
      iconBg: data.overdueTaskCount > 0
        ? "bg-red-50 dark:bg-red-950/40"
        : "bg-emerald-50 dark:bg-emerald-950/40",
      iconColor: data.overdueTaskCount > 0
        ? "text-red-600 dark:text-red-400"
        : "text-emerald-600 dark:text-emerald-400",
      accent: data.overdueTaskCount > 0 ? "bg-red-500" : "bg-emerald-500",
    },
    {
      id: "draft-pos",
      label: "Draft POs",
      value: data.draftPOs,
      trend: data.draftPOs > 0 ? "flat" : "up",
      trendLabel: data.draftPOs > 0 ? "Pending send" : "All sent",
      href: "/procurement/pos",
      icon: ShoppingCart,
      iconBg: "bg-violet-50 dark:bg-violet-950/40",
      iconColor: "text-violet-600 dark:text-violet-400",
      accent: "bg-violet-500",
    },
  ];
}
