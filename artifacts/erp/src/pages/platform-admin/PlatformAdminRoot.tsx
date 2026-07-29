/**
 * PlatformAdminRoot — auth gate + section router for the Platform Admin portal.
 * Renders outside of NavRail/Shell with its own AdminShell dark sidebar.
 */
import { useAuth } from "@/lib/auth";
import { AdminShell, type AdminSection } from "./AdminShell";
import { AdminOverview }       from "./sections/AdminOverview";
import { AdminUsers }          from "./sections/AdminUsers";
import { AdminRBAC }           from "./sections/AdminRBAC";
import { AdminModules }        from "./sections/AdminModules";
import { AdminSettings }       from "./sections/AdminSettings";
import { AdminNotifTemplates } from "./sections/AdminNotifTemplates";
import { AdminWorkflows }      from "./sections/AdminWorkflows";
import { AdminSecurity }       from "./sections/AdminSecurity";
import { AdminAuditLogs }      from "./sections/AdminAuditLogs";
import { AdminDbConsole }      from "./sections/AdminDbConsole";
import { Loader2, ShieldX } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const ALLOWED_ROLES = new Set(["super_admin", "admin"]);

function sectionFromPath(path: string): AdminSection {
  const seg = path.split("/").filter(Boolean)[1] as AdminSection | undefined;
  const VALID: AdminSection[] = [
    "overview","users","rbac","modules","settings",
    "notifications","workflows","security","audit","db",
  ];
  return VALID.includes(seg as AdminSection) ? (seg as AdminSection) : "overview";
}

interface PlatformAdminRootProps {
  section?: AdminSection;
}

export function PlatformAdminRoot({ section: sectionProp }: PlatformAdminRootProps) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  const section = sectionProp ?? sectionFromPath(location);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!user || !ALLOWED_ROLES.has(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 gap-4 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-red-900/30 flex items-center justify-center">
          <ShieldX className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-100">Access Restricted</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Platform Admin is only accessible to <span className="text-zinc-300">super_admin</span> and <span className="text-zinc-300">admin</span> accounts.
          </p>
          {user && (
            <p className="text-xs text-zinc-600 mt-2">Signed in as: {user.email} ({user.role})</p>
          )}
        </div>
        <Button
          onClick={() => navigate("/dashboard")}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 h-8 text-xs"
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  function renderSection() {
    switch (section) {
      case "overview":      return <AdminOverview />;
      case "users":         return <AdminUsers />;
      case "rbac":          return <AdminRBAC />;
      case "modules":       return <AdminModules />;
      case "settings":      return <AdminSettings />;
      case "notifications": return <AdminNotifTemplates />;
      case "workflows":     return <AdminWorkflows />;
      case "security":      return <AdminSecurity />;
      case "audit":         return <AdminAuditLogs />;
      case "db":            return <AdminDbConsole />;
      default:              return <AdminOverview />;
    }
  }

  return (
    <AdminShell section={section}>
      {renderSection()}
    </AdminShell>
  );
}
