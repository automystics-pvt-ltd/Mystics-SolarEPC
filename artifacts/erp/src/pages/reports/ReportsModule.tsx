import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, TrendingUp, Package, FileText, BarChart3, Boxes, FolderKanban } from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

const COLORS = ["#EA580C", "#F97316", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

function INR(v: number) {
  return v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function KPICard({ title, value, sub, icon: Icon, color = "orange" }: any) {
  const colors: Record<string, string> = {
    orange: "from-orange-50 to-orange-100/50 border-orange-200/60",
    blue: "from-blue-50 to-blue-100/50 border-blue-200/60",
    green: "from-emerald-50 to-emerald-100/50 border-emerald-200/60",
    purple: "from-purple-50 to-purple-100/50 border-purple-200/60",
  };
  const iconColors: Record<string, string> = {
    orange: "text-orange-600 bg-orange-100",
    blue: "text-blue-600 bg-blue-100",
    green: "text-emerald-600 bg-emerald-100",
    purple: "text-purple-600 bg-purple-100",
  };
  return (
    <Card className={cn("border bg-gradient-to-br shadow-sm", colors[color])}>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", iconColors[color])}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5 leading-tight">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }} className="flex gap-2">
          <span>{p.name}:</span>
          <span className="font-semibold">{typeof p.value === 'number' && p.value > 1000 ? INR(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Procurement Tab ──────────────────────────────────────────────────────────
function ProcurementReport() {
  const { data, isLoading } = useQuery({ queryKey: ["reports-procurement"], queryFn: () => apiGet<any>("/reports/procurement") });
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>;
  if (!data) return null;
  const { summary, byStatus = [], byVendor = [], monthly = [] } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total POs" value={summary?.total ?? 0} icon={FileText} color="orange" />
        <KPICard title="Total Value" value={INR(summary?.totalValue ?? 0)} icon={TrendingUp} color="blue" />
        <KPICard title="Open Value" value={INR(summary?.openValue ?? 0)} icon={Package} color="purple" />
        <KPICard title="Closed Value" value={INR(summary?.closedValue ?? 0)} icon={BarChart3} color="green" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-gray-200/60 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly PO Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 100000).toFixed(1)}L`} />
                <Tooltip content={<CustomTooltip />} />
                <Line dataKey="value" name="PO Value" stroke="#EA580C" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-gray-200/60 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">POs by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {byStatus.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Top Vendors by Spend</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() =>
            exportToCsv("procurement-vendors.csv", ["Vendor", "PO Count", "Value (₹)"],
              byVendor.map((v: any) => [v.vendor, v.count, v.value]))}>
            <Download className="h-3 w-3" /> Export
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-gray-100 bg-gray-50/50 text-xs uppercase text-gray-500">
              <th className="text-left px-4 py-2">Vendor</th>
              <th className="text-center px-4 py-2">PO Count</th>
              <th className="text-right px-4 py-2">Total Value</th>
            </tr></thead>
            <tbody>
              {byVendor.map((v: any, i: number) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{v.vendor}</td>
                  <td className="px-4 py-2 text-center text-gray-600">{v.count}</td>
                  <td className="px-4 py-2 text-right font-semibold">{INR(v.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── GRN Tab ──────────────────────────────────────────────────────────────────
function GRNReport() {
  const { data, isLoading } = useQuery({ queryKey: ["reports-grn"], queryFn: () => apiGet<any>("/reports/grn") });
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>;
  if (!data) return null;
  const { summary, byStatus = [], vendorRejections = [] } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total GRNs" value={summary?.totalGRNs ?? 0} icon={Package} color="orange" />
        <KPICard title="Total Received" value={(summary?.totalReceived ?? 0).toFixed(1)} icon={Boxes} color="blue" />
        <KPICard title="Accepted" value={(summary?.totalAccepted ?? 0).toFixed(1)} icon={TrendingUp} color="green" />
        <KPICard title="Acceptance Rate" value={`${summary?.acceptanceRate ?? 0}%`} icon={BarChart3} color="purple" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-gray-200/60 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">GRNs by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {byStatus.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-gray-200/60 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vendor Rejection Rates</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={vendorRejections.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <YAxis dataKey="vendor" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip />
                <Bar dataKey="rejectionRate" name="Rejection %" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Vendor Quality Analysis</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() =>
            exportToCsv("grn-quality.csv", ["Vendor", "Received", "Rejected", "Rejection Rate %"],
              vendorRejections.map((v: any) => [v.vendor, v.received.toFixed(1), v.rejected.toFixed(1), v.rejectionRate]))}>
            <Download className="h-3 w-3" /> Export
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-gray-100 bg-gray-50/50 text-xs uppercase text-gray-500">
              <th className="text-left px-4 py-2">Vendor</th>
              <th className="text-right px-4 py-2">Received</th>
              <th className="text-right px-4 py-2">Rejected</th>
              <th className="text-right px-4 py-2">Rejection Rate</th>
            </tr></thead>
            <tbody>
              {vendorRejections.map((v: any, i: number) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-medium">{v.vendor}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{Number(v.received).toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{Number(v.rejected).toFixed(1)}</td>
                  <td className="px-4 py-2 text-right">
                    <Badge variant="outline" className={cn("text-xs", Number(v.rejectionRate) > 10 ? "text-red-600 border-red-200" : "text-emerald-600 border-emerald-200")}>
                      {v.rejectionRate}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Invoice Tab ──────────────────────────────────────────────────────────────
function InvoiceReport() {
  const { data, isLoading } = useQuery({ queryKey: ["reports-invoices"], queryFn: () => apiGet<any>("/reports/invoices") });
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>;
  if (!data) return null;
  const { summary, aging, byVendor = [], byStatus = [] } = data;
  const agingData = [
    { period: "Not Due", value: aging?.current ?? 0 },
    { period: "1–30 Days", value: aging?.days30 ?? 0 },
    { period: "31–60 Days", value: aging?.days60 ?? 0 },
    { period: "61–90 Days", value: aging?.days90 ?? 0 },
    { period: "90+ Days", value: aging?.over90 ?? 0 },
  ];
  const agingColors = ["#10B981", "#F59E0B", "#F97316", "#EF4444", "#991B1B"];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Invoices" value={summary?.total ?? 0} icon={FileText} color="orange" />
        <KPICard title="Total Payable" value={INR(summary?.totalPayable ?? 0)} icon={TrendingUp} color="blue" />
        <KPICard title="Amount Paid" value={INR(summary?.totalPaid ?? 0)} icon={BarChart3} color="green" />
        <KPICard title="Outstanding" value={INR(summary?.totalPending ?? 0)} icon={Package} color="purple" />
      </div>
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Invoice Aging Analysis</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                {agingData.map((_, i) => <Cell key={i} fill={agingColors[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Outstanding by Vendor</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() =>
            exportToCsv("outstanding-vendors.csv", ["Vendor", "Total ₹", "Paid ₹", "Pending ₹"],
              byVendor.map((v: any) => [v.vendor, v.total.toFixed(2), v.paid.toFixed(2), v.pending.toFixed(2)]))}>
            <Download className="h-3 w-3" /> Export
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-gray-100 bg-gray-50/50 text-xs uppercase text-gray-500">
              <th className="text-left px-4 py-2">Vendor</th>
              <th className="text-right px-4 py-2">Total</th>
              <th className="text-right px-4 py-2">Paid</th>
              <th className="text-right px-4 py-2">Outstanding</th>
              <th className="text-right px-4 py-2">% Paid</th>
            </tr></thead>
            <tbody>
              {byVendor.map((v: any, i: number) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-medium">{v.vendor}</td>
                  <td className="px-4 py-2 text-right">{INR(v.total)}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{INR(v.paid)}</td>
                  <td className="px-4 py-2 text-right text-orange-600 font-semibold">{INR(v.pending)}</td>
                  <td className="px-4 py-2 text-right">
                    <Badge variant="outline" className="text-xs">
                      {v.total > 0 ? ((v.paid / v.total) * 100).toFixed(0) : 0}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Inventory Tab ─────────────────────────────────────────────────────────────
function InventoryReport() {
  const { data, isLoading } = useQuery({ queryKey: ["reports-inventory"], queryFn: () => apiGet<any>("/reports/inventory") });
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>;
  if (!data) return null;
  const { summary, lowStock = [], txnByType = [] } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Items" value={summary?.totalItems ?? 0} icon={Boxes} color="orange" />
        <KPICard title="Total Value" value={INR(summary?.totalValue ?? 0)} icon={TrendingUp} color="blue" />
        <KPICard title="Warehouses" value={summary?.warehouses ?? 0} icon={Package} color="green" />
        <KPICard title="Low Stock Items" value={summary?.lowStockItems ?? 0} icon={BarChart3} color="purple" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-gray-200/60 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Transaction Types</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={txnByType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {txnByType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-orange-100 bg-orange-50/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-700">⚠ Low Stock Items (below 10 units)</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No low stock items</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {lowStock.slice(0, 10).map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 bg-white rounded border border-orange-100">
                    <span className="font-medium text-gray-800">{item.itemName}</span>
                    <Badge variant="outline" className="text-orange-600 border-orange-200">
                      {Number(item.balanceQty).toFixed(1)} units
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────
function ProjectsReport() {
  const { data, isLoading } = useQuery({ queryKey: ["reports-projects"], queryFn: () => apiGet<any>("/reports/projects") });
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>;
  if (!data) return null;
  const { summary, projects = [] } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Projects" value={summary?.total ?? 0} icon={FolderKanban} color="orange" />
        <KPICard title="Total Budget" value={INR(summary?.totalBudget ?? 0)} icon={TrendingUp} color="blue" />
        <KPICard title="Total Expenses" value={INR(summary?.totalExpenses ?? 0)} icon={BarChart3} color="purple" />
        <KPICard title="PO Value" value={INR(summary?.totalPOValue ?? 0)} icon={Package} color="green" />
      </div>
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Budget vs Expenses by Project</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={projects.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="budget" name="Budget" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#EA580C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Project Cost Breakdown</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() =>
            exportToCsv("project-costs.csv", ["Project", "Status", "Client", "Budget ₹", "Expenses ₹", "Remaining ₹", "Utilization %"],
              projects.map((p: any) => [p.name, p.status, p.clientName, p.budget, p.expenses, p.remaining, p.utilization]))}>
            <Download className="h-3 w-3" /> Export
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-gray-100 bg-gray-50/50 text-xs uppercase text-gray-500">
              <th className="text-left px-4 py-2">Project</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2">Budget</th>
              <th className="text-right px-4 py-2">Expenses</th>
              <th className="text-right px-4 py-2">Remaining</th>
              <th className="text-right px-4 py-2">Utilization</th>
            </tr></thead>
            <tbody>
              {projects.map((p: any, i: number) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{p.status}</Badge></td>
                  <td className="px-4 py-2 text-right">{INR(p.budget)}</td>
                  <td className="px-4 py-2 text-right">{INR(p.expenses)}</td>
                  <td className={cn("px-4 py-2 text-right font-semibold", p.remaining < 0 ? "text-red-600" : "text-emerald-600")}>
                    {INR(p.remaining)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", Number(p.utilization) > 90 ? "bg-red-500" : Number(p.utilization) > 70 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${Math.min(100, Number(p.utilization))}%` }} />
                      </div>
                      <span className="text-xs font-semibold">{p.utilization}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReportsModule() {
  const [tab, setTab] = useState("procurement");
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Business intelligence across all modules</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-10 mb-6">
          <TabsTrigger value="procurement" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Procurement</TabsTrigger>
          <TabsTrigger value="grn" className="gap-1.5"><Package className="h-3.5 w-3.5" /> GRN Analysis</TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Invoices</TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5"><Boxes className="h-3.5 w-3.5" /> Inventory</TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5"><FolderKanban className="h-3.5 w-3.5" /> Projects</TabsTrigger>
        </TabsList>
        <TabsContent value="procurement"><ProcurementReport /></TabsContent>
        <TabsContent value="grn"><GRNReport /></TabsContent>
        <TabsContent value="invoices"><InvoiceReport /></TabsContent>
        <TabsContent value="inventory"><InventoryReport /></TabsContent>
        <TabsContent value="projects"><ProjectsReport /></TabsContent>
      </Tabs>
    </div>
  );
}
