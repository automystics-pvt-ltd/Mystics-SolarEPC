import { useAuth } from "@/lib/auth";
import {
  Bell, PanelLeftClose, PanelLeftOpen, CheckCheck, ExternalLink,
  Command, Search, ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { useSidebar } from "@/lib/sidebar-context";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  LayoutDashboard, Users, FileText, FileCheck, FilePlus, CheckSquare,
  AlertTriangle, FolderKanban, HardHat, Warehouse, Boxes, Truck,
  BookOpen, Scale, ClipboardCheck, Zap, Layers, CheckSquare2, Wrench,
  Building2, Package, ClipboardList, ShoppingCart, BarChart2, ArrowRightLeft,
  RotateCcw, DollarSign, BarChart3, UserCog, ScrollText, TrendingUp,
} from "lucide-react";

/* ── All nav items for command palette ───────────────────────── */
const ALL_NAV: { name: string; href: string; icon: React.ElementType; section: string }[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "Core" },
  { name: "Leads", href: "/crm/leads", icon: Users, section: "Sales & CRM" },
  { name: "Quotations", href: "/crm/quotations", icon: FileText, section: "Sales & CRM" },
  { name: "Client POs", href: "/crm/client-pos", icon: FileCheck, section: "Sales & CRM" },
  { name: "Invoices", href: "/crm/invoices", icon: FilePlus, section: "Sales & CRM" },
  { name: "Tasks", href: "/crm/tasks", icon: CheckSquare, section: "Sales & CRM" },
  { name: "Escalations", href: "/crm/escalations", icon: AlertTriangle, section: "Sales & CRM" },
  { name: "Projects Hub", href: "/projects", icon: FolderKanban, section: "Project Mgmt" },
  { name: "Contractors", href: "/projects/contractors", icon: HardHat, section: "Project Mgmt" },
  { name: "Warehouses", href: "/inventory/warehouses", icon: Warehouse, section: "Inventory" },
  { name: "Stock Transfers", href: "/inventory/stock-transfers", icon: ArrowRightLeft, section: "Inventory" },
  { name: "Delivery Challans", href: "/inventory/delivery-challans", icon: Truck, section: "Inventory" },
  { name: "Stock Ledger", href: "/inventory/stock-ledger", icon: BookOpen, section: "Inventory" },
  { name: "Stock Valuation", href: "/inventory/stock-valuation", icon: Scale, section: "Inventory" },
  { name: "Audits", href: "/inventory/audits", icon: ClipboardCheck, section: "Inventory" },
  { name: "Design Documents", href: "/engineering/docs", icon: Layers, section: "Engineering" },
  { name: "Commissioning Checklists", href: "/commissioning", icon: CheckSquare2, section: "Commissioning" },
  { name: "AMC Contracts", href: "/oam/amc", icon: Wrench, section: "O&M & AMC" },
  { name: "Maintenance", href: "/oam/maintenance", icon: Wrench, section: "O&M & AMC" },
  { name: "Service Tickets", href: "/oam/tickets", icon: AlertTriangle, section: "O&M & AMC" },
  { name: "Procurement Dashboard", href: "/procurement/dashboard", icon: BarChart2, section: "Procurement" },
  { name: "Vendors", href: "/procurement/vendors", icon: Building2, section: "Procurement" },
  { name: "Materials", href: "/procurement/materials", icon: Package, section: "Procurement" },
  { name: "Vendor Quotations", href: "/procurement/quotations", icon: ClipboardList, section: "Procurement" },
  { name: "Purchase Orders", href: "/procurement/pos", icon: ShoppingCart, section: "Procurement" },
  { name: "GRNs", href: "/procurement/grns", icon: Boxes, section: "Procurement" },
  { name: "GRN Returns", href: "/procurement/grn-returns", icon: RotateCcw, section: "Procurement" },
  { name: "Procurement Invoices", href: "/procurement/invoices", icon: FilePlus, section: "Procurement" },
  { name: "Finance Dashboard", href: "/finance/dashboard", icon: DollarSign, section: "Finance" },
  { name: "Reports", href: "/reports", icon: BarChart3, section: "Finance" },
  { name: "Vendor Performance", href: "/reports/vendors", icon: TrendingUp, section: "Finance" },
  { name: "User Management", href: "/admin/users", icon: UserCog, section: "Admin" },
  { name: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, section: "Admin" },
];

/* ── Breadcrumb route map ────────────────────────────────────── */
interface BreadcrumbItem { label: string; href?: string }

const STATIC_ROUTES: Record<string, BreadcrumbItem[]> = {
  "/dashboard": [{ label: "Dashboard" }],
  "/crm/leads": [{ label: "Sales & CRM", href: "/crm/leads" }, { label: "Leads" }],
  "/crm/quotations": [{ label: "Sales & CRM", href: "/crm/leads" }, { label: "Quotations" }],
  "/crm/client-pos": [{ label: "Sales & CRM", href: "/crm/leads" }, { label: "Client POs" }],
  "/crm/invoices": [{ label: "Sales & CRM", href: "/crm/leads" }, { label: "Invoices" }],
  "/crm/tasks": [{ label: "Sales & CRM", href: "/crm/leads" }, { label: "Tasks" }],
  "/crm/escalations": [{ label: "Sales & CRM", href: "/crm/leads" }, { label: "Escalations" }],
  "/projects": [{ label: "Project Mgmt", href: "/projects" }, { label: "Projects Hub" }],
  "/projects/contractors": [{ label: "Project Mgmt", href: "/projects" }, { label: "Contractors" }],
  "/inventory/warehouses": [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Warehouses" }],
  "/inventory/stock-transfers": [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Stock Transfers" }],
  "/inventory/delivery-challans": [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Delivery Challans" }],
  "/inventory/stock-ledger": [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Stock Ledger" }],
  "/inventory/stock-valuation": [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Stock Valuation" }],
  "/inventory/audits": [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Audits" }],
  "/engineering/docs": [{ label: "Engineering" }, { label: "Design Documents" }],
  "/commissioning": [{ label: "Commissioning" }],
  "/oam/amc": [{ label: "O&M & AMC" }, { label: "AMC Contracts" }],
  "/oam/maintenance": [{ label: "O&M & AMC" }, { label: "Maintenance" }],
  "/oam/tickets": [{ label: "O&M & AMC" }, { label: "Service Tickets" }],
  "/procurement/dashboard": [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Dashboard" }],
  "/procurement/vendors": [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendors" }],
  "/procurement/materials": [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Materials" }],
  "/procurement/quotations": [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendor Quotations" }],
  "/procurement/pos": [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Purchase Orders" }],
  "/procurement/grns": [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRNs" }],
  "/procurement/grn-returns": [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRN Returns" }],
  "/procurement/invoices": [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Invoices" }],
  "/finance/dashboard": [{ label: "Finance & Reports", href: "/finance/dashboard" }, { label: "Finance Dashboard" }],
  "/reports": [{ label: "Finance & Reports", href: "/finance/dashboard" }, { label: "Reports" }],
  "/reports/vendors": [{ label: "Finance & Reports", href: "/finance/dashboard" }, { label: "Vendor Performance" }],
  "/admin/users": [{ label: "Admin" }, { label: "User Management" }],
  "/admin/audit-logs": [{ label: "Admin" }, { label: "Audit Logs" }],
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
    return [{ label: "Inventory", href: "/inventory/warehouses" }, { label: "Warehouses", href: "/inventory/warehouses" }, { label: "Warehouse Detail" }];
  if (path.match(/^\/procurement\/vendors\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendors", href: "/procurement/vendors" }, { label: "Vendor Detail" }];
  if (path.match(/^\/procurement\/quotations\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendor Quotations", href: "/procurement/quotations" }, { label: "Quotation" }];
  if (path.match(/^\/procurement\/pos\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Purchase Orders", href: "/procurement/pos" }, { label: "PO Detail" }];
  if (path.match(/^\/procurement\/grns\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRNs", href: "/procurement/grns" }, { label: "GRN Detail" }];
  if (path.match(/^\/procurement\/grn-returns\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRN Returns", href: "/procurement/grn-returns" }, { label: "Return Detail" }];
  if (path.match(/^\/procurement\/invoices\/\d+/))
    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Invoices", href: "/procurement/invoices" }, { label: "Invoice Detail" }];
  if (path.match(/^\/engineering\/docs\/\d+/))
    return [{ label: "Engineering" }, { label: "Design Documents", href: "/engineering/docs" }, { label: "Document" }];
  if (path.match(/^\/commissioning\/\d+/))
    return [{ label: "Commissioning", href: "/commissioning" }, { label: "Checklist Detail" }];
  return [{ label: "Mystics ERP" }];
}

function getFYLabel() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const fyStart = month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY ${fyStart}-${String(fyStart + 1).slice(-2)}`;
}

const NOTIF_ICON_COLOR: Record<string, string> = {
  info: "bg-blue-100 text-blue-600",
  warning: "bg-amber-100 text-amber-600",
  success: "bg-emerald-100 text-emerald-600",
  error: "bg-red-100 text-red-600",
  approval: "bg-orange-100 text-orange-600",
};

/* ── Command Palette ─────────────────────────────────────────── */
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query.trim()
    ? ALL_NAV.filter(
        (item) =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.section.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_NAV.slice(0, 8);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      setLocation(href);
      onClose();
    },
    [setLocation, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      if (results[cursor]) navigate(results[cursor].href);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-modal border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
        aria-modal
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search className="h-4 w-4 text-gray-400 shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and modules…"
            className="flex-1 text-[14px] font-medium text-gray-900 placeholder:text-gray-400 outline-none bg-transparent"
            aria-label="Search command palette"
          />
          <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-gray-100 text-gray-500 text-[10px] font-mono font-bold">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto scrollbar-thin py-1.5">
          {!query.trim() && (
            <div className="px-4 pb-1 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Quick Navigation
              </p>
            </div>
          )}
          {results.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map((item, idx) => (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              onMouseEnter={() => setCursor(idx)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                cursor === idx ? "bg-orange-50" : "hover:bg-gray-50"
              )}
              aria-selected={cursor === idx}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  cursor === idx ? "bg-orange-100 text-[#EA580C]" : "bg-gray-100 text-gray-500"
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13px] font-semibold", cursor === idx ? "text-gray-900" : "text-gray-700")}>
                  {item.name}
                </p>
                <p className="text-[11px] text-gray-400">{item.section}</p>
              </div>
              {cursor === idx && (
                <ArrowRight className="h-4 w-4 text-[#EA580C] shrink-0" aria-hidden />
              )}
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
          {[
            { keys: "↑↓", label: "navigate" },
            { keys: "↵", label: "open" },
            { keys: "esc", label: "close" },
          ].map((hint) => (
            <div key={hint.label} className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded-[4px] bg-gray-200 text-gray-600 text-[10px] font-mono font-bold">
                {hint.keys}
              </kbd>
              <span className="text-[11px] text-gray-400">{hint.label}</span>
            </div>
          ))}
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
          variant="ghost"
          size="icon"
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
            {unread > 0 && (
              <p className="text-[11px] text-gray-500">{unread} unread</p>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
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
                onClick={() => {
                  if (!n.isRead) markRead.mutate(n.id);
                  if (n.actionUrl) setLocation(n.actionUrl);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setLocation(n.actionUrl)}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors group",
                  !n.isRead && "bg-orange-50/40"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5",
                    NOTIF_ICON_COLOR[n.type] ?? "bg-gray-100 text-gray-600"
                  )}
                >
                  {n.type === "approval"
                    ? "A"
                    : n.type === "info"
                    ? "i"
                    : n.type === "warning"
                    ? "!"
                    : n.type === "success"
                    ? "✓"
                    : "!"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[12px] leading-tight", n.isRead ? "text-gray-600 font-medium" : "text-gray-900 font-bold")}>
                    {n.title}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-tight line-clamp-2">
                    {n.message}
                  </p>
                  {n.entityRef && (
                    <p className="text-[10px] text-orange-600 font-mono mt-1">{n.entityRef}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
                {!n.isRead && (
                  <div className="h-2 w-2 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                )}
                {n.actionUrl && (
                  <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1" aria-hidden />
                )}
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Topbar ──────────────────────────────────────────────────── */
export function Topbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { toggle, isCollapsed } = useSidebar();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const breadcrumbs = getBreadcrumbs(location);
  const fyLabel = getFYLabel();

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  /* ── Cmd+K / Ctrl+K to open palette ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="h-14 bg-white/90 backdrop-blur-md border-b border-gray-200/60 flex items-center gap-3 px-4 sm:px-5 shrink-0 z-10 sticky top-0">
        {/* Desktop sidebar toggle */}
        <button
          onClick={toggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors focus-ring"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden />
          )}
        </button>

        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation menu"
              className="lg:hidden text-gray-600 h-9 w-9 focus-ring"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[240px] bg-[#0c1445] border-r-0">
            <Sidebar className="w-full flex" />
          </SheetContent>
        </Sheet>

        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="hidden sm:flex items-center gap-1.5 flex-1 min-w-0"
        >
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={idx} className="flex items-center gap-1.5 min-w-0">
                {idx > 0 && <span className="text-gray-300 text-xs flex-shrink-0">/</span>}
                {crumb.href && !isLast ? (
                  <Link href={crumb.href}>
                    <span className="text-[13px] font-medium text-gray-400 hover:text-gray-700 transition-colors cursor-pointer truncate">
                      {crumb.label}
                    </span>
                  </Link>
                ) : (
                  <motion.span
                    key={crumb.label}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "text-[13px] truncate",
                      isLast ? "font-bold text-gray-900" : "font-medium text-gray-400"
                    )}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </motion.span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Cmd+K search trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette (Cmd+K)"
          className="flex items-center gap-2 h-9 px-3 rounded-lg bg-gray-100/80 hover:bg-gray-200/80 text-gray-400 hover:text-gray-700 transition-colors text-[13px] focus-ring shrink-0"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden md:inline font-medium text-[12px]">Search…</span>
          <div className="hidden md:flex items-center gap-0.5">
            <kbd className="h-5 px-1 rounded-[4px] bg-white border border-gray-200 text-gray-500 text-[10px] font-mono font-bold shadow-sm">
              ⌘K
            </kbd>
          </div>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {/* FY pill */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100/60">
            <div className="h-1.5 w-1.5 rounded-full bg-[#EA580C]" />
            <span className="text-[11px] font-bold text-[#EA580C] tracking-wide">{fyLabel}</span>
          </div>

          {/* Notifications */}
          {user?.id ? (
            <NotificationBell userId={user.id} />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="relative h-9 w-9 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full focus-ring"
            >
              <Bell className="h-4 w-4" aria-hidden />
            </Button>
          )}

          {/* User avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 w-9 rounded-full p-0 hover:bg-gray-100 ml-1 focus-ring"
                aria-label="User menu"
              >
                <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm">
                  <AvatarFallback
                    className="text-white text-[12px] font-bold"
                    style={{ background: "linear-gradient(135deg, #1E293B, #0F172A)" }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mt-2 shadow-popover" align="end">
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-bold text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  <Badge
                    variant="outline"
                    className="mt-1 w-fit text-[10px] uppercase font-bold text-gray-600 bg-gray-50"
                  >
                    {user?.role}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="text-red-600 font-medium cursor-pointer p-3 focus:text-red-700 focus:bg-red-50"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Command Palette (portal) */}
      <AnimatePresence>
        {paletteOpen && (
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
