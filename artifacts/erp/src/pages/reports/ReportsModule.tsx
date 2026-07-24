import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Download, TrendingUp, Package, FileText, BarChart3, Boxes, FolderKanban } from "lucide-react";
import { SkeletonList } from "@/components/shared";
import { apiGet } from "@/lib/fetch";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";
import { PageHeader, StatCard, SectionCard, StatusBadge } from "@/components/shared";
import { motion } from "framer-motion";
import { formatINR } from "@/lib/currency";

const COLORS = ["#EA580C", "#F97316", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

function KPICard({ title, value, sub, icon: Icon, color = "orange" }: any) {
  const iconBg: Record<string, string> = {
    orange: "bg-orange-50", blue: "bg-blue-50",
    green: "bg-emerald-50", purple: "bg-purple-50",
  };
  const iconColor: Record<string, string> = {
    orange: "text-orange-600", blue: "text-blue-600",
    green: "text-emerald-600", purple: "text-purple-600",
  };
  const trend: Record<string, "up" | "down" | "neutral"> = {
    orange: "neutral", blue: "up", green: "up", purple: "neutral",
  };
  return (
    <StatCard
      label={title}
      value={value}
      icon={Icon}
      iconBg={iconBg[color]}
      iconColor={iconColor[color]}
      trendLabel={sub}
      trend={trend[color]}
    />
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }} className="flex gap-2">
          <span>{p.name}:</span>
          <span className="font-semibold">{typeof p.value === 'number' && p.value > 1000 ? formatINR(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Procurement Tab ──────────────────────────────────────────────────────────
function ProcurementReport() {
  const { data, isPending } = useQuery({ queryKey: ["reports-procurement"], queryFn: () => apiGet<any>("/reports/procurement") });
  if (isPending) return <SkeletonList rows={5} />;
  if (!data) return null;
  const { summary, byStatus = [], byVendor = [], monthly = [] } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total POs" value={summary?.total ?? 0} icon={FileText} color="orange" />
        <KPICard title="Total Value" value={formatINR(summary?.totalValue ?? 0)} icon={TrendingUp} color="blue" />
        <KPICard title="Open Value" value={formatINR(summary?.openValue ?? 0)} icon={Package} color="purple" />
        <KPICard title="Closed Value" value={formatINR(summary?.closedValue ?? 0)} icon={BarChart3} color="green" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard title="Monthly PO Trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 100000).toFixed(1)}L`} />
              <Tooltip content={<CustomTooltip />} />
              <Line dataKey="value" name="PO Value" stroke="#EA580C" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="POs by Status">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {byStatus.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
      <SectionCard
        title="Top Vendors by Spend"
        actions={
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() =>
            exportToCsv("procurement-vendors.csv", ["Vendor", "PO Count", "Value (₹)"],
              byVendor.map((v: any) => [v.vendor, v.count, v.value]))}>
            <Download className="h-3 w-3" /> Export
          </Button>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-border/60 bg-muted/30 text-xs uppercase text-muted-foreground">
              <th className="text-left px-4 py-2">Vendor</th>
              <th className="text-center px-4 py-2">PO Count</th>
              <th className="text-right px-4 py-2">Total Value</th>
            </tr></thead>
            <tbody>
              {byVendor.map((v: any, i: number) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium text-foreground">{v.vendor}</td>
                  <td className="px-4 py-2 text-center text-muted-foreground">{v.count}</td>
                  <td className="px-4 py-2 text-right font-semibold text-foreground">{formatINR(v.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── GRN Tab ──────────────────────────────────────────────────────────────────
function GRNReport() {
  const { data, isPending } = useQuery({ queryKey: ["reports-grn"], queryFn: () => apiGet<any>("/reports/grn") });
  if (isPending) return <SkeletonList rows={5} />;
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
        <SectionCard title="GRNs by Status">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {byStatus.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="Vendor Rejection Rates">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={vendorRejections.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <YAxis dataKey="vendor" type="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Bar dataKey="rejectionRate" name="Rejection %" fill="#EF4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
      <SectionCard
        title="Vendor Quality Analysis"
        actions={
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() =>
            exportToCsv("grn-quality.csv", ["Vendor", "Received", "Rejected", "Rejection Rate %"],
              vendorRejections.map((v: any) => [v.vendor, v.received.toFixed(1), v.rejected.toFixed(1), v.rejectionRate]))}>
            <Download className="h-3 w-3" /> Export
          </Button>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-border/60 bg-muted/30 text-xs uppercase text-muted-foreground">
              <th className="text-left px-4 py-2">Vendor</th>
              <th className="text-right px-4 py-2">Received</th>
              <th className="text-right px-4 py-2">Rejected</th>
              <th className="text-right px-4 py-2">Rejection Rate</th>
            </tr></thead>
            <tbody>
              {vendorRejections.map((v: any, i: number) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium text-foreground">{v.vendor}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{Number(v.received).toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{Number(v.rejected).toFixed(1)}</td>
                  <td className="px-4 py-2 text-right">
                    <StatusBadge status={Number(v.rejectionRate) > 10 ? "Error" : "Success"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Invoice Tab ──────────────────────────────────────────────────────────────
function InvoiceReport() {
  const { data, isPending } = useQuery({ queryKey: ["reports-invoices"], queryFn: () => apiGet<any>("/reports/invoices") });
  if (isPending) return <SkeletonList rows={5} />;
  if (!data) return null;
  const { summary, aging, byVendor = [] } = data;
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
        <KPICard title="Total Payable" value={formatINR(summary?.totalPayable ?? 0)} icon={TrendingUp} color="blue" />
        <KPICard title="Amount Paid" value={formatINR(summary?.totalPaid ?? 0)} icon={BarChart3} color="green" />
        <KPICard title="Outstanding" value={formatINR(summary?.totalPending ?? 0)} icon={Package} color="purple" />
      </div>
      <SectionCard title="Invoice Aging Analysis">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={agingData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
              {agingData.map((_, i) => <Cell key={i} fill={agingColors[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard
        title="Outstanding by Vendor"
        actions={
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() =>
            exportToCsv("outstanding-vendors.csv", ["Vendor", "Total ₹", "Paid ₹", "Pending ₹"],
              byVendor.map((v: any) => [v.vendor, v.total.toFixed(2), v.paid.toFixed(2), v.pending.toFixed(2)]))}>
            <Download className="h-3 w-3" /> Export
          </Button>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-border/60 bg-muted/30 text-xs uppercase text-muted-foreground">
              <th className="text-left px-4 py-2">Vendor</th>
              <th className="text-right px-4 py-2">Total</th>
              <th className="text-right px-4 py-2">Paid</th>
              <th className="text-right px-4 py-2">Outstanding</th>
              <th className="text-right px-4 py-2">% Paid</th>
            </tr></thead>
            <tbody>
              {byVendor.map((v: any, i: number) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium text-foreground">{v.vendor}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{formatINR(v.total)}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{formatINR(v.paid)}</td>
                  <td className="px-4 py-2 text-right text-orange-600 font-semibold">{formatINR(v.pending)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                    {v.total > 0 ? ((v.paid / v.total) * 100).toFixed(0) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Inventory Tab ─────────────────────────────────────────────────────────────
function InventoryReport() {
  const { data, isPending } = useQuery({ queryKey: ["reports-inventory"], queryFn: () => apiGet<any>("/reports/inventory") });
  if (isPending) return <SkeletonList rows={5} />;
  if (!data) return null;
  const { summary, lowStock = [], txnByType = [] } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Items" value={summary?.totalItems ?? 0} icon={Boxes} color="orange" />
        <KPICard title="Total Value" value={formatINR(summary?.totalValue ?? 0)} icon={TrendingUp} color="blue" />
        <KPICard title="Warehouses" value={summary?.warehouses ?? 0} icon={Package} color="green" />
        <KPICard title="Low Stock Items" value={summary?.lowStockItems ?? 0} icon={BarChart3} color="purple" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard title="Transaction Types">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={txnByType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {txnByType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="⚠ Low Stock Items (below 10 units)" accent>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No low stock items</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {lowStock.slice(0, 10).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 bg-card rounded border border-border">
                  <span className="font-medium text-foreground">{item.itemName}</span>
                  <StatusBadge status="Warning" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────
function ProjectsReport() {
  const { data, isPending } = useQuery({ queryKey: ["reports-projects"], queryFn: () => apiGet<any>("/reports/projects") });
  if (isPending) return <SkeletonList rows={5} />;
  if (!data) return null;
  const { summary, projects = [] } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Projects" value={summary?.total ?? 0} icon={FolderKanban} color="orange" />
        <KPICard title="Total Budget" value={formatINR(summary?.totalBudget ?? 0)} icon={TrendingUp} color="blue" />
        <KPICard title="Total Expenses" value={formatINR(summary?.totalExpenses ?? 0)} icon={BarChart3} color="purple" />
        <KPICard title="PO Value" value={formatINR(summary?.totalPOValue ?? 0)} icon={Package} color="green" />
      </div>
      <SectionCard title="Budget vs Expenses by Project">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={projects.slice(0, 8)}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="budget" name="Budget" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#EA580C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard
        title="Project Cost Breakdown"
        actions={
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() =>
            exportToCsv("project-costs.csv", ["Project", "Status", "Client", "Budget ₹", "Expenses ₹", "Remaining ₹", "Utilization %"],
              projects.map((p: any) => [p.name, p.status, p.clientName, p.budget, p.expenses, p.remaining, p.utilization]))}>
            <Download className="h-3 w-3" /> Export
          </Button>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-border/60 bg-muted/30 text-xs uppercase text-muted-foreground">
              <th className="text-left px-4 py-2">Project</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2">Budget</th>
              <th className="text-right px-4 py-2">Expenses</th>
              <th className="text-right px-4 py-2">Remaining</th>
              <th className="text-right px-4 py-2">Utilization</th>
            </tr></thead>
            <tbody>
              {projects.map((p: any, i: number) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{formatINR(p.budget)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{formatINR(p.expenses)}</td>
                  <td className={cn("px-4 py-2 text-right font-semibold", p.remaining < 0 ? "text-red-600" : "text-emerald-600")}>
                    {formatINR(p.remaining)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", Number(p.utilization) > 90 ? "bg-red-500" : Number(p.utilization) > 70 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${Math.min(100, Number(p.utilization))}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{p.utilization}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReportsModule() {
  const [tab, setTab] = useState("procurement");
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Operational insights and performance metrics"
      />
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
    </motion.div>
  );
}
