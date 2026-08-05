import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Users, AlertTriangle, Shield, Monitor, Smartphone, Globe,
  ChevronRight, X, MapPin, Clock, Activity,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

/* ── types ──────────────────────────────────────────────────────────────────── */
type Session = {
  user_id:    number;
  user_name:  string;
  user_role:  string;
  last_seen:  string;
  ip_address: string | null;
  user_agent: string | null;
  suspicious: boolean;
  all_ips:    string[] | null;
};

type FailedLogin = {
  email:         string | null;
  ip_address:    string | null;
  description:   string | null;
  error_message: string | null;
  user_agent:    string | null;
  created_at:    string;
};

type UserActivity = {
  id:           number;
  action:       string;
  module:       string;
  entity_label: string | null;
  description:  string | null;
  ip_address:   string | null;
  user_agent:   string | null;
  status:       string;
  created_at:   string;
};

/* ── helpers ────────────────────────────────────────────────────────────────── */
function parseBrowser(ua: string | null): string {
  if (!ua) return "Unknown";
  if (/Edg\//i.test(ua))   return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return "Browser";
}

function parseDevice(ua: string | null): "mobile" | "tablet" | "desktop" {
  if (!ua) return "desktop";
  if (/Mobile|iPhone|iPod|Android.*Mobile/i.test(ua)) return "mobile";
  if (/iPad|Android(?!.*Mobile)/i.test(ua))           return "tablet";
  return "desktop";
}

function DeviceIcon({ ua }: { ua: string | null }) {
  const d = parseDevice(ua);
  if (d === "mobile")  return <Smartphone className="w-3 h-3 text-zinc-500" />;
  if (d === "tablet")  return <Monitor className="w-3 h-3 text-zinc-500" />;
  return <Monitor className="w-3 h-3 text-zinc-500" />;
}

const ACTION_COLORS: Record<string, string> = {
  create:  "bg-blue-900/60 text-blue-300",
  update:  "bg-amber-900/60 text-amber-300",
  delete:  "bg-red-900/60 text-red-300",
  approve: "bg-emerald-900/60 text-emerald-300",
  reject:  "bg-rose-900/60 text-rose-300",
  login:   "bg-violet-900/60 text-violet-300",
  submit:  "bg-sky-900/60 text-sky-300",
};

/* ── User Activity Drawer ────────────────────────────────────────────────────── */
function UserActivityDrawer({ session, onClose }: { session: Session; onClose: () => void }) {
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ["pa-user-activity", session.user_id],
    queryFn:  () => apiGet<UserActivity[]>(`/platform-admin/sessions/${session.user_id}/activity`),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/60" onClick={onClose} />
      {/* panel */}
      <div className="w-[480px] bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <p className="text-sm font-bold text-zinc-100">{session.user_name}</p>
            <p className="text-[11px] text-zinc-500 font-mono">{session.user_role}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* meta */}
        <div className="px-5 py-3 border-b border-zinc-800 grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1">Current IP</p>
            <p className="text-xs text-zinc-200 font-mono">{session.ip_address ?? "—"}</p>
          </div>
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1">Device</p>
            <p className="text-xs text-zinc-200">{parseBrowser(session.user_agent)} · {parseDevice(session.user_agent)}</p>
          </div>
          {session.suspicious && (
            <div className="col-span-2 bg-amber-950/40 border border-amber-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-[11px] font-semibold text-amber-300">Multiple IPs detected</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(session.all_ips ?? []).map(ip => (
                  <span key={ip} className="text-[10px] font-mono bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded">
                    {ip}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* activity list */}
        <div className="flex-1 overflow-y-auto">
          <p className="px-5 py-3 text-[10px] text-zinc-500 uppercase tracking-wider font-medium border-b border-zinc-800">
            Recent Activity (last 100 actions)
          </p>
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-5 py-3 border-b border-zinc-800/50 flex gap-3">
                  <Skeleton className="h-3 w-16 bg-zinc-800 mt-0.5 shrink-0" />
                  <Skeleton className="h-3 flex-1 bg-zinc-800" />
                </div>
              ))
            : activity.length === 0
            ? (
                <div className="px-5 py-10 text-center text-zinc-500 text-xs">No recent activity</div>
              )
            : activity.map(a => (
                <div key={a.id} className="px-5 py-3 border-b border-zinc-800/40 hover:bg-zinc-900/40 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <Badge className={`text-[9px] font-mono px-1.5 py-0 shrink-0 mt-0.5 ${ACTION_COLORS[a.action] ?? "bg-zinc-800 text-zinc-300"}`}>
                      {a.action}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-zinc-300 truncate">{a.description ?? a.entity_label ?? "—"}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-zinc-600 font-mono">{a.module}</span>
                        {a.ip_address && a.ip_address !== session.ip_address && (
                          <span className="text-[10px] font-mono text-amber-500">{a.ip_address}</span>
                        )}
                        <span className={`text-[10px] ${a.status === "success" ? "text-emerald-500" : "text-red-400"}`}>
                          {a.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 shrink-0 mt-0.5">
                      {format(new Date(a.created_at), "HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
export function AdminSecurity() {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const { data: sessions = [], isLoading: sLoading, dataUpdatedAt } = useQuery({
    queryKey:       ["pa-sessions"],
    queryFn:        () => apiGet<Session[]>("/platform-admin/sessions"),
    refetchInterval: 30_000,
  });

  const { data: failedLogins = [], isLoading: flLoading } = useQuery({
    queryKey: ["pa-failed-logins"],
    queryFn:  () => apiGet<FailedLogin[]>("/platform-admin/security/failed-logins"),
  });

  const suspiciousSessions = sessions.filter(s => s.suspicious);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Security</h2>
          <p className="text-xs text-zinc-500">Live sessions, login activity, and suspicious access detection</p>
        </div>
        {dataUpdatedAt ? (
          <span className="text-[10px] text-zinc-600">
            Updated {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}
          </span>
        ) : null}
      </div>

      {/* Suspicious sessions alert */}
      {suspiciousSessions.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-300">
              {suspiciousSessions.length} account{suspiciousSessions.length > 1 ? "s" : ""} active from multiple IP addresses
            </p>
            <p className="text-[11px] text-amber-500/80 mt-0.5">
              Same credentials used from different locations in the last 8 hours. Review the sessions below.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {suspiciousSessions.map(s => (
                <button
                  key={s.user_id}
                  onClick={() => setSelectedSession(s)}
                  className="text-[11px] bg-amber-900/40 hover:bg-amber-900/60 border border-amber-800/50 text-amber-300 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5"
                >
                  {s.user_name}
                  <span className="font-mono text-[10px] opacity-70">{s.all_ips?.length} IPs</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Sessions */}
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
          <Users className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Active Sessions</h3>
          <Badge className="bg-emerald-900/50 text-emerald-300 text-[10px] ml-auto">
            {sessions.length} users · last 8h
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-4 py-2 font-medium">User</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">IP Address</th>
                <th className="text-left px-4 py-2 font-medium">Device</th>
                <th className="text-left px-4 py-2 font-medium">Last Seen</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {sLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    {[120, 80, 100, 120, 90, 24].map((w, j) => (
                      <td key={j} className="px-4 py-2.5">
                        <Skeleton className="h-3 bg-zinc-800" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No active sessions in the last 8 hours
                  </td>
                </tr>
              ) : (
                sessions.map(s => (
                  <tr
                    key={s.user_id}
                    className={`border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors cursor-pointer ${s.suspicious ? "bg-amber-950/10" : ""}`}
                    onClick={() => setSelectedSession(s)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {s.suspicious && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
                        <span className="text-zinc-200 font-medium">{s.user_name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className="bg-zinc-800 text-zinc-300 text-[10px] font-mono">{s.user_role ?? "—"}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.suspicious ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-amber-400">{s.ip_address ?? "—"}</span>
                          <span className="text-[10px] text-amber-600">+{(s.all_ips?.length ?? 1) - 1} more</span>
                        </div>
                      ) : (
                        <span className="font-mono text-zinc-400">{s.ip_address ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <DeviceIcon ua={s.user_agent} />
                        <span>{parseBrowser(s.user_agent)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400">
                      {s.last_seen ? (
                        <span title={format(new Date(s.last_seen), "dd MMM yyyy HH:mm:ss")}>
                          {formatDistanceToNow(new Date(s.last_seen), { addSuffix: true })}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Failed Logins */}
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
          <Shield className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Failed Login Attempts</h3>
          <Badge className={`text-[10px] ml-auto ${failedLogins.length > 0 ? "bg-red-900/50 text-red-300" : "bg-zinc-800 text-zinc-400"}`}>
            {failedLogins.length} recent
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-4 py-2 font-medium">Email Attempted</th>
                <th className="text-left px-4 py-2 font-medium">IP Address</th>
                <th className="text-left px-4 py-2 font-medium">Device</th>
                <th className="text-left px-4 py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {flLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    {[160, 100, 120, 100].map((w, j) => (
                      <td key={j} className="px-4 py-2.5">
                        <Skeleton className="h-3 bg-zinc-800" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : failedLogins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    No failed login attempts on record
                  </td>
                </tr>
              ) : (
                failedLogins.map((l, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-200 font-mono">{l.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-red-400/80 font-mono">{l.ip_address ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <DeviceIcon ua={l.user_agent ?? null} />
                        <span>{parseBrowser(l.user_agent ?? null)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">
                      <span title={format(new Date(l.created_at), "dd MMM yyyy HH:mm:ss")}>
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* User Activity Drawer */}
      {selectedSession && (
        <UserActivityDrawer session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}
    </div>
  );
}
