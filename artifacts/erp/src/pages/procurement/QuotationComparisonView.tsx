/**
 * Task 2 — Vendor Quotation Comparison (L1 Analysis)
 * Allows procurement managers to compare all vendor quotations for a Material Request
 * side-by-side, highlighting the L1 (lowest) vendor and lowest price per item.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Trophy, CheckCircle2, TrendingDown } from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { cn } from "@/lib/utils";

const INR = (v: number | null | undefined) =>
  v != null ? `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";

const STATUS_COLOR: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Submitted: "bg-blue-50 text-blue-700",
  UnderReview: "bg-purple-50 text-purple-700",
  Approved: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700",
  RevisionRequested: "bg-amber-50 text-amber-700",
};

export default function QuotationComparisonView({ mrId }: { mrId: string }) {
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery({
    queryKey: ["quotation-comparison", mrId],
    queryFn: () => apiGet<any>(`/material-requests/${mrId}/quotation-comparison`),
    enabled: !!mrId,
  });

  const comparison = data?.quotations ?? [];
  const materialNames: string[] = data?.materialNames ?? [];
  const l1Id = comparison.find((q: any) => q.isL1Candidate)?.id ?? null;
  const l1Amount = data?.l1Amount;

  const nonRejected = comparison.filter((q: any) => q.status !== "Rejected");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setLocation("/procurement/quotations")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Vendor Comparison — MR #{mrId}</h1>
          <p className="text-sm text-slate-500">L1 analysis · side-by-side price comparison across all quotations</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700">
          Failed to load comparison data. Please try again.
        </div>
      )}

      {!isLoading && comparison.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No quotations found for this Material Request</p>
          <p className="text-sm mt-1">Quotations linked to MR #{mrId} will appear here for comparison.</p>
        </div>
      )}

      {!isLoading && comparison.length > 0 && (
        <>
          {/* L1 Summary Card */}
          {l1Id && (
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-orange-900">L1 Vendor (Lowest Qualifying Bid)</p>
                {(() => {
                  const l1 = comparison.find((q: any) => q.id === l1Id);
                  return (
                    <div className="flex flex-wrap gap-4 mt-1 text-sm">
                      <span><span className="text-orange-700">Vendor:</span> <strong>{l1?.vendorSnapshotName}</strong></span>
                      <span><span className="text-orange-700">Ref:</span> <strong className="font-mono">{l1?.referenceId}</strong></span>
                      <span><span className="text-orange-700">Total:</span> <strong>{INR(l1Amount)}</strong></span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Vendor Header Cards */}
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(comparison.length, 4)}, minmax(0, 1fr))` }}>
            {comparison.map((q: any) => (
              <Card
                key={q.id}
                className={cn(
                  "border shadow-sm transition-all",
                  q.id === l1Id ? "border-orange-300 bg-orange-50/40 ring-1 ring-orange-300" :
                  q.status === "Rejected" ? "opacity-50 border-slate-200" : "border-slate-200"
                )}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {q.id === l1Id && (
                        <div className="flex items-center gap-1 text-orange-600 text-xs font-bold mb-1">
                          <Trophy className="h-3 w-3" /> L1 VENDOR
                        </div>
                      )}
                      <CardTitle className="text-sm font-bold text-slate-900 leading-tight">
                        {q.vendorSnapshotName}
                      </CardTitle>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">{q.referenceId} v{q.version}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-xs shrink-0", STATUS_COLOR[q.status] ?? "")}>
                      {q.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total</span>
                    <span className={cn("font-bold font-mono", q.id === l1Id ? "text-orange-700" : "text-slate-900")}>
                      {INR(q.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment</span>
                    <span className="text-slate-700 text-xs">{q.paymentTerms ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lead days</span>
                    <span className="text-slate-700 text-xs">{q.deliveryLeadDays ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Validity</span>
                    <span className="text-slate-700 text-xs">{q.validityDate ?? "—"}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      onClick={() => setLocation(`/procurement/quotations/${q.id}`)}
                    >
                      View Full Quotation →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Item-wise comparison table */}
          {materialNames.length > 0 && (
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-200 px-5 py-3">
                <CardTitle className="text-sm">Item-wise Price Comparison</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase whitespace-nowrap sticky left-0 bg-slate-50">
                        Material
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">
                        UOM
                      </th>
                      {comparison.map((q: any) => (
                        <th
                          key={q.id}
                          className={cn(
                            "text-right px-4 py-2.5 text-xs font-bold uppercase whitespace-nowrap",
                            q.id === l1Id ? "text-orange-600" : "text-slate-500"
                          )}
                        >
                          {q.vendorSnapshotName?.split(" ").slice(0, 2).join(" ")}
                          {q.id === l1Id && " ★"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materialNames.map(name => (
                      <tr key={name} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-900 sticky left-0 bg-white max-w-56 truncate">
                          {name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">
                          {(() => {
                            for (const q of comparison) {
                              const item = q.items?.find((i: any) => i.materialName === name);
                              if (item) return item.uom;
                            }
                            return "—";
                          })()}
                        </td>
                        {comparison.map((q: any) => {
                          const item = q.items?.find((i: any) => i.materialName === name);
                          if (!item) return (
                            <td key={q.id} className="px-4 py-2.5 text-right text-slate-300 text-xs">Not quoted</td>
                          );
                          return (
                            <td
                              key={q.id}
                              className={cn(
                                "px-4 py-2.5 text-right font-mono",
                                item.isLowest
                                  ? "text-emerald-700 font-bold"
                                  : q.status === "Rejected" ? "text-slate-400 line-through" : "text-slate-700"
                              )}
                            >
                              <div>{INR(item.unitPrice)}</div>
                              {item.isLowest && (
                                <div className="flex items-center justify-end gap-1 text-xs text-emerald-600">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> lowest
                                </div>
                              )}
                              {!item.isLowest && item.lowestPrice && (
                                <div className="text-xs text-slate-400">
                                  +{INR((item.unitPrice ?? 0) - item.lowestPrice)} vs L1
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                      <td className="px-4 py-3 text-slate-700 sticky left-0 bg-slate-50" colSpan={2}>Grand Total</td>
                      {comparison.map((q: any) => (
                        <td
                          key={q.id}
                          className={cn(
                            "px-4 py-3 text-right font-mono text-sm",
                            q.id === l1Id ? "text-orange-700 text-base" : "text-slate-800"
                          )}
                        >
                          {INR(q.totalAmount)}
                          {q.id === l1Id && (
                            <div className="text-xs font-normal text-orange-500">L1 ✓</div>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Remarks / notes per vendor */}
          {nonRejected.some((q: any) => q.vendorRemarks || q.internalNotes) && (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(nonRejected.length, 3)}, minmax(0, 1fr))` }}>
              {nonRejected.map((q: any) => (q.vendorRemarks || q.internalNotes) && (
                <div key={q.id} className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">{q.vendorSnapshotName}</p>
                  {q.vendorRemarks && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-slate-600">Vendor Remarks</p>
                      <p className="text-sm text-slate-700">{q.vendorRemarks}</p>
                    </div>
                  )}
                  {q.internalNotes && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600">Internal Notes</p>
                      <p className="text-sm text-slate-700">{q.internalNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
