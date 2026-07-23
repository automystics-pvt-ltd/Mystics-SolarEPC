/**
 * Task 2 — Vendor Quotation Comparison (L1 Analysis)
 * Allows procurement managers to compare all vendor quotations for a Material Request
 * side-by-side, highlighting the L1 (lowest) vendor and lowest price per item.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, CheckCircle2, TrendingDown } from "lucide-react";
import { apiGet } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { PageHeader, SectionCard, StatusBadge } from "@/components/shared";

const INR = (v: number | null | undefined) =>
  v != null ? `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";

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
  const l1Vendor = comparison.find((q: any) => q.id === l1Id);

  const nonRejected = comparison.filter((q: any) => q.status !== "Rejected");

  // Stats for summary
  const totalVendors = comparison.length;
  const totalItems = materialNames.length;
  const amounts = comparison.filter((q: any) => q.totalAmount != null).map((q: any) => Number(q.totalAmount));
  const priceSpread = amounts.length >= 2 ? Math.max(...amounts) - Math.min(...amounts) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-12">
      <PageHeader
        title="Vendor Comparison"
        subtitle={`MR #${mrId} · L1 analysis · side-by-side price comparison`}
        backHref="/procurement/quotations"
      />

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl p-6 text-center text-red-700 dark:text-red-400">
          Failed to load comparison data. Please try again.
        </div>
      )}

      {!isLoading && comparison.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No quotations found for this Material Request</p>
          <p className="text-sm mt-1">Quotations linked to MR #{mrId} will appear here for comparison.</p>
        </div>
      )}

      {!isLoading && comparison.length > 0 && (
        <>
          {/* Comparison Summary */}
          <SectionCard title="Comparison Summary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{totalVendors}</p>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Total Vendors</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 rounded-lg p-4 text-center">
                <p className="text-sm font-bold text-orange-900 dark:text-orange-300 truncate">{l1Vendor?.vendorSnapshotName ?? "—"}</p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 uppercase tracking-wide flex items-center justify-center gap-1"><Trophy className="h-3 w-3" /> L1 Vendor</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{totalItems}</p>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Total Items</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-sm font-bold text-foreground font-mono">{priceSpread != null ? INR(priceSpread) : "—"}</p>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Price Spread</p>
              </div>
            </div>
          </SectionCard>

          {/* L1 Summary Banner */}
          {l1Id && (
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800/40 rounded-xl p-5 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-orange-900 dark:text-orange-300">L1 Vendor (Lowest Qualifying Bid)</p>
                <div className="flex flex-wrap gap-4 mt-1 text-sm">
                  <span><span className="text-orange-700 dark:text-orange-400">Vendor:</span> <strong>{l1Vendor?.vendorSnapshotName}</strong></span>
                  <span><span className="text-orange-700 dark:text-orange-400">Ref:</span> <strong className="font-mono">{l1Vendor?.referenceId}</strong></span>
                  <span><span className="text-orange-700 dark:text-orange-400">Total:</span> <strong>{INR(l1Amount)}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Vendor Header Cards */}
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(comparison.length, 4)}, minmax(0, 1fr))` }}>
            {comparison.map((q: any) => (
              <div
                key={q.id}
                className={cn(
                  "bg-card border rounded-xl p-4 space-y-3 shadow-sm transition-all",
                  q.id === l1Id ? "border-orange-300 dark:border-orange-700 ring-1 ring-orange-300 dark:ring-orange-700" :
                  q.status === "Rejected" ? "opacity-50 border-border" : "border-border"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {q.id === l1Id && (
                      <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 text-xs font-bold mb-1">
                        <Trophy className="h-3 w-3" /> L1 VENDOR
                      </div>
                    )}
                    <p className="text-sm font-bold text-foreground leading-tight">{q.vendorSnapshotName}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{q.referenceId} v{q.version}</p>
                  </div>
                  <StatusBadge status={q.status} size="sm" />
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className={cn("font-bold font-mono", q.id === l1Id ? "text-orange-700 dark:text-orange-400" : "text-foreground")}>
                      {INR(q.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="text-foreground text-xs">{q.paymentTerms ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lead days</span>
                    <span className="text-foreground text-xs">{q.deliveryLeadDays ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Validity</span>
                    <span className="text-foreground text-xs">{q.validityDate ?? "—"}</span>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      onClick={() => setLocation(`/procurement/quotations/${q.id}`)}
                    >
                      View Full Quotation →
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Item-wise comparison table */}
          {materialNames.length > 0 && (
            <SectionCard title="Item-wise Price Comparison" noPadding>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em] whitespace-nowrap sticky left-0 bg-muted/40">
                        Material
                      </th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em] whitespace-nowrap">
                        UOM
                      </th>
                      {comparison.map((q: any) => (
                        <th
                          key={q.id}
                          className={cn(
                            "text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap",
                            q.id === l1Id ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
                          )}
                        >
                          {q.vendorSnapshotName?.split(" ").slice(0, 2).join(" ")}
                          {q.id === l1Id && " ★"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {materialNames.map(name => (
                      <tr key={name} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium text-foreground sticky left-0 bg-card max-w-56 truncate">
                          {name}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
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
                            <td key={q.id} className="px-4 py-2.5 text-right text-muted-foreground/40 text-xs">Not quoted</td>
                          );
                          const lowestPrice = item.lowestPrice;
                          const variancePct = lowestPrice && !item.isLowest
                            ? (((Number(item.unitPrice) - Number(lowestPrice)) / Number(lowestPrice)) * 100).toFixed(1)
                            : null;
                          return (
                            <td
                              key={q.id}
                              className={cn(
                                "px-4 py-2.5 text-right font-mono",
                                item.isLowest
                                  ? "bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-bold"
                                  : q.status === "Rejected" ? "text-muted-foreground/40 line-through" : "text-foreground"
                              )}
                            >
                              <div>{INR(item.unitPrice)}</div>
                              {item.isLowest && (
                                <div className="flex items-center justify-end gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> lowest
                                </div>
                              )}
                              {variancePct && (
                                <div className="text-xs text-red-500 dark:text-red-400">
                                  +{variancePct}% vs L1
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-muted/40 border-t-2 border-border font-bold">
                      <td className="px-4 py-3 text-foreground sticky left-0 bg-muted/40" colSpan={2}>Grand Total</td>
                      {comparison.map((q: any) => (
                        <td
                          key={q.id}
                          className={cn(
                            "px-4 py-3 text-right font-mono text-sm",
                            q.id === l1Id ? "text-orange-700 dark:text-orange-400 text-base" : "text-foreground"
                          )}
                        >
                          {INR(q.totalAmount)}
                          {q.id === l1Id && (
                            <div className="text-xs font-normal text-orange-500 dark:text-orange-400">L1 ✓</div>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Remarks / notes per vendor */}
          {nonRejected.some((q: any) => q.vendorRemarks || q.internalNotes) && (
            <SectionCard title="Vendor Remarks &amp; Notes">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(nonRejected.length, 3)}, minmax(0, 1fr))` }}>
                {nonRejected.map((q: any) => (q.vendorRemarks || q.internalNotes) && (
                  <div key={q.id} className="bg-muted/20 border border-border rounded-lg p-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">{q.vendorSnapshotName}</p>
                    {q.vendorRemarks && (
                      <div className="mb-2">
                        <p className="text-xs font-semibold text-muted-foreground">Vendor Remarks</p>
                        <p className="text-sm text-foreground">{q.vendorRemarks}</p>
                      </div>
                    )}
                    {q.internalNotes && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Internal Notes</p>
                        <p className="text-sm text-foreground">{q.internalNotes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </motion.div>
  );
}
