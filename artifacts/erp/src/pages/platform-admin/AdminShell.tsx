/**
 * AdminShell — Dark sidebar layout for the Platform Admin portal.
 * Completely separate from NavRail / Shell — no global navigation here.
 */
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Users, Shield, Puzzle, Settings, Bell,
  GitBranch, Lock, ScrollText, Database, LogOut, ChevronLeft,
  Cpu,
} from "lucide-react";

export type AdminSection =
  | "overview"
  | "users"
  | "rbac"
  | "modules"
  | "settings"
  | "notifications"
  | "workflows"
  | "security"
  | "audit"
  | "db";

type NavItem = {
  key: AdminSection;
  label: string;
  icon: React.ElementType;
  description: string;
};

const NAV: NavItem[] = [
  { key: "overview",       label: "Overview",       icon: LayoutDashboard, description: "System health & KPIs"        },
  { key: "users",          label: "Users",          icon: Users,           description: "All platform users"          },
  { key: "rbac",           label: "Access Control", icon: Shield,          description: "Roles & permissions"         },
  { key: "modules",        label: "Modules",        icon: Puzzle,          description: "Enable / disable features"   },
  { key: "settings",       label: "System Settings",icon: Settings,        description: "App-wide configuration"      },
  { key: "notifications",  label: "Notifications",  icon: Bell,            description: "Email & alert templates"     },
  { key: "workflows",      label: "Workflows",      icon: GitBranch,       description: "Approval workflow config"    },
  { key: "security",       label: "Security",       icon: Lock,            description: "Login attempts & locks"      },
  { key: "audit",          label: "Audit Logs",     icon: ScrollText,      description: "Full system audit trail"     },
  { key: "db",             label: "DB Console",     icon: Database,        description: "Raw SQL access"              },
];

interface AdminShellProps {
  section: AdminSection;
  children: React.ReactNode;
}

export function AdminShell({ section, children }: AdminShellProps) {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="flex flex-col w-60 border-r border-zinc-800 shrink-0">
        {/* Logo / Brand */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">Platform Admin</p>
            <p className="text-[10px] text-zinc-500 truncate">Automystics</p>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className="px-2 space-y-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <Link key={item.key} href={`/platform-admin/${item.key}`}>
                  <a
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer select-none",
                      active
                        ? "bg-violet-600/20 text-violet-300 font-medium"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", active ? "text-violet-400" : "")} />
                    {item.label}
                  </a>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-zinc-800 p-3 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={() => navigate("/dashboard")}
          >
            <ChevronLeft className="w-4 h-4" />
            Back to App
          </Button>
          <Separator className="bg-zinc-800" />
          <div className="flex items-center gap-2 px-1 py-1">
            <div className="w-6 h-6 rounded-full bg-violet-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {(user?.name ?? "S").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-200 truncate">{user?.name ?? "Super Admin"}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user?.role ?? "super_admin"}</p>
            </div>
            <button
              onClick={logout}
              className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 shrink-0">
          {(() => {
            const item = NAV.find(n => n.key === section);
            if (!item) return null;
            const Icon = item.icon;
            return (
              <>
                <Icon className="w-4 h-4 text-violet-400" />
                <div>
                  <h1 className="text-sm font-semibold text-zinc-100">{item.label}</h1>
                  <p className="text-[11px] text-zinc-500">{item.description}</p>
                </div>
              </>
            );
          })()}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] bg-violet-600/20 text-violet-300 border border-violet-600/30 px-2 py-0.5 rounded font-mono">
              PLATFORM ADMIN
            </span>
          </div>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {children}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
