import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, RotateCcw, Search, Download, PackageX } from "lucide-react";
import { exportToCsv } from "@/lib/export";
import { apiGet } from "@/lib/fetch";
import { cn } from "@/lib/utils";

const STATUS_TABS = ["All", "Draft", "Submitted", "Approved", "Dispatched", "Closed", "Cancelled"];
const STATUS_COLOR: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Submitted: "bg-blue-50 text-blue-700 border-blue-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Dispatched: "bg-purple-50 text-purple-700 border-purple-200",
  Closed: "bg-gray-100 text-gray-600 border-gray-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

export default function GRNReturnsList() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["grn-returns", tab],
    queryFn: () => apiGet<any[]>("/grn-returns", tab !== "All" ? { status: tab } : {}),
  });

  const filtered = (returns as any[]).filter(r =>
    !search ||
    r.returnNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.vendorName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    exportToCsv(
      `grn-returns-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Return #", "Vendor", "GRN ID", "Return Type", "Status", "Total Qty", "Total Value", "Created At"],
      filtered.map(r => [
        r.returnNumber, r.vendorName, r.grnId, r.returnType, r.status,
        r.totalReturnQty ?? 0, r.totalReturnValue ?? 0,
        new Date(r.createdAt).toLocaleDateString("en-IN"),
      ])
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GRN Returns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Return-to-Vendor (RTV) management</p>
        </div>
        <Button
          onClick={() => setLocation("/procurement/grn-returns/new")}
          className="gap-2 bg-orange-600 hover:bg-orange-700 text-white shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Return
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-9">
              {STATUS_TABS.map(s => (
                <TabsTrigger key={s} value={s} className="text-xs font-medium">{s}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by return number or vendor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 h-9 shrink-0">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-gray-200/60 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Return #</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Vendor</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">GRN ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Return Value</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <PackageX className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">No GRN returns found</p>
                    <p className="text-gray-400 text-xs mt-1">Create a new return to get started</p>
                  </td>
                </tr>
              ) : filtered.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-gray-50 hover:bg-orange-50/30 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/procurement/grn-returns/${r.id}`)}
                >
                  <td className="px-4 py-3 font-mono font-semibold text-orange-600 text-xs">{r.returnNumber}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{r.vendorName}</td>
                  <td className="px-4 py-3 text-gray-500">#{r.grnId}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs font-medium">{r.returnType}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn("text-xs font-semibold", STATUS_COLOR[r.status] ?? "")}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {Number(r.totalReturnValue || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(r.createdAt).toLocaleDateString("en-IN")}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
