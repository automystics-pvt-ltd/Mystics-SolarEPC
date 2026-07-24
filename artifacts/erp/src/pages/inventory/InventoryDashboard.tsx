import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  Warehouse, Package, TrendingUp, TrendingDown, AlertTriangle,
  ArrowRightLeft, ClipboardList, RotateCcw, Plus, RefreshCw,
  BarChart3, ArrowRight, Layers, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const CATEGORY_COLORS = [
  "#EA580C","#F97316","#FB923C","#FDBA74",
  "#0A0F2C","#1e3a8a","#1d4ed8","#3b82f6",
  "#059669","#10b981","#6d28d9","#8b5cf6"
];

function KpiCard({ label, value, sub, icon: Icon, accent = false, alert = false, onClick }: {
  label: string; value: string | number; sub?: string;
  icon: any; accent?: boolean; alert?: boolean; onClick?: () => void;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
      className={cn(
        "bg-card border border-border rounded-xl p-5 cursor-pointer transition-all",
        accent && "border-[#EA580C]/30 bg-orange-50/30 dark:bg-orange-950/10",
        alert && "border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/10"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          "h-10 w-10 rounded-[10px] flex items-center justify-center",
          accent ? "bg-[#EA580C]/10" : alert ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"
        )}>
          <Icon className={cn("h-5 w-5", accent ? "text-[#EA580C]" : alert ? "text-amber-600" : "text-muted-foreground")} />
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1" />
      </div>
      <p className={cn(
        "text-2xl font-black tracking-tight font-mono",
        accent ? "text-[#EA580C]" : alert ? "text-amber-600" : "text-foreground"
      )}>{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </motion.div>
  );
}

function AlertRow({ item, onAck }: { item: any; onAck?: (id: number) => void }) {
  const severity = item.currentQty <= 0 ? "critical" : "warning";
  return (
    <div className={cn(
      "flex items-center gap-3 py-3 px-4 rounded-[10px] border",
      severity === "critical"
        ? "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800/40"
        : "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-700/40"
    )}>
      <AlertTriangle className={cn("h-4 w-4 shrink-0", severity === "critical" ? "text-red-500" : "text-amber-500")} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{item.materialName}</p>
        <p className="text-xs text-muted-foreground">{item.warehouseName} · {item.currentQty} {item.uom} available</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-xs font-mono font-black", severity === "critical" ? "text-red-600" : "text-amber-600")}>
          {severity === "critical" ? "OUT OF STOCK" : `Need ${item.shortageQty} more`}
        </p>
      </div>
    </div>
  );
}

export function InventoryDashboard() {
  const [, nav] = useLocation();

  const { data, isPending, refetch } = useQuery({
    queryKey: ["inventory-dashboard"],
    queryFn: () => apiGet<any>("/inventory/dashboard"),
    refetchInterval: 60_000,
  });

  const stats = data?.stats ?? {};
  const categories = data?.categoryBreakdown ?? [];
  const alerts = data?.reorderAlerts ?? [];
  const movements = data?.recentMovements ?? [];
  const trend = data?.movementTrend ?? [];

  const pieData = categories.slice(0, 8).map((c: any, i: number) => ({
    name: c.categoryName,
    value: Number(c.totalValue) || 0,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Solar material stock across all warehouses</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 rounded-[8px] font-bold" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" className="gap-2 rounded-[8px] font-bold bg-[#EA580C] hover:bg-[#C2410C] text-white" onClick={() => nav("/inventory/stock-levels")}>
            <Package className="h-3.5 w-3.5" /> View Stock
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      {isPending ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total Stock Value" value={`₹${(Number(stats.totalStockValue) / 100000).toFixed(1)}L`} sub={`${stats.totalSKUs} SKUs tracked`} icon={TrendingUp} accent onClick={() => nav("/inventory/stock-levels")} />
          <KpiCard label="Warehouses" value={stats.totalWarehouses ?? 0} sub="Active facilities" icon={Warehouse} onClick={() => nav("/inventory/warehouses")} />
          <KpiCard label="Below Reorder" value={stats.belowReorderCount ?? 0} sub="Need replenishment" icon={AlertTriangle} alert onClick={() => nav("/inventory/reorder-planning")} />
          <KpiCard label="Out of Stock" value={stats.outOfStockCount ?? 0} sub="Zero quantity" icon={Package} alert={Number(stats.outOfStockCount) > 0} onClick={() => nav("/inventory/stock-levels?outOfStock=true")} />
          <KpiCard label="Pending Transfers" value={stats.pendingTransfers ?? 0} sub="Awaiting completion" icon={ArrowRightLeft} onClick={() => nav("/inventory/stock-transfers")} />
          <KpiCard label="Open Allocations" value={stats.pendingAllocations ?? 0} sub="Draft or approved" icon={ClipboardList} onClick={() => nav("/inventory/allocations")} />
          <KpiCard label="Pending Returns" value={stats.pendingReturns ?? 0} sub="From project sites" icon={RotateCcw} onClick={() => nav("/inventory/returns")} />
          <KpiCard label="Categories" value={categories.length} sub="Material types" icon={Layers} onClick={() => nav("/inventory/stock-levels")} />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Category Breakdown Pie */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Stock by Category</h3>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold text-muted-foreground" onClick={() => nav("/inventory/stock-levels")}>
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {isPending ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : pieData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
              <BarChart3 className="h-8 w-8 opacity-20 mb-2" />
              <p className="text-sm font-medium">No stock data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {pieData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Value"]} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category Table */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Category Breakdown</h3>
          </div>
          {isPending ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}</div>
          ) : categories.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">No inventory data yet</div>
          ) : (
            <div className="space-y-1.5">
              {categories.map((cat: any, i: number) => (
                <div key={cat.categoryCode} className="flex items-center gap-3 py-2 rounded-[8px] hover:bg-muted/30 px-2 cursor-pointer" onClick={() => nav(`/inventory/stock-levels?categoryCode=${cat.categoryCode}`)}>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  <span className="text-sm font-bold text-foreground flex-1 truncate">{cat.categoryName}</span>
                  <span className="text-xs font-mono text-muted-foreground">{cat.skuCount} SKUs</span>
                  <span className="text-xs font-mono font-black text-foreground min-w-[80px] text-right">
                    ₹{Number(cat.totalValue / 1000).toFixed(0)}K
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts + Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Reorder Alerts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Reorder Alerts</h3>
              {alerts.length > 0 && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold text-muted-foreground" onClick={() => nav("/inventory/reorder-planning")}>
              Manage <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {isPending ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-[10px]" />)}</div>
          ) : alerts.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-muted-foreground">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-sm font-bold">All stock levels healthy</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">No items below reorder point</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((a: any, i: number) => (
                <AlertRow key={i} item={a} />
              ))}
              {alerts.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full text-xs font-bold text-muted-foreground" onClick={() => nav("/inventory/reorder-planning")}>
                  View all {alerts.length} alerts
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Recent Stock Movements */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Recent Movements</h3>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold text-muted-foreground" onClick={() => nav("/inventory/stock-ledger")}>
              Ledger <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {isPending ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}</div>
          ) : movements.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">No recent movements</div>
          ) : (
            <div className="space-y-1">
              {movements.slice(0, 8).map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                    m.txnType === "Inward" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/20"
                  )}>
                    {m.txnType === "Inward"
                      ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                      : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{m.itemName}</p>
                    <p className="text-[10px] text-muted-foreground">{m.warehouseName} · {m.date}</p>
                  </div>
                  <span className={cn(
                    "text-xs font-mono font-black shrink-0",
                    m.txnType === "Inward" ? "text-emerald-600" : "text-red-500"
                  )}>
                    {m.txnType === "Inward" ? "+" : "-"}{m.qty}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-black uppercase tracking-wider text-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "New Allocation", icon: Plus, href: "/inventory/allocations", color: "bg-[#EA580C]/10 text-[#EA580C]" },
            { label: "Receive Return", icon: RotateCcw, href: "/inventory/returns", color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" },
            { label: "Stock Transfer", icon: ArrowRightLeft, href: "/inventory/stock-transfers", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
            { label: "Reorder Planning", icon: AlertTriangle, href: "/inventory/reorder-planning", color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
          ].map(action => (
            <Button key={action.label} variant="outline" className="h-16 flex-col gap-2 rounded-xl border-border font-bold text-xs" onClick={() => nav(action.href)}>
              <div className={cn("h-8 w-8 rounded-[8px] flex items-center justify-center", action.color)}>
                <action.icon className="h-4 w-4" />
              </div>
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
