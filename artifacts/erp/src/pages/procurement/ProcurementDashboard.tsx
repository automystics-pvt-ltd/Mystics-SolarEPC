import { useGetProcurementDashboard } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart, AlertTriangle, Package, FileText, TrendingUp,
  Clock, CheckCircle2, ArrowRight, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const fmt = (n: number | null | undefined) =>
  n != null ? `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function ProcurementDashboard() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetProcurementDashboard();

  if (isLoading) return (
    <div className="flex h-60 items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading dashboard…</div>
    </div>
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

  const statCards = [
    { label: "Open POs", value: summary.openPOs ?? 0, icon: ShoppingCart, color: "bg-blue-50 text-blue-700 border-blue-200", iconColor: "text-blue-500" },
    { label: "Overdue POs", value: summary.overduePOs ?? 0, icon: AlertTriangle, color: "bg-red-50 text-red-700 border-red-200", iconColor: "text-red-500" },
    { label: "Pending GRNs", value: summary.pendingGRNs ?? 0, icon: Package, color: "bg-amber-50 text-amber-700 border-amber-200", iconColor: "text-amber-500" },
    { label: "Pending Invoices", value: summary.pendingInvoices ?? 0, icon: FileText, color: "bg-purple-50 text-purple-700 border-purple-200", iconColor: "text-purple-500" },
    { label: "Total POs", value: summary.totalPOs ?? 0, icon: BarChart2, color: "bg-slate-50 text-slate-700 border-slate-200", iconColor: "text-slate-500" },
    { label: "YTD Spend", value: fmt(summary.ytdSpend), icon: TrendingUp, color: "bg-emerald-50 text-emerald-700 border-emerald-200", iconColor: "text-emerald-500" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Procurement Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Real-time overview of orders, deliveries, and payments</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(card => (
          <div key={card.label} className={cn("rounded-xl border p-4", card.color)}>
            <div className="flex items-center justify-between mb-2">
              <card.icon className={cn("w-5 h-5", card.iconColor)} />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs mt-0.5 opacity-80">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly spend bar chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-bold text-slate-900 mb-4">Monthly Spend (Received POs)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySpend} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : String(v)} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Bar dataKey="amount" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* PO status breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-bold text-slate-900 mb-4">PO Status Breakdown</h2>
          <div className="space-y-2">
            {Object.entries(summary.poByStatus ?? {}).map(([status, count]: any) => {
              const colors: Record<string, string> = {
                Draft: "bg-slate-200", Issued: "bg-blue-400", Acknowledged: "bg-amber-400",
                PartiallyReceived: "bg-orange-400", FullyReceived: "bg-emerald-400",
                Closed: "bg-green-600", Cancelled: "bg-red-400",
              };
              const total = summary.totalPOs || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 w-28 shrink-0">{status}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className={cn("h-2 rounded-full", colors[status] ?? "bg-slate-400")} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Overdue POs */}
      {overduePOs.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
          <div className="bg-red-50 border-b border-red-200 px-5 py-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h2 className="font-bold text-red-800">Overdue POs ({overduePOs.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">PO Number</th>
                  <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">Vendor</th>
                  <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">Deadline</th>
                  <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">Days Overdue</th>
                  <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">Value</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overduePOs.map((po: any) => (
                  <tr key={po.id} className="hover:bg-red-50 cursor-pointer" onClick={() => setLocation(`/procurement/pos/${po.id}`)}>
                    <td className="px-5 py-3 font-mono font-bold text-slate-900">{po.poNumber}</td>
                    <td className="px-5 py-3 text-slate-700">{po.vendorName}</td>
                    <td className="px-5 py-3 text-slate-600">{po.deliveryDeadline}</td>
                    <td className="px-5 py-3"><Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{po.daysOverdue}d overdue</Badge></td>
                    <td className="px-5 py-3 text-slate-600">{po.status}</td>
                    <td className="px-5 py-3 font-mono text-slate-700">{fmt(po.totalAmount)}</td>
                    <td className="px-5 py-3"><ArrowRight className="w-4 h-4 text-slate-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending GRNs */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" />
              <h2 className="font-bold text-amber-800">Pending GRNs</h2>
            </div>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setLocation("/procurement/grns")}>View all</Button>
          </div>
          {pendingGRNs.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">No pending GRNs</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingGRNs.slice(0, 5).map((g: any) => (
                <div key={g.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer" onClick={() => setLocation(`/procurement/grns/${g.id}`)}>
                  <div>
                    <p className="font-mono font-bold text-sm text-slate-900">{g.grnNumber}</p>
                    <p className="text-xs text-slate-500">{g.vendorName}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-xs", g.status === "Submitted" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600")}>{g.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Invoices */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-purple-50 border-b border-purple-200 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              <h2 className="font-bold text-purple-800">Pending Invoices</h2>
            </div>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setLocation("/procurement/invoices")}>View all</Button>
          </div>
          {pendingInvoices.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">No pending invoices</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingInvoices.slice(0, 5).map((i: any) => (
                <div key={i.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer" onClick={() => setLocation(`/procurement/invoices/${i.id}`)}>
                  <div>
                    <p className="font-mono font-bold text-sm text-slate-900">{i.invoiceNumber}</p>
                    <p className="text-xs text-slate-500">{i.vendorName} · {fmt(i.totalAmount)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={cn("text-xs", i.status === "PendingApproval" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-600")}>{i.status}</Badge>
                    {i.matchStatus === "MismatchPending" && <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">⚠ Mismatch</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
