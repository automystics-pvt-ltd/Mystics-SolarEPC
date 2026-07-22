import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, DollarSign, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

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
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
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

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );

  const { summary, aging, byVendor = [], byStatus = [], recent = [] } = data ?? {};

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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Payables, aging, and payment management</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-gray-200/60 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100/40 border-orange-200/60">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-orange-100 shrink-0">
              <DollarSign className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{summary?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200/60 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/40 border-blue-200/60">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-blue-100 shrink-0">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Payable</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5 leading-tight">{INR(summary?.totalPayable ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200/60 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/40 border-emerald-200/60">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-emerald-100 shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Amount Paid</p>
              <p className="text-lg font-bold text-emerald-700 mt-0.5 leading-tight">{INR(summary?.totalPaid ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200/60 shadow-sm bg-gradient-to-br from-red-50 to-red-100/40 border-red-200/60">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-red-100 shrink-0">
              <AlertCircle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outstanding</p>
              <p className="text-lg font-bold text-red-700 mt-0.5 leading-tight">{INR(summary?.totalPending ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging Chart */}
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" /> Invoice Aging Analysis
            </CardTitle>
            <div className="text-xs text-gray-500">Outstanding invoices by overdue period</div>
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Vendor breakdown + Status pie */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="md:col-span-3 border-gray-200/60 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Payables by Vendor (Top 10)</CardTitle></CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
        <Card className="md:col-span-2 border-gray-200/60 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Invoice Status Breakdown</CardTitle></CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      {/* Outstanding table */}
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Outstanding by Vendor</CardTitle>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() =>
              exportToCsv("outstanding.csv", ["Vendor", "Total ₹", "Paid ₹", "Pending ₹", "% Paid"],
                byVendor.map((v: any) => [v.vendor, v.total.toFixed(2), v.paid.toFixed(2), v.pending.toFixed(2),
                  v.total > 0 ? ((v.paid / v.total) * 100).toFixed(1) : 0]))}>
              <Download className="h-3 w-3" /> Export
            </Button>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-gray-100 bg-gray-50/50 text-xs uppercase text-gray-500">
              <th className="text-left px-4 py-2">Vendor</th>
              <th className="text-right px-4 py-2">Total Payable</th>
              <th className="text-right px-4 py-2">Paid</th>
              <th className="text-right px-4 py-2">Outstanding</th>
              <th className="text-right px-4 py-2">% Paid</th>
            </tr></thead>
            <tbody>
              {byVendor.slice(0, 15).map((v: any, i: number) => {
                const pct = v.total > 0 ? ((v.paid / v.total) * 100) : 0;
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/40">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{v.vendor}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{INR(v.total)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">{INR(v.paid)}</td>
                    <td className={cn("px-4 py-2.5 text-right font-semibold", v.pending > 0 ? "text-orange-700" : "text-gray-400")}>
                      {INR(v.pending)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400")}
                            style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
