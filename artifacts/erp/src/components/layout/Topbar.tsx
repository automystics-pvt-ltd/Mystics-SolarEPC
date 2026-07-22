import { useAuth } from "@/lib/auth";
import { Bell, Search, HelpCircle, ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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

const PAGE_TITLE_MAP: Record<string, { title: string; section?: string }> = {
  "/dashboard": { title: "Dashboard" },
  "/crm/leads": { title: "Leads", section: "Sales & CRM" },
  "/crm/quotations": { title: "Quotations", section: "Sales & CRM" },
  "/crm/client-pos": { title: "Client POs", section: "Sales & CRM" },
  "/crm/invoices": { title: "Invoices", section: "Sales & CRM" },
  "/crm/tasks": { title: "Tasks", section: "Sales & CRM" },
  "/crm/escalations": { title: "Escalations", section: "Sales & CRM" },
  "/projects": { title: "Projects Hub", section: "Project Management" },
  "/projects/contractors": { title: "Contractors", section: "Project Management" },
  "/inventory/warehouses": { title: "Warehouses", section: "Inventory" },
  "/inventory/grns": { title: "GRNs", section: "Inventory" },
  "/inventory/delivery-challans": { title: "Delivery Challans", section: "Inventory" },
  "/inventory/stock-ledger": { title: "Stock Ledger", section: "Inventory" },
  "/inventory/stock-valuation": { title: "Stock Valuation", section: "Inventory" },
  "/inventory/audits": { title: "Audits", section: "Inventory" },
};

function getPageMeta(path: string) {
  if (PAGE_TITLE_MAP[path]) return PAGE_TITLE_MAP[path];
  if (path.startsWith("/crm/leads/")) return { title: "Lead Detail", section: "Sales & CRM" };
  if (path.startsWith("/crm/quotations/")) return { title: "Quotation", section: "Sales & CRM" };
  if (path.startsWith("/projects/")) return { title: "Project Workspace", section: "Project Management" };
  if (path.startsWith("/inventory/warehouses/")) return { title: "Warehouse Detail", section: "Inventory" };
  return { title: "Mystics ERP" };
}

function getFYLabel() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const fyStart = month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY ${fyStart}-${String(fyStart + 1).slice(-2)}`;
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
    <header className="h-14 bg-white border-b border-orange-100/80 flex items-center gap-3 px-4 sm:px-5 shrink-0 shadow-[0_1px_4px_rgba(234,88,12,0.08)]">
      {/* Desktop sidebar toggle */}
      <button
        onClick={toggle}
        className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden text-gray-500 h-8 w-8">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[220px] bg-[#0c1445] border-r-0">
          <Sidebar className="w-full flex" />
        </SheetContent>
      </Sheet>

      {/* Page title */}
      <div className="hidden sm:flex items-center gap-1.5 min-w-[120px]">
        {meta.section && (
          <>
            <span className="text-[12px] text-gray-400 font-medium">{meta.section}</span>
            <span className="text-gray-300 text-xs">/</span>
          </>
        )}
        <span className="text-[13px] font-semibold text-gray-700">{meta.title}</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-xs mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search projects, leads, POs..."
            className="pl-9 pr-3 h-8 text-[13px] rounded-full border-orange-100 bg-orange-50/40 focus-visible:ring-1 focus-visible:ring-orange-300 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        {/* FY pill */}
        <button className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: "linear-gradient(90deg, #0c1445, #1e3a8a)" }}>
          ☀ {fyLabel}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>

        {/* Notifications */}
        <Button variant="ghost" size="icon"
          className="relative h-8 w-8 text-gray-500 hover:text-orange-600 hover:bg-orange-50">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border border-white" />
        </Button>

        {/* Help */}
        <Button variant="ghost" size="sm"
          className="hidden sm:flex items-center gap-1 h-8 text-[12px] text-gray-500 hover:text-orange-600 hover:bg-orange-50 px-2">
          <HelpCircle className="h-3.5 w-3.5" />
          Help
        </Button>

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 rounded-full p-0 hover:bg-orange-50">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-white text-[11px] font-bold"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)" }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <span className="mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 w-fit uppercase tracking-wide">
                  {user?.role}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
