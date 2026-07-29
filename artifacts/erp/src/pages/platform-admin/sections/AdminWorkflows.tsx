import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { GitBranch, ExternalLink, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminWorkflows() {
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["approval-workflows"],
    queryFn: () => apiGet<any[]>("/approval-workflows"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Approval Workflows</h2>
          <p className="text-xs text-zinc-500">Platform-wide approval chains and escalation rules</p>
        </div>
        <Link href="/admin/platform">
          <a className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
            <ExternalLink className="w-3 h-3" /> Manage in App
          </a>
        </Link>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-40 bg-zinc-800" />
                  <Skeleton className="h-3 w-60 bg-zinc-800" />
                </div>
                <Skeleton className="h-5 w-16 bg-zinc-800 rounded-full" />
              </div>
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <GitBranch className="w-8 h-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">No approval workflows configured</p>
            <Link href="/admin/platform">
              <a className="text-xs text-violet-400 hover:text-violet-300 mt-1">Configure workflows →</a>
            </Link>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-4 py-2.5 font-medium">Workflow</th>
                <th className="text-left px-4 py-2.5 font-medium">Module</th>
                <th className="text-left px-4 py-2.5 font-medium">Steps</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w: any) => (
                <tr key={w.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-200">{w.name}</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-zinc-800 text-zinc-300 text-[10px] capitalize">{w.module ?? w.entity_type ?? "—"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{w.steps?.length ?? w.step_count ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-medium", w.is_active ? "text-emerald-400" : "text-zinc-500")}>
                      {w.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600 inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
