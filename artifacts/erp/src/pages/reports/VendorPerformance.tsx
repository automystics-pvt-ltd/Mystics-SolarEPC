import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Search, Star, TrendingUp, Building2, Package, CalendarRange, X } from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";
import { PageHeader, StatCard, SectionCard, EmptyState } from "@/components/shared";
import { motion } from "framer-motion";
import { formatINR } from "@/lib/currency";

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-xs font-bold w-8 text-right", score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600")}>
        {score}
      </span>
    </div>
  );
}

function RateBadge({ rate }: { rate: string }) {
  const n = Number(rate);
  return (
    <Badge variant="outline" className={cn(
      "text-xs font-semibold",
      n >= 90
        ? "text-emerald-700 border-emerald-200 bg-emerald-50"
        : n >= 70
          ? "text-amber-700 border-amber-200 bg-amber-50"
          : "text-red-700 border-red-200 bg-red-50"
    )}>
      {rate}%
    </Badge>
  );
}

export default function VendorPerformance() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params = new URLSearchParams();
  if (fromDate) params.set("from", fromDate);
  if (toDate) params.set("to", toDate);
  const queryString = params.toString();

  const { data, isPending } = useQuery({
    queryKey: ["vendor-performance", fromDate, toDate],
    queryFn: () => apiGet<any>(`/reports/vendor-performance${queryString ? `?${queryString}` : ""}`),
  });

  const hasDateFilter = Boolean(fromDate || toDate);
  function clearDates() { setFromDate(""); setToDate(""); }

  const vendors: any[] = data?.vendors ?? [];
  const categories = ["All", ...Array.from(new Set(vendors.map((v) => v.category).filter(Boolean)))] as string[];

  const filtered = vendors.filter(
    (v) =>
      (category === "All" || v.category === category) &&
      (!search || v.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const avgAcceptance =
    filtered.length > 0
      ? (filtered.reduce((s, v) => s + Number(v.acceptanceRate), 0) / filtered.length).toFixed(1)
      : "0.0";
  const avgOnTime =
    filtered.length > 0
      ? (filtered.reduce((s, v) => s + Number(v.onTimeRate), 0) / filtered.length).toFixed(1)
      : "0.0";
  const topPerformer = filtered[0];

  const chartData = filtered.slice(0, 10).map((v) => ({
    name: v.name.length > 12 ? v.name.slice(0, 12) + "…" : v.name,
    acceptance: Number(v.acceptanceRate),
    onTime: Number(v.onTimeRate),
    score: v.score,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 pb-10"
    >
      <PageHeader
        title="Vendor Performance"
        subtitle="Quality, delivery and value analysis per vendor"
        backHref="/reports"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-9 text-xs"
            onClick={() =>
              exportToCsv(
                "vendor-performance.csv",
                ["Rank", "Vendor", "Category", "POs", "GRNs", "Total Spend ₹", "Acceptance %", "On-Time %", "Rejection %", "Score"],
                filtered.map((v, i) => [
                  i + 1,
                  v.name,
                  v.category,
                  v.totalPOs,
                  v.totalGRNs,
                  v.totalSpend,
                  v.acceptanceRate,
                  v.onTimeRate,
                  v.rejectionRate,
                  v.score,
                ])
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        }
      />

      {/* Date Range Filter */}
      <div className="flex items-end gap-3 flex-wrap p-4 bg-muted/30 border border-border/60 rounded-xl">
        <CalendarRange className="h-4 w-4 text-muted-foreground mt-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 text-sm w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 text-sm w-36"
          />
        </div>
        {hasDateFilter && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearDates}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
        {hasDateFilter && (
          <span className="text-xs text-muted-foreground mt-5">
            Showing data for selected period only
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Vendors Tracked"
          value={isPending ? "—" : filtered.length}
          icon={Building2}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
        <StatCard
          label="Avg Acceptance Rate"
          value={`${avgAcceptance}%`}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Avg On-Time Rate"
          value={`${avgOnTime}%`}
          icon={Package}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Top Performer"
          value={topPerformer?.name ?? "—"}
          icon={Star}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          trendLabel={topPerformer ? `Score: ${topPerformer.score}/100` : undefined}
        />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <SectionCard title="Top 10 Vendor Rates Comparison">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: any) => `${v}%`} />
              <Bar dataKey="acceptance" name="Acceptance %" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="onTime" name="On-Time %" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* Filters + Table */}
      <SectionCard
        title="Vendor Scorecard"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendor..."
                className="pl-9 h-8 text-sm"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        noPadding
      >
        {isPending ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No vendor data found"
            description="Try adjusting your search or category filter"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border/60 bg-muted/30 text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2 text-center">#</th>
                  <th className="text-left px-4 py-2">Vendor</th>
                  <th className="text-left px-4 py-2">Category</th>
                  <th className="text-center px-4 py-2">POs</th>
                  <th className="text-right px-4 py-2">Total Spend</th>
                  <th className="text-center px-4 py-2">Acceptance</th>
                  <th className="text-center px-4 py-2">On-Time</th>
                  <th className="text-center px-4 py-2">Rejection</th>
                  <th className="text-left px-4 py-2 min-w-32">Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => (
                  <tr key={v.id ?? v.name} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-3 text-center text-muted-foreground font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <span>{v.name}</span>
                      {v.linked === false && (
                        <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-200 bg-amber-50">Unlinked</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{v.category || "—"}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{v.totalPOs}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{formatINR(v.totalSpend)}</td>
                    <td className="px-4 py-3 text-center">
                      <RateBadge rate={v.acceptanceRate} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <RateBadge rate={v.onTimeRate} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          Number(v.rejectionRate) > 10
                            ? "text-red-600 border-red-200 bg-red-50"
                            : "text-muted-foreground"
                        )}
                      >
                        {v.rejectionRate}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3 min-w-32">
                      <ScoreBar score={v.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}
