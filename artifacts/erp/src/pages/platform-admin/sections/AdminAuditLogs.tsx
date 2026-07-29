import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Search, ScrollText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Backend returns { data: row[], total: number, page: number, totalPages: number }
type AuditResponse = {
  data: AuditRow[];
  total: number;
  page: number;
  totalPages: number;
};

type AuditRow = {
  id?: number;
  method?: string;
  action?: string;
  path?: string;
  resource?: string;
  actor_email?: string;
  status_code?: number;
  status?: number;
  created_at?: string;
};

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-zinc-800 text-zinc-300",
  POST:   "bg-blue-900/60 text-blue-300",
  PUT:    "bg-amber-900/60 text-amber-300",
  PATCH:  "bg-amber-900/60 text-amber-300",
  DELETE: "bg-red-900/60 text-red-300",
};

export function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["pa-audit-logs", page, search],
    queryFn: () => apiGet<AuditResponse>(
      `/audit-logs`,
      {
        page,
        limit,
        ...(search ? { search } : {}),
      }
    ),
  });

  const logs: AuditRow[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages: number = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Audit Logs</h2>
          <p className="text-xs text-zinc-500">Full system event trail</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Filter by path, user…"
            className="pl-8 h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
          />
        </div>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-4 py-2.5 font-medium">Time</th>
                <th className="text-left px-4 py-2.5 font-medium">Method</th>
                <th className="text-left px-4 py-2.5 font-medium">Path</th>
                <th className="text-left px-4 py-2.5 font-medium">User</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-800/50">
                      {[80, 50, 180, 120, 40].map((w, j) => (
                        <td key={j} className="px-4 py-2.5">
                          <Skeleton className="h-3 bg-zinc-800" style={{ width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : logs.length === 0
                ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <ScrollText className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-zinc-500">No audit logs found</p>
                      </td>
                    </tr>
                  )
                : logs.map((l, i) => {
                    const method = l.method ?? l.action ?? "—";
                    const statusCode = l.status_code ?? l.status;
                    return (
                      <tr
                        key={l.id ?? i}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                          {l.created_at ? format(new Date(l.created_at), "dd MMM HH:mm:ss") : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <Badge className={cn("text-[10px] font-mono px-1.5", METHOD_COLORS[method] ?? "bg-zinc-800 text-zinc-300")}>
                            {method}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-zinc-300 font-mono max-w-xs truncate">
                          {l.path ?? l.resource ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-zinc-400 max-w-[120px] truncate">
                          {l.actor_email ?? "—"}
                        </td>
                        <td className="px-4 py-2">
                          {statusCode != null ? (
                            <span className={cn("font-mono text-[10px]", statusCode >= 400 ? "text-red-400" : "text-emerald-400")}>
                              {statusCode}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800">
            <span className="text-xs text-zinc-500">
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="h-6 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="h-6 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
