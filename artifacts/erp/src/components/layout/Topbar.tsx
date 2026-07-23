import { useAuth } from "@/lib/auth";
import {
  Bell, CheckCheck, ExternalLink, Search, ArrowRight, Menu, Zap,
  LayoutDashboard, Users, FileText, FileCheck, FilePlus, CheckSquare,
  AlertTriangle, FolderKanban, HardHat, Warehouse, Boxes, Truck,
  BookOpen, Scale, ClipboardCheck, Layers, Wrench,
  Building2, Package, ClipboardList, ShoppingCart, BarChart2, ArrowRightLeft,
  RotateCcw, DollarSign, BarChart3, UserCog, ScrollText, TrendingUp,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef, useState, useCallback } from "react";
import { addRecentEntry, getRecentEntries, type RecentEntry } from "@/lib/recentHistory";

/* ── All nav items for command palette ───────────────────────────
   `roles` mirrors NavRail exactly — item visible when:
     • no roles field  → visible to all authenticated users
     • roles field     → only listed roles can see it
   Unknown / unmapped roles fall through to deny-by-default (they
   only see items with no roles restriction, i.e. Dashboard).
─────────────────────────────────────────────────────────────── */
const ALL_NAV: { name: string; href: string; icon: React.ElementType; section: string; roles?: string[] }[] = [
  // Core — no role restriction
  { name: "Dashboard",             href: "/dashboard",               icon: LayoutDashboard, section: "Core" },

  // Sales & CRM — matches NavRail group roles
  { name: "Leads",                 href: "/crm/leads",               icon: Users,           section: "Sales & CRM",   roles: ["admin","director","sales","pm"] },
  { name: "Quotations",            href: "/crm/quotations",          icon: FileText,        section: "Sales & CRM",   roles: ["admin","director","sales","pm"] },
  { name: "Client POs",            href: "/crm/client-pos",          icon: FileCheck,       section: "Sales & CRM",   roles: ["admin","director","sales","pm"] },
  { name: "Invoices",              href: "/crm/invoices",            icon: FilePlus,        section: "Sales & CRM",   roles: ["admin","director","sales","pm"] },
  { name: "Tasks",                 href: "/crm/tasks",               icon: CheckSquare,     section: "Sales & CRM",   roles: ["admin","director","sales","pm"] },
  { name: "Escalations",           href: "/crm/escalations",         icon: AlertTriangle,   section: "Sales & CRM",   roles: ["admin","director","sales","pm"] },

  // Project Mgmt — matches NavRail group roles
  { name: "Projects Hub",          href: "/projects",                icon: FolderKanban,    section: "Project Mgmt",  roles: ["admin","director","pm","sales"] },
  { name: "Contractors",           href: "/projects/contractors",    icon: HardHat,         section: "Project Mgmt",  roles: ["admin","director","pm","sales"] },

  // Inventory — matches NavRail group roles
  { name: "Warehouses",            href: "/inventory/warehouses",    icon: Warehouse,       section: "Inventory",     roles: ["admin","director","warehouse","pm"] },
  { name: "Stock Transfers",       href: "/inventory/stock-transfers", icon: ArrowRightLeft, section: "Inventory",    roles: ["admin","director","warehouse","pm"] },
  { name: "Delivery Challans",     href: "/inventory/delivery-challans", icon: Truck,       section: "Inventory",     roles: ["admin","director","warehouse","pm"] },
  { name: "Stock Ledger",          href: "/inventory/stock-ledger",  icon: BookOpen,        section: "Inventory",     roles: ["admin","director","warehouse","pm"] },
  { name: "Stock Valuation",       href: "/inventory/stock-valuation", icon: Scale,         section: "Inventory",     roles: ["admin","director","warehouse","pm"] },
  { name: "Audits",                href: "/inventory/audits",        icon: ClipboardCheck,  section: "Inventory",     roles: ["admin","director","warehouse","pm"] },

  // Engineering — matches NavRail group roles
  { name: "Design Documents",      href: "/engineering/docs",        icon: Layers,          section: "Engineering",   roles: ["admin","director","pm"] },

  // Commissioning — matches NavRail group roles
  { name: "Checklists",            href: "/commissioning",           icon: CheckSquare,     section: "Commissioning", roles: ["admin","director","pm"] },

  // O&M & AMC — matches NavRail group roles
  { name: "AMC Contracts",         href: "/oam/amc",                 icon: Wrench,          section: "O&M & AMC",     roles: ["admin","director","pm"] },
  { name: "Maintenance",           href: "/oam/maintenance",         icon: Wrench,          section: "O&M & AMC",     roles: ["admin","director","pm"] },
  { name: "Service Tickets",       href: "/oam/tickets",             icon: AlertTriangle,   section: "O&M & AMC",     roles: ["admin","director","pm"] },

  // Procurement — group roles + per-item roles mirror NavRail exactly
  { name: "Procurement Dashboard", href: "/procurement/dashboard",   icon: BarChart2,       section: "Procurement",   roles: ["admin","director","pm","warehouse","finance"] },
  { name: "Vendors",               href: "/procurement/vendors",     icon: Building2,       section: "Procurement",   roles: ["admin","director","pm"] },
  { name: "Materials",             href: "/procurement/materials",   icon: Package,         section: "Procurement",   roles: ["admin","director","pm"] },
  { name: "Vendor Quotations",     href: "/procurement/quotations",  icon: ClipboardList,   section: "Procurement",   roles: ["admin","director","pm"] },
  { name: "Purchase Orders",       href: "/procurement/pos",         icon: ShoppingCart,    section: "Procurement",   roles: ["admin","director","pm","warehouse","finance"] },
  { name: "GRNs",                  href: "/procurement/grns",        icon: Boxes,           section: "Procurement",   roles: ["admin","director","pm","warehouse","finance"] },
  { name: "GRN Returns",           href: "/procurement/grn-returns", icon: RotateCcw,       section: "Procurement",   roles: ["admin","director","pm","warehouse"] },
  { name: "Procurement Invoices",  href: "/procurement/invoices",    icon: FilePlus,        section: "Procurement",   roles: ["admin","director","pm","finance"] },

  // Finance — matches NavRail group roles
  { name: "Finance Dashboard",     href: "/finance/dashboard",       icon: DollarSign,      section: "Finance",       roles: ["admin","director","finance"] },
  { name: "Reports",               href: "/reports",                 icon: BarChart3,       section: "Finance",       roles: ["admin","director","finance"] },
  { name: "Vendor Performance",    href: "/reports/vendors",         icon: TrendingUp,      section: "Finance",       roles: ["admin","director","finance"] },

  // Admin — matches NavRail group roles
  { name: "User Management",       href: "/admin/users",             icon: UserCog,         section: "Admin",         roles: ["admin","director"] },
  { name: "Audit Logs",            href: "/admin/audit-logs",        icon: ScrollText,      section: "Admin",         roles: ["admin","director"] },
];

/* ── Mobile nav groups ───────────────────────────────────────── */
const MOBILE_NAV_GROUPS = [
  { label: "Core",           items: ALL_NAV.filter(n => n.section === "Core") },
  { label: "Sales & CRM",    items: ALL_NAV.filter(n => n.section === "Sales & CRM") },
  { label: "Project Mgmt",   items: ALL_NAV.filter(n => n.section === "Project Mgmt") },
  { label: "Inventory",      items: ALL_NAV.filter(n => n.section === "Inventory") },
  { label: "Procurement",    items: ALL_NAV.filter(n => n.section === "Procurement") },
  { label: "Finance",        items: ALL_NAV.filter(n => n.section === "Finance") },
  { label: "O&M & AMC",      items: ALL_NAV.filter(n => n.section === "O&M & AMC") },
  { label: "Engineering",    items: ALL_NAV.filter(n => n.section === "Engineering") },
  { label: "Commissioning",  items: ALL_NAV.filter(n => n.section === "Commissioning") },
  { label: "Admin",          items: ALL_NAV.filter(n => n.section === "Admin") },
];

/* ── Breadcrumb route map ────────────────────────────────────── */
interface BreadcrumbItem { label: string; href?: string }

const STATIC_ROUTES: Record<string, BreadcrumbItem[]> = {
  "/dashboard":                   [{ label: "Dashboard" }],
  "/crm/leads":                   [{ label: "Sales & CRM", href: "/crm/leads" },       { label: "Leads" }],
  "/crm/quotations":              [{ label: "Sales & CRM", href: "/crm/leads" },       { label: "Quotations" }],
  "/crm/client-pos":              [{ label: "Sales & CRM", href: "/crm/leads" },       { label: "Client POs" }],
  "/crm/invoices":                [{ label: "Sales & CRM", href: "/crm/leads" },       { label: "Invoices" }],
  "/crm/tasks":                   [{ label: "Sales & CRM", href: "/crm/leads" },       { label: "Tasks" }],
  "/crm/escalations":             [{ label: "Sales & CRM", href: "/crm/leads" },       { label: "Escalations" }],
  "/projects":                    [{ label: "Project Mgmt", href: "/projects" },       { label: "Projects Hub" }],
  "/projects/contractors":        [{ label: "Project Mgmt", href: "/projects" },       { label: "Contractors" }],
  "/inventory/warehouses":        [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Warehouses" }],
  "/inventory/stock-transfers":   [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Stock Transfers" }],
  "/inventory/delivery-challans": [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Delivery Challans" }],
  "/inventory/stock-ledger":      [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Stock Ledger" }],
  "/inventory/stock-valuation":   [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Stock Valuation" }],
  "/inventory/audits":            [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Audits" }],
  "/engineering/docs":            [{ label: "Engineering" },                            { label: "Design Documents" }],
  "/commissioning":               [{ label: "Commissioning" }],
  "/oam/amc":                     [{ label: "O&M & AMC" },                             { label: "AMC Contracts" }],
  "/oam/maintenance":             [{ label: "O&M & AMC" },                             { label: "Maintenance" }],
  "/oam/tickets":                 [{ label: "O&M & AMC" },                             { label: "Service Tickets" }],
  "/procurement/dashboard":       [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Dashboard" }],
  "/procurement/vendors":         [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendors" }],
  "/procurement/materials":       [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Materials" }],
  "/procurement/quotations":      [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendor Quotations" }],
  "/procurement/pos":             [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Purchase Orders" }],
  "/procurement/grns":            [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRNs" }],
  "/procurement/grn-returns":     [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRN Returns" }],
  "/procurement/invoices":        [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Invoices" }],
  "/finance/dashboard":           [{ label: "Finance & Reports", href: "/finance/dashboard" }, { label: "Finance Dashboard" }],
  "/reports":                     [{ label: "Finance & Reports", href: "/finance/dashboard" }, { label: "Reports" }],
  "/reports/vendors":             [{ label: "Finance & Reports", href: "/finance/dashboard" }, { label: "Vendor Performance" }],
  "/admin/users":                 [{ label: "Admin" },                                 { label: "User Management" }],
  "/admin/audit-logs":            [{ label: "Admin" },                                 { label: "Audit Logs" }],
};

function getBreadcrumbs(path: string): BreadcrumbItem[] {
  if (STATIC_ROUTES[path]) return STATIC_ROUTES[path];
  if (path.startsWith("/crm/leads/"))
    return [{ label: "Sales & CRM", href: "/crm/leads" }, { label: "Leads", href: "/crm/leads" }, { label: "Lead Detail" }];
  if (path.startsWith("/crm/quotations/"))
    return [{ label: "Sales & CRM", href: "/crm/leads" }, { label: "Quotations", href: "/crm/quotations" }, { label: "Quotation" }];
  if (path.match(/^\/projects\/\d+/))
    return [{ label: "Project Mgmt", href: "/projects" }, { label: "Projects Hub", href: "/projects" }, { label: "Workspace" }];
  if (path.match(/^\/inventory\/warehouses\/\d+/))
    return [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Warehouses", href: "/inventory/warehouses" }, { label: "Warehouse" }];
  if (path.match(/^\/procurement\/vendors\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendors", href: "/procurement/vendors" }, { label: "Vendor" }];
  if (path.match(/^\/procurement\/quotations\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Quotations", href: "/procurement/quotations" }, { label: "Quotation" }];
  if (path.match(/^\/procurement\/pos\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Purchase Orders", href: "/procurement/pos" }, { label: "PO Detail" }];
  if (path.match(/^\/procurement\/grns\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRNs", href: "/procurement/grns" }, { label: "GRN Detail" }];
  if (path.match(/^\/procurement\/grn-returns\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRN Returns", href: "/procurement/grn-returns" }, { label: "Return Detail" }];
  if (path.match(/^\/procurement\/invoices\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Invoices", href: "/procurement/invoices" }, { label: "Invoice" }];
  if (path.match(/^\/engineering\/docs\/\d+/))
    return [{ label: "Engineering" }, { label: "Design Documents", href: "/engineering/docs" }, { label: "Document" }];
  if (path.match(/^\/commissioning\/\d+/))
    return [{ label: "Commissioning", href: "/commissioning" }, { label: "Checklist" }];
  return [{ label: "Mystics ERP" }];
}

function getFYLabel() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const fyStart = month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY ${fyStart}-${String(fyStart + 1).slice(-2)}`;
}

const NOTIF_ICON_COLOR: Record<string, string> = {
  info:     "bg-blue-100 text-blue-600",
  warning:  "bg-amber-100 text-amber-600",
  success:  "bg-emerald-100 text-emerald-600",
  error:    "bg-red-100 text-red-600",
  approval: "bg-orange-100 text-orange-600",
};

/* ── Route-level role filter (mirrors NavRail deny-by-default) ── */
function navItemAllowed(item: typeof ALL_NAV[number], role: string): boolean {
  // Items with no roles field are visible to all authenticated users.
  // Items with a roles field require the user's role to be listed.
  // Unknown/unmapped roles only see items that have no restriction.
  return !item.roles || item.roles.includes(role);
}

/* ── Palette item (unified type for nav + detail entries) ────── */
interface PaletteItem {
  href: string;
  label: string;
  section: string;
  icon: React.ElementType;
  roles?: string[];
}

function navToPaletteItem(n: typeof ALL_NAV[number]): PaletteItem {
  return { href: n.href, label: n.name, section: n.section, icon: n.icon, roles: n.roles };
}

/** Convert a RecentEntry to a PaletteItem; returns null if unresolvable. */
function recentEntryToPaletteItem(entry: RecentEntry): PaletteItem | null {
  // Exact nav item match (list pages)
  const navItem = ALL_NAV.find((n) => n.href === entry.href);
  if (navItem) return navToPaletteItem(navItem);
  // Detail page — inherit icon and roles from parent nav item
  const parent = ALL_NAV.find((n) => entry.href.startsWith(n.href + "/"));
  return {
    href: entry.href,
    label: entry.label || entry.href,
    section: entry.section || parent?.section || "",
    icon: parent?.icon ?? FileText,
    roles: parent?.roles,
  };
}

/* ── Command Palette ─────────────────────────────────────────── */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  /* Filter nav by role — route-level, deny-by-default for unknown roles */
  const role = user?.role ?? "";
  const roleNav: PaletteItem[] = ALL_NAV
    .filter((item) => navItemAllowed(item, role))
    .map(navToPaletteItem);

  /* Recent items: include detail-page entries + nav items, role-filtered */
  const recentItems: PaletteItem[] = recentEntries
    .map(recentEntryToPaletteItem)
    .filter((item): item is PaletteItem => {
      if (!item) return false;
      if (!item.roles) return true;
      return item.roles.includes(role);
    });

  /* Search results (role-filtered, searches both label and section) */
  const searchResults: PaletteItem[] = query.trim()
    ? roleNav.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.section.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  /* Flat list for keyboard navigation */
  const flatList: PaletteItem[] = query.trim() ? searchResults : [...recentItems, ...roleNav];

  const userId = user?.id;

  // Re-read localStorage whenever `open` becomes true (picks up entries added
  // from detail pages or since the palette was last opened).
  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setRecentEntries(userId ? getRecentEntries(userId) : []);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, userId]);

  // Also refresh whenever the user's role changes so that entries for
  // sections the user can no longer access are flushed from the display.
  useEffect(() => {
    setRecentEntries(userId ? getRecentEntries(userId) : []);
  }, [role, userId]);

  useEffect(() => { setCursor(0); }, [query]);

  const navigate = useCallback(
    (item: PaletteItem) => {
      if (userId) addRecentEntry(userId, item.href, item.label, item.section);
      setLocation(item.href);
      onClose();
    },
    [userId, setLocation, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, flatList.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { if (flatList[cursor]) navigate(flatList[cursor]); }
    else if (e.key === "Escape") onClose();
  };

  if (!open) return null;

  /* Render a single palette item row (works for nav items and detail entries) */
  const NavRow = ({ item, idx }: { item: PaletteItem; idx: number }) => (
    <button
      key={item.href}
      onClick={() => navigate(item)}
      onMouseEnter={() => setCursor(idx)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
        cursor === idx ? "bg-orange-50 dark:bg-orange-500/10" : "hover:bg-gray-50 dark:hover:bg-muted"
      )}
      aria-selected={cursor === idx}
    >
      <div className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
        cursor === idx ? "bg-orange-100 text-[#EA580C]" : "bg-gray-100 dark:bg-muted text-gray-500"
      )}>
        <item.icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] font-semibold", cursor === idx ? "text-gray-900 dark:text-foreground" : "text-gray-700 dark:text-muted-foreground")}>{item.label}</p>
        <p className="text-[11px] text-gray-400">{item.section}</p>
      </div>
      {cursor === idx && <ArrowRight className="h-4 w-4 text-[#EA580C] shrink-0" aria-hidden />}
    </button>
  );

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="px-4 pb-1 pt-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg bg-white dark:bg-card rounded-2xl shadow-2xl border border-gray-200 dark:border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="Command palette" aria-modal
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-border">
          <Search className="h-4 w-4 text-gray-400 shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and modules…"
            className="flex-1 text-[14px] font-medium text-gray-900 dark:text-foreground placeholder:text-gray-400 outline-none bg-transparent"
            aria-label="Search"
          />
          <kbd className="hidden sm:flex px-1.5 py-0.5 rounded-[4px] bg-gray-100 dark:bg-muted text-gray-500 text-[10px] font-mono font-bold">ESC</kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto scrollbar-thin py-1.5">
          {/* Searching: flat filtered list */}
          {query.trim() && (
            <>
              {searchResults.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-400">No results for &ldquo;{query}&rdquo;</div>
              )}
              {searchResults.map((item, idx) => <NavRow key={item.href} item={item} idx={idx} />)}
            </>
          )}

          {/* Not searching: recent + all pages */}
          {!query.trim() && (
            <>
              {recentItems.length > 0 && (
                <>
                  <SectionLabel label="Recent" />
                  {recentItems.map((item, idx) => <NavRow key={`recent-${item.href}`} item={item} idx={idx} />)}
                </>
              )}
              <SectionLabel label="All Pages" />
              {roleNav.map((item, idx) => (
                <NavRow key={item.href} item={item} idx={recentItems.length + idx} />
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 dark:border-border bg-gray-50/50 dark:bg-muted/30">
          {[{ keys: "↑↓", label: "navigate" }, { keys: "↵", label: "open" }, { keys: "esc", label: "close" }].map((h) => (
            <div key={h.label} className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded-[4px] bg-gray-200 dark:bg-muted text-gray-600 text-[10px] font-mono font-bold">{h.keys}</kbd>
              <span className="text-[11px] text-gray-400">{h.label}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded-[4px] bg-gray-200 dark:bg-muted text-gray-600 text-[10px] font-mono font-bold">⌘K</kbd>
            <span className="text-[11px] text-gray-400">close</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Notification bell ───────────────────────────────────────── */
function NotificationBell({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: countData } = useQuery({
    queryKey: ["notifications-count", userId],
    queryFn: () => apiGet<{ count: number }>("/notifications/unread-count", { userId }),
    refetchInterval: 30000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => apiGet<any[]>("/notifications", { userId, limit: 20 }),
    refetchInterval: 60000,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => apiPatch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => apiPost("/notifications/read-all", { userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const unread = countData?.count ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost" size="icon"
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
          className="relative h-9 w-9 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full focus-ring"
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-popover" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-[13px] font-bold text-gray-900">Notifications</p>
            {unread > 0 && <p className="text-[11px] text-gray-500">{unread} unread</p>}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-3 w-3" aria-hidden /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[360px]">
          {(notifications as any[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Bell className="h-8 w-8 mb-2 opacity-20" aria-hidden />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            (notifications as any[]).map((n: any) => (
              <div
                key={n.id}
                onClick={() => { if (!n.isRead) markRead.mutate(n.id); if (n.actionUrl) setLocation(n.actionUrl); }}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && n.actionUrl && setLocation(n.actionUrl)}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors group",
                  !n.isRead && "bg-orange-50/40"
                )}
              >
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5", NOTIF_ICON_COLOR[n.type] ?? "bg-gray-100 text-gray-600")}>
                  {n.type === "approval" ? "A" : n.type === "info" ? "i" : n.type === "warning" ? "!" : n.type === "success" ? "✓" : "!"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[12px] leading-tight", n.isRead ? "text-gray-600 font-medium" : "text-gray-900 font-bold")}>{n.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-tight line-clamp-2">{n.message}</p>
                  {n.entityRef && <p className="text-[10px] text-orange-600 font-mono mt-1">{n.entityRef}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
                {!n.isRead && <div className="h-2 w-2 rounded-full bg-orange-500 shrink-0 mt-1.5" />}
                {n.actionUrl && <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1" aria-hidden />}
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Mobile nav sheet ────────────────────────────────────────── */
function MobileNavSheet() {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation menu" className="lg:hidden text-gray-600 h-9 w-9">
          <Menu className="h-5 w-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-[280px] flex flex-col" style={{ background: "linear-gradient(180deg,#0C1445 0%,#0F172A 100%)" }}>
        {/* Logo header */}
        <div className="flex items-center gap-3 px-4 h-14 shrink-0 border-b border-white/5">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}
          >
            <Zap className="h-3.5 w-3.5 text-white" aria-hidden />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">Mystics ERP</span>
        </div>

        {/* Nav groups */}
        <ScrollArea className="flex-1">
          <div className="py-3 px-2 space-y-4">
            {MOBILE_NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">{group.label}</p>
                {group.items.map((item) => {
                  const isActive =
                    location === item.href ||
                    (item.href !== "/projects" && location.startsWith(item.href + "/"));
                  return (
                    <button
                      key={item.href}
                      onClick={() => { setLocation(item.href); setOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-medium transition-colors text-left",
                        isActive ? "bg-white/12 text-white" : "text-white/50 hover:text-white hover:bg-white/6"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#F97316]" : "text-white/30")} aria-hidden />
                      <span className="flex-1 truncate">{item.name}</span>
                      {isActive && <ChevronRight className="h-3 w-3 text-white/30 shrink-0" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/* ── Topbar ──────────────────────────────────────────────────── */
export function Topbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const breadcrumbs = getBreadcrumbs(location);
  const fyLabel = getFYLabel();

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  /* Cmd+K / Ctrl+K */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="h-14 bg-white/90 dark:bg-card/90 backdrop-blur-md border-b border-gray-200/60 dark:border-border flex items-center gap-3 px-4 sm:px-5 shrink-0 z-10 sticky top-0">

        {/* Mobile menu (lg: hidden — NavRail handles desktop) */}
        <MobileNavSheet />

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 flex-1 min-w-0">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={idx} className="flex items-center gap-1.5 min-w-0">
                {idx > 0 && <span className="text-gray-300 dark:text-border text-xs shrink-0">/</span>}
                {crumb.href && !isLast ? (
                  <Link href={crumb.href}>
                    <span className="text-[13px] font-medium text-gray-400 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground transition-colors cursor-pointer truncate">
                      {crumb.label}
                    </span>
                  </Link>
                ) : (
                  <motion.span
                    key={crumb.label}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className={cn("text-[13px] truncate", isLast ? "font-bold text-gray-900 dark:text-foreground" : "font-medium text-gray-400 dark:text-muted-foreground")}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </motion.span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Cmd+K trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette (Cmd+K)"
          className="flex items-center gap-2 h-9 px-3 rounded-lg bg-gray-100/80 dark:bg-muted hover:bg-gray-200/80 dark:hover:bg-muted/80 text-gray-400 hover:text-gray-700 dark:hover:text-foreground transition-colors text-[13px] shrink-0"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden md:inline font-medium text-[12px]">Search…</span>
          <kbd className="hidden md:flex h-5 px-1 rounded-[4px] bg-white dark:bg-card border border-gray-200 dark:border-border text-gray-500 dark:text-muted-foreground text-[10px] font-mono font-bold shadow-sm">⌘K</kbd>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-500/10 border border-orange-100/60 dark:border-orange-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-[#EA580C]" />
            <span className="text-[11px] font-bold text-[#EA580C] tracking-wide">{fyLabel}</span>
          </div>

          {user?.id ? (
            <NotificationBell userId={user.id} />
          ) : (
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative h-9 w-9 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full">
              <Bell className="h-4 w-4" aria-hidden />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-muted ml-1" aria-label="User menu">
                <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm">
                  <AvatarFallback className="text-white text-[12px] font-bold" style={{ background: "linear-gradient(135deg, #1E293B, #0F172A)" }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mt-2 shadow-popover" align="end">
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-foreground">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground">{user?.email}</p>
                  <Badge variant="outline" className="mt-1 w-fit text-[10px] uppercase font-bold text-gray-600 bg-gray-50">{user?.role}</Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} className="text-red-600 font-medium cursor-pointer p-3 focus:text-red-700 focus:bg-red-50">
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <AnimatePresence>
        {paletteOpen && <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
