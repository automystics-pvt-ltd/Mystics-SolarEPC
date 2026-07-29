import { useLocation } from "wouter";
import {
  Users,
  ShoppingCart,
  Package,
  Calendar,
  BarChart3,
  FolderKanban,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface QuickAction {
  label: string;
  icon: typeof Users;
  href: string;
  iconColor: string;
  iconBg: string;
  roles?: string[];
}

const ALL_ACTIONS: QuickAction[] = [
  {
    label: "New Project",
    icon: FolderKanban,
    href: "/projects",
    iconColor: "text-slate-600 dark:text-slate-400",
    iconBg: "bg-slate-100 dark:bg-slate-800",
    roles: ["admin", "pm", "director"],
  },
  {
    label: "New Lead",
    icon: Users,
    href: "/crm/leads",
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-blue-950/50",
  },
  {
    label: "New PO",
    icon: ShoppingCart,
    href: "/procurement/pos/new",
    iconColor: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-50 dark:bg-orange-950/50",
    roles: ["admin", "pm", "director"],
  },
  {
    label: "Record GRN",
    icon: Package,
    href: "/procurement/grns/new",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/50",
    roles: ["warehouse", "admin"],
  },
  {
    label: "Schedule Maintenance",
    icon: Calendar,
    href: "/oam/maintenance",
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 dark:bg-amber-950/50",
    roles: ["admin", "pm", "director"],
  },
  {
    label: "View Reports",
    icon: BarChart3,
    href: "/reports",
    iconColor: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-50 dark:bg-violet-950/50",
    roles: ["finance", "admin", "director"],
  },
];

export function QuickActionsGrid() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const role = (user as any)?.role ?? "";

  const actions = ALL_ACTIONS.filter(
    (a) => !a.roles || a.roles.includes(role)
  );

  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-card border border-border rounded-xl flex-wrap">
      {/* Label */}
      <div className="flex items-center gap-1.5 mr-2 shrink-0">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap select-none">
          Quick Actions
        </span>
      </div>
      <div className="w-px h-5 bg-border mr-2 shrink-0 hidden sm:block" />

      {/* Action buttons */}
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            tabIndex={0}
            onClick={() => setLocation(action.href)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLocation(action.href);
              }
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium",
              "border border-transparent bg-muted/50",
              "hover:bg-muted hover:border-border/70",
              "active:scale-[0.97]",
              "transition-all duration-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "group whitespace-nowrap"
            )}
          >
            <div
              className={cn(
                "h-5 w-5 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                action.iconBg
              )}
            >
              <Icon className={cn("h-3 w-3", action.iconColor)} />
            </div>
            <span className="text-foreground/80 group-hover:text-foreground transition-colors">
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
