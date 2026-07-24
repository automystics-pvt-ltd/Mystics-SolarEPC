/**
 * RBAC — Frontend permission hook + PermissionGate component.
 *
 * Usage:
 *   const { canCreate, canEdit, canDelete } = usePermissions("procurement");
 *   <PermissionGate module="admin" action="admin"><AdminButton /></PermissionGate>
 */
import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/fetch";

/* ── Types ──────────────────────────────────────────────────────────────── */
export type PermAction = "view" | "create" | "edit" | "delete" | "approve" | "export" | "import" | "admin";

export interface ModulePerms {
  canView:    boolean;
  canCreate:  boolean;
  canEdit:    boolean;
  canDelete:  boolean;
  canApprove: boolean;
  canExport:  boolean;
  canImport:  boolean;
  canAdmin:   boolean;
  can:        (action: PermAction) => boolean;
  isLoading:  boolean;
}

export type PermissionMap = Record<string, Record<PermAction, boolean>>;

/* ── Sentinels ──────────────────────────────────────────────────────────── */
const ALL_ALLOWED: ModulePerms = {
  canView: true, canCreate: true, canEdit: true, canDelete: true,
  canApprove: true, canExport: true, canImport: true, canAdmin: true,
  can: () => true, isLoading: false,
};
const LOADING_PERMS: ModulePerms = {
  canView: true, canCreate: false, canEdit: false, canDelete: false,
  canApprove: false, canExport: false, canImport: false, canAdmin: false,
  can: (a) => a === "view", isLoading: true,
};
const NO_ACCESS: ModulePerms = {
  canView: false, canCreate: false, canEdit: false, canDelete: false,
  canApprove: false, canExport: false, canImport: false, canAdmin: false,
  can: () => false, isLoading: false,
};

function mapToPerms(actions: Record<PermAction, boolean>): ModulePerms {
  return {
    canView:    actions.view,
    canCreate:  actions.create,
    canEdit:    actions.edit,
    canDelete:  actions.delete,
    canApprove: actions.approve,
    canExport:  actions.export,
    canImport:  actions.import,
    canAdmin:   actions.admin,
    can:        (a: PermAction) => actions[a] ?? false,
    isLoading:  false,
  };
}

/* ── Hook ───────────────────────────────────────────────────────────────── */
export function usePermissions(module?: string): ModulePerms {
  const { user, isLoading: authLoading } = useAuth();

  const { data: permMap, isLoading: permLoading } = useQuery<PermissionMap>({
    queryKey: ["rbac-my-permissions"],
    queryFn: () => apiGet<PermissionMap>("/rbac/my-permissions"),
    enabled: !!user,
    staleTime: 5 * 60_000,
    gcTime:    30 * 60_000,
    refetchOnWindowFocus: false,
  });

  if (authLoading) return LOADING_PERMS;
  if (!user) return NO_ACCESS;
  if (user.role === "admin") return ALL_ALLOWED;
  if (!module) return ALL_ALLOWED;
  if (permLoading || !permMap) return LOADING_PERMS;
  const modulePerms = permMap[module];
  if (!modulePerms) return NO_ACCESS;
  return mapToPerms(modulePerms);
}

/* ── Full permission map (for admin UI) ─────────────────────────────────── */
export function useAllPermissions() {
  const { user } = useAuth();
  return useQuery<Record<string, PermissionMap>>({
    queryKey: ["rbac-all-permissions"],
    queryFn: () => apiGet<Record<string, PermissionMap>>("/rbac/all"),
    enabled: !!user && (user.role === "admin" || user.role === "director"),
    staleTime: 60_000,
  });
}

/* ── PermissionGate component ───────────────────────────────────────────── */
interface PermissionGateProps {
  module:   string;
  action:   PermAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ module, action, children, fallback = null }: PermissionGateProps) {
  const perms = usePermissions(module);
  if (perms.isLoading) return null;
  if (!perms.can(action)) return <>{fallback}</>;
  return <>{children}</>;
}

/* ── Convenience wrappers ───────────────────────────────────────────────── */
export function CanView({ module, children, fallback }: { module: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  return <PermissionGate module={module} action="view" children={children} fallback={fallback} />;
}
export function CanCreate({ module, children, fallback }: { module: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  return <PermissionGate module={module} action="create" children={children} fallback={fallback} />;
}
export function CanEdit({ module, children, fallback }: { module: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  return <PermissionGate module={module} action="edit" children={children} fallback={fallback} />;
}
export function CanDelete({ module, children, fallback }: { module: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  return <PermissionGate module={module} action="delete" children={children} fallback={fallback} />;
}
export function CanApprove({ module, children, fallback }: { module: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  return <PermissionGate module={module} action="approve" children={children} fallback={fallback} />;
}
export function CanExport({ module, children, fallback }: { module: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  return <PermissionGate module={module} action="export" children={children} fallback={fallback} />;
}
export function CanAdmin({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return <PermissionGate module="admin" action="admin" children={children} fallback={fallback} />;
}

