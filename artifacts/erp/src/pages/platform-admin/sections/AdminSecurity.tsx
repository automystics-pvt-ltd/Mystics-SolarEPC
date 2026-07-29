import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type FailedLogin = {
  email?: string;
  ip_address?: string;
  description?: string;
  error_message?: string;
  created_at?: string;
};

type Session = {
  user_id?: number;
  user_name?: string;
  user_role?: string;
  last_seen?: string;
};

export function AdminSecurity() {
  const { data: failedLogins = [], isLoading: flLoading } = useQuery({
    queryKey: ["pa-failed-logins"],
    queryFn: () => apiGet<FailedLogin[]>("/platform-admin/security/failed-logins"),
  });

  const { data: sessions = [], isLoading: sLoading } = useQuery({
    queryKey: ["pa-sessions"],
    queryFn: () => apiGet<Session[]>("/platform-admin/sessions"),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Security</h2>
        <p className="text-xs text-zinc-500">Recent login activity and active sessions</p>
      </div>

      {/* Active Sessions */}
      <Card className="bg-zinc-900 border-zinc-800">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
          <Users className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Active Sessions</h3>
          <Badge className="bg-emerald-900/50 text-emerald-300 text-[10px] ml-auto">
            {sessions.length} active (last 8h)
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-4 py-2 font-medium">User</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {sLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    {[120, 80, 120].map((w, j) => (
                      <td key={j} className="px-4 py-2.5">
                        <Skeleton className="h-3 bg-zinc-800" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                    No active sessions in last 8 hours
                  </td>
                </tr>
              ) : (
                sessions.map((s, i) => (
                  <tr key={s.user_id ?? i} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-200 font-medium">{s.user_name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge className="bg-zinc-800 text-zinc-300 text-[10px] font-mono">{s.user_role ?? "—"}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400">
                      {s.last_seen ? format(new Date(s.last_seen), "dd MMM HH:mm") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Failed Logins */}
      <Card className="bg-zinc-900 border-zinc-800">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Failed Login Attempts</h3>
          <Badge className="bg-amber-900/50 text-amber-300 text-[10px] ml-auto">
            {failedLogins.length} recent
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-4 py-2 font-medium">Email Attempted</th>
                <th className="text-left px-4 py-2 font-medium">IP Address</th>
                <th className="text-left px-4 py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {flLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    {[160, 100, 120].map((w, j) => (
                      <td key={j} className="px-4 py-2.5">
                        <Skeleton className="h-3 bg-zinc-800" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : failedLogins.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                    No failed login attempts on record
                  </td>
                </tr>
              ) : (
                failedLogins.map((l, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-200 font-mono">{l.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-400 font-mono">{l.ip_address ?? "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-400">
                      {l.created_at ? format(new Date(l.created_at), "dd MMM HH:mm") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
