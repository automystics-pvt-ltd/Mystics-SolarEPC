import { useGetProcurementDashboard } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart, AlertTriangle, Package, FileText, TrendingUp,
  ArrowRight, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PageHeader, StatCard, SectionCard, SkeletonStats, SkeletonList, StatusBadge } from "@/components/shared";

const fmt = (n: number | null | undefined) =>
  n != null ? `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function ProcurementDashboard() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetProcurementDashboard();

  if (isLoading) return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
      <SkeletonStats count={6} />
      <SkeletonList rows={6} />
    </motion.div>
  );

  const d = data as any;
  const summary = d?.summary ?? {};
  const overduePOs: any[] = d?.overduePOs ?? [];
  const pendingGRNs: any[] = d?.pendingGRNs ?? [];
  const pendingInvoices: any[] = d?.pendingInvoices ?? [];
  const monthlySpend: any[] = (d?.monthlySpend ?? []).map((m: any, i: number) => ({
    month: MONTH_LABELS[i] ?? m.month,
    amount: m.amount,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Procurement Overview"
        subtitle="Monitor PO pipeline, GRN delivery status, and vendor invoices"
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Open POs" value={summary.openPOs ?? 0} icon={ShoppingCart}
          iconBg="bg-blue-50" iconColor="text-blue-600" compact />
        <StatCard label="Overdue POs" value={summary.overduePOs ?? 0} icon={AlertTriangle}
          iconBg="bg-red-50" iconColor="text-red-600" compact />
        <StatCard label="Pending GRNs" value={summary.pendingGRNs ?? 0} icon={Package}
          iconBg="bg-amber-50" iconColor="text-amber-600" compact />
        <StatCard label="Pending Invoices" value={summary.pendingInvoices ?? 0} icon={FileText}
          iconBg="bg-purple-50" iconColor="text-purple-600" compact />
        <StatCard label="Total POs" value={summary.totalPOs ?? 0} icon={BarChart2}
          iconBg="bg-muted" iconColor="text-muted-foreground" compact />
        <StatCard label="YTD Spend" value={fmt(summary.ytdSpend)} icon={TrendingUp}
          iconBg="bg-emerald-50" iconColor="text-emerald-600" compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly spend bar chart */}
        <SectionCard title="Monthly Spend (Received POs)" noPadding={false}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySpend} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : String(v)} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Bar dataKey="amount" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* PO status breakdown */}
        <SectionCard title="PO Status Breakdown">
          <div className="space-y-2">
            {Object.entries(summary.poByStatus ?? {}).map(([status, count]: any) => {
              const barColors: Record<string, string> = {
                Draft: "bg-muted-foreground/40", Issued: "bg-blue-400", Acknowledged: "bg-amber-400",
                PartiallyReceived: "bg-orange-400", FullyReceived: "bg-emerald-400",
                Closed: "bg-green-600", Cancelled: "bg-red-400",
              };
              const total = summary.totalPOs || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 shrink-0">{status}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div className={cn("h-2 rounded-full", barColors[status] ?? "bg-muted-foreground")} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-foreground w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Overdue POs */}
      {overduePOs.length > 0 && (
        <SectionCard
          title={`Overdue POs (${overduePOs.length})`}
          accent
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border/60">
                <tr>
                  {["PO Number", "Vendor", "Deadline", "Days Overdue", "Status", "Value", ""].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-xs font-bold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {overduePOs.map((po: any) => (
                  <tr key={po.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setLocation(`/procurement/pos/${po.id}`)}>
                    <td className="px-5 py-3 font-mono font-bold text-foreground">{po.poNumber}</td>
                    <td className="px-5 py-3 text-foreground">{po.vendorName}</td>
                    <td className="px-5 py-3 text-muted-foreground">{po.deliveryDeadline}</td>
                    <td className="px-5 py-3"><StatusBadge status="Overdue" /></td>
                    <td className="px-5 py-3"><StatusBadge status={po.status} /></td>
                    <td className="px-5 py-3 font-mono text-foreground">{fmt(po.totalAmount)}</td>
                    <td className="px-5 py-3"><ArrowRight className="w-4 h-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending GRNs */}
        <SectionCard
          title="Pending GRNs"
          actions={<Button size="sm" variant="outline" className="text-xs" onClick={() => setLocation("/procurement/grns")}>View all</Button>}
          noPadding
        >
          {pendingGRNs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No pending GRNs</div>
          ) : (
            <div className="divide-y divide-border/40">
              {pendingGRNs.slice(0, 5).map((g: any) => (
                <div key={g.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 cursor-pointer" onClick={() => setLocation(`/procurement/grns/${g.id}`)}>
                  <div>
                    <p className="font-mono font-bold text-sm text-foreground">{g.grnNumber}</p>
                    <p className="text-xs text-muted-foreground">{g.vendorName}</p>
                  </div>
                  <StatusBadge status={g.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Pending Invoices */}
        <SectionCard
          title="Pending Invoices"
          actions={<Button size="sm" variant="outline" className="text-xs" onClick={() => setLocation("/procurement/invoices")}>View all</Button>}
          noPadding
        >
          {pendingInvoices.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No pending invoices</div>
          ) : (
            <div className="divide-y divide-border/40">
              {pendingInvoices.slice(0, 5).map((i: any) => (
                <div key={i.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 cursor-pointer" onClick={() => setLocation(`/procurement/invoices/${i.id}`)}>
                  <div>
                    <p className="font-mono font-bold text-sm text-foreground">{i.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{i.vendorName} · {fmt(i.totalAmount)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={i.status} />
                    {i.matchStatus === "MismatchPending" && <StatusBadge status="MismatchFlagged" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </motion.div>
  );
}
