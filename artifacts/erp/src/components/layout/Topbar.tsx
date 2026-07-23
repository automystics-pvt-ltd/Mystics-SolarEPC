import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import {
  Bell, Search, PanelLeftClose, PanelLeftOpen, CheckCheck,
  ExternalLink, ArrowRight, Moon, Sun, Monitor, LogOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sidebar } from "./Sidebar";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { useSidebar } from "@/lib/sidebar-context";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Breadcrumb config ─────────────────────────────────────────────────────────

type Crumb = { label: string; href?: string };

function getBreadcrumbs(path: string): Crumb[] {
  const EXACT: Record<string, Crumb[]> = {
    "/dashboard":                   [{ label: "Dashboard" }],
    "/crm/leads":                   [{ label: "Sales & CRM" }, { label: "Leads" }],
    "/crm/quotations":              [{ label: "Sales & CRM" }, { label: "Quotations" }],
    "/crm/client-pos":              [{ label: "Sales & CRM" }, { label: "Client POs" }],
    "/crm/invoices":                [{ label: "Sales & CRM" }, { label: "Invoices" }],
    "/crm/tasks":                   [{ label: "Sales & CRM" }, { label: "Tasks" }],
    "/crm/escalations":             [{ label: "Sales & CRM" }, { label: "Escalations" }],
    "/projects":                    [{ label: "Projects" }, { label: "Projects Hub" }],
    "/projects/contractors":        [{ label: "Projects", href: "/projects" }, { label: "Contractors" }],
    "/inventory/warehouses":        [{ label: "Inventory" }, { label: "Warehouses" }],
    "/inventory/stock-transfers":   [{ label: "Inventory" }, { label: "Stock Transfers" }],
    "/inventory/delivery-challans": [{ label: "Inventory" }, { label: "Delivery Challans" }],
    "/inventory/stock-ledger":      [{ label: "Inventory" }, { label: "Stock Ledger" }],
    "/inventory/stock-valuation":   [{ label: "Inventory" }, { label: "Stock Valuation" }],
    "/inventory/audits":            [{ label: "Inventory" }, { label: "Audits" }],
    "/engineering/docs":            [{ label: "Engineering" }, { label: "Design Documents" }],
    "/commissioning":               [{ label: "Engineering" }, { label: "Commissioning" }],
    "/oam/amc":                     [{ label: "O&M & AMC" }, { label: "AMC Contracts" }],
    "/oam/maintenance":             [{ label: "O&M & AMC" }, { label: "Maintenance" }],
    "/oam/tickets":                 [{ label: "O&M & AMC" }, { label: "Service Tickets" }],
    "/procurement/dashboard":       [{ label: "Procurement" }, { label: "Overview" }],
    "/procurement/vendors":         [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendors" }],
    "/procurement/materials":       [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Materials" }],
    "/procurement/quotations":      [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendor Quotations" }],
    "/procurement/quotations/new":  [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendor Quotations", href: "/procurement/quotations" }, { label: "New Quotation" }],
    "/procurement/pos":             [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Purchase Orders" }],
    "/procurement/grns":            [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRNs" }],
    "/procurement/grns/new":        [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRNs", href: "/procurement/grns" }, { label: "New GRN" }],
    "/procurement/grn-returns":     [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRN Returns" }],
    "/procurement/grn-returns/new": [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRN Returns", href: "/procurement/grn-returns" }, { label: "New Return" }],
    "/procurement/invoices":        [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Invoices" }],
    "/procurement/invoices/new":    [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Invoices", href: "/procurement/invoices" }, { label: "New Invoice" }],
    "/finance/dashboard":           [{ label: "Finance & Reports" }, { label: "Finance Overview" }],
    "/reports":                     [{ label: "Finance & Reports", href: "/finance/dashboard" }, { label: "Reports" }],
    "/reports/vendors":             [{ label: "Finance & Reports", href: "/finance/dashboard" }, { label: "Vendor Performance" }],
    "/admin/users":                 [{ label: "Administration" }, { label: "User Management" }],
    "/admin/audit-logs":            [{ label: "Administration", href: "/admin/users" }, { label: "Audit Logs" }],
  };

  if (EXACT[path]) return EXACT[path];

  if (path.startsWith("/crm/leads/"))               return [{ label: "Sales & CRM" }, { label: "Leads", href: "/crm/leads" }, { label: "Lead Detail" }];
  if (path.startsWith("/crm/quotations/"))          return [{ label: "Sales & CRM" }, { label: "Quotations", href: "/crm/quotations" }, { label: "Quotation Detail" }];
  if (path.startsWith("/projects/"))               return [{ label: "Projects" }, { label: "Projects Hub", href: "/projects" }, { label: "Project Workspace" }];
  if (path.startsWith("/inventory/warehouses/"))   return [{ label: "Inventory" }, { label: "Warehouses", href: "/inventory/warehouses" }, { label: "Warehouse Detail" }];
  if (path.startsWith("/engineering/docs/"))       return [{ label: "Engineering" }, { label: "Design Documents", href: "/engineering/docs" }, { label: "Document Detail" }];
  if (path.startsWith("/commissioning/"))          return [{ label: "Engineering" }, { label: "Commissioning", href: "/commissioning" }, { label: "Checklist Detail" }];
  if (path.startsWith("/procurement/vendors/"))    return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendors", href: "/procurement/vendors" }, { label: "Vendor Detail" }];
  if (path.match(/\/procurement\/quotations\/\d+\/edit/)) return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendor Quotations", href: "/procurement/quotations" }, { label: "Edit Quotation" }];
  if (path.match(/\/procurement\/material-requests\//)) return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendor Quotations", href: "/procurement/quotations" }, { label: "Compare Vendors" }];
  if (path.startsWith("/procurement/quotations/")) return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Vendor Quotations", href: "/procurement/quotations" }, { label: "Quotation Detail" }];
  if (path.startsWith("/procurement/pos/"))        return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Purchase Orders", href: "/procurement/pos" }, { label: "PO Detail" }];
  if (path.startsWith("/procurement/grns/"))       return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRNs", href: "/procurement/grns" }, { label: "GRN Detail" }];
  if (path.startsWith("/procurement/grn-returns/")) return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "GRN Returns", href: "/procurement/grn-returns" }, { label: "Return Detail" }];
  if (path.startsWith("/procurement/invoices/"))   return [{ label: "Procurement", href: "/procurement/dashboard" }, { label: "Invoices", href: "/procurement/invoices" }, { label: "Invoice Detail" }];

  return [{ label: "Mystics ERP" }];
}

// ── FY label ──────────────────────────────────────────────────────────────────

function getFYLabel() {
  const now = new Date();
  const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY ${fy}–${String(fy + 1).slice(-2)}`;
}

// ── All nav items (for command palette) ──────────────────────────────────────

const CMD_NAV = [
  { section: "Overview",          name: "Dashboard",             href: "/dashboard" },
  { section: "Sales & CRM",       name: "Leads",                 href: "/crm/leads" },
  { section: "Sales & CRM",       name: "Quotations",            href: "/crm/quotations" },
  { section: "Sales & CRM",       name: "Client POs",            href: "/crm/client-pos" },
  { section: "Sales & CRM",       name: "Invoices",              href: "/crm/invoices" },
  { section: "Sales & CRM",       name: "Tasks",                 href: "/crm/tasks" },
  { section: "Sales & CRM",       name: "Escalations",           href: "/crm/escalations" },
  { section: "Projects",          name: "Projects Hub",          href: "/projects" },
  { section: "Projects",          name: "Contractors",           href: "/projects/contractors" },
  { section: "Engineering",       name: "Design Documents",      href: "/engineering/docs" },
  { section: "Engineering",       name: "Commissioning",         href: "/commissioning" },
  { section: "O&M & AMC",         name: "AMC Contracts",         href: "/oam/amc" },
  { section: "O&M & AMC",         name: "Maintenance",           href: "/oam/maintenance" },
  { section: "O&M & AMC",         name: "Service Tickets",       href: "/oam/tickets" },
  { section: "Inventory",         name: "Warehouses",            href: "/inventory/warehouses" },
  { section: "Inventory",         name: "Stock Transfers",       href: "/inventory/stock-transfers" },
  { section: "Inventory",         name: "Delivery Challans",     href: "/inventory/delivery-challans" },
  { section: "Inventory",         name: "Stock Ledger",          href: "/inventory/stock-ledger" },
  { section: "Inventory",         name: "Stock Valuation",       href: "/inventory/stock-valuation" },
  { section: "Inventory",         name: "Audits",                href: "/inventory/audits" },
  { section: "Procurement",       name: "Procurement Overview",  href: "/procurement/dashboard" },
  { section: "Procurement",       name: "Vendors",               href: "/procurement/vendors" },
  { section: "Procurement",       name: "Materials",             href: "/procurement/materials" },
  { section: "Procurement",       name: "Vendor Quotations",     href: "/procurement/quotations" },
  { section: "Procurement",       name: "Purchase Orders",       href: "/procurement/pos" },
  { section: "Procurement",       name: "GRNs",                  href: "/procurement/grns" },
  { section: "Procurement",       name: "GRN Returns",           href: "/procurement/grn-returns" },
  { section: "Procurement",       name: "Proc. Invoices",        href: "/procurement/invoices" },
  { section: "Finance & Reports", name: "Finance Overview",      href: "/finance/dashboard" },
  { section: "Finance & Reports", name: "Reports",               href: "/reports" },
  { section: "Finance & Reports", name: "Vendor Performance",    href: "/reports/vendors" },
  { section: "Administration",    name: "User Management",       href: "/admin/users" },
  { section: "Administration",    name: "Audit Logs",            href: "/admin/audit-logs" },
];

// ── Command Palette ───────────────────────────────────────────────────────────

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? CMD_NAV.filter(
        (i) =>
          i.name.toLowerCase().includes(query.toLowerCase()) ||
          i.section.toLowerCase().includes(query.toLowerCase())
      )
    : CMD_NAV;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);
  useEffect(() => { setActiveIdx(0); }, [query]);

  const go = (href: string) => { navigate(href); onClose(); };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && filtered[activeIdx]) go(filtered[activeIdx].href);
    if (e.key === "Escape") onClose();
  };

  // Group by section
  const groups = filtered.reduce<Record<string, typeof filtered>>((acc, item) => {
    (acc[item.section] = acc[item.section] ?? []).push(item);
    return acc;
  }, {});

  let globalIdx = 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="p-0 max-w-[500px] overflow-hidden gap-0 shadow-modal border-border/60">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search modules and pages…"
            className="flex-1 text-sm text-foreground placeholder:text-muted-foreground outline-none bg-transparent"
          />
          <kbd className="hidden sm:flex items-center text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[380px]">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No results for "{query}"
            </div>
          ) : (
            Object.entries(groups).map(([section, items]) => (
              <div key={section}>
                <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {section}
                </p>
                {items.map((item) => {
                  const idx = globalIdx++;
                  return (
                    <div
                      key={item.href}
                      onClick={() => go(item.href)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={cn(
                        "flex items-center justify-between px-4 py-2.5 cursor-pointer text-[13px] transition-colors",
                        idx === activeIdx
                          ? "bg-primary/8 text-primary dark:bg-primary/15"
                          : "text-foreground hover:bg-muted/60"
                      )}
                    >
                      <span className="font-medium">{item.name}</span>
                      {idx === activeIdx && (
                        <ArrowRight className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border/60 bg-muted/40">
          {[["↑↓", "navigate"], ["↵", "go"], ["ESC", "close"]].map(([key, hint]) => (
            <div key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <kbd className="font-mono bg-background border border-border rounded px-1 py-0.5">{key}</kbd>
              {hint}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Theme toggle ──────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: Array<{ value: "light" | "dark" | "system"; icon: React.ElementType; label: string }> = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ];
  const current = options.find((o) => o.value === theme) ?? options[0];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Toggle theme"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 shadow-popover" sideOffset={8}>
        {options.map(({ value, icon: OptionIcon, label }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn("gap-2.5 text-[13px] cursor-pointer", theme === value && "font-semibold text-primary")}
          >
            <OptionIcon className="h-3.5 w-3.5" />
            {label}
            {theme === value && <span className="ml-auto text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Notification dot colors ───────────────────────────────────────────────────

const NOTIF_ICON_CLASS: Record<string, string> = {
  info:     "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  warning:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  success:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  error:    "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  approval: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
};

const NOTIF_DOT: Record<string, string> = {
  info: "bg-blue-500", warning: "bg-amber-500",
  success: "bg-emerald-500", error: "bg-red-500", approval: "bg-orange-500",
};

// ── Notification Bell ─────────────────────────────────────────────────────────

function NotificationBell({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: countData } = useQuery({
    queryKey: ["notifications-count", userId],
    queryFn: () => apiGet<{ count: number }>("/notifications/unread-count", { userId }),
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => apiGet<any[]>("/notifications", { userId, limit: 25 }),
    refetchInterval: 60_000,
    retry: false,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => apiPatch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const markAll = useMutation({
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
        <button
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
          className="relative h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 h-[14px] min-w-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center ring-1 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0 shadow-popover" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <p className="text-[13px] font-bold text-foreground">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/8 rounded-md transition-colors"
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {(notifications as any[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">No notifications</p>
            </div>
          ) : (
            (notifications as any[]).map((n: any) => (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.isRead) markRead.mutate(n.id);
                  if (n.actionUrl) setLocation(n.actionUrl);
                }}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 border-b border-border/40 cursor-pointer hover:bg-muted/50 transition-colors group",
                  !n.isRead && "bg-primary/[0.04] dark:bg-primary/[0.07]"
                )}
              >
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                    NOTIF_ICON_CLASS[n.type] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {n.type === "success" ? "✓" : n.type === "info" ? "i" : "!"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[12px] leading-snug", !n.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>{n.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  {n.entityRef && <p className="text-[10px] text-primary font-mono mt-1">{n.entityRef}</p>}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {new Date(n.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {!n.isRead && <div className={cn("h-2 w-2 rounded-full", NOTIF_DOT[n.type] ?? "bg-muted-foreground")} />}
                  {n.actionUrl && <ExternalLink className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground" />}
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────

export function Topbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { toggle, isCollapsed } = useSidebar();
  const [cmdOpen, setCmdOpen] = useState(false);
  const fyLabel = getFYLabel();
  const breadcrumbs = getBreadcrumbs(location);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  // Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="h-14 bg-card border-b border-border/70 flex items-center gap-3 px-4 shrink-0 z-10">
        {/* Desktop sidebar toggle */}
        <button
          onClick={toggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>

        {/* Mobile sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              aria-label="Open navigation"
              className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="p-0 w-[252px] border-r-0"
            style={{ background: "linear-gradient(180deg, #0D1548 0%, #090E28 100%)" }}
          >
            <Sidebar className="flex w-full" />
          </SheetContent>
        </Sheet>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.ol
              key={location}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.12 }}
              className="flex items-center gap-1.5 list-none m-0 p-0 min-w-0"
            >
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <li key={i} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 && <span className="text-border text-xs shrink-0 select-none">/</span>}
                    {crumb.href && !isLast ? (
                      <Link href={crumb.href}>
                        <span className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors truncate cursor-pointer">
                          {crumb.label}
                        </span>
                      </Link>
                    ) : (
                      <span
                        className={cn(
                          "text-[13px] truncate",
                          isLast
                            ? "font-semibold text-foreground"
                            : "font-medium text-muted-foreground"
                        )}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </motion.ol>
          </AnimatePresence>
        </nav>

        {/* Mobile: just page name */}
        <div className="sm:hidden flex-1 min-w-0">
          <span className="text-[14px] font-semibold text-foreground truncate">
            {breadcrumbs[breadcrumbs.length - 1]?.label}
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* Search trigger */}
          <button
            onClick={() => setCmdOpen(true)}
            aria-label="Open command palette"
            className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg border border-border/70 bg-muted/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted transition-all text-[12px]"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search…</span>
            <kbd className="hidden lg:flex items-center gap-0.5 font-mono text-[10px] text-muted-foreground/60 ml-1">
              <span className="text-[11px]">⌘</span>K
            </kbd>
          </button>
          <button
            onClick={() => setCmdOpen(true)}
            aria-label="Search"
            className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* FY badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/8 dark:bg-primary/15 border border-primary/15">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-bold text-primary tracking-wide">{fyLabel}</span>
          </div>

          {/* Theme */}
          <ThemeToggle />

          {/* Notifications */}
          {user?.id ? (
            <NotificationBell userId={user.id} />
          ) : (
            <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground" disabled>
              <Bell className="h-4 w-4" />
            </button>
          )}

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="User menu"
                className="h-8 w-8 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ml-0.5"
              >
                <Avatar className="h-8 w-8 ring-2 ring-background shadow-xs">
                  <AvatarFallback
                    className="text-white text-[11px] font-bold"
                    style={{ background: "linear-gradient(135deg, #1E3A5F, #0F2340)" }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mt-1 shadow-popover" align="end">
              <DropdownMenuLabel className="font-normal px-3 py-2.5">
                <p className="text-[13px] font-semibold text-foreground">{user?.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{(user as any)?.email}</p>
                <Badge
                  variant="outline"
                  className="mt-1.5 w-fit text-[9px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0 capitalize"
                >
                  {(user as any)?.role}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive font-medium cursor-pointer px-3 py-2 text-[13px] gap-2 focus:text-destructive focus:bg-destructive/8"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
}
