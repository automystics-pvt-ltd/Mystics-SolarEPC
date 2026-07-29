import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/fetch";
import { motion } from "framer-motion";
import { PageHeader, DataTable, ExportButton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, TrendingDown, Package, Bell, Check } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className={cn("bg-card border rounded-xl p-4 flex items-center gap-4", color)}>
      <div className={cn("h-10 w-10 rounded-[10px] flex items-center justify-center", color.includes("amber") ? "bg-amber-100 dark:bg-amber-900/30" : color.includes("red") ? "bg-red-100 dark:bg-red-900/20" : "bg-muted")}>
        <Icon className={cn("h-5 w-5", color.includes("amber") ? "text-amber-600" : color.includes("red") ? "text-red-500" : "text-muted-foreground")} />
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight font-mono text-foreground">{value}</p>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function ReorderPlanning() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["inventory-reorder"],
    queryFn: () => apiGet<any>("/inventory/reorder-analysis"),
  });

  const ackMut = useMutation({
    mutationFn: (id: number) => apiPost(`/inventory/reorder-alerts/${id}/acknowledge`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-reorder"] }); toast({ title: "Alert acknowledged" }); },
  });

  const items = data?.items ?? [];
  const openAlerts = data?.openAlerts ?? [];
  const outOfStock = items.filter((i: any) => i.isOutOfStock);
  const belowReorder = items.filter((i: any) => !i.isOutOfStock);
  const totalOrderValue = items.reduce((s: number, i: any) => s + Number(i.estimatedOrderValue || 0), 0);

  const stockColumns: ColumnDef<any, any>[] = [
    {
      accessorKey: "materialName",
      header: "Material",
      cell: ({ row }) => (
        <div>
          <p className="font-bold text-sm text-foreground">{row.original.materialName}</p>
          {row.original.materialCode && <p className="text-[10px] font-mono text-muted-foreground">{row.original.materialCode}</p>}
        </div>
      ),
    },
    {
      accessorKey: "warehouseName",
      header: "Warehouse",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.warehouseName}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        row.original.isOutOfStock
          ? <Badge className="bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-[10px] font-bold border-0">Out of Stock</Badge>
          : <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold border-0">Below Reorder</Badge>
      ),
    },
    {
      id: "quantities",
      header: "Qty Analysis",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-16">Current:</span>
              <span className={cn("font-mono font-bold", r.isOutOfStock ? "text-red-600" : "text-amber-600")}>{r.currentQty} {r.uom}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-16">Min Level:</span>
              <span className="font-mono text-foreground">{r.minStockLevel} {r.uom}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-16">Shortage:</span>
              <span className="font-mono font-black text-red-600">{r.shortageQty} {r.uom}</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "reorderQty",
      header: "Suggested Order",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-[#EA580C]">
          {row.original.reorderQty > 0 ? row.original.reorderQty : row.original.shortageQty} {row.original.uom}
        </span>
      ),
    },
    {
      accessorKey: "estimatedOrderValue",
      header: "Est. Order Value",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-sm text-foreground">
          {row.original.estimatedOrderValue > 0 ? `₹${Number(row.original.estimatedOrderValue).toLocaleString("en-IN")}` : "—"}
        </span>
      ),
    },
  ];

  const alertColumns: ColumnDef<any, any>[] = [
    {
      accessorKey: "materialName",
      header: "Material",
      cell: ({ row }) => <span className="font-bold text-sm text-foreground">{row.original.materialName}</span>,
    },
    {
      accessorKey: "warehouseName",
      header: "Warehouse",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.warehouseName || "—"}</span>,
    },
    {
      id: "qty",
      header: "Stock",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-bold text-red-600">{row.original.currentQty}</span>
      ),
    },
    {
      accessorKey: "shortageQty",
      header: "Shortage",
      cell: ({ row }) => (
        <span className="font-mono font-black text-amber-600">{row.original.shortageQty}</span>
      ),
    },
    {
      accessorKey: "suggestedOrderQty",
      header: "Order Qty",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-[#EA580C]">{row.original.suggestedOrderQty}</span>
      ),
    },
    {
      id: "ack",
      header: "",
      cell: ({ row }) => (
        <Button
          size="sm" variant="outline"
          className="h-7 px-2 text-xs font-bold gap-1 rounded-[6px]"
          onClick={(e) => { e.stopPropagation(); ackMut.mutate(row.original.id); }}
        >
          <Check className="h-3.5 w-3.5" /> Acknowledge
        </Button>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Reorder Planning"
        subtitle="Identify stock shortages and plan procurement orders"
        actions={
          <ExportButton
            config={{
              title: "Reorder Planning",
              module: "inventory",
              filename: "Inventory_ReorderPlanning",
              columns: [
                { header: "Material",        key: "materialName"          },
                { header: "Warehouse",        key: "warehouseName"         },
                { header: "Current Qty",      key: "currentQty"            },
                { header: "UoM",              key: "uom"                   },
                { header: "Min Level",        key: "minStockLevel"         },
                { header: "Shortage",         key: "shortageQty"           },
                { header: "Suggested Order",  key: "reorderQty"            },
                { header: "Est. Value (₹)",   key: "estimatedOrderValue"   },
              ],
              getRows: () => (items as any[]) as unknown as Record<string, unknown>[],
            }}
            size="sm"
            className="rounded-[8px] font-bold"
          />
        }
      />

      {/* Summary Cards */}
      {isPending ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Total Shortage Items" value={items.length} icon={AlertTriangle} color="border-amber-300 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-700/40" />
          <SummaryCard label="Out of Stock" value={outOfStock.length} icon={Package} color="border-red-200 bg-red-50/20 dark:bg-red-950/10 dark:border-red-800/40" />
          <SummaryCard label="Below Reorder Point" value={belowReorder.length} icon={TrendingDown} color="border-border" />
          <SummaryCard label="Est. Reorder Value" value={`₹${(totalOrderValue / 100000).toFixed(1)}L`} icon={AlertTriangle} color="border-border" />
        </div>
      )}

      {items.length === 0 && !isPending ? (
        <div className="bg-card border border-border rounded-xl p-16 flex flex-col items-center justify-center text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-black text-foreground">All Stock Levels Healthy</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            No items are currently below their reorder points. Stock levels are well maintained.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="items" className="space-y-4">
          <TabsList className="bg-muted/50 rounded-[8px] p-1">
            <TabsTrigger value="items" className="text-sm font-bold rounded-[6px]">
              Shortage Items <span className="ml-1.5 h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-black inline-flex items-center justify-center">{items.length}</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-sm font-bold rounded-[6px]">
              Open Alerts <span className="ml-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-black inline-flex items-center justify-center">{openAlerts.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-0">
            <DataTable
              data={items}
              columns={stockColumns}
              loading={isPending}
              searchPlaceholder="Search materials..."
              emptyIcon={Package}
              emptyTitle="No shortage items"
              emptyDescription="All stock levels are above reorder points"
              exportFilename="reorder-items"
            />
          </TabsContent>

          <TabsContent value="alerts" className="mt-0">
            {openAlerts.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No open alerts</p>
              </div>
            ) : (
              <DataTable
                data={openAlerts}
                columns={alertColumns}
                loading={isPending}
                searchPlaceholder="Search alerts..."
                emptyIcon={Bell}
                emptyTitle="No open alerts"
                emptyDescription="All reorder alerts have been acknowledged"
                exportFilename="reorder-alerts"
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </motion.div>
  );
}
