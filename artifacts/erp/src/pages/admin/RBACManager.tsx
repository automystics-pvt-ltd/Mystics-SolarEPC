/**
 * RBAC Manager — visual permission matrix for admin users.
 * Role tabs → module rows → 8 action checkboxes per cell.
 * Changes persist immediately on toggle with optimistic UI.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/fetch";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Shield, RefreshCw, Loader2, Lock, Check, X, RotateCcw,
  LayoutDashboard, Users2, ShoppingCart, Package, Building2,
  FolderKanban, Warehouse, FileCode, CheckCircle2, Wrench,
  DollarSign, BarChart3, Settings2, ListChecks,
} from "lucide-react";
import { Redirect } from "wouter";

/* ── Types ─────────────────────────────────────────────────────────────── */
type Action = "view"|"create"|"edit"|"delete"|"approve"|"export"|"import"|"admin";
type PermMatrix = Record<string, Record<string, Record<Action, boolean>>>;

/* ── Constants ──────────────────────────────────────────────────────────── */
const ROLES = [
  { key: "admin",     label: "Admin",           color: "bg-rose-100 text-rose-800 border-rose-200" },
  { key: "director",  label: "Director",        color: "bg-violet-100 text-violet-800 border-violet-200" },
  { key: "pm",        label: "Project Manager", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { key: "finance",   label: "Finance",         color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { key: "warehouse", label: "Warehouse",       color: "bg-amber-100 text-amber-800 border-amber-200" },
  { key: "sales",     label: "Sales",           color: "bg-orange-100 text-orange-800 border-orange-200" },
];

const MODULES = [
  { key: "dashboard",     label: "Dashboard",           Icon: LayoutDashboard,  group: "Core" },
  { key: "approvals",     label: "Approval Workbench",  Icon: ListChecks,       group: "Core" },
  { key: "crm",           label: "Sales & CRM",         Icon: Users2,           group: "Business" },
  { key: "procurement",   label: "Procurement",         Icon: ShoppingCart,     group: "Business" },
  { key: "materials",     label: "Materials Catalogue", Icon: Package,          group: "Business" },
  { key: "vendors",       label: "Vendors",             Icon: Building2,        group: "Business" },
  { key: "projects",      label: "Projects",            Icon: FolderKanban,     group: "Business" },
  { key: "inventory",     label: "Inventory",           Icon: Warehouse,        group: "Operations" },
  { key: "engineering",   label: "Engineering",         Icon: FileCode,         group: "Operations" },
  { key: "commissioning", label: "Commissioning",       Icon: CheckCircle2,     group: "Operations" },
  { key: "oam",           label: "O&M & AMC",           Icon: Wrench,           group: "Operations" },
  { key: "finance",       label: "Finance & Reports",   Icon: DollarSign,       group: "Finance" },
  { key: "reports",       label: "Reports",             Icon: BarChart3,        group: "Finance" },
  { key: "admin",         label: "Administration",      Icon: Settings2,        group: "Admin" },
];

const ACTIONS: { key: Action; label: string; short: string }[] = [
  { key: "view",    label: "View",    short: "VW" },
  { key: "create",  label: "Create",  short: "CR" },
  { key: "edit",    label: "Edit",    short: "ED" },
  { key: "delete",  label: "Delete",  short: "DL" },
  { key: "approve", label: "Approve", short: "AP" },
  { key: "export",  label: "Export",  short: "EX" },
  { key: "import",  label: "Import",  short: "IM" },
  { key: "admin",   label: "Admin",   short: "AD" },
];

const MODULE_GROUPS = ["Core", "Business", "Operations", "Finance", "Admin"];

/* ── Helpers ────────────────────────────────────────────────────────────── */
function countGranted(matrix: PermMatrix, role: string): number {
  if (!matrix[role]) return 0;
  return Object.values(matrix[role]).reduce((sum, mods) =>
    sum + Object.values(mods).filter(Boolean).length, 0);
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function RBACManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState("director");
  const [pendingToggle, setPendingToggle] = useState<string | null>(null);

  const { data: matrix, isPending } = useQuery<PermMatrix>({
    queryKey: ["rbac-all"],
    queryFn: () => apiGet<PermMatrix>("/rbac/all"),
    staleTime: 30_000,
  });

  const toggleMut = useMutation({
    mutationFn: (body: { role: string; module: string; action: string; allowed: boolean }) =>
      fetch(`${import.meta.env.BASE_URL}api/rbac/permission`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("mystics_token")}`,
        },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: (_, vars) => {
      // Optimistic update in cache
      qc.setQueryData<PermMatrix>(["rbac-all"], (old) => {
        if (!old) return old;
        return {
          ...old,
          [vars.role]: {
            ...old[vars.role],
            [vars.module]: {
              ...(old[vars.role]?.[vars.module] ?? {}),
              [vars.action]: vars.allowed,
            },
          },
        };
      });
      // Invalidate frontend permission cache
      qc.invalidateQueries({ queryKey: ["rbac-my-permissions"] });
      setPendingToggle(null);
    },
    onError: () => {
      toast({ title: "Failed to save permission", variant: "destructive" });
      setPendingToggle(null);
    },
  });

  const seedMut = useMutation({
    mutationFn: () => apiPost("/rbac/seed", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac-all"] });
      qc.invalidateQueries({ queryKey: ["rbac-my-permissions"] });
      toast({ title: "Default permissions seeded successfully" });
    },
  });

  const resetMut = useMutation({
    mutationFn: () => apiPost("/rbac/reset", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac-all"] });
      qc.invalidateQueries({ queryKey: ["rbac-my-permissions"] });
      toast({ title: "Permissions reset to defaults", variant: "default" });
    },
  });

  // Guard: only admin/director — placed AFTER all hooks to satisfy Rules of Hooks
  if (user && user.role !== "admin" && user.role !== "director") {
    return <Redirect to="/dashboard" />;
  }

  function handleToggle(role: string, mod: string, action: Action, current: boolean) {
    if (role === "admin") return; // admin is immutable
    const key = `${role}:${mod}:${action}`;
    setPendingToggle(key);
    toggleMut.mutate({ role, module: mod, action, allowed: !current });
  }

  const roleConfig = ROLES.find(r => r.key === selectedRole)!;
  const roleMatrix = matrix?.[selectedRole] ?? {};

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-600" />
            <h1 className="text-xl font-bold tracking-tight">Access Control</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Configure what each role can see and do across every module.
            Changes take effect immediately.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm" variant="outline"
            className="gap-1.5 text-xs h-8"
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending}
          >
            {seedMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Seed Defaults
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 text-rose-600 border-rose-200 hover:bg-rose-50">
                <RotateCcw className="h-3 w-3" />
                Reset All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all permissions to defaults?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will wipe all custom permission changes and restore the
                  factory defaults for every role. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-rose-600 hover:bg-rose-700"
                  onClick={() => resetMut.mutate()}
                >
                  {resetMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reset to Defaults
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* ── Role selector tabs ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map(r => {
          const granted = matrix ? countGranted(matrix, r.key) : 0;
          return (
            <button
              key={r.key}
              onClick={() => setSelectedRole(r.key)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                selectedRole === r.key
                  ? "ring-2 ring-orange-500 bg-white shadow-sm"
                  : "bg-muted/40 hover:bg-muted/70 border-transparent",
              )}
            >
              <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold border", r.color)}>
                {r.label}
              </span>
              {r.key === "admin" ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" />All</span>
              ) : (
                <span className="text-xs text-muted-foreground">{granted} granted</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {isPending ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          {/* ── Admin role notice ─────────────────────────────────────── */}
          {selectedRole === "admin" && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200">
              <Lock className="h-5 w-5 text-rose-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-rose-900">Administrator role is immutable</p>
                <p className="text-xs text-rose-700 mt-0.5">
                  Administrators always have full access to all modules and actions.
                  This cannot be modified for system security.
                </p>
              </div>
            </div>
          )}

          {/* ── Action legend ─────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Actions:</span>
            {ACTIONS.map(a => (
              <span key={a.key} className="flex items-center gap-1">
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{a.short}</span>
                {a.label}
              </span>
            ))}
          </div>

          {/* ── Permission matrix ──────────────────────────────────────── */}
          <div className="space-y-4">
            {MODULE_GROUPS.map(group => {
              const groupMods = MODULES.filter(m => m.group === group);
              return (
                <div key={group} className="rounded-xl border bg-card overflow-hidden">
                  {/* Group header */}
                  <div className="px-4 py-2.5 bg-muted/40 border-b">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{group}</p>
                  </div>

                  {/* Module rows */}
                  <div className="divide-y">
                    {groupMods.map(mod => {
                      const modPerms = selectedRole === "admin"
                        ? Object.fromEntries(ACTIONS.map(a => [a.key, true])) as Record<Action, boolean>
                        : (roleMatrix[mod.key] ?? Object.fromEntries(ACTIONS.map(a => [a.key, false]))) as Record<Action, boolean>;

                      const grantedCount = Object.values(modPerms).filter(Boolean).length;

                      return (
                        <div key={mod.key}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group"
                        >
                          {/* Module name */}
                          <div className="flex items-center gap-2 min-w-0 w-44 shrink-0">
                            <div className="p-1.5 rounded-lg bg-muted/60 group-hover:bg-muted">
                              <mod.Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{mod.label}</p>
                              <p className="text-[10px] text-muted-foreground">{grantedCount}/{ACTIONS.length} granted</p>
                            </div>
                          </div>

                          {/* Action toggles */}
                          <div className="flex items-center gap-1.5 flex-wrap flex-1">
                            {ACTIONS.map(act => {
                              const isGranted = modPerms[act.key] ?? false;
                              const isAdmin   = selectedRole === "admin";
                              const isPending = pendingToggle === `${selectedRole}:${mod.key}:${act.key}`;

                              return (
                                <button
                                  key={act.key}
                                  disabled={isAdmin || isPending}
                                  onClick={() => handleToggle(selectedRole, mod.key, act.key, isGranted)}
                                  title={`${act.label}: ${isGranted ? "Granted" : "Denied"}`}
                                  className={cn(
                                    "relative flex flex-col items-center justify-center w-12 h-11 rounded-lg border text-[10px] font-semibold transition-all",
                                    isAdmin
                                      ? "bg-rose-50 border-rose-200 text-rose-700 cursor-not-allowed opacity-80"
                                      : isGranted
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer"
                                        : "bg-muted/40 border-border text-muted-foreground hover:bg-muted cursor-pointer",
                                  )}
                                >
                                  {isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : isGranted ? (
                                    <>
                                      <Check className="h-3 w-3 mb-0.5" />
                                      <span>{act.short}</span>
                                    </>
                                  ) : (
                                    <>
                                      <X className="h-3 w-3 mb-0.5 opacity-40" />
                                      <span className="opacity-40">{act.short}</span>
                                    </>
                                  )}
                                  {isAdmin && (
                                    <Lock className="absolute -top-1 -right-1 h-2.5 w-2.5 text-rose-500" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Grant all / Revoke all quick actions */}
                          {selectedRole !== "admin" && (
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium leading-none"
                                onClick={() => {
                                  ACTIONS.forEach(act => {
                                    if (!modPerms[act.key]) handleToggle(selectedRole, mod.key, act.key, false);
                                  });
                                }}
                              >All ↑</button>
                              <button
                                className="text-[10px] text-rose-500 hover:text-rose-700 font-medium leading-none"
                                onClick={() => {
                                  ACTIONS.forEach(act => {
                                    if (modPerms[act.key]) handleToggle(selectedRole, mod.key, act.key, true);
                                  });
                                }}
                              >None ↓</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Summary stats ─────────────────────────────────────────── */}
          {matrix && selectedRole !== "admin" && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t">
              <span>
                <strong className="text-foreground">{countGranted(matrix, selectedRole)}</strong> permissions granted
              </span>
              <span>·</span>
              <span>
                <strong className="text-foreground">{MODULES.length * ACTIONS.length - countGranted(matrix, selectedRole)}</strong> denied
              </span>
              <span>·</span>
              <span>{MODULES.length} modules × {ACTIONS.length} actions</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
