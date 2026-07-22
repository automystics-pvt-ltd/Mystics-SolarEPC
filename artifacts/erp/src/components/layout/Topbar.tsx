import { useAuth } from "@/lib/auth";
import { Bell, Search, PanelLeftClose, PanelLeftOpen, CheckCheck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { useLocation } from "wouter";
import { Menu } from "lucide-react";
import { useSidebar } from "@/lib/sidebar-context";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const PAGE_TITLE_MAP: Record<string, { title: string; section?: string }> = {
  "/dashboard": { title: "Overview", section: "Dashboard" },
  "/crm/leads": { title: "Pipeline", section: "Sales & CRM" },
  "/crm/quotations": { title: "Quotations", section: "Sales & CRM" },
  "/crm/client-pos": { title: "Client POs", section: "Sales & CRM" },
  "/crm/invoices": { title: "Invoices", section: "Sales & CRM" },
  "/crm/tasks": { title: "Tasks", section: "Sales & CRM" },
  "/crm/escalations": { title: "Escalations", section: "Sales & CRM" },
  "/projects": { title: "Projects Hub", section: "Project Management" },
  "/projects/contractors": { title: "Contractors", section: "Project Management" },
  "/inventory/warehouses": { title: "Warehouses", section: "Inventory" },
  "/inventory/grns": { title: "GRNs", section: "Inventory" },
  "/inventory/stock-transfers": { title: "Stock Transfers", section: "Inventory" },
  "/inventory/delivery-challans": { title: "Delivery Challans", section: "Inventory" },
  "/inventory/stock-ledger": { title: "Stock Ledger", section: "Inventory" },
  "/inventory/stock-valuation": { title: "Stock Valuation", section: "Inventory" },
  "/inventory/audits": { title: "Audits", section: "Inventory" },
  "/procurement/dashboard": { title: "Dashboard", section: "Procurement" },
  "/procurement/vendors": { title: "Vendors", section: "Procurement" },
  "/procurement/materials": { title: "Materials", section: "Procurement" },
  "/procurement/quotations": { title: "Vendor Quotations", section: "Procurement" },
  "/procurement/pos": { title: "Purchase Orders", section: "Procurement" },
  "/procurement/grns": { title: "GRNs", section: "Procurement" },
  "/procurement/grn-returns": { title: "GRN Returns", section: "Procurement" },
  "/procurement/invoices": { title: "Invoices", section: "Procurement" },
  "/finance/dashboard": { title: "Finance Dashboard", section: "Finance & Reports" },
  "/reports": { title: "Reports", section: "Finance & Reports" },
  "/reports/vendors": { title: "Vendor Performance", section: "Finance & Reports" },
  "/admin/users": { title: "User Management", section: "Admin" },
  "/admin/audit-logs": { title: "Audit Logs", section: "Admin" },
};

function getPageMeta(path: string) {
  if (PAGE_TITLE_MAP[path]) return PAGE_TITLE_MAP[path];
  if (path.startsWith("/crm/leads/")) return { title: "Lead Detail", section: "Sales & CRM" };
  if (path.startsWith("/crm/quotations/")) return { title: "Quotation", section: "Sales & CRM" };
  if (path.startsWith("/projects/")) return { title: "Project Workspace", section: "Project Management" };
  if (path.startsWith("/inventory/warehouses/")) return { title: "Warehouse Detail", section: "Inventory" };
  if (path.startsWith("/procurement/grn-returns/")) return { title: "GRN Return Detail", section: "Procurement" };
  if (path.startsWith("/procurement/pos/")) return { title: "Purchase Order", section: "Procurement" };
  if (path.startsWith("/procurement/grns/")) return { title: "GRN Detail", section: "Procurement" };
  if (path.startsWith("/procurement/invoices/")) return { title: "Invoice Detail", section: "Procurement" };
  return { title: "Mystics ERP", section: "Workspace" };
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
        <Button variant="ghost" size="icon"
          className="relative h-9 w-9 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-[13px] font-bold text-gray-900">Notifications</p>
            {unread > 0 && <p className="text-[11px] text-gray-500">{unread} unread</p>}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
              onClick={() => markAllRead.mutate()}>
              <CheckCheck className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[360px]">
          {(notifications as any[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
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
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
                {!n.isRead && <div className="h-2 w-2 rounded-full bg-orange-500 shrink-0 mt-1.5" />}
                {n.actionUrl && <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1" />}
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { toggle, isCollapsed } = useSidebar();
  const meta = getPageMeta(location);
  const fyLabel = getFYLabel();

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex items-center gap-4 px-4 sm:px-6 shrink-0 z-10 sticky top-0">
      {/* Desktop sidebar toggle */}
      <button
        onClick={toggle}
        className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden text-gray-600 h-9 w-9">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[240px] bg-[#0c1445] border-r-0">
          <Sidebar className="w-full flex" />
        </SheetContent>
      </Sheet>

      {/* Page Breadcrumb */}
      <div className="hidden sm:flex items-center gap-2 flex-1">
        {meta.section && (
          <>
            <span className="text-[13px] font-medium text-gray-400">{meta.section}</span>
            <span className="text-gray-300 text-xs">/</span>
          </>
        )}
        <motion.span 
          key={meta.title}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[14px] font-bold text-gray-900 tracking-tight"
        >
          {meta.title}
        </motion.span>
      </div>

      {/* Search */}
      <div className="flex-1 sm:max-w-xs mx-auto lg:mx-0">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#EA580C] transition-colors" />
          <Input
            placeholder="Search everything..."
            className="pl-9 pr-4 h-9 text-[13px] rounded-full border-gray-200 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-[#EA580C] focus-visible:border-[#EA580C] focus-visible:bg-white placeholder:text-gray-400 transition-all shadow-none"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* FY pill */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100/50">
          <div className="h-2 w-2 rounded-full bg-[#EA580C]" />
          <span className="text-[11px] font-bold text-[#EA580C] tracking-wide">{fyLabel}</span>
        </div>

        {/* Notifications */}
        {user?.id ? (
          <NotificationBell userId={user.id} />
        ) : (
          <Button variant="ghost" size="icon"
            className="relative h-9 w-9 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full">
            <Bell className="h-4 w-4" />
          </Button>
        )}

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 rounded-full p-0 hover:bg-gray-100 ml-1">
              <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm">
                <AvatarFallback className="text-white text-[12px] font-bold"
                  style={{ background: "linear-gradient(135deg, #1E293B, #0F172A)" }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 mt-2" align="end">
            <DropdownMenuLabel className="font-normal p-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <Badge variant="outline" className="mt-1 w-fit text-[10px] uppercase font-bold text-gray-600 bg-gray-50">
                  {user?.role}
                </Badge>
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
  );
}
