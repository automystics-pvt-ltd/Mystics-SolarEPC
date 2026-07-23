import { ReactNode, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useSidebar } from "@/lib/sidebar-context";
import {
  LayoutDashboard, Users, FolderKanban, ShoppingCart, Warehouse,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

/* ── Bottom nav items for mobile ─────────────────────────────── */
const BOTTOM_TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/crm/leads", icon: Users, label: "CRM" },
  { href: "/projects", icon: FolderKanban, label: "Projects" },
  { href: "/procurement/pos", icon: ShoppingCart, label: "Procurement" },
  { href: "/inventory/warehouses", icon: Warehouse, label: "Inventory" },
];

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const { isCollapsed, toggle } = useSidebar();
  const [location] = useLocation();

  /* ── Auto-collapse on tablet (768–1024px) ── */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");

    const handle = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches && !isCollapsed) toggle();
    };

    handle(mq);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      {/* Sidebar — desktop only */}
      <div className="print:hidden">
        <Sidebar />
      </div>

      {/* Main area */}
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
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 print:hidden
                   safe-area-bottom"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
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
                    "flex flex-col items-center justify-center gap-1 h-full transition-colors",
                    isActive ? "text-[#EA580C]" : "text-gray-400 hover:text-gray-700"
                  )}
                >
                  {isActive && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#EA580C] rounded-full" />
                  )}
                  <tab.icon className="h-5 w-5" aria-hidden />
                  <span className="text-[10px] font-bold tracking-wide">{tab.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
