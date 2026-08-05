import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Check, X, AlertCircle, RefreshCw, Loader2, ShieldCheck, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MODULES = [
  "dashboard","crm","procurement","materials","vendors",
  "projects","inventory","engineering","commissioning",
  "oam","finance","reports","admin","approvals",
];
const ACTIONS = ["view","create","edit","delete","approve","export","import","admin"];

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-violet-900/60 text-violet-200 border-violet-700",
  admin:       "bg-red-900/60 text-red-200 border-red-800",
  director:    "bg-blue-900/60 text-blue-200 border-blue-800",
  pm:          "bg-emerald-900/60 text-emerald-200 border-emerald-800",
  finance:     "bg-amber-900/60 text-amber-200 border-amber-800",
  warehouse:   "bg-cyan-900/60 text-cyan-200 border-cyan-800",
  sales:       "bg-pink-900/60 text-pink-200 border-pink-800",
};

type RbacMatrix = Record<string, Record<string, Record<string, boolean>>>;

function apiFetch(url: string, method: string, body?: any) {
  const token = (window as any).__mystics_token ?? localStorage.getItem("mystics_token");
  return fetch(`/api${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => {
    const json = await r.json();
    if (!r.ok) throw new Error(json.error ?? r.statusText);
    return json;
  });
}

export function AdminRBAC() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const { data: matrix, isLoading, isError, refetch } = useQuery({
    queryKey: ["rbac-all"],
    queryFn: () => apiGet<RbacMatrix>("/rbac/all"),
    staleTime: 30_000,
  });

  const roles = matrix ? Object.keys(matrix) : [];
  const selectedRole = activeRole ?? roles[0];

  const toggle = useMutation({
    mutationFn: ({ role, module, action, allowed }: { role: string; module: string; action: string; allowed: boolean }) =>
      apiFetch("/rbac/permission", "PATCH", { role, module, action, allowed }),
    onMutate: async ({ role, module, action, allowed }) => {
      const key = `${role}:${module}:${action}`;
      setPending(p => new Set(p).add(key));
      await qc.cancelQueries({ queryKey: ["rbac-all"] });
      const prev = qc.getQueryData<RbacMatrix>(["rbac-all"]);
      qc.setQueryData<RbacMatrix>(["rbac-all"], old => {
        if (!old) return old;
        return {
          ...old,
          [role]: {
            ...old[role],
            [module]: { ...(old[role]?.[module] ?? {}), [action]: allowed },
          },
        };
      });
      return { prev, key };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["rbac-all"], ctx.prev);
      toast({ title: "Permission update failed", variant: "destructive" });
    },
    onSettled: (_data, _err, _vars, ctx: any) => {
      setPending(p => { const n = new Set(p); n.delete(ctx?.key ?? ""); return n; });
      qc.invalidateQueries({ queryKey: ["rbac-all"] });
    },
  });

  const seed = useMutation({
    mutationFn: () => apiFetch("/rbac/seed", "POST"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rbac-all"] }); toast({ title: "Permissions seeded to defaults" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const reset = useMutation({
    mutationFn: () => apiFetch("/rbac/reset", "POST"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rbac-all"] }); toast({ title: "All permissions reset" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isError) return (
    <div className="flex flex-col items-center gap-3 py-16">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p className="text-sm text-zinc-400">Failed to load permissions</p>
      <Button size="sm" variant="ghost" onClick={() => refetch()} className="text-violet-400 gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </Button>
    </div>
  );

  if (isLoading) return (
    <div className="space-y-4">
      <div className="flex gap-2">{Array.from({length: 5}).map((_,i) => <Skeleton key={i} className="h-8 w-24 bg-zinc-800 rounded-lg" />)}</div>
      <Card className="bg-zinc-900 border-zinc-800 p-4 space-y-2">
        {Array.from({length: 8}).map((_,i) => <Skeleton key={i} className="h-7 w-full bg-zinc-800" />)}
      </Card>
    </div>
  );

  const roleData = matrix?.[selectedRole] ?? {};
  const grantedCount = MODULES.reduce((acc, m) =>
    acc + ACTIONS.filter(a => roleData[m]?.[a]).length, 0);
  const totalPerms = MODULES.length * ACTIONS.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Access Control Matrix</h2>
          <p className="text-xs text-zinc-500">Click any cell to toggle a permission — changes apply immediately</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost"
            disabled={seed.isPending}
            onClick={() => { if (confirm("Seed all permissions to their default values? This will overwrite any custom changes.")) seed.mutate(); }}
            className="h-7 text-xs gap-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
            <ShieldCheck className="w-3.5 h-3.5" /> Seed Defaults
          </Button>
          <Button size="sm" variant="ghost"
            disabled={reset.isPending}
            onClick={() => { if (confirm("Reset ALL permissions? Every role will lose all access. This cannot be undone.")) reset.mutate(); }}
            className="h-7 text-xs gap-1.5 text-red-500 hover:text-red-300 hover:bg-red-950/30">
            <RefreshCw className="w-3.5 h-3.5" /> Reset All
          </Button>
        </div>
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 flex-wrap">
        {roles.map(r => (
          <button key={r} onClick={() => setActiveRole(r)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border",
              selectedRole === r
                ? (ROLE_BADGE[r] ?? "bg-zinc-700 text-zinc-200 border-zinc-600")
                : "bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:border-zinc-600 hover:text-zinc-300"
            )}>
            {r}
          </button>
        ))}
      </div>

      {/* Coverage bar */}
      {selectedRole && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-zinc-400">
                <span className="text-zinc-200 font-semibold font-mono">{selectedRole}</span>
                {" · "}{grantedCount} of {totalPerms} permissions granted
              </span>
              <span className="text-xs text-zinc-500">{Math.round((grantedCount / totalPerms) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${(grantedCount / totalPerms) * 100}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-500 shrink-0">
            <Info className="w-3 h-3" /> Click cell to toggle
          </div>
        </div>
      )}

      {/* Matrix */}
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-500">
                <th className="text-left px-4 py-2.5 font-medium w-32 text-[10px] uppercase tracking-wide">Module</th>
                {ACTIONS.map(a => (
                  <th key={a} className="text-center px-2 py-2.5 font-medium text-[10px] uppercase tracking-wide capitalize w-14">{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map(mod => {
                const rowGranted = ACTIONS.filter(a => roleData[mod]?.[a]).length;
                return (
                  <tr key={mod} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors group">
                    <td className="px-4 py-1 font-medium text-zinc-300 capitalize">
                      <div className="flex items-center gap-2">
                        <span>{mod}</span>
                        {rowGranted > 0 && (
                          <span className="text-[9px] text-zinc-600 font-mono">{rowGranted}/{ACTIONS.length}</span>
                        )}
                      </div>
                    </td>
                    {ACTIONS.map(act => {
                      const allowed = roleData[mod]?.[act] ?? false;
                      const key = `${selectedRole}:${mod}:${act}`;
                      const isPending = pending.has(key);
                      const isSuperAdmin = selectedRole === "super_admin";

                      return (
                        <td key={act} className="text-center px-2 py-1">
                          <button
                            disabled={isSuperAdmin || isPending}
                            onClick={() => toggle.mutate({ role: selectedRole, module: mod, action: act, allowed: !allowed })}
                            title={isSuperAdmin ? "super_admin always has full access" : `${allowed ? "Revoke" : "Grant"} ${act} on ${mod}`}
                            className={cn(
                              "w-7 h-6 rounded flex items-center justify-center mx-auto transition-all",
                              isSuperAdmin
                                ? "cursor-default"
                                : allowed
                                ? "bg-emerald-900/30 hover:bg-emerald-900/60 border border-emerald-800/50 cursor-pointer"
                                : "bg-zinc-800/40 hover:bg-red-950/30 border border-zinc-700/40 hover:border-red-800/40 cursor-pointer"
                            )}
                          >
                            {isPending ? (
                              <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                            ) : isSuperAdmin ? (
                              <Check className="w-3 h-3 text-violet-400" />
                            ) : allowed ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <X className="w-3 h-3 text-zinc-700 group-hover:text-zinc-600" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedRole === "super_admin" && (
        <p className="text-xs text-zinc-600 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-violet-500" />
          super_admin has unrestricted access to all modules — individual permissions cannot be revoked.
        </p>
      )}
    </div>
  );
}
