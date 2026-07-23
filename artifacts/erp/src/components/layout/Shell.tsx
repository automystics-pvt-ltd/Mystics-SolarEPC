import { ReactNode } from "react";
import { NavRail } from "./NavRail";
import { Topbar } from "./Topbar";
import { LayoutDashboard, Users, FolderKanban, ShoppingCart, Warehouse } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

/* ── Mobile bottom-nav tabs ──────────────────────────────────────── */
const BOTTOM_TABS = [
  { href: "/dashboard",       icon: LayoutDashboard, label: "Home"        },
  { href: "/crm/leads",       icon: Users,           label: "CRM"         },
  { href: "/projects",        icon: FolderKanban,    label: "Projects"    },
  { href: "/procurement/pos", icon: ShoppingCart,    label: "Procurement" },
  { href: "/inventory/warehouses", icon: Warehouse,  label: "Inventory"   },
];

interface ShellProps { children: ReactNode }

export function Shell({ children }: ShellProps) {
  const [location] = useLocation();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background print:block print:h-auto print:overflow-visible">

      {/* ── Desktop: slim icon rail (hidden on mobile) ── */}
      <div className="print:hidden">
        <NavRail />
      </div>

      {/* ── Main column ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 relative print:block print:overflow-visible">

        {/* Sticky topbar */}
        <div className="print:hidden shrink-0">
          <Topbar />
        </div>

        {/* Scrollable page content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto scrollbar-thin print:overflow-visible pb-[calc(1.5rem+4rem)] lg:pb-0"
        >
          <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 print:px-0 print:py-0">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom-tab bar ── */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom,0)" }}
      >
        <div className="flex items-stretch h-16">
          {BOTTOM_TABS.map((tab) => {
            const isActive =
              location === tab.href ||
              (tab.href !== "/projects" && location.startsWith(tab.href + "/")) ||
              (tab.href === "/projects" && location === "/projects");

            return (
              <Link key={tab.href} href={tab.href} className="flex-1">
                <div
                  aria-current={isActive ? "page" : undefined}
                  aria-label={tab.label}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 h-full transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-primary rounded-full" />
                  )}
                  <tab.icon className="h-5 w-5" aria-hidden />
                  <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
