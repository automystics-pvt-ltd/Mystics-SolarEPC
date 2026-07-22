import { useAuth } from "@/lib/auth";
import { Bell, Search, HelpCircle, ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
  return { title: "Mystics ERP", section: "Workspace" };
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
        <Button variant="ghost" size="icon"
          className="relative h-9 w-9 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />
        </Button>

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
