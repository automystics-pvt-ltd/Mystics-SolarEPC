import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  super_admin:  "bg-violet-800 text-violet-200",
  admin:        "bg-red-900 text-red-200",
  director:     "bg-blue-900 text-blue-200",
  pm:           "bg-emerald-900 text-emerald-200",
  finance:      "bg-amber-900 text-amber-200",
  warehouse:    "bg-cyan-900 text-cyan-200",
  sales:        "bg-pink-900 text-pink-200",
};

export function AdminUsers() {
  const [q, setQ] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["pa-users"],
    queryFn: () => apiGet<any[]>("/users"),
  });

  const filtered = users.filter(u =>
    !q || u.name?.toLowerCase().includes(q.toLowerCase()) ||
    u.email?.toLowerCase().includes(q.toLowerCase()) ||
    u.role?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">All Users</h2>
          <p className="text-xs text-zinc-500">{users.length} platform accounts</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search users…"
            className="pl-8 h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
          />
        </div>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">Email</th>
              <th className="text-left px-4 py-2.5 font-medium">Role</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  {[140, 200, 80, 60].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className={`h-3 bg-zinc-800 rounded`} style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No users found</td></tr>
            ) : (
              filtered.map((u: any) => (
                <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-200">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-400 font-mono">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge className={cn("text-[10px] px-1.5 font-mono", ROLE_COLORS[u.role] ?? "bg-zinc-700 text-zinc-300")}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                      Active
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
