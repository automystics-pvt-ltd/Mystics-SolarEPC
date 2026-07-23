import { useLocation } from "wouter";
import {
  Users,
  ShoppingCart,
  Package,
  Calendar,
  BarChart3,
  FolderKanban,
} from "lucide-react";
import { SectionCard } from "@/components/shared";
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
    label: "New Lead",
    icon: Users,
    href: "/crm/leads",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    label: "New PO",
    icon: ShoppingCart,
    href: "/procurement/pos/new",
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50 dark:bg-orange-950/40",
    roles: ["admin", "pm", "director"],
  },
  {
    label: "Record GRN",
    icon: Package,
    href: "/procurement/grns/new",
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
    roles: ["warehouse", "admin"],
  },
  {
    label: "Schedule Maintenance",
    icon: Calendar,
    href: "/oam/maintenance",
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50 dark:bg-amber-950/40",
    roles: ["admin", "pm", "director"],
  },
  {
    label: "View Reports",
    icon: BarChart3,
    href: "/reports",
    iconColor: "text-violet-600",
    iconBg: "bg-violet-50 dark:bg-violet-950/40",
    roles: ["finance", "admin", "director"],
  },
  {
    label: "New Project",
    icon: FolderKanban,
    href: "/projects",
    iconColor: "text-slate-600 dark:text-slate-400",
    iconBg: "bg-slate-100 dark:bg-slate-800",
    roles: ["admin", "pm", "director"],
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
    <SectionCard title="Quick Actions" subtitle="Common shortcuts">
      <div className="grid grid-cols-3 gap-2">
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
                "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-transparent",
                "bg-muted/40 hover:bg-muted/70 hover:border-border transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group"
              )}
            >
              <div
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
                  action.iconBg
                )}
              >
                <Icon className={cn("h-4.5 w-4.5", action.iconColor)} style={{ width: "18px", height: "18px" }} />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground text-center leading-tight transition-colors">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
