import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Clock, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";
import { PageHeader, StatCard, SkeletonStats, SectionCard } from "@/components/shared";
import { motion } from "framer-motion";

const COLORS = ["#10B981", "#F59E0B", "#F97316", "#EF4444", "#991B1B"];
const STATUS_COLORS: Record<string, string> = {
  Paid: "#10B981", Approved: "#3B82F6", PendingApproval: "#F59E0B",
  "3WayMismatch": "#EF4444", Draft: "#9CA3AF",
};

function INR(v: number) {
  return v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}:</span>
          <span className="font-semibold">{INR(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function FinanceDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-dashboard"],
    queryFn: () => apiGet<any>("/reports/invoices"),
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
        <PageHeader
          title="Finance Overview"
          subtitle="Revenue, receivables, and cash flow tracking"
        />
        <SkeletonStats count={4} />
      </motion.div>
    );
  }

  const { summary, aging, byVendor = [], byStatus = [] } = data ?? {};

  const agingData = [
    { period: "Not Due", value: aging?.current ?? 0 },
    { period: "1–30 Days", value: aging?.days30 ?? 0 },
    { period: "31–60 Days", value: aging?.days60 ?? 0 },
    { period: "61–90 Days", value: aging?.days90 ?? 0 },
    { period: "90+ Days", value: aging?.over90 ?? 0 },
  ];

  const vendorChartData = byVendor.slice(0, 10).map((v: any) => ({
    name: v.vendor.length > 14 ? v.vendor.slice(0, 14) + "…" : v.vendor,
    Paid: v.paid, Outstanding: v.pending,
  }));

  const pieData = byStatus.map((s: any) => ({
    name: s.status, value: s.count, amount: s.value,
  }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <PageHeader
        title="Finance Overview"
        subtitle="Revenue, receivables, and cash flow tracking"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Invoices"
          value={summary?.total ?? 0}
          icon={DollarSign}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
        <StatCard
          label="Total Payable"
          value={INR(summary?.totalPayable ?? 0)}
          icon={DollarSign}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Amount Paid"
          value={INR(summary?.totalPaid ?? 0)}
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          trend="up"
        />
        <StatCard
          label="Outstanding"
          value={INR(summary?.totalPending ?? 0)}
          icon={AlertCircle}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          trend="down"
        />
      </div>

      {/* Aging Chart */}
      <SectionCard
        title="Invoice Aging Analysis"
        subtitle="Outstanding invoices by overdue period"
        actions={<Clock className="h-4 w-4 text-orange-500" />}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={agingData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]}>
              {agingData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Vendor breakdown + Status pie */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-3">
          <SectionCard title="Payables by Vendor (Top 10)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={vendorChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Paid" stackId="a" fill="#10B981" />
                <Bar dataKey="Outstanding" stackId="a" fill="#EA580C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
        <div className="md:col-span-2">
          <SectionCard title="Invoice Status Breakdown">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((entry: any, i: number) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name, props) => [props.payload.amount ? INR(props.payload.amount) : v, name]} />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
      </div>

      {/* Outstanding table */}
      <SectionCard
        title="Outstanding by Vendor"
        actions={
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() =>
            exportToCsv("outstanding.csv", ["Vendor", "Total ₹", "Paid ₹", "Pending ₹", "% Paid"],
              byVendor.map((v: any) => [v.vendor, v.total.toFixed(2), v.paid.toFixed(2), v.pending.toFixed(2),
                v.total > 0 ? ((v.paid / v.total) * 100).toFixed(1) : 0]))}>
            <Download className="h-3 w-3" /> Export
          </Button>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border/60 bg-muted/30 text-xs uppercase text-muted-foreground">
                <th className="text-left px-4 py-2">Vendor</th>
                <th className="text-right px-4 py-2">Total Payable</th>
                <th className="text-right px-4 py-2">Paid</th>
                <th className="text-right px-4 py-2">Outstanding</th>
                <th className="text-right px-4 py-2">% Paid</th>
              </tr>
            </thead>
            <tbody>
              {byVendor.slice(0, 15).map((v: any, i: number) => {
                const pct = v.total > 0 ? ((v.paid / v.total) * 100) : 0;
                return (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium text-foreground">{v.vendor}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{INR(v.total)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">{INR(v.paid)}</td>
                    <td className={cn("px-4 py-2.5 text-right font-semibold", v.pending > 0 ? "text-orange-700" : "text-muted-foreground")}>
                      {INR(v.pending)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400")}
                            style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </motion.div>
  );
}
