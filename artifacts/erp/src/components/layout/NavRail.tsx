/**
 * NavRail — slim 56px icon rail with context-aware flyout panels.
 *
 * Paradigm: SAP Fiori / Linear / Workday
 * - Persistent icon rail (56 px) always visible on desktop
 * - Click icon → animated 240px flyout overlays the content area
 * - Flyout closes on: outside click, Escape key, nav-item click
 * - Procurement section shows live badge dot when items need attention
 * - Role-based section visibility
 */

import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard, Users, FolderKanban, Warehouse, Layers,
  CheckCircle2, Wrench, ShoppingCart, DollarSign, Settings2, Zap,
  LogOut, FileText, FileCheck, FilePlus, CheckSquare, AlertTriangle,
  HardHat, ArrowRightLeft, Truck, BookOpen, Scale, ClipboardCheck,
  ClipboardList, Building2, Package, RotateCcw, Boxes,
  BarChart2, BarChart3, TrendingUp, UserCog, ScrollText, X,
  ChevronRight, Users2, FileCode, Calendar, Receipt,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────── */
type NavChild = {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: number;
};

type RailEntry =
  | { type: "link";      key: string; icon: React.ElementType; label: string; href: string }
  | { type: "group";     key: string; icon: React.ElementType; label: string; roles?: string[]; hasBadge?: boolean; items: NavChild[] }
  | { type: "separator"; key: string };

/* ── Module definitions ─────────────────────────────────────────── */
const RAIL: RailEntry[] = [
  {
    type: "link", key: "dashboard",
    icon: LayoutDashboard, label: "Dashboard", href: "/dashboard",
  },
  { type: "separator", key: "s1" },
  {
    type: "group", key: "crm",
    icon: Users2, label: "Sales & CRM",
    roles: ["admin", "director", "sales", "pm"],
    items: [
      { name: "Leads",       href: "/crm/leads",       icon: Users },
      { name: "Quotations",  href: "/crm/quotations",  icon: FileText },
      { name: "Client POs",  href: "/crm/client-pos",  icon: FileCheck },
      { name: "Invoices",    href: "/crm/invoices",    icon: Receipt },
      { name: "Tasks",       href: "/crm/tasks",       icon: CheckSquare },
      { name: "Escalations", href: "/crm/escalations", icon: AlertTriangle },
    ],
  },
  {
    type: "group", key: "projects",
    icon: FolderKanban, label: "Projects",
    roles: ["admin", "director", "pm", "sales"],
    items: [
      { name: "Projects Hub", href: "/projects",             icon: FolderKanban },
      { name: "Contractors",  href: "/projects/contractors", icon: HardHat },
    ],
  },
  {
    type: "group", key: "inventory",
    icon: Warehouse, label: "Inventory",
    roles: ["admin", "director", "warehouse", "pm"],
    items: [
      { name: "Warehouses",        href: "/inventory/warehouses",        icon: Warehouse },
      { name: "Stock Transfers",   href: "/inventory/stock-transfers",   icon: ArrowRightLeft },
      { name: "Delivery Challans", href: "/inventory/delivery-challans", icon: Truck },
      { name: "Stock Ledger",      href: "/inventory/stock-ledger",      icon: BookOpen },
      { name: "Stock Valuation",   href: "/inventory/stock-valuation",   icon: Scale },
      { name: "Audits",            href: "/inventory/audits",            icon: ClipboardCheck },
    ],
  },
  {
    type: "group", key: "engineering",
    icon: FileCode, label: "Engineering",
    roles: ["admin", "director", "pm"],
    items: [
      { name: "Design Documents", href: "/engineering/docs", icon: Layers },
    ],
  },
  {
    type: "group", key: "commissioning",
    icon: CheckCircle2, label: "Commissioning",
    roles: ["admin", "director", "pm"],
    items: [
      { name: "Checklists", href: "/commissioning", icon: CheckCircle2 },
    ],
  },
  {
    type: "group", key: "oam",
    icon: Wrench, label: "O&M & AMC",
    roles: ["admin", "director", "pm"],
    items: [
      { name: "AMC Contracts",  href: "/oam/amc",         icon: FileText },
      { name: "Maintenance",    href: "/oam/maintenance",  icon: Calendar },
      { name: "Service Tickets", href: "/oam/tickets",    icon: AlertTriangle },
    ],
  },
  {
    type: "group", key: "procurement",
    icon: ShoppingCart, label: "Procurement",
    hasBadge: true,
    roles: ["admin", "director", "pm", "warehouse", "finance"],
    items: [
      { name: "Dashboard",         href: "/procurement/dashboard",   icon: BarChart2 },
      { name: "Vendors",           href: "/procurement/vendors",     icon: Building2,     roles: ["admin","director","pm"] },
      { name: "Materials",         href: "/procurement/materials",   icon: Package,        roles: ["admin","director","pm"] },
      { name: "Vendor Quotations", href: "/procurement/quotations",  icon: ClipboardList,  roles: ["admin","director","pm"] },
      { name: "Purchase Orders",   href: "/procurement/pos",         icon: ShoppingCart },
      { name: "GRNs",              href: "/procurement/grns",        icon: Boxes },
      { name: "GRN Returns",       href: "/procurement/grn-returns", icon: RotateCcw,      roles: ["admin","director","pm","warehouse"] },
      { name: "Invoices",          href: "/procurement/invoices",    icon: FilePlus,       roles: ["admin","director","pm","finance"] },
    ],
  },
  { type: "separator", key: "s2" },
  {
    type: "group", key: "finance",
    icon: DollarSign, label: "Finance & Reports",
    roles: ["admin", "director", "finance"],
    items: [
      { name: "Finance Dashboard",    href: "/finance/dashboard", icon: DollarSign },
      { name: "Reports",              href: "/reports",           icon: BarChart3 },
      { name: "Vendor Performance",   href: "/reports/vendors",   icon: TrendingUp },
    ],
  },
  {
    type: "group", key: "admin",
    icon: Settings2, label: "Administration",
    roles: ["admin", "director"],
    items: [
      { name: "User Management", href: "/admin/users",      icon: UserCog },
      { name: "Audit Logs",      href: "/admin/audit-logs", icon: ScrollText },
    ],
  },
];

/* ── Active-section detection ───────────────────────────────────── */
function getActiveSectionKey(path: string, entries: RailEntry[]): string | null {
  for (const e of entries) {
    if (e.type === "link") {
      if (path === e.href) return e.key;
    } else if (e.type === "group") {
      const hit = e.items.some(
        (item) =>
          path === item.href ||
          (item.href !== "/projects" && path.startsWith(item.href + "/")) ||
          (item.href === "/projects" && path === "/projects")
      );
      if (hit) return e.key;
    }
  }
  return null;
}

/* ── Procurement badge hook ─────────────────────────────────────── */
function useProcBadge() {
  const { data } = useQuery({
    queryKey: ["rail-proc-badges"],
    queryFn: () => apiGet<{ draftPOs: number; pendingInvoices: number }>("/procurement/badge-counts"),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
  return (data?.draftPOs ?? 0) + (data?.pendingInvoices ?? 0);
}

/* ══════════════════════════════════════════════════════════════════
   NavRail — the public export
═══════════════════════════════════════════════════════════════════ */
export function NavRail() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const procBadge = useProcBadge();

  const role    = user?.role ?? "";
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const activeKey = getActiveSectionKey(location, RAIL);

  /* ── Filter by role ── */
  const visible = RAIL.filter((e) => {
    if (e.type === "separator") return true;
    if (e.type === "link")  return true;
    return !e.roles || e.roles.includes(role);
  }) as RailEntry[];

  /* ── Close flyout when route changes ── */
  useEffect(() => { setOpenKey(null); }, [location]);

  /* ── Escape key ── */
  useEffect(() => {
    if (!openKey) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenKey(null); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [openKey]);

  const toggle = useCallback((key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  }, []);

  /* ── Flyout content for the open section ── */
  const flyoutSection = openKey
    ? (visible.find((e) => e.type === "group" && e.key === openKey) as Extract<RailEntry, { type: "group" }> | undefined)
    : undefined;

  return (
    <>
      {/* ── Icon rail ── */}
      <nav
        aria-label="Main navigation"
        className="hidden lg:flex flex-col w-14 shrink-0 h-full z-30 relative"
        style={{ background: "linear-gradient(180deg,#0C1445 0%,#0F172A 100%)", borderRight: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center h-14 shrink-0">
          <div
            className="h-8 w-8 rounded-[8px] flex items-center justify-center shadow-[0_0_16px_rgba(249,115,22,0.4)]"
            style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}
          >
            <Zap className="h-4 w-4 text-white" aria-hidden />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-white/5 shrink-0" />

        {/* Icons */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none py-2 flex flex-col items-center gap-0.5">
          {visible.map((entry) => {
            if (entry.type === "separator") {
              return <div key={entry.key} className="w-6 h-px bg-white/[0.07] my-1.5 shrink-0" />;
            }

            if (entry.type === "link") {
              const isActive = activeKey === entry.key;
              return (
                <Tooltip key={entry.key} delayDuration={400} disableHoverableContent>
                  <TooltipTrigger asChild>
                    <Link href={entry.href} onClick={() => setOpenKey(null)}>
                      <div
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "relative flex items-center justify-center h-10 w-10 rounded-[10px] transition-all duration-200 cursor-pointer",
                          isActive
                            ? "bg-white/12 text-[#F97316]"
                            : "text-white/40 hover:text-white/80 hover:bg-white/6"
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="rail-indicator"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#F97316] rounded-r-full"
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          />
                        )}
                        <entry.icon className="h-[18px] w-[18px]" aria-hidden />
                      </div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12} className="text-xs font-semibold">
                    {entry.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            /* group */
            const isActiveSection = activeKey === entry.key;
            const isOpen = openKey === entry.key;
            const showBadge = entry.hasBadge && procBadge > 0;

            return (
              <Tooltip key={entry.key} delayDuration={400} disableHoverableContent>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggle(entry.key)}
                    aria-expanded={isOpen}
                    aria-label={`${entry.label} menu`}
                    className={cn(
                      "relative flex items-center justify-center h-10 w-10 rounded-[10px] transition-all duration-200",
                      isOpen
                        ? "bg-white/15 text-white"
                        : isActiveSection
                        ? "bg-white/10 text-[#F97316]"
                        : "text-white/40 hover:text-white/80 hover:bg-white/6"
                    )}
                  >
                    {isActiveSection && !isOpen && (
                      <motion.div
                        layoutId="rail-indicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#F97316] rounded-r-full"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <entry.icon className="h-[18px] w-[18px]" aria-hidden />
                    {showBadge && (
                      <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#F97316] ring-[1.5px] ring-[#0C1445]" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12} className="text-xs font-semibold">
                  {entry.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Bottom: user avatar + logout */}
        <div className="shrink-0 flex flex-col items-center gap-1 py-3 border-t border-white/5">
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <button
                onClick={logout}
                aria-label="Sign out"
                className="h-10 w-10 rounded-[10px] flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="text-xs font-semibold">Sign out</TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold cursor-default shrink-0"
                style={{ background: "linear-gradient(135deg,#1E3A5F,#0F172A)", border: "1.5px solid rgba(255,255,255,0.12)" }}
                aria-label={user?.name ?? "User"}
              >
                {initials}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="text-xs">
              <p className="font-bold">{user?.name}</p>
              <p className="text-muted-foreground capitalize">{user?.role}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>

      {/* ── Flyout backdrop (click outside to close) ── */}
      <AnimatePresence>
        {flyoutSection && (
          <>
            <motion.div
              key="flyout-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 left-14 z-[28] hidden lg:block"
              onClick={() => setOpenKey(null)}
              aria-hidden
            />

            {/* ── Flyout panel ── */}
            <motion.div
              key={`flyout-${flyoutSection.key}`}
              ref={flyoutRef}
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -16, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 bottom-0 left-14 w-60 z-[29] hidden lg:flex flex-col overflow-hidden"
              style={{
                background: "linear-gradient(180deg,#0F1C3F 0%,#0D1529 100%)",
                borderRight: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "8px 0 32px rgba(0,0,0,0.4)",
              }}
              role="navigation"
              aria-label={`${flyoutSection.label} submenu`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <flyoutSection.icon className="h-4 w-4 text-[#F97316]" aria-hidden />
                  <span className="text-[13px] font-bold text-white tracking-tight">
                    {flyoutSection.label}
                  </span>
                </div>
                <button
                  onClick={() => setOpenKey(null)}
                  aria-label="Close menu"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Nav items */}
              <div className="flex-1 overflow-y-auto scrollbar-none py-2 px-2">
                {flyoutSection.items
                  .filter((item) => !item.roles || item.roles.includes(role))
                  .map((item) => {
                    const isActive =
                      location === item.href ||
                      (item.href !== "/projects" && location.startsWith(item.href + "/")) ||
                      (item.href === "/projects" && location === "/projects");
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setOpenKey(null)}>
                        <div
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "relative flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-medium transition-all duration-150 group cursor-pointer",
                            isActive
                              ? "bg-white/12 text-white"
                              : "text-white/50 hover:text-white hover:bg-white/6"
                          )}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[#F97316] rounded-r-full" />
                          )}
                          <item.icon
                            className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              isActive ? "text-[#F97316]" : "text-white/35 group-hover:text-white/70"
                            )}
                            aria-hidden
                          />
                          <span className="flex-1 truncate">{item.name}</span>
                          {isActive && (
                            <ChevronRight className="h-3 w-3 text-white/30 shrink-0" aria-hidden />
                          )}
                        </div>
                      </Link>
                    );
                  })}
              </div>

              {/* Footer hint */}
              <div className="shrink-0 px-4 py-3 border-t border-white/5">
                <p className="text-[10px] text-white/20 font-medium">
                  Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/40 font-mono text-[9px]">Esc</kbd> to close
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
