import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, FileText, FileCheck, FilePlus, CheckSquare,
  AlertTriangle, FolderKanban, HardHat, Warehouse, Boxes, Truck,
  BookOpen, Scale, ClipboardCheck, ChevronLeft, ChevronRight,
  LogOut, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useSidebar } from "@/lib/sidebar-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const MODULES = [
  {
    section: "CORE",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "SALES & CRM",
    items: [
      { name: "Leads", href: "/crm/leads", icon: Users },
      { name: "Quotations", href: "/crm/quotations", icon: FileText },
      { name: "Client POs", href: "/crm/client-pos", icon: FileCheck },
      { name: "Invoices", href: "/crm/invoices", icon: FilePlus },
      { name: "Tasks", href: "/crm/tasks", icon: CheckSquare },
      { name: "Escalations", href: "/crm/escalations", icon: AlertTriangle },
    ],
  },
  {
    section: "PROJECT MGMT",
    items: [
      { name: "Projects Hub", href: "/projects", icon: FolderKanban },
      { name: "Contractors", href: "/projects/contractors", icon: HardHat },
    ],
  },
  {
    section: "INVENTORY",
    items: [
      { name: "Warehouses", href: "/inventory/warehouses", icon: Warehouse },
      { name: "GRNs", href: "/inventory/grns", icon: Boxes },
      { name: "Delivery Challans", href: "/inventory/delivery-challans", icon: Truck },
      { name: "Stock Ledger", href: "/inventory/stock-ledger", icon: BookOpen },
      { name: "Stock Valuation", href: "/inventory/stock-valuation", icon: Scale },
      { name: "Audits", href: "/inventory/audits", icon: ClipboardCheck },
    ],
  },
];

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { isCollapsed, toggle } = useSidebar();

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <aside
      className={cn(
        "transition-all duration-200 ease-in-out flex-col hidden lg:flex shrink-0 h-full overflow-hidden",
        "border-r",
        isCollapsed ? "w-16" : "w-[220px]",
        className
      )}
      style={{ background: "linear-gradient(180deg, #0c1445 0%, #0f172a 100%)", borderColor: "rgba(255,255,255,0.07)" }}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center py-4 border-b shrink-0 transition-all duration-200",
          isCollapsed ? "justify-center px-0" : "gap-2.5 px-4"
        )}
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)", boxShadow: "0 0 12px rgba(245,158,11,0.4)" }}>
          <Zap className="h-4 w-4 text-white" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <div className="font-bold text-[13px] text-white leading-tight">Mystics ERP</div>
            <div className="text-[10px] leading-tight" style={{ color: "#f59e0b99" }}>ERP &amp; Project Management</div>
          </div>
        )}
      </div>

      {/* User context — only when expanded */}
      {!isCollapsed && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-b shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
        >
          <span className="text-[11px]" style={{ color: "#94a3b8" }}>
            <span className="font-semibold capitalize" style={{ color: "#f59e0b" }}>{user?.role || "User"}</span>
            <span className="mx-1 opacity-40">›</span>
            Mystics ERP
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
        {MODULES.map((module) => (
          <div key={module.section} className="mb-1">
            {!isCollapsed && (
              <div className="px-4 pt-3 pb-1 text-[9.5px] font-semibold uppercase tracking-widest select-none"
                style={{ color: "rgba(245,158,11,0.45)" }}>
                {module.section}
              </div>
            )}
            {isCollapsed && <div className="my-1 mx-3 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />}

            {module.items.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/projects" && location.startsWith(item.href + "/")) ||
                (item.href === "/projects" && location === "/projects");

              if (isCollapsed) {
                return (
                  <Tooltip key={item.name} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link href={item.href}>
                        <div
                          className={cn(
                            "flex items-center justify-center h-9 w-9 mx-auto my-0.5 rounded-lg cursor-pointer transition-all",
                            isActive
                              ? "text-amber-400"
                              : "text-gray-500 hover:text-gray-300"
                          )}
                          style={isActive ? { background: "rgba(245,158,11,0.15)" } : { background: "transparent" }}
                        >
                          <item.icon className="h-[15px] w-[15px]" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs font-medium">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-2.5 py-[7px] pr-3 text-[13px] font-medium cursor-pointer transition-colors",
                      isActive
                        ? "pl-[13px] border-l-[3px] border-amber-400"
                        : "pl-4 border-l-[3px] border-transparent"
                    )}
                    style={
                      isActive
                        ? { color: "#fbbf24", background: "rgba(245,158,11,0.1)" }
                        : { color: "#94a3b8" }
                    }
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.color = "#e2e8f0"; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.color = "#94a3b8"; }}
                  >
                    <item.icon
                      className="h-[15px] w-[15px] shrink-0"
                      style={{ color: isActive ? "#fbbf24" : "#64748b" }}
                    />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Solar panel decoration */}
      {!isCollapsed && (
        <div className="px-4 py-2 shrink-0 opacity-20">
          <svg width="100%" height="28" viewBox="0 0 180 28" fill="none">
            {[0,1,2,3].map(col =>
              [0,1].map(row => (
                <g key={`${col}-${row}`} transform={`translate(${col * 46}, ${row * 15})`}>
                  <rect x="1" y="1" width="42" height="12" rx="1" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="0.5"/>
                  <line x1="15" y1="1" x2="15" y2="13" stroke="#3b82f6" strokeWidth="0.4"/>
                  <line x1="29" y1="1" x2="29" y2="13" stroke="#3b82f6" strokeWidth="0.4"/>
                  <line x1="1" y1="7" x2="43" y2="7" stroke="#3b82f6" strokeWidth="0.4"/>
                </g>
              ))
            )}
          </svg>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="border-t shrink-0" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <button
          onClick={toggle}
          className={cn(
            "w-full flex items-center py-2.5 transition-colors text-[12px] font-medium",
            isCollapsed ? "justify-center" : "gap-2 px-4"
          )}
          style={{ color: "#64748b" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f59e0b"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              Collapse
            </>
          )}
        </button>
      </div>

      {/* User info */}
      <div
        className={cn(
          "border-t flex items-center py-3 shrink-0",
          isCollapsed ? "justify-center px-0" : "gap-2.5 px-4"
        )}
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-bold cursor-default"
              style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)" }}
            >
              {initials}
            </div>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="text-xs">
              {user?.name} · {user?.role}
            </TooltipContent>
          )}
        </Tooltip>

        {!isCollapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold leading-tight truncate" style={{ color: "#e2e8f0" }}>
                {user?.name || "User"}
              </div>
              <div className="text-[10px] truncate" style={{ color: "#64748b" }}>{user?.email}</div>
            </div>
            <button
              onClick={logout}
              className="p-1 rounded transition-colors shrink-0"
              style={{ color: "#64748b" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
