import { useState, useEffect, useRef, useCallback } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeKey = "draftPOs" | "pendingInvoices";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: BadgeKey;
  prefixes?: string[];
};

type NavSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
  defaultOpen?: boolean;
  items: NavItem[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasAccess(roles: string[] | undefined, userRole: string): boolean {
  if (!roles || roles.length === 0) return true;
  return roles.includes(userRole);
}

function isItemActive(location: string, item: NavItem): boolean {
  if (location === item.href) return true;
  if (item.prefixes?.some((p) => location.startsWith(p))) return true;
  if (item.href !== "/projects" && location.startsWith(item.href + "/")) return true;
  return false;
}

function findActiveSectionId(location: string, sections: NavSection[]): string | null {
  for (const s of sections) {
    if (s.items.some((i) => isItemActive(location, i))) return s.id;
  }
  return null;
}

// ── Nav config ────────────────────────────────────────────────────────────────

const SECTIONS: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    id: "crm",
    label: "Sales & CRM",
    icon: TrendingUp,
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
    id: "projects",
    label: "Projects",
    icon: FolderKanban,
    roles: ["admin", "director", "pm", "sales"],
    items: [
      { name: "Projects Hub", href: "/projects", icon: FolderKanban },
      { name: "Contractors", href: "/projects/contractors", icon: HardHat, prefixes: ["/projects/contractors"] },
    ],
  },
  {
    id: "engineering",
    label: "Engineering",
    icon: Layers,
    roles: ["admin", "director", "pm"],
    items: [
      { name: "Design Documents", href: "/engineering/docs", icon: Layers },
      { name: "Commissioning", href: "/commissioning", icon: CheckSquare2 },
    ],
  },
  {
    id: "oam",
    label: "O&M & AMC",
    icon: Wrench,
    roles: ["admin", "director", "pm"],
    items: [
      { name: "AMC Contracts", href: "/oam/amc", icon: ClipboardCheck },
      { name: "Maintenance", href: "/oam/maintenance", icon: Wrench },
      { name: "Service Tickets", href: "/oam/tickets", icon: AlertTriangle },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Warehouse,
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
    id: "procurement",
    label: "Procurement",
    icon: ShoppingCart,
    roles: ["admin", "director", "procurement", "warehouse", "finance"],
    items: [
      { name: "Overview", href: "/procurement/dashboard", icon: BarChart2 },
      { name: "Vendors", href: "/procurement/vendors", icon: Building2 },
      { name: "Materials", href: "/procurement/materials", icon: Package },
      { name: "Vendor Quotations", href: "/procurement/quotations", icon: ClipboardList, prefixes: ["/procurement/material-requests/"] },
      { name: "Purchase Orders", href: "/procurement/pos", icon: ShoppingCart, badge: "draftPOs" },
      { name: "GRNs", href: "/procurement/grns", icon: Boxes },
      { name: "GRN Returns", href: "/procurement/grn-returns", icon: RotateCcw },
      { name: "Invoices", href: "/procurement/invoices", icon: FilePlus, badge: "pendingInvoices" },
    ],
  },
  {
    id: "finance",
    label: "Finance & Reports",
    icon: DollarSign,
    roles: ["admin", "director", "finance"],
    items: [
      { name: "Finance", href: "/finance/dashboard", icon: DollarSign },
      { name: "Reports", href: "/reports", icon: BarChart3 },
      { name: "Vendor Performance", href: "/reports/vendors", icon: TrendingUp },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    icon: UserCog,
    roles: ["admin", "director"],
    items: [
      { name: "User Management", href: "/admin/users", icon: UserCog },
      { name: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
    ],
  },
];

// ── Badge hook ────────────────────────────────────────────────────────────────

function useSidebarBadges(): Partial<Record<BadgeKey, number>> {
  const { data } = useQuery<any>({
    queryKey: ["sidebar-badges"],
    queryFn: () => apiGet<any>("/procurement-dashboard"),
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: false,
  });
  if (!data) return {};
  return {
    draftPOs: (data.draftPOs ?? 0) as number,
    pendingInvoices: (data.pendingApprovalInvoices ?? 0) as number,
  };
}

// ── Collapsed nav item ────────────────────────────────────────────────────────

function CollapsedItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link href={item.href}>
          <div
            className={cn(
              "flex items-center justify-center h-9 w-9 mx-auto rounded-lg cursor-pointer transition-all",
              active
                ? "bg-orange-500/20 text-orange-400"
                : "text-white/35 hover:text-white/75 hover:bg-white/[0.08]"
            )}
          >
            <item.icon className="h-[17px] w-[17px]" />
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="text-xs font-semibold">
        {item.name}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { isCollapsed, toggle } = useSidebar();
  const badges = useSidebarBadges();
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Per-section open state, persisted to localStorage
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("sidebar-sections");
      if (stored) return JSON.parse(stored);
    } catch {}
    return Object.fromEntries(SECTIONS.map((s) => [s.id, s.defaultOpen ?? true]));
  });

  // Auto-open the active section on location change
  useEffect(() => {
    const activeId = findActiveSectionId(location, SECTIONS);
    if (activeId) {
      setOpenSections((prev) => {
        if (prev[activeId]) return prev;
        const next = { ...prev, [activeId]: true };
        localStorage.setItem("sidebar-sections", JSON.stringify(next));
        return next;
      });
    }
    setSearchQuery("");
  }, [location]);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("sidebar-sections", JSON.stringify(next));
      return next;
    });
  }, []);

  const userRole = (user as any)?.role ?? "";

  // Role-filtered sections
  const visibleSections = SECTIONS.filter((s) => hasAccess(s.roles, userRole)).map((s) => ({
    ...s,
    items: s.items.filter((i) => hasAccess(i.roles, userRole)),
  }));

  // Search
  const query = searchQuery.trim().toLowerCase();
  const searchResults = query
    ? visibleSections.flatMap((s) =>
        s.items
          .filter((i) => i.name.toLowerCase().includes(query))
          .map((i) => ({ ...i, sectionLabel: s.label }))
      )
    : [];

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  function sectionBadgeTotal(sec: NavSection) {
    return sec.items.reduce(
      (sum, item) => sum + (item.badge ? (badges[item.badge] ?? 0) : 0),
      0
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 64 : 252 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "hidden lg:flex flex-col shrink-0 h-full overflow-hidden border-r z-20 select-none",
        className
      )}
      style={{
        background: "linear-gradient(180deg, #0D1548 0%, #090E28 100%)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Logo ── */}
      <div
        className={cn(
          "flex items-center shrink-0 h-14 border-b",
          isCollapsed ? "justify-center px-0" : "gap-3 px-4"
        )}
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
            boxShadow: "0 0 18px rgba(249,115,22,0.4)",
          }}
        >
          <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
              className="min-w-0 flex-1 overflow-hidden"
            >
              <div className="font-bold text-[14px] text-white leading-tight tracking-tight whitespace-nowrap">
                Mystics ERP
              </div>
              <div className="text-[9px] leading-tight text-white/35 tracking-[0.18em] font-medium uppercase mt-0.5 whitespace-nowrap">
                Automystics Technologies
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Search ── */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="px-3 pt-3 pb-2 shrink-0"
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search navigation…"
                className="w-full h-8 bg-white/[0.06] border border-white/[0.09] rounded-lg pl-8 pr-7 text-[12px] text-white placeholder:text-white/22 outline-none focus:border-orange-500/50 focus:bg-white/[0.09] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/55 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nav ── */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto py-1.5 scrollbar-none"
      >
        {/* Search results */}
        {query && !isCollapsed ? (
          <div className="px-2 py-1">
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-white/25 text-[12px]">
                No results for "{query}"
              </div>
            ) : (
              <>
                <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                </p>
                {searchResults.map((item) => {
                  const active = isItemActive(location, item);
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        onClick={() => setSearchQuery("")}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all group relative",
                          active
                            ? "text-white bg-white/10"
                            : "text-white/50 hover:text-white hover:bg-white/[0.07]"
                        )}
                      >
                        {active && (
                          <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-orange-500 rounded-full" />
                        )}
                        <item.icon
                          className={cn(
                            "h-[15px] w-[15px] shrink-0",
                            active ? "text-orange-400" : "text-white/28 group-hover:text-white/55"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{item.name}</div>
                          <div className="text-[10px] text-white/28 mt-px">{item.sectionLabel}</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          /* ── Sections ── */
          <div className="space-y-px px-2">
            {visibleSections.map((section) => {
              const isOpen = openSections[section.id] ?? true;
              const sectionBadge = sectionBadgeTotal(section);
              const hasActive = section.items.some((i) => isItemActive(location, i));
              const SectionIcon = section.icon;

              if (isCollapsed) {
                return (
                  <div key={section.id} className="py-1">
                    <div
                      className="mx-3 border-t mb-1"
                      style={{ borderColor: "rgba(255,255,255,0.07)" }}
                    />
                    {section.items.map((item) => (
                      <CollapsedItem
                        key={item.href}
                        item={item}
                        active={isItemActive(location, item)}
                      />
                    ))}
                  </div>
                );
              }

              return (
                <div key={section.id} className="mb-0.5">
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isOpen}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold uppercase tracking-[0.11em] transition-all group",
                      hasActive
                        ? "text-white/75 hover:bg-white/[0.05]"
                        : "text-white/28 hover:text-white/50 hover:bg-white/[0.04]"
                    )}
                  >
                    <SectionIcon
                      className={cn(
                        "h-3 w-3 shrink-0 transition-colors",
                        hasActive
                          ? "text-orange-400/70"
                          : "text-white/22 group-hover:text-white/40"
                      )}
                    />
                    <span className="flex-1 text-left">{section.label}</span>
                    {sectionBadge > 0 && (
                      <span className="h-4 min-w-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {sectionBadge > 99 ? "99+" : sectionBadge}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 shrink-0 text-white/18 transition-transform duration-200",
                        isOpen ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  </button>

                  {/* Items */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="pl-1 pb-0.5 space-y-px">
                          {section.items.map((item) => {
                            const active = isItemActive(location, item);
                            const badgeCount = item.badge ? (badges[item.badge] ?? 0) : 0;
                            return (
                              <Link key={item.href} href={item.href}>
                                <div
                                  aria-current={active ? "page" : undefined}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium cursor-pointer transition-all group relative",
                                    active
                                      ? "text-white bg-white/[0.09]"
                                      : "text-white/45 hover:text-white/85 hover:bg-white/[0.06]"
                                  )}
                                >
                                  {active && (
                                    <motion.div
                                      layoutId="nav-active-pill"
                                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-orange-500 rounded-full"
                                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                                    />
                                  )}
                                  <item.icon
                                    className={cn(
                                      "h-[15px] w-[15px] shrink-0 transition-colors",
                                      active
                                        ? "text-orange-400"
                                        : "text-white/28 group-hover:text-white/55"
                                    )}
                                  />
                                  <span className="flex-1 truncate">{item.name}</span>
                                  {badgeCount > 0 && (
                                    <span
                                      className={cn(
                                        "h-[18px] min-w-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center",
                                        active
                                          ? "bg-orange-500 text-white"
                                          : "bg-white/12 text-white/60"
                                      )}
                                    >
                                      {badgeCount > 99 ? "99+" : badgeCount}
                                    </span>
                                  )}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* ── Collapse toggle ── */}
      <div
        className="shrink-0 px-2 py-2 border-t"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={toggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "w-full flex items-center h-8 rounded-lg transition-colors text-[12px] font-medium text-white/28 hover:text-white/65 hover:bg-white/[0.06]",
            isCollapsed ? "justify-center" : "gap-2.5 px-3"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <>
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* ── User ── */}
      <div
        className={cn(
          "shrink-0 border-t flex items-center gap-2.5 p-3",
          isCollapsed ? "justify-center" : ""
        )}
        style={{
          borderColor: "rgba(255,255,255,0.07)",
          background: "rgba(0,0,0,0.18)",
        }}
      >
        <Tooltip delayDuration={0} disableHoverableContent={!isCollapsed}>
          <TooltipTrigger asChild>
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-bold cursor-default"
              style={{
                background: "linear-gradient(135deg, #1E3A5F, #0F2340)",
                border: "1.5px solid rgba(255,255,255,0.12)",
              }}
            >
              {initials}
            </div>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" sideOffset={10}>
              <p className="font-semibold text-[12px]">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{(user as any)?.role}</p>
            </TooltipContent>
          )}
        </Tooltip>

        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="min-w-0 flex-1 flex items-center gap-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-white/88 truncate leading-tight">
                  {user?.name || "User"}
                </div>
                <div className="text-[10px] text-white/32 truncate capitalize mt-px">
                  {(user as any)?.role || "User"}
                </div>
              </div>
              <button
                onClick={logout}
                aria-label="Sign out"
                className="h-7 w-7 flex items-center justify-center rounded-md text-white/28 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
