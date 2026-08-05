import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search, UserPlus, Pencil, KeyRound, Trash2,
  ShieldAlert, AlertTriangle, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

const ROLES = ["super_admin","admin","director","pm","finance","warehouse","sales"];

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-violet-800/60 text-violet-200 border-violet-700",
  admin:       "bg-red-900/60 text-red-200 border-red-800",
  director:    "bg-blue-900/60 text-blue-200 border-blue-800",
  pm:          "bg-emerald-900/60 text-emerald-200 border-emerald-800",
  finance:     "bg-amber-900/60 text-amber-200 border-amber-800",
  warehouse:   "bg-cyan-900/60 text-cyan-200 border-cyan-800",
  sales:       "bg-pink-900/60 text-pink-200 border-pink-800",
};

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

/* ── Create User Dialog ─────────────────────────────────────────────────────── */
function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [role, setRole]       = useState("sales");
  const [error, setError]     = useState("");

  const mut = useMutation({
    mutationFn: () => apiFetch("/platform-admin/users", "POST", { name, email, password: pass, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pa-users-v2"] });
      qc.invalidateQueries({ queryKey: ["pa-stats"] });
      toast({ title: `User ${name} created` });
      setName(""); setEmail(""); setPass(""); setRole("sales"); setError("");
      onClose();
    },
    onError: (e: any) => setError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Create Platform User</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          <div className="space-y-1"><Label className="text-xs text-zinc-400">Full Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe"
              className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200" /></div>
          <div className="space-y-1"><Label className="text-xs text-zinc-400">Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="john@company.com" type="email"
              className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200" /></div>
          <div className="space-y-1"><Label className="text-xs text-zinc-400">Password</Label>
            <Input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="Minimum 8 characters"
              className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200" /></div>
          <div className="space-y-1"><Label className="text-xs text-zinc-400">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {ROLES.map(r => <SelectItem key={r} value={r} className="text-xs text-zinc-200">{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">Cancel</Button>
          <Button size="sm" disabled={!name || !email || !pass || mut.isPending}
            onClick={() => mut.mutate()}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {mut.isPending ? "Creating…" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Edit User Dialog ───────────────────────────────────────────────────────── */
function EditUserDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => apiFetch(`/platform-admin/users/${user.id}`, "PATCH", { name, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pa-users-v2"] });
      qc.invalidateQueries({ queryKey: ["pa-stats"] });
      toast({ title: "User updated" });
      onClose();
    },
    onError: (e: any) => setError(e.message),
  });

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Edit User</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          <p className="text-xs text-zinc-500 font-mono">{user.email}</p>
          <div className="space-y-1"><Label className="text-xs text-zinc-400">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)}
              className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200" /></div>
          <div className="space-y-1"><Label className="text-xs text-zinc-400">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {ROLES.map(r => <SelectItem key={r} value={r} className="text-xs text-zinc-200">{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">Cancel</Button>
          <Button size="sm" disabled={(!name && !role) || mut.isPending}
            onClick={() => mut.mutate()}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {mut.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Reset Password Dialog ──────────────────────────────────────────────────── */
function ResetPasswordDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => apiFetch(`/platform-admin/users/${user.id}/reset-password`, "PATCH", { password: pass }),
    onSuccess: () => {
      toast({ title: `Password reset for ${user.name}` });
      onClose();
    },
    onError: (e: any) => setError(e.message),
  });

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Reset Password</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          <p className="text-xs text-zinc-400">Setting new password for <span className="text-zinc-200 font-medium">{user.name}</span> ({user.email})</p>
          <div className="space-y-1"><Label className="text-xs text-zinc-400">New Password</Label>
            <Input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="Minimum 6 characters"
              className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200"
              onKeyDown={e => e.key === "Enter" && pass.length >= 6 && mut.mutate()} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">Cancel</Button>
          <Button size="sm" disabled={pass.length < 6 || mut.isPending}
            onClick={() => mut.mutate()}
            className="bg-amber-600 hover:bg-amber-700 text-white">
            {mut.isPending ? "Resetting…" : "Reset Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Delete Confirm Dialog ──────────────────────────────────────────────────── */
function DeleteConfirmDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => apiFetch(`/platform-admin/users/${user.id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pa-users-v2"] });
      qc.invalidateQueries({ queryKey: ["pa-stats"] });
      toast({ title: `User ${user.name} deleted` });
      onClose();
    },
    onError: (e: any) => setError(e.message),
  });

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-red-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Delete User Account
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          <p className="text-sm text-zinc-300">
            Permanently delete <span className="font-semibold text-white">{user.name}</span>?
          </p>
          <div className="bg-zinc-800 rounded-lg px-3 py-2 space-y-0.5">
            <p className="text-xs text-zinc-400 font-mono">{user.email}</p>
            <Badge className={cn("text-[10px] font-mono", ROLE_COLORS[user.role] ?? "bg-zinc-700 text-zinc-300")}>
              {user.role}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500">This action is irreversible. The user will lose all access immediately.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">Cancel</Button>
          <Button size="sm" disabled={mut.isPending}
            onClick={() => mut.mutate()}
            className="bg-red-700 hover:bg-red-600 text-white">
            {mut.isPending ? "Deleting…" : "Delete Permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
export function AdminUsers() {
  const [q, setQ]               = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing]   = useState<any>(null);
  const [resetting, setResetting] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["pa-users-v2"],
    queryFn: () => apiGet<any[]>("/platform-admin/users"),
  });

  const filtered = users.filter(u =>
    !q || u.name?.toLowerCase().includes(q.toLowerCase()) ||
    u.email?.toLowerCase().includes(q.toLowerCase()) ||
    u.role?.toLowerCase().includes(q.toLowerCase())
  );

  // Role counts for header strip
  const roleCounts = users.reduce((acc: Record<string, number>, u: any) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1; return acc;
  }, {});

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">User Accounts</h2>
          <p className="text-xs text-zinc-500">{users.length} total platform accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search users…"
              className="pl-8 h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500" />
          </div>
          <Button size="sm" onClick={() => setCreating(true)}
            className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs">
            <UserPlus className="w-3.5 h-3.5" /> New User
          </Button>
        </div>
      </div>

      {/* Role breakdown strip */}
      {!isLoading && users.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(roleCounts).sort((a,b) => b[1] - a[1]).map(([role, count]) => (
            <button key={role} onClick={() => setQ(role)}
              className={cn("flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md border transition-colors",
                q === role ? ROLE_COLORS[role] : "bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-600")}>
              <Users className="w-3 h-3" />{role} <span className="opacity-70">×{count as number}</span>
            </button>
          ))}
          {q && (
            <button onClick={() => setQ("")}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 px-1.5 py-1 transition-colors">
              <X className="w-3 h-3" /> clear
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">Email</th>
              <th className="text-left px-4 py-2.5 font-medium">Role</th>
              <th className="text-left px-4 py-2.5 font-medium">Last Seen</th>
              <th className="text-left px-4 py-2.5 font-medium">Joined</th>
              <th className="text-right px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  {[140, 200, 80, 100, 80, 80].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-3 bg-zinc-800 rounded" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                {q ? `No users matching "${q}"` : "No users found"}
              </td></tr>
            ) : (
              filtered.map((u: any) => (
                <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors group">
                  <td className="px-4 py-3 font-medium text-zinc-200">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge className={cn("text-[10px] px-1.5 font-mono border", ROLE_COLORS[u.role] ?? "bg-zinc-700 text-zinc-300 border-zinc-600")}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-[11px]">
                    {u.last_seen
                      ? <span title={format(new Date(u.last_seen), "dd MMM yyyy HH:mm")}>
                          {formatDistanceToNow(new Date(u.last_seen), { addSuffix: true })}
                        </span>
                      : <span className="text-zinc-700">Never</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 text-[11px]">
                    {u.created_at ? format(new Date(u.created_at), "dd MMM yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditing(u)} title="Edit"
                        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setResetting(u)} title="Reset password"
                        className="p-1.5 rounded hover:bg-amber-900/40 text-zinc-400 hover:text-amber-300 transition-colors">
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleting(u)} title="Delete user"
                        className="p-1.5 rounded hover:bg-red-900/40 text-zinc-400 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Dialogs */}
      {creating  && <CreateUserDialog open onClose={() => setCreating(false)} />}
      {editing   && <EditUserDialog user={editing} onClose={() => setEditing(null)} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
      {deleting  && <DeleteConfirmDialog user={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
