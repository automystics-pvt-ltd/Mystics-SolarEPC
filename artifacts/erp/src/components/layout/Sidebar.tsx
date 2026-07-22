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
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const MODULES = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }
    ]
  },
  {
    title: "Sales & CRM",
    items: [
      { name: "Leads", href: "/crm/leads", icon: Users },
      { name: "Quotations", href: "/crm/quotations", icon: FileText },
      { name: "Client POs", href: "/crm/client-pos", icon: FileCheck },
      { name: "Invoices", href: "/crm/invoices", icon: FilePlus },
      { name: "Tasks", href: "/crm/tasks", icon: CheckSquare },
      { name: "Escalations", href: "/crm/escalations", icon: AlertTriangle },
    ]
  },
  {
    title: "Project Management",
    items: [
      { name: "Projects Hub", href: "/projects", icon: FolderKanban },
      { name: "Contractors", href: "/projects/contractors", icon: HardHat },
    ]
  },
  {
    title: "Inventory & Warehouse",
    items: [
      { name: "Warehouses", href: "/inventory/warehouses", icon: Warehouse },
      { name: "GRNs", href: "/inventory/grns", icon: Boxes },
      { name: "Delivery Challans", href: "/inventory/delivery-challans", icon: Truck },
      { name: "Stock Ledger", href: "/inventory/stock-ledger", icon: BookOpen },
      { name: "Stock Valuation", href: "/inventory/stock-valuation", icon: Scale },
      { name: "Audits", href: "/inventory/audits", icon: ClipboardCheck },
    ]
  }
];

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();

  return (
    <aside className={cn("w-64 border-r border-sidebar-border bg-sidebar flex-col hidden lg:flex shrink-0", className)}>
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50">
        <div className="flex items-center gap-2 text-sidebar-foreground">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
            M
          </div>
          <span className="font-bold text-lg tracking-tight">Mystics ERP</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {MODULES.map((module) => (
          <div key={module.title} className="space-y-1">
            <h4 className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
              {module.title}
            </h4>
            {module.items.map((item) => {
              const isActive = location === item.href || location.startsWith(item.href + "/");
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm font-medium",
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "")} />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
