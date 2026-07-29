import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Check, X, Info, AlertCircle } from "lucide-react";

// Modules and actions to display — kept in sync with backend MODULES/ACTIONS
const MODULES = [
  "dashboard","crm","procurement","materials","vendors",
  "projects","inventory","engineering","commissioning",
  "oam","finance","reports","admin","approvals",
];
const ACTIONS = ["view","create","edit","delete","approve","export","import","admin"];

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-violet-900 text-violet-200",
  admin:       "bg-red-900 text-red-200",
  director:    "bg-blue-900 text-blue-200",
  pm:          "bg-emerald-900 text-emerald-200",
  finance:     "bg-amber-900 text-amber-200",
  warehouse:   "bg-cyan-900 text-cyan-200",
  sales:       "bg-pink-900 text-pink-200",
};

// /rbac/all → Record<role, Record<module, Record<action, boolean>>>
type RbacMatrix = Record<string, Record<string, Record<string, boolean>>>;

export function AdminRBAC() {
  const { data: matrix, isLoading, isError } = useQuery({
    queryKey: ["rbac-all"],
    queryFn: () => apiGet<RbacMatrix>("/rbac/all"),
    staleTime: 60_000,
  });

  const roles = matrix ? Object.keys(matrix) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Role Permissions Matrix</h2>
          <p className="text-xs text-zinc-500">Read-only view — edit via Access Control in the main app</p>
        </div>
        <Link href="/admin/rbac">
          <a className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
            <Info className="w-3 h-3" />
            Edit in RBAC Manager
          </a>
        </Link>
      </div>

      {isError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Failed to load permission matrix. You may not have admin access to this endpoint.
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-zinc-900 border-zinc-800 p-4">
              <Skeleton className="h-4 w-24 bg-zinc-800 mb-3" />
              <div className="grid grid-cols-8 gap-2">
                {Array.from({ length: 8 }).map((_, j) => (
                  <Skeleton key={j} className="h-3 w-full bg-zinc-800" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && !isError && matrix && (
        <div className="space-y-4">
          {roles.map(role => {
            const roleData = matrix[role] ?? {};
            const accessibleModules = MODULES.filter(m =>
              Object.values(roleData[m] ?? {}).some(Boolean)
            ).length;

            return (
              <Card key={role} className="bg-zinc-900 border-zinc-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <Badge className={cn("text-[10px] font-mono", ROLE_BADGE[role] ?? "bg-zinc-700 text-zinc-300")}>
                    {role}
                  </Badge>
                  <span className="text-xs text-zinc-500">
                    {accessibleModules} module{accessibleModules !== 1 ? "s" : ""} accessible
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-600">
                        <th className="text-left px-4 py-2 font-medium w-32">Module</th>
                        {ACTIONS.map(a => (
                          <th key={a} className="text-center px-2 py-2 font-medium capitalize">{a}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map(mod => (
                        <tr
                          key={mod}
                          className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="px-4 py-1.5 font-medium text-zinc-300 capitalize">{mod}</td>
                          {ACTIONS.map(act => {
                            const allowed = roleData[mod]?.[act] ?? false;
                            return (
                              <td key={act} className="text-center px-2 py-1.5">
                                {allowed
                                  ? <Check className="w-3 h-3 text-emerald-500 mx-auto" />
                                  : <X className="w-3 h-3 text-zinc-700 mx-auto" />}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
