import { useGetQuotationComparison, getGetQuotationComparisonQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowLeft, Star, TrendingDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function QuotationComparisonView({ mrId }: { mrId: string }) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetQuotationComparison(Number(mrId), { query: { enabled: !!mrId, queryKey: getGetQuotationComparisonQueryKey(Number(mrId)) } });

  if (isLoading) return <div className="flex h-60 items-center justify-center"><div className="animate-pulse text-slate-400">Loading comparison…</div></div>;
  if (!data || !data.quotations?.length) return (
    <div className="text-center py-20">
      <p className="text-slate-500 font-medium">No quotations found for MR #{mrId}</p>
      <Button variant="link" className="text-orange-600 mt-2" onClick={() => setLocation("/procurement/quotations")}>View all quotations</Button>
    </div>
  );

  const { quotations = [], materialNames = [], materialLowest = {}, l1ReferenceId, l1Amount } = data as any;

  const fmt = (n: number | null | undefined) =>
    n !== null && n !== undefined ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setLocation("/procurement/quotations")} className="h-9 w-9"><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">L1 Quotation Comparison</h1>
          <p className="text-sm text-slate-500">Material Request #{mrId} · {quotations.length} quotation{quotations.length !== 1 ? "s" : ""} compared</p>
        </div>
      </div>

      {/* L1 summary card */}
      {l1ReferenceId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><Star className="w-5 h-5 text-amber-600" /></div>
          <div>
            <p className="font-bold text-amber-800">L1 Vendor: <span className="font-mono">{l1ReferenceId}</span></p>
            <p className="text-sm text-amber-700">Lowest Total: <strong>{fmt(l1Amount)}</strong> (excl. rejected quotations)</p>
          </div>
        </div>
      )}

      {/* Comparison matrix */}
      <div className="overflow-x-auto">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden min-w-max">
          <table className="text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 min-w-48">Material / Item</th>
                {quotations.map((q: any) => (
                  <th key={q.id} className="text-center px-4 py-3 min-w-52">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-slate-900 text-xs">{q.referenceId}</span>
                        {q.isL1Candidate && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                      </div>
                      <p className="text-xs text-slate-500">{q.vendorSnapshotName}</p>
                      <Badge variant="outline" className={cn("text-xs",
                        q.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        q.status === "Rejected" ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-100 text-slate-600"
                      )}>{q.status}</Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materialNames.map((matName: string) => (
                <tr key={matName} className="hover:bg-slate-50">
                  <td className="px-5 py-3 sticky left-0 bg-white font-medium text-slate-800 max-w-48 truncate">{matName}</td>
                  {quotations.map((q: any) => {
                    const item = (q.items ?? []).find((i: any) => i.materialName === matName);
                    const isLowest = item?.isLowest;
                    return (
                      <td key={q.id} className={cn("px-4 py-3 text-center", isLowest && "bg-emerald-50")}>
                        {item ? (
                          <div>
                            <p className={cn("font-mono font-bold", isLowest ? "text-emerald-700" : "text-slate-900")}>
                              {fmt(item.unitPrice)}/{item.uom}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">Qty: {item.qty} · GST: {item.gstRate}%</p>
                            {isLowest && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-semibold mt-0.5">
                                <TrendingDown className="w-3 h-3" /> Lowest
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">Not quoted</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot className="bg-slate-900 text-white">
              <tr>
                <td className="px-5 py-4 sticky left-0 bg-slate-900 font-bold text-sm">Grand Total</td>
                {quotations.map((q: any) => (
                  <td key={q.id} className="px-4 py-4 text-center">
                    <p className={cn("font-mono font-bold text-base", q.isL1Candidate ? "text-amber-300" : "text-white")}>{fmt(q.totalAmount)}</p>
                    {q.isL1Candidate && <p className="text-amber-400 text-xs mt-0.5">★ L1</p>}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Per-vendor action links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {quotations.map((q: any) => (
          <div key={q.id} onClick={() => setLocation(`/procurement/quotations/${q.id}`)}
            className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-orange-200 transition-all flex items-center justify-between group">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-xs text-slate-900">{q.referenceId}</span>
                {q.isL1Candidate && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{q.vendorSnapshotName}</p>
              <p className="font-bold font-mono mt-1 text-orange-600">{fmt(q.totalAmount)}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-slate-200 group-hover:text-orange-400 transition-colors" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
