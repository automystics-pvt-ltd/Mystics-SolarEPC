import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { apiPut } from "@/lib/fetch";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";

const MODULE_DESCRIPTIONS: Record<string, string> = {
  dashboard:     "Main dashboard and KPI overview",
  crm:           "Sales pipeline, leads, CRM quotations",
  procurement:   "Vendor quotations, purchase orders, GRNs",
  materials:     "Material catalog and supplier management",
  vendors:       "Vendor directory and performance tracking",
  projects:      "Solar EPC project workspace and milestones",
  inventory:     "Stock management, warehouses, ledger",
  engineering:   "Design documents and technical drawings",
  commissioning: "Commissioning checklists and handover",
  oam:           "O&M contracts and service tickets",
  finance:       "Finance dashboard and cost tracking",
  reports:       "Analytics and cross-module reports",
  admin:         "User management, RBAC, audit logs",
  approvals:     "Approval workflow workbench",
};

export function AdminModules() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["pa-modules"],
    queryFn: () => apiGet<any[]>("/platform-admin/modules"),
  });

  const toggle = useMutation({
    mutationFn: (m: any) =>
      apiPut(`/platform-admin/modules`, { module: m.module, enabled: !m.enabled, settings: m.settings }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pa-modules"] });
      toast({ title: "Module updated" });
    },
    onError: () => toast({ title: "Failed to update module", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Module Configuration</h2>
        <p className="text-xs text-zinc-500">Enable or disable ERP modules platform-wide</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="bg-zinc-900 border-zinc-800 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-24 bg-zinc-800" />
                    <Skeleton className="h-3 w-48 bg-zinc-800" />
                  </div>
                  <Skeleton className="h-5 w-9 bg-zinc-800 rounded-full" />
                </div>
              </Card>
            ))
          : modules.map((m: any) => (
              <Card
                key={m.module}
                className={cn(
                  "bg-zinc-900 border-zinc-800 p-4 transition-colors",
                  !m.enabled && "opacity-60"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      m.enabled ? "bg-violet-600/20" : "bg-zinc-800"
                    )}>
                      <Puzzle className={cn("w-4 h-4", m.enabled ? "text-violet-400" : "text-zinc-600")} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-100 capitalize">{m.module}</p>
                        {!m.enabled && (
                          <Badge className="bg-zinc-800 text-zinc-500 text-[10px] px-1.5">disabled</Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 truncate">
                        {MODULE_DESCRIPTIONS[m.module] ?? "ERP module"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={m.enabled}
                    onCheckedChange={() => toggle.mutate(m)}
                    disabled={toggle.isPending}
                    className="data-[state=checked]:bg-violet-600"
                  />
                </div>
              </Card>
            ))}
      </div>
    </div>
  );
}
