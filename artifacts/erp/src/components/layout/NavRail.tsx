/**
 * NavRail — Enterprise navigation rail for Mystics ERP
 *
 * Inspired by: SAP Fiori, Microsoft Dynamics 365, Salesforce Lightning,
 *              Oracle Fusion Cloud, ServiceNow, Workday, Linear, Jira
 *
 * Architecture:
 *  • 60px persistent icon rail — always visible on desktop
 *  • Context-aware flyout panels that overlay content (never push it)
 *  • Recently visited pages — tracked automatically, shown in flyout + dedicated history view
 *  • Favorites / pinned pages — per-user, persisted in localStorage
 *  • Role-based section visibility
 *  • Procurement badge dot via live /api/procurement/badge-counts
 *  • Keyboard: Escape closes any open flyout
 *  • Mobile: hidden (Shell's bottom-tab bar + MobileNavSheet handle mobile)
 */

import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { addRecentEntry, clearRecentEntries } from "@/lib/recentHistory";
import { useNavState } from "@/lib/nav-state";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  ChevronRight, Users2, FileCode, Calendar, Receipt, Star, Clock,
  Trash2, Pin, PinOff, ListChecks, GitBranch, Shield,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   Types
════════════════════════════════════════════════════════════════ */
export type NavChild = {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
};

type RailEntry =
  | { type: "link";      key: string; icon: React.ElementType; label: string; href: string }
  | { type: "group";     key: string; icon: React.ElementType; label: string; roles?: string[]; hasBadge?: boolean; items: NavChild[] }
  | { type: "separator"; key: string };

type HistoryEntry = { href: string; name: string; section: string; ts: number };

/* ════════════════════════════════════════════════════════════════
   Module definitions  (single source of truth for the whole app)
════════════════════════════════════════════════════════════════ */
export const RAIL: RailEntry[] = [
  { type: "link",      key: "dashboard", icon: LayoutDashboard, label: "Dashboard",           href: "/dashboard" },
  { type: "link",      key: "approvals", icon: ListChecks,     label: "Approval Workbench",  href: "/approvals"  },
  { type: "separator", key: "s1" },
  {
    type: "group", key: "crm", icon: Users2, label: "Sales & CRM",
    roles: ["admin","director","sales","pm"],
    items: [
      { name: "Leads",        href: "/crm/leads",       icon: Users },
      { name: "Quotations",   href: "/crm/quotations",  icon: FileText },
      { name: "Client POs",   href: "/crm/client-pos",  icon: FileCheck },
      { name: "Invoices",     href: "/crm/invoices",    icon: Receipt },
      { name: "Tasks",        href: "/crm/tasks",       icon: CheckSquare },
      { name: "Escalations",  href: "/crm/escalations", icon: AlertTriangle },
    ],
  },
  {
    type: "group", key: "procurement", icon: ShoppingCart, label: "Procurement",
    hasBadge: true,
    roles: ["admin","director","pm","warehouse","finance"],
    items: [
      { name: "Dashboard",          href: "/procurement/dashboard",   icon: BarChart2 },
      { name: "Vendors",            href: "/procurement/vendors",     icon: Building2,    roles: ["admin","director","pm"] },
      { name: "Materials",          href: "/procurement/materials",   icon: Package,      roles: ["admin","director","pm"] },
      { name: "Vendor Quotations",  href: "/procurement/quotations",  icon: ClipboardList,roles: ["admin","director","pm"] },
      { name: "Purchase Orders",    href: "/procurement/pos",         icon: ShoppingCart },
      { name: "GRNs",               href: "/procurement/grns",        icon: Boxes },
      { name: "GRN Returns",        href: "/procurement/grn-returns", icon: RotateCcw,    roles: ["admin","director","pm","warehouse"] },
      { name: "Invoices",           href: "/procurement/invoices",    icon: FilePlus,     roles: ["admin","director","pm","finance"] },
    ],
  },
  {
    type: "group", key: "projects", icon: FolderKanban, label: "Projects",
    roles: ["admin","director","pm","sales"],
    items: [
      { name: "Projects Hub", href: "/projects",             icon: FolderKanban },
      { name: "Contractors",  href: "/projects/contractors", icon: HardHat },
    ],
  },
  {
    type: "group", key: "inventory", icon: Warehouse, label: "Inventory",
    roles: ["admin","director","warehouse","pm"],
    items: [
      { name: "Dashboard",         href: "/inventory/dashboard",         icon: LayoutDashboard },
      { name: "Stock Summary",     href: "/inventory/stock-levels",      icon: Boxes },
      { name: "Warehouses",        href: "/inventory/warehouses",        icon: Warehouse },
      { name: "Allocations",       href: "/inventory/allocations",       icon: ClipboardList },
      { name: "Material Returns",  href: "/inventory/returns",           icon: RotateCcw },
      { name: "Reorder Planning",  href: "/inventory/reorder-planning",  icon: AlertTriangle },
      { name: "Stock Transfers",   href: "/inventory/stock-transfers",   icon: ArrowRightLeft },
      { name: "Delivery Challans", href: "/inventory/delivery-challans", icon: Truck },
      { name: "Stock Ledger",      href: "/inventory/stock-ledger",      icon: BookOpen },
      { name: "Stock Valuation",   href: "/inventory/stock-valuation",   icon: Scale },
      { name: "Audits",            href: "/inventory/audits",            icon: ClipboardCheck },
    ],
  },
  {
    type: "group", key: "engineering", icon: FileCode, label: "Engineering",
    roles: ["admin","director","pm"],
    items: [
      { name: "Design Documents", href: "/engineering/docs", icon: Layers },
    ],
  },
  {
    type: "group", key: "commissioning", icon: CheckCircle2, label: "Commissioning",
    roles: ["admin","director","pm"],
    items: [
      { name: "Checklists", href: "/commissioning", icon: CheckCircle2 },
    ],
  },
  {
    type: "group", key: "oam", icon: Wrench, label: "O&M & AMC",
    roles: ["admin","director","pm"],
    items: [
      { name: "AMC Contracts",   href: "/oam/amc",        icon: FileText },
      { name: "Maintenance",     href: "/oam/maintenance", icon: Calendar },
      { name: "Service Tickets", href: "/oam/tickets",     icon: AlertTriangle },
    ],
  },
  { type: "separator", key: "s2" },
  {
    type: "group", key: "finance", icon: DollarSign, label: "Finance & Reports",
    roles: ["admin","director","finance"],
    items: [
      { name: "Finance Dashboard",  href: "/finance/dashboard", icon: DollarSign },
      { name: "Reports",            href: "/reports",           icon: BarChart3 },
      { name: "Vendor Performance", href: "/reports/vendors",   icon: TrendingUp },
    ],
  },
  {
    type: "group", key: "admin", icon: Settings2, label: "Administration",
    roles: ["admin","director"],
    items: [
      { name: "User Management", href: "/admin/users",      icon: UserCog  },
      { name: "Audit Logs",      href: "/admin/audit-logs", icon: ScrollText },
      { name: "Access Control",  href: "/admin/rbac",       icon: Shield,  roles: ["admin"] },
    ],
  },
];

/* ════════════════════════════════════════════════════════════════
   Flat lookup: href → {name, section}  (for history display)
════════════════════════════════════════════════════════════════ */
export const HREF_META: Record<string, { name: string; section: string; icon: React.ElementType }> = {};
RAIL.forEach((e) => {
  if (e.type === "link")  HREF_META[e.href] = { name: e.label, section: "Core", icon: e.icon };
  if (e.type === "group") e.items.forEach((item) => { HREF_META[item.href] = { name: item.name, section: e.label, icon: item.icon }; });
});

/* ════════════════════════════════════════════════════════════════
   localStorage persistence
════════════════════════════════════════════════════════════════ */
const HISTORY_KEY  = "mystics_nav_history";     // HistoryEntry[]  — rich history for NavRail
const FAVORITES_KEY  = "mystics_nav_favorites"; // string[]        — favorited hrefs

const MAX_HISTORY   = 15;

function readHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}

function pushHistory(entry: Omit<HistoryEntry, "ts">) {
  const prev = readHistory().filter((h) => h.href !== entry.href);
  const next = [{ ...entry, ts: Date.now() }, ...prev].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

function readFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]"); } catch { return []; }
}

function writeFavorites(hrefs: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(hrefs));
}

/* ════════════════════════════════════════════════════════════════
   Active-section detection
════════════════════════════════════════════════════════════════ */
function getActiveSectionKey(path: string, entries: RailEntry[]): string | null {
  for (const e of entries) {
    if (e.type === "link")  { if (path === e.href) return e.key; }
    if (e.type === "group") {
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

/* ════════════════════════════════════════════════════════════════
   Hooks
════════════════════════════════════════════════════════════════ */
function useProcBadge() {
  const { data } = useQuery({
    queryKey: ["rail-proc-badges"],
    queryFn: () => apiGet<{ draftPOs: number; pendingInvoices: number }>("/procurement/badge-counts"),
    refetchInterval: 60_000, staleTime: 30_000, retry: false,
  });
  return (data?.draftPOs ?? 0) + (data?.pendingInvoices ?? 0);
}

function useNavHistory(location: string, userId?: number): HistoryEntry[] {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Refresh from localStorage on mount and whenever location changes
  useEffect(() => {
    const meta = HREF_META[location];
    if (meta) {
      pushHistory({ href: location, name: meta.name, section: meta.section });
      // Keep the user-scoped command palette list in sync
      if (userId) addRecentEntry(userId, location, meta.name, meta.section);
    }
    setHistory(readHistory());
  }, [location, userId]);

  return history;
}

function useFavorites(): [Set<string>, (href: string) => void] {
  const [favSet, setFavSet] = useState<Set<string>>(() => new Set(readFavorites()));
  const toggle = useCallback((href: string) => {
    setFavSet((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href); else next.add(href);
      writeFavorites([...next]);
      return next;
    });
  }, []);
  return [favSet, toggle];
}

/* ════════════════════════════════════════════════════════════════
   Time-ago helper
════════════════════════════════════════════════════════════════ */
function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ════════════════════════════════════════════════════════════════
   Rail icon button
════════════════════════════════════════════════════════════════ */
function RailBtn({
  icon: Icon,
  label,
  isActive,
  isOpen,
  badge,
  onClick,
  href,
  onPrefetch,
}: {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  isOpen?: boolean;
  badge?: boolean;
  onClick?: () => void;
  href?: string;
  onPrefetch?: () => void;
}) {
  const cls = cn(
    "relative flex items-center justify-center h-10 w-10 rounded-[10px] transition-all duration-150",
    isOpen
      ? "bg-white/15 text-white"
      : isActive
      ? "bg-white/10 text-[#F97316]"
      : "text-white/40 hover:text-white/80 hover:bg-white/6"
  );

  const inner = (
    <>
      {isActive && !isOpen && (
        <motion.div
          layoutId="rail-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#F97316] rounded-r-full"
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
      )}
      <Icon className="h-[18px] w-[18px]" aria-hidden />
      {badge && (
        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#F97316] ring-[1.5px] ring-[#0C1445]" />
      )}
    </>
  );

  return (
    <Tooltip delayDuration={500} disableHoverableContent>
      <TooltipTrigger asChild>
        {href ? (
          <Link href={href}>
            <div aria-current={isActive ? "page" : undefined} className={cls} onMouseEnter={onPrefetch}>{inner}</div>
          </Link>
        ) : (
          <button onClick={onClick} onMouseEnter={onPrefetch} className={cls} aria-label={label} aria-expanded={isOpen}>{inner}</button>
        )}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={12} className="text-xs font-semibold">{label}</TooltipContent>
    </Tooltip>
  );
}

/* ════════════════════════════════════════════════════════════════
   Flyout — renders the sliding panel for any open key
════════════════════════════════════════════════════════════════ */
function FlyoutItem({
  item,
  isActive,
  isFav,
  onNav,
  onFavToggle,
}: {
  item: NavChild;
  isActive: boolean;
  isFav: boolean;
  onNav: () => void;
  onFavToggle: (href: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={item.href} onClick={onNav}>
      <div
        aria-current={isActive ? "page" : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
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
        {/* Favorite toggle — appears on hover or if already favorited */}
        {(hovered || isFav) && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFavToggle(item.href); }}
            aria-label={isFav ? "Unpin" : "Pin to favorites"}
            className={cn(
              "shrink-0 transition-colors",
              isFav ? "text-[#F97316]" : "text-white/25 hover:text-white/60"
            )}
          >
            <Star className={cn("h-3.5 w-3.5", isFav && "fill-[#F97316]")} />
          </button>
        )}
        {isActive && !hovered && !isFav && (
          <ChevronRight className="h-3 w-3 text-white/30 shrink-0" aria-hidden />
        )}
      </div>
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pb-0.5 pt-2 text-[9px] font-bold uppercase tracking-[0.1em] text-white/25 select-none">
      {label}
    </p>
  );
}

/* ════════════════════════════════════════════════════════════════
   History flyout content
════════════════════════════════════════════════════════════════ */
function HistoryFlyout({
  history,
  location,
  onNav,
  onClear,
}: {
  history: HistoryEntry[];
  location: string;
  onNav: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 text-white/50" />
          <span className="text-[13px] font-bold text-white tracking-tight">Recently Visited</span>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClear}
            aria-label="Clear history"
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            <span>Clear</span>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none py-2 px-2">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Clock className="h-8 w-8 text-white/10" />
            <p className="text-[12px] text-white/25 text-center leading-snug">
              Pages you visit appear here
            </p>
          </div>
        ) : (
          history.slice(0, 12).map((entry) => {
            const meta = HREF_META[entry.href];
            const Icon = meta?.icon ?? LayoutDashboard;
            const isActive = location === entry.href;
            return (
              <Link key={entry.href} href={entry.href} onClick={onNav}>
                <div
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-[8px] transition-all duration-150 cursor-pointer group",
                    isActive ? "bg-white/12" : "hover:bg-white/6"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-white/30 group-hover:text-white/60" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13px] font-medium truncate", isActive ? "text-white" : "text-white/55 group-hover:text-white/90")}>
                      {entry.name}
                    </p>
                    <p className="text-[10px] text-white/25 truncate">{entry.section}</p>
                  </div>
                  <span className="text-[10px] text-white/20 shrink-0 tabular-nums">{timeAgo(entry.ts)}</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Favorites flyout content
════════════════════════════════════════════════════════════════ */
function FavoritesFlyout({
  favorites,
  location,
  onNav,
  onFavToggle,
}: {
  favorites: Set<string>;
  location: string;
  onNav: () => void;
  onFavToggle: (href: string) => void;
}) {
  // Group by section
  const grouped = new Map<string, NavChild[]>();
  for (const href of favorites) {
    const meta = HREF_META[href];
    if (!meta) continue;
    const item: NavChild = { name: meta.name, href, section: meta.section, icon: meta.icon } as NavChild & { section: string };
    const list = grouped.get(meta.section) ?? [];
    list.push(item);
    grouped.set(meta.section, list);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4 h-14 shrink-0 border-b border-white/5 gap-2.5">
        <Star className="h-4 w-4 text-[#F97316] fill-[#F97316]" />
        <span className="text-[13px] font-bold text-white tracking-tight">Favorites</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none py-2 px-2">
        {favorites.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 px-4">
            <Star className="h-8 w-8 text-white/10" />
            <p className="text-[12px] text-white/25 text-center leading-snug">
              Pin pages by clicking ⭐ on any nav item
            </p>
          </div>
        ) : (
          [...grouped.entries()].map(([section, items]) => (
            <div key={section}>
              <SectionLabel label={section} />
              {items.map((item) => (
                <FlyoutItem
                  key={item.href}
                  item={item}
                  isActive={location === item.href}
                  isFav={true}
                  onNav={onNav}
                  onFavToggle={onFavToggle}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Module flyout content
════════════════════════════════════════════════════════════════ */
function ModuleFlyout({
  section,
  role,
  location,
  history,
  favorites,
  onNav,
  onFavToggle,
}: {
  section: Extract<RailEntry, { type: "group" }>;
  role: string;
  location: string;
  history: HistoryEntry[];
  favorites: Set<string>;
  onNav: () => void;
  onFavToggle: (href: string) => void;
}) {
  const visibleItems = section.items.filter((item) => !item.roles || item.roles.includes(role));

  // Pinned items in this module
  const pinned = visibleItems.filter((item) => favorites.has(item.href));

  // Recently visited items in this module (last 3, not already pinned)
  const moduleHrefs = new Set(section.items.map((i) => i.href));
  const recentInModule = history
    .filter((h) => moduleHrefs.has(h.href) && !favorites.has(h.href))
    .slice(0, 3)
    .map((h) => visibleItems.find((i) => i.href === h.href))
    .filter(Boolean) as NavChild[];

  const hasSections = pinned.length > 0 || recentInModule.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4 h-14 shrink-0 border-b border-white/5 gap-2.5">
        <section.icon className="h-4 w-4 text-[#F97316]" aria-hidden />
        <span className="text-[13px] font-bold text-white tracking-tight">{section.label}</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none py-2 px-2">
        {pinned.length > 0 && (
          <>
            <SectionLabel label="Pinned" />
            {pinned.map((item) => (
              <FlyoutItem
                key={item.href}
                item={item}
                isActive={location === item.href || location.startsWith(item.href + "/")}
                isFav={true}
                onNav={onNav}
                onFavToggle={onFavToggle}
              />
            ))}
          </>
        )}
        {recentInModule.length > 0 && (
          <>
            <SectionLabel label="Recently Visited" />
            {recentInModule.map((item) => (
              <FlyoutItem
                key={item.href}
                item={item}
                isActive={location === item.href || location.startsWith(item.href + "/")}
                isFav={false}
                onNav={onNav}
                onFavToggle={onFavToggle}
              />
            ))}
          </>
        )}
        {hasSections && (
          <div className="mx-3 my-2 h-px bg-white/5" />
        )}
        {hasSections && <SectionLabel label="All Pages" />}
        {visibleItems.map((item) => (
          <FlyoutItem
            key={item.href}
            item={item}
            isActive={location === item.href || (item.href !== "/projects" && location.startsWith(item.href + "/"))}
            isFav={favorites.has(item.href)}
            onNav={onNav}
            onFavToggle={onFavToggle}
          />
        ))}
      </div>
      <div className="shrink-0 px-4 py-3 border-t border-white/5">
        <p className="text-[10px] text-white/20">
          Press <kbd className="px-1 py-0.5 rounded bg-white/8 text-white/35 font-mono text-[9px]">Esc</kbd> to close
          · <kbd className="px-1 py-0.5 rounded bg-white/8 text-white/35 font-mono text-[9px]">⌘K</kbd> to search
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   NavRail — main export
════════════════════════════════════════════════════════════════ */
type SpecialKey = "recents" | "favorites";

/* ── Prefetch map: hover a nav group → warm the most-used endpoint ── */
const PREFETCH_MAP: Record<string, { key: string[]; fn: () => Promise<unknown> }[]> = {
  crm:         [{ key: ["leads"],       fn: () => apiGet("/leads?limit=30") }],
  projects:    [{ key: ["projects"],    fn: () => apiGet("/projects?limit=30") }],
  procurement: [{ key: ["proc-dash"],   fn: () => apiGet("/procurement-dashboard") }],
  inventory:   [{ key: ["warehouses"],  fn: () => apiGet("/warehouses") }],
  approvals:   [{ key: ["approvals-pending"], fn: () => apiGet("/approvals/my-pending") }],
  finance:     [{ key: ["finance-dash"], fn: () => apiGet("/finance/dashboard") }],
};

export function NavRail() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const procBadge = useProcBadge();
  const history = useNavHistory(location, user?.id);
  const [favorites, toggleFavorite] = useFavorites();
  const queryClient = useQueryClient();

  const role = user?.role ?? "";
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const activeKey = getActiveSectionKey(location, RAIL);

  // RBAC permission map — same query key as App-level; served from React Query cache
  const { data: permMap } = useQuery<Record<string, Record<string, boolean>>>({
    queryKey: ["rbac-my-permissions"],
    queryFn: () => apiGet("/rbac/my-permissions"),
    enabled: !!user,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Filter by role first (fast), then by RBAC view permission (cached)
  const visible = RAIL.filter((e) => {
    if (e.type === "separator") return true;
    if (e.type === "group") {
      if (e.roles && !e.roles.includes(role)) return false;
      if (role !== "admin" && permMap) return permMap[e.key]?.view !== false;
      return true;
    }
    if (e.type === "link") {
      if (role !== "admin" && permMap) return permMap[e.key]?.view !== false;
      return true;
    }
    return true;
  }) as RailEntry[];

  // Publish flyout open state to Shell via context
  const { setNavOpen } = useNavState();
  useEffect(() => { setNavOpen(!!openKey); }, [openKey, setNavOpen]);

  // Close flyout on navigation
  useEffect(() => { setOpenKey(null); }, [location]);

  // Escape key closes flyout
  useEffect(() => {
    if (!openKey) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenKey(null); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [openKey]);

  const toggle = useCallback((key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  }, []);

  const closeFlyout = useCallback(() => setOpenKey(null), []);

  // Determine what the open flyout renders
  const openGroupSection = openKey && openKey !== "recents" && openKey !== "favorites"
    ? (visible.find((e) => e.type === "group" && e.key === openKey) as Extract<RailEntry, { type: "group" }> | undefined)
    : undefined;

  const showFlyout = !!openKey;
  const showHistory = history.length > 0;

  return (
    <>
      {/* ══ Icon Rail ══════════════════════════════════════════════ */}
      <nav
        aria-label="Main navigation"
        className="hidden lg:flex flex-col w-[60px] shrink-0 h-full z-30 relative"
        style={{
          background: "linear-gradient(180deg,#0C1445 0%,#0F172A 100%)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center h-14 shrink-0">
          <div
            className="h-8 w-8 rounded-[9px] flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#F97316,#EA580C)", boxShadow: "0 0 14px rgba(249,115,22,0.35)" }}
            aria-label="Mystics ERP"
          >
            <Zap className="h-4 w-4 text-white" aria-hidden />
          </div>
        </div>

        <div className="mx-3.5 h-px bg-white/5 shrink-0" />

        {/* Module icons */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none py-2 flex flex-col items-center gap-0.5">
          {visible.map((entry) => {
            if (entry.type === "separator") {
              return <div key={entry.key} className="w-6 h-px bg-white/[0.07] my-1.5 shrink-0" />;
            }
            if (entry.type === "link") {
              return (
                <RailBtn
                  key={entry.key}
                  icon={entry.icon}
                  label={entry.label}
                  isActive={activeKey === entry.key}
                  href={entry.href}
                />
              );
            }
            // group
            const showBadge = entry.hasBadge && procBadge > 0;
            const prefetches = PREFETCH_MAP[entry.key];
            return (
              <RailBtn
                key={entry.key}
                icon={entry.icon}
                label={entry.label}
                isActive={activeKey === entry.key}
                isOpen={openKey === entry.key}
                badge={showBadge}
                onClick={() => toggle(entry.key)}
                onPrefetch={prefetches ? () => {
                  prefetches.forEach(({ key, fn }) =>
                    queryClient.prefetchQuery({ queryKey: key, queryFn: fn, staleTime: 60_000 })
                  );
                } : undefined}
              />
            );
          })}
        </div>

        {/* Bottom utilities */}
        <div className="shrink-0 flex flex-col items-center gap-0.5 py-3 border-t border-white/5">
          {/* Favorites */}
          <RailBtn
            icon={Star}
            label="Favorites"
            isOpen={openKey === "favorites"}
            isActive={openKey === "favorites"}
            onClick={() => toggle("favorites")}
          />
          {/* History */}
          {showHistory && (
            <RailBtn
              icon={Clock}
              label="Recently Visited"
              isOpen={openKey === "recents"}
              isActive={openKey === "recents"}
              onClick={() => toggle("recents")}
            />
          )}

          <div className="w-6 h-px bg-white/5 my-1" />

          {/* Sign out */}
          <Tooltip delayDuration={500}>
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

          {/* User avatar */}
          <Tooltip delayDuration={500}>
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

      {/* ══ Flyout system ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {showFlyout && (
          <>
            {/* Panel — pushes content via Shell margin, no overlay backdrop */}
            <motion.div
              key={`flyout-${openKey}`}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 bottom-0 left-[60px] w-60 z-[29] hidden lg:flex flex-col overflow-hidden"
              style={{
                background: "linear-gradient(180deg,#0F1C3F 0%,#0D1529 100%)",
                borderRight: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "8px 0 32px rgba(0,0,0,0.45)",
              }}
              role="navigation"
              aria-label={openGroupSection?.label ?? (openKey === "favorites" ? "Favorites" : "Recently Visited")}
            >
              {/* Close button — always visible in header */}
              <button
                onClick={closeFlyout}
                aria-label="Close panel"
                className="absolute top-3.5 right-3 h-7 w-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white hover:bg-white/8 transition-colors z-10"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {openKey === "recents" && (
                <HistoryFlyout
                  history={history}
                  location={location}
                  onNav={closeFlyout}
                  onClear={() => { clearHistory(); if (user?.id) clearRecentEntries(user.id); setOpenKey(null); }}
                />
              )}
              {openKey === "favorites" && (
                <FavoritesFlyout
                  favorites={favorites}
                  location={location}
                  onNav={closeFlyout}
                  onFavToggle={toggleFavorite}
                />
              )}
              {openGroupSection && (
                <ModuleFlyout
                  section={openGroupSection}
                  role={role}
                  location={location}
                  history={history}
                  favorites={favorites}
                  onNav={closeFlyout}
                  onFavToggle={toggleFavorite}
                />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
