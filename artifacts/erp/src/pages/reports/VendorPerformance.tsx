import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Search, Star, TrendingUp, Building2 } from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

function INR(v: number) {
  return v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
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
    <Badge variant="outline" className={cn("text-xs font-semibold", n >= 90 ? "text-emerald-700 border-emerald-200 bg-emerald-50" : n >= 70 ? "text-amber-700 border-amber-200 bg-amber-50" : "text-red-700 border-red-200 bg-red-50")}>
      {rate}%
    </Badge>
  );
}

export default function VendorPerformance() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-performance"],
    queryFn: () => apiGet<any>("/reports/vendor-performance"),
  });

  const vendors: any[] = data?.vendors ?? [];
  const categories = ["All", ...Array.from(new Set(vendors.map(v => v.category).filter(Boolean)))];

  const filtered = vendors.filter(v =>
    (category === "All" || v.category === category) &&
    (!search || v.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const avgAcceptance = filtered.length > 0
    ? (filtered.reduce((s, v) => s + Number(v.acceptanceRate), 0) / filtered.length).toFixed(1)
    : "0.0";
  const avgOnTime = filtered.length > 0
    ? (filtered.reduce((s, v) => s + Number(v.onTimeRate), 0) / filtered.length).toFixed(1)
    : "0.0";
  const topPerformer = filtered[0];

  const chartData = filtered.slice(0, 10).map(v => ({
    name: v.name.length > 12 ? v.name.slice(0, 12) + "…" : v.name,
    acceptance: Number(v.acceptanceRate),
    onTime: Number(v.onTimeRate),
    score: v.score,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vendor Performance Scorecard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quality, delivery and value analysis per vendor</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-gray-200/60 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vendors Tracked</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{isLoading ? "—" : filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200/60 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Acceptance Rate</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{avgAcceptance}%</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200/60 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg On-Time Rate</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{avgOnTime}%</p>
          </CardContent>
        </Card>
        <Card className={cn("border shadow-sm", topPerformer ? "border-orange-200 bg-orange-50/30" : "border-gray-200/60")}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Star className="h-3 w-3 text-orange-500" /> Top Performer
            </p>
            <p className="text-sm font-bold text-orange-600 mt-1 truncate">{topPerformer?.name ?? "—"}</p>
            {topPerformer && <p className="text-xs text-gray-400">Score: {topPerformer.score}/100</p>}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border-gray-200/60 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top 10 Vendor Rates Comparison</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Bar dataKey="acceptance" name="Acceptance %" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="onTime" name="On-Time %" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filters + Table */}
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor..." className="pl-9 h-9 text-sm" />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {(categories as string[]).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1 h-9 text-xs" onClick={() =>
              exportToCsv("vendor-performance.csv",
                ["Rank", "Vendor", "Category", "POs", "GRNs", "Total Spend ₹", "Acceptance %", "On-Time %", "Rejection %", "Score"],
                filtered.map((v, i) => [i + 1, v.name, v.category, v.totalPOs, v.totalGRNs, v.totalSpend, v.acceptanceRate, v.onTimeRate, v.rejectionRate, v.score]))}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </CardHeader>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-y border-gray-100 bg-gray-50/50 text-xs uppercase text-gray-500">
                <th className="px-4 py-2 text-center">#</th>
                <th className="text-left px-4 py-2">Vendor</th>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-center px-4 py-2">POs</th>
                <th className="text-right px-4 py-2">Total Spend</th>
                <th className="text-center px-4 py-2">Acceptance</th>
                <th className="text-center px-4 py-2">On-Time</th>
                <th className="text-center px-4 py-2">Rejection</th>
                <th className="text-left px-4 py-2 min-w-32">Score</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center">
                    <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400">No vendor data found</p>
                  </td></tr>
                ) : filtered.map((v, i) => (
                  <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{v.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{v.category || "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{v.totalPOs}</td>
                    <td className="px-4 py-3 text-right font-semibold">{INR(v.totalSpend)}</td>
                    <td className="px-4 py-3 text-center"><RateBadge rate={v.acceptanceRate} /></td>
                    <td className="px-4 py-3 text-center"><RateBadge rate={v.onTimeRate} /></td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={cn("text-xs", Number(v.rejectionRate) > 10 ? "text-red-600 border-red-200" : "text-gray-500")}>
                        {v.rejectionRate}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3 min-w-32"><ScoreBar score={v.score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
