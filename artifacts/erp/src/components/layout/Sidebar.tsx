import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  FileText,
  FileCheck,
  FilePlus,
  CheckSquare,
  AlertTriangle,
  FolderKanban,
  HardHat,
  Warehouse,
  Boxes,
  Truck,
  BookOpen,
  Scale,
  ClipboardCheck,
  ChevronsLeft,
  Building2,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const MODULES = [
  {
    section: "CORE",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "SALES & CRM",
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
    section: "PROJECT MANAGEMENT",
    items: [
      { name: "Projects Hub", href: "/projects", icon: FolderKanban },
      { name: "Contractors", href: "/projects/contractors", icon: HardHat },
    ],
  },
  {
    section: "INVENTORY",
    items: [
      { name: "Warehouses", href: "/inventory/warehouses", icon: Warehouse },
      { name: "GRNs", href: "/inventory/grns", icon: Boxes },
      { name: "Delivery Challans", href: "/inventory/delivery-challans", icon: Truck },
      { name: "Stock Ledger", href: "/inventory/stock-ledger", icon: BookOpen },
      { name: "Stock Valuation", href: "/inventory/stock-valuation", icon: Scale },
      { name: "Audits", href: "/inventory/audits", icon: ClipboardCheck },
    ],
  },
];

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <aside
      className={cn(
        "w-[220px] bg-white border-r border-gray-200 flex-col hidden lg:flex shrink-0 h-full",
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100">
        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <HardHat className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-[13px] text-gray-900 leading-tight">Mystics ERP</div>
          <div className="text-[10px] text-gray-400 leading-tight truncate">Powered by Automystics</div>
        </div>
      </div>

      {/* User context row */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50">
        <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-[11px] text-gray-500">
          <span className="font-semibold text-gray-700 capitalize">{user?.role || "User"}</span>
          <span className="mx-1 text-gray-300">›</span>
          Automystics
        </span>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
        {MODULES.map((module) => (
          <div key={module.section} className="mb-1">
            <div className="px-4 pt-3 pb-1 text-[9.5px] font-semibold text-gray-400 uppercase tracking-widest select-none">
              {module.section}
            </div>
            {module.items.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/projects" && location.startsWith(item.href + "/")) ||
                (item.href === "/projects" && location === "/projects");
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-2.5 py-[7px] pr-3 text-[13px] font-medium cursor-pointer transition-colors",
                      isActive
                        ? "pl-[13px] border-l-[3px] border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "pl-4 border-l-[3px] border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[15px] w-[15px] shrink-0",
                        isActive ? "text-indigo-600" : "text-gray-400"
                      )}
                    />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Collapse button */}
      <div className="border-t border-gray-100 px-4 py-2.5">
        <button
          onClick={logout}
          className="flex items-center gap-2 text-[12px] text-gray-500 hover:text-red-600 transition-colors w-full"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>

      {/* User info */}
      <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-2.5">
        <div
          className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-bold"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-gray-800 leading-tight truncate">
            {user?.name || "User"}
          </div>
          <div className="text-[10px] text-gray-400 truncate">{user?.email}</div>
        </div>
      </div>

      {/* App version */}
      <div className="px-4 pb-2">
        <div className="text-[9px] text-gray-300 font-mono tracking-wider">MYSTICS ERP · FY 2026-27</div>
      </div>
    </aside>
  );
}
