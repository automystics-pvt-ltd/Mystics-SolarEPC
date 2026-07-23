import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, UserCog, MoreHorizontal, Loader2, Shield } from "lucide-react";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataTable, SectionCard, StatusBadge } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";

const ROLES = ["admin", "director", "pm", "warehouse", "sales"];

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<any>(null);
  const [resetDialog, setResetDialog] = useState<any>(null);

  // Add user form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("sales");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");

  // Reset password
  const [newPw, setNewPw] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<any[]>("/users"),
  });

  const createMut = useMutation({
    mutationFn: () => apiPost("/users", { name: newName, email: newEmail, password: newPassword, role: newRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User created", description: `${newName} added as ${newRole}` });
      setAddDialog(false);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("sales");
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const editMut = useMutation({
    mutationFn: () => apiPatch(`/users/${editDialog?.id}`, { name: editName, role: editRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User updated" });
      setEditDialog(null);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const resetMut = useMutation({
    mutationFn: () => apiPatch(`/users/${resetDialog?.id}/reset-password`, { password: newPw }),
    onSuccess: () => {
      toast({ title: "Password reset", description: "Password updated successfully" });
      setResetDialog(null);
      setNewPw("");
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  if (currentUser?.role !== "admin" && currentUser?.role !== "director") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground font-medium">Access Restricted</p>
        <p className="text-muted-foreground text-sm">Only Admin and Director roles can access User Management</p>
      </div>
    );
  }

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #1E293B, #0F172A)" }}>
              {u.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{u.name}</p>
              {u.id === currentUser?.id && <p className="text-xs text-orange-500">You</p>}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize text-xs">
          {row.original.role}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      enableSorting: false,
      cell: () => <StatusBadge status="Active" />,
    },
    {
      id: "lastActive",
      header: "Last Active",
      enableSorting: false,
      cell: () => <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("en-IN") : "—"}
        </span>
      ),
    },
    {
      id: "__actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const u = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setEditDialog(u); setEditName(u.name); setEditRole(u.role); }}>
                Edit Role
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setResetDialog(u); setNewPw(""); }}>
                Reset Password
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="User Management"
        subtitle="Team members and access control"
        actions={
          <Button onClick={() => setAddDialog(true)} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white shadow-sm">
            <Plus className="h-4 w-4" /> Add User
          </Button>
        }
      />

      <SectionCard title="Users" noPadding>
        <DataTable
          data={users as any[]}
          columns={columns}
          loading={isLoading}
          searchPlaceholder="Search by name or email..."
          exportFilename="users"
          filterOptions={[
            {
              key: "role",
              label: "Role",
              options: ROLES.map(r => ({ label: r.charAt(0).toUpperCase() + r.slice(1), value: r })),
            },
          ]}
          emptyIcon={UserCog}
          emptyTitle="No users found"
          emptyDescription="Add a user to get started"
          noSelection
        />
      </SectionCard>

      {/* Add User Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Priya Sharma" />
            </div>
            <div className="space-y-1">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="priya@company.com" />
            </div>
            <div className="space-y-1">
              <Label>Password <span className="text-red-500">*</span></Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" minLength={6} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !newName || !newEmail || !newPassword || newPassword.length < 6}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
            >
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User — {editDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button onClick={() => editMut.mutate()} disabled={editMut.isPending} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
              {editMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetDialog} onOpenChange={() => setResetDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password — {resetDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>New Password <span className="text-red-500">*</span></Label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 6 characters" minLength={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(null)}>Cancel</Button>
            <Button onClick={() => resetMut.mutate()} disabled={resetMut.isPending || newPw.length < 6} className="gap-2">
              {resetMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
