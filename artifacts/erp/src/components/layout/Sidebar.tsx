import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, FileText, FileCheck, FilePlus, CheckSquare,
  AlertTriangle, FolderKanban, HardHat, Warehouse, Boxes, Truck,
  BookOpen, Scale, ClipboardCheck, ChevronLeft, ChevronRight, ChevronDown,
  LogOut, Zap, Layers, CheckSquare2, Wrench, Building2, Package,
  ClipboardList, ShoppingCart, BarChart2, ArrowRightLeft, RotateCcw,
  DollarSign, BarChart3, UserCog, ScrollText, TrendingUp, Search, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useSidebar } from "@/lib/sidebar-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";

/* ── Types ─────────────────────────────────────────────────── */
type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: number;
};
type NavSection = {
  section: string;
  key: string;
  roles?: string[];
  items: NavItem[];
};

/* ── Module definitions ─────────────────────────────────────── */
const MODULES: NavSection[] = [
  {
    section: "CORE",
    key: "core",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "SALES & CRM",
    key: "crm",
    roles: ["admin", "director", "sales", "pm"],
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
    key: "projects",
    roles: ["admin", "director", "pm", "sales"],
    items: [
      { name: "Projects Hub", href: "/projects", icon: FolderKanban },
      { name: "Contractors", href: "/projects/contractors", icon: HardHat },
    ],
  },
  {
    section: "INVENTORY",
    key: "inventory",
    roles: ["admin", "director", "warehouse", "pm"],
    items: [
      { name: "Warehouses", href: "/inventory/warehouses", icon: Warehouse },
      { name: "Stock Transfers", href: "/inventory/stock-transfers", icon: ArrowRightLeft },
      { name: "Delivery Challans", href: "/inventory/delivery-challans", icon: Truck },
      { name: "Stock Ledger", href: "/inventory/stock-ledger", icon: BookOpen },
      { name: "Stock Valuation", href: "/inventory/stock-valuation", icon: Scale },
      { name: "Audits", href: "/inventory/audits", icon: ClipboardCheck },
    ],
  },
  {
    section: "ENGINEERING",
    key: "engineering",
    roles: ["admin", "director", "pm"],
    items: [
      { name: "Design Documents", href: "/engineering/docs", icon: Layers },
    ],
  },
  {
    section: "COMMISSIONING",
    key: "commissioning",
    roles: ["admin", "director", "pm"],
    items: [
      { name: "Checklists", href: "/commissioning", icon: CheckSquare2 },
    ],
  },
  {
    section: "O&M & AMC",
    key: "oam",
    roles: ["admin", "director", "pm"],
    items: [
      { name: "AMC Contracts", href: "/oam/amc", icon: Wrench },
      { name: "Maintenance", href: "/oam/maintenance", icon: Wrench },
      { name: "Service Tickets", href: "/oam/tickets", icon: AlertTriangle },
    ],
  },
  {
    section: "PROCUREMENT",
    key: "procurement",
    roles: ["admin", "director", "pm", "warehouse", "finance"],
    items: [
      { name: "Dashboard", href: "/procurement/dashboard", icon: BarChart2 },
      { name: "Vendors", href: "/procurement/vendors", icon: Building2, roles: ["admin", "director", "pm"] },
      { name: "Materials", href: "/procurement/materials", icon: Package, roles: ["admin", "director", "pm"] },
      { name: "Vendor Quotations", href: "/procurement/quotations", icon: ClipboardList, roles: ["admin", "director", "pm"] },
      { name: "Purchase Orders", href: "/procurement/pos", icon: ShoppingCart },
      { name: "GRNs", href: "/procurement/grns", icon: Boxes },
      { name: "GRN Returns", href: "/procurement/grn-returns", icon: RotateCcw, roles: ["admin", "director", "pm", "warehouse"] },
      { name: "Invoices", href: "/procurement/invoices", icon: FilePlus, roles: ["admin", "director", "pm", "finance"] },
    ],
  },
  {
    section: "FINANCE & REPORTS",
    key: "finance",
    roles: ["admin", "director", "finance"],
    items: [
      { name: "Finance Dashboard", href: "/finance/dashboard", icon: DollarSign },
      { name: "Reports", href: "/reports", icon: BarChart3 },
      { name: "Vendor Performance", href: "/reports/vendors", icon: TrendingUp },
    ],
  },
  {
    section: "ADMIN",
    key: "admin",
    roles: ["admin", "director"],
    items: [
      { name: "User Management", href: "/admin/users", icon: UserCog },
      { name: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
    ],
  },
];

/* ── localStorage helpers ───────────────────────────────────── */
const LS_KEY = "sidebar-sections";
function loadExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveExpanded(state: Record<string, boolean>) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

/* ── Procurement badge hook ─────────────────────────────────── */
function useProcurementBadges() {
  const { data } = useQuery({
    queryKey: ["sidebar-procurement-badges"],
    queryFn: () => apiGet<{ draftPOs: number; pendingInvoices: number }>("/procurement/badge-counts"),
    refetchInterval: 60000,
    staleTime: 30000,
    retry: false,
  });
  return { draftPOs: data?.draftPOs ?? 0, pendingInvoices: data?.pendingInvoices ?? 0 };
}

/* ── Simple fuzzy match ─────────────────────────────────────── */
function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/* ─────────────────────────────────────────────────────────────
   Main Sidebar
───────────────────────────────────────────────────────────── */
export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { isCollapsed, toggle } = useSidebar();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const { draftPOs, pendingInvoices } = useProcurementBadges();

  const role = user?.role ?? "";
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  /* ── Role filtering ── */
  const visibleModules = MODULES.map((mod) => {
    if (mod.roles && !mod.roles.includes(role)) return null;
    const items = mod.items.filter((item) => !item.roles || item.roles.includes(role));
    if (!items.length) return null;
    return { ...mod, items };
  }).filter(Boolean) as NavSection[];

  /* ── Auto-expand active section on mount / route change ── */
  useEffect(() => {
    const next: Record<string, boolean> = { ...loadExpanded() };
    visibleModules.forEach((mod) => {
      const hasActive = mod.items.some(
        (item) =>
          location === item.href ||
          (item.href !== "/projects" && location.startsWith(item.href + "/")) ||
          (item.href === "/projects" && location === "/projects")
      );
      if (hasActive) next[mod.key] = true;
    });
    setExpanded(next);
    saveExpanded(next);
  // eslint-disable-next-line -- react-hooks/exhaustive-deps: location change intentionally re-initialises expanded state
  }, [location]);

  const toggleSection = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveExpanded(next);
      return next;
    });
  }, []);

  /* ── Search: flatten all items ── */
  const searchResults = search.trim()
    ? visibleModules.flatMap((mod) =>
        mod.items
          .filter((item) => fuzzyMatch(search, item.name))
          .map((item) => ({ ...item, section: mod.section }))
      )
    : null;

  /* ── Procurement badges ── */
  const procBadge = draftPOs + pendingInvoices;

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
        borderColor: "rgba(255,255,255,0.06)",
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── Logo ── */}
      <div
        className={cn(
          "flex items-center py-5 shrink-0 transition-all duration-300",
          isCollapsed ? "justify-center px-0" : "gap-3 px-5"
        )}
      >
        <div
          className="h-8 w-8 rounded-[8px] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(249,115,22,0.4)]"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
        >
          <Zap className="h-4 w-4 text-white" aria-hidden />
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
              <div className="font-bold text-[14px] text-white leading-tight tracking-tight">
                Solar EPC
              </div>
              <div className="text-[10px] leading-tight text-white/50 tracking-wide font-medium uppercase mt-0.5">
                Automystics
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Search (only in expanded mode) ── */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 pb-2 overflow-hidden"
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" aria-hidden />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search nav…"
                aria-label="Search navigation"
                className="w-full bg-white/5 border border-white/10 rounded-[8px] pl-7 pr-7 py-2 text-[12px] text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 focus-visible:ring-1 focus-visible:ring-white/30 rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navigation ── */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-none px-3">
        {/* Search results (flat list) */}
        {searchResults ? (
          <div className="space-y-1">
            {searchResults.length === 0 ? (
              <div className="text-center py-6 text-white/30 text-xs">No results</div>
            ) : (
              searchResults.map((item) => (
                <NavItemRow
                  key={item.href}
                  item={item}
                  location={location}
                  isCollapsed={false}
                  badge={undefined}
                />
              ))
            )}
          </div>
        ) : (
          /* Normal section list */
          visibleModules.map((mod, idx) => {
            const isOpen = isCollapsed ? false : (expanded[mod.key] ?? false);
            const hasBadge = mod.key === "procurement" && procBadge > 0;

            return (
              <div
                key={mod.key}
                className={cn("mb-1", idx === visibleModules.length - 1 && "mb-0")}
              >
                {/* Section header */}
                {isCollapsed ? (
                  <div className="mx-auto w-4 border-t border-white/10 mb-2 mt-3" />
                ) : (
                  <button
                    onClick={() => toggleSection(mod.key)}
                    aria-expanded={isOpen}
                    aria-label={`Toggle ${mod.section} section`}
                    className="w-full flex items-center justify-between px-3 pt-4 pb-1.5 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 group-hover:text-white/50 transition-colors select-none">
                      {mod.section}
                    </span>
                    <div className="flex items-center gap-2">
                      {hasBadge && !isOpen && (
                        <span className="h-4 w-4 rounded-full bg-[#F97316] text-white text-[9px] font-bold flex items-center justify-center">
                          {procBadge > 9 ? "9+" : procBadge}
                        </span>
                      )}
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 text-white/20 group-hover:text-white/40 transition-all duration-200",
                          isOpen && "rotate-180"
                        )}
                      />
                    </div>
                  </button>
                )}

                {/* Section items */}
                {isCollapsed ? (
                  <div className="space-y-0.5">
                    {mod.items.map((item) => {
                      const itemBadge =
                        mod.key === "procurement" && item.href === "/procurement/pos"
                          ? draftPOs
                          : mod.key === "procurement" && item.href === "/procurement/invoices"
                          ? pendingInvoices
                          : undefined;
                      return (
                        <Tooltip key={item.name} delayDuration={0} disableHoverableContent>
                          <TooltipTrigger asChild>
                            <NavItemRow
                              item={item}
                              location={location}
                              isCollapsed
                              badge={itemBadge}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={10} className="text-xs font-semibold">
                            {item.name}
                            {hasBadge && mod.key === "procurement" && (
                              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-[#F97316] inline-block" />
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ) : (
                  <motion.div
                    initial={false}
                    animate={isOpen ? "open" : "closed"}
                    variants={{
                      open: { height: "auto", opacity: 1 },
                      closed: { height: 0, opacity: 0 },
                    }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 pb-1">
                      {mod.items.map((item) => {
                        const itemBadge =
                          mod.key === "procurement" && item.href === "/procurement/pos"
                            ? draftPOs
                            : mod.key === "procurement" && item.href === "/procurement/invoices"
                            ? pendingInvoices
                            : undefined;
                        return (
                          <NavItemRow
                            key={item.name}
                            item={item}
                            location={location}
                            isCollapsed={false}
                            badge={itemBadge}
                          />
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Collapse toggle ── */}
      <div className="px-3 py-3 border-t border-white/5">
        <button
          onClick={toggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "w-full flex items-center h-10 rounded-[8px] transition-colors text-[13px] font-medium text-white/40 hover:text-white hover:bg-white/5 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:outline-none",
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

      {/* ── User info ── */}
      <div
        className={cn(
          "p-4 border-t border-white/5 bg-black/10 shrink-0 flex items-center",
          isCollapsed ? "justify-center" : "gap-3"
        )}
      >
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-white text-[12px] font-bold tracking-wider"
          style={{
            background: "linear-gradient(135deg, #1E293B, #0F172A)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          aria-label={`Logged in as ${user?.name}`}
        >
          {initials}
        </div>
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-w-0 flex-1 flex items-center gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-white truncate leading-tight">
                  {user?.name || "User"}
                </div>
                <div className="text-[11px] text-white/40 truncate mt-0.5 capitalize">
                  {user?.role || "User"}
                </div>
              </div>
              <button
                onClick={logout}
                aria-label="Sign out"
                className="h-8 w-8 flex items-center justify-center rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 focus-visible:ring-1 focus-visible:ring-red-400 focus-visible:outline-none"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

/* ── NavItemRow ─────────────────────────────────────────────── */
function NavItemRow({
  item,
  location,
  isCollapsed,
  badge,
}: {
  item: NavItem & { section?: string };
  location: string;
  isCollapsed: boolean;
  badge?: number;
}) {
  const isActive =
    location === item.href ||
    (item.href !== "/projects" && location.startsWith(item.href + "/")) ||
    (item.href === "/projects" && location === "/projects");

  if (isCollapsed) {
    return (
      <Link href={item.href}>
        <div
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "relative flex items-center justify-center h-10 w-10 mx-auto rounded-[8px] cursor-pointer transition-all duration-200",
            isActive
              ? "bg-white/10 text-[#F97316] shadow-sm"
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
          )}
        >
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#F97316] rounded-r" />
          )}
          <item.icon className="h-4 w-4" aria-hidden />
          {badge && badge > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#F97316]" />
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link href={item.href}>
      <div
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-medium cursor-pointer transition-all duration-200 group overflow-hidden",
          isActive
            ? "text-white bg-white/10"
            : "text-white/50 hover:text-white hover:bg-white/5"
        )}
      >
        {isActive && (
          <motion.div
            layoutId="sidebar-active-bar"
            className="absolute left-0 top-0 bottom-0 w-1 bg-[#F97316] rounded-r"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        <item.icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isActive ? "text-[#F97316]" : "text-white/40 group-hover:text-white/70"
          )}
          aria-hidden
        />
        <span className="flex-1 truncate">{item.name}</span>
        {badge && badge > 0 && (
          <span className="h-5 min-w-5 px-1 rounded-full bg-[#F97316]/20 text-[#F97316] text-[10px] font-bold flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
    </Link>
  );
}
