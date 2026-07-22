import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, FileText, FileCheck, FilePlus, CheckSquare,
  AlertTriangle, FolderKanban, HardHat, Warehouse, Boxes, Truck,
  BookOpen, Scale, ClipboardCheck, ChevronLeft, ChevronRight,
  LogOut, Zap, Layers, CheckSquare2, Wrench, Building2, Package,
  ClipboardList, ShoppingCart, BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useSidebar } from "@/lib/sidebar-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";

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
  {
    section: "ENGINEERING",
    items: [
      { name: "Design Documents", href: "/engineering/docs", icon: Layers },
    ],
  },
  {
    section: "COMMISSIONING",
    items: [
      { name: "Checklists", href: "/commissioning", icon: CheckSquare2 },
    ],
  },
  {
    section: "O&M & AMC",
    items: [
      { name: "AMC Contracts", href: "/oam/amc", icon: Wrench },
      { name: "Maintenance", href: "/oam/maintenance", icon: Wrench },
      { name: "Service Tickets", href: "/oam/tickets", icon: AlertTriangle },
    ],
  },
  {
    section: "PROCUREMENT",
    items: [
      { name: "Dashboard", href: "/procurement/dashboard", icon: BarChart2 },
      { name: "Vendors", href: "/procurement/vendors", icon: Building2 },
      { name: "Materials", href: "/procurement/materials", icon: Package },
      { name: "Vendor Quotations", href: "/procurement/quotations", icon: ClipboardList },
      { name: "Purchase Orders", href: "/procurement/pos", icon: ShoppingCart },
      { name: "GRNs", href: "/procurement/grns", icon: Boxes },
      { name: "Invoices", href: "/procurement/invoices", icon: FilePlus },
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
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex-col hidden lg:flex shrink-0 h-full overflow-hidden border-r z-20",
        className
      )}
      style={{ 
        background: "linear-gradient(180deg, #0C1445 0%, #0F172A 100%)", 
        borderColor: "rgba(255,255,255,0.06)" 
      }}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center py-5 shrink-0 transition-all duration-300",
          isCollapsed ? "justify-center px-0" : "gap-3 px-5"
        )}
      >
        <div className="h-8 w-8 rounded-[8px] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(249,115,22,0.4)]"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}>
          <Zap className="h-4 w-4 text-white" />
        </div>
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              <div className="font-bold text-[14px] text-white leading-tight tracking-tight">Mystics ERP</div>
              <div className="text-[10px] leading-tight text-white/50 tracking-wide font-medium uppercase mt-0.5">Automystics</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-none px-3">
        {MODULES.map((module, idx) => (
          <div key={module.section} className={cn("mb-6", idx === MODULES.length - 1 && "mb-0")}>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 select-none"
                >
                  {module.section}
                </motion.div>
              )}
            </AnimatePresence>
            {isCollapsed && <div className="mx-auto w-4 border-t border-white/10 mb-4 mt-2" />}

            <div className="space-y-1">
              {module.items.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/projects" && location.startsWith(item.href + "/")) ||
                  (item.href === "/projects" && location === "/projects");

                if (isCollapsed) {
                  return (
                    <Tooltip key={item.name} delayDuration={0} disableHoverableContent>
                      <TooltipTrigger asChild>
                        <Link href={item.href}>
                          <div
                            className={cn(
                              "flex items-center justify-center h-10 w-10 mx-auto rounded-[8px] cursor-pointer transition-all duration-200",
                              isActive
                                ? "bg-white/10 text-[#F97316] shadow-sm"
                                : "text-white/40 hover:text-white/80 hover:bg-white/5"
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                          </div>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={10} className="text-xs font-semibold">
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <Link key={item.name} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-medium cursor-pointer transition-all duration-200 group relative overflow-hidden",
                        isActive
                          ? "text-white bg-white/10"
                          : "text-white/50 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {isActive && (
                        <motion.div 
                          layoutId="sidebar-active"
                          className="absolute left-0 top-0 bottom-0 w-1 bg-[#F97316]"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <item.icon
                        className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-[#F97316]" : "text-white/40 group-hover:text-white/70")}
                      />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Collapse toggle */}
      <div className="px-3 py-3 border-t border-white/5">
        <button
          onClick={toggle}
          className={cn(
            "w-full flex items-center h-10 rounded-[8px] transition-colors text-[13px] font-medium text-white/40 hover:text-white hover:bg-white/5",
            isCollapsed ? "justify-center" : "gap-3 px-3"
          )}
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
      <div className={cn("p-4 border-t border-white/5 bg-black/10 shrink-0 flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
        <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-white text-[12px] font-bold tracking-wider"
          style={{ background: "linear-gradient(135deg, #1E293B, #0F172A)", border: "1px solid rgba(255,255,255,0.1)" }}>
          {initials}
        </div>
        {!isCollapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-white truncate leading-tight">{user?.name || "User"}</div>
              <div className="text-[11px] text-white/40 truncate mt-0.5">{user?.role || "User"}</div>
            </div>
            <button
              onClick={logout}
              className="h-8 w-8 flex items-center justify-center rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </motion.aside>
  );
}
