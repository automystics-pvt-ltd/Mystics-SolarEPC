import { useGetProcurementPO, useUpdateProcurementPO, getGetProcurementPOQueryKey, getGetProcurementPOsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingCart, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CONFIG: Record<string, { color: string }> = {
  Draft: { color: "bg-slate-100 text-slate-600 border-slate-200" },
  Issued: { color: "bg-blue-50 text-blue-700 border-blue-200" },
  Acknowledged: { color: "bg-amber-50 text-amber-700 border-amber-200" },
  PartiallyReceived: { color: "bg-orange-50 text-orange-700 border-orange-200" },
  FullyReceived: { color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Closed: { color: "bg-slate-100 text-slate-500 border-slate-200" },
  Cancelled: { color: "bg-red-50 text-red-700 border-red-200" },
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  Draft: ["Issued", "Cancelled"],
  Issued: ["Acknowledged", "Cancelled"],
  Acknowledged: ["PartiallyReceived", "FullyReceived", "Cancelled"],
  PartiallyReceived: ["FullyReceived", "Cancelled"],
  FullyReceived: ["Closed"],
  Closed: [], Cancelled: [],
};

export default function ProcurementPODetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const poId = Number(id);

  const { data: po, isLoading } = useGetProcurementPO(poId, { query: { enabled: !!poId, queryKey: getGetProcurementPOQueryKey(poId) } });
  const updateMut = useUpdateProcurementPO();

  if (isLoading || !po) return (
    <div className="flex h-60 items-center justify-center"><div className="animate-pulse text-slate-400">Loading PO…</div></div>
  );

  const p = po as any;
  const cfg = STATUS_CONFIG[p.status ?? "Draft"];
  const nextStatuses = VALID_TRANSITIONS[p.status ?? "Draft"] ?? [];
  const fmt = (n: number | null | undefined) => n !== null && n !== undefined ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";

  const updateStatus = (status: string) => {
    updateMut.mutate({ id: poId, data: { status } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProcurementPOQueryKey(poId) });
        qc.invalidateQueries({ queryKey: getGetProcurementPOsQueryKey() });
        toast({ title: `PO status updated to ${status}` });
      },
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setLocation("/procurement/pos")} className="h-9 w-9 shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><ShoppingCart className="w-5 h-5 text-slate-400" /></div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-mono text-slate-900">{p.poNumber}</h1>
                <Badge variant="outline" className={cn("text-sm", cfg.color)}>{p.status}</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {p.vendorName} · PO Date: {p.poDate ?? "—"}
                {p.approvedByName && ` · Approved by ${p.approvedByName}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {p.quotationId && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation(`/procurement/quotations/${p.quotationId}`)}>
                <ExternalLink className="w-3.5 h-3.5" /> View Quotation
              </Button>
            )}
            {nextStatuses.length > 0 && (
              <Select onValueChange={updateStatus}>
                <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Change status…" /></SelectTrigger>
                <SelectContent>{nextStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-100 text-sm">
          {[
            { label: "Vendor GSTIN", value: p.vendorGstin ?? "—" },
            { label: "Payment Terms", value: p.paymentTerms ?? "—" },
            { label: "Warranty", value: p.warrantyMonths ? `${p.warrantyMonths} months` : "—" },
            { label: "Delivery By", value: p.deliveryDeadline ?? "—" },
            { label: "Delivery Address", value: p.deliveryAddress ?? "—" },
          ].map(f => (
            <div key={f.label}><p className="text-xs text-slate-400">{f.label}</p><p className="font-semibold text-slate-800 mt-0.5 truncate">{f.value}</p></div>
          ))}
        </div>
      </div>

      {/* Vendor info */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Vendor Details</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-slate-400">Name</p><p className="font-semibold">{p.vendorName}</p></div>
          <div><p className="text-xs text-slate-400">GSTIN</p><p className="font-mono">{p.vendorGstin ?? "—"}</p></div>
          <div><p className="text-xs text-slate-400">Phone</p><p>{p.vendorContact ?? "—"}</p></div>
          <div><p className="text-xs text-slate-400">Address</p><p>{p.vendorAddress ?? "—"}</p></div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-700">Line Items ({(p.items ?? []).length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>{["#", "Item", "HSN", "Qty", "UoM", "Rate", "Disc%", "Taxable", "GST%", "Total"].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(p.items ?? []).map((item: any) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-xs text-slate-400">{item.lineNo}</td>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-slate-900">{item.materialName}</p>
                  {item.brand && <p className="text-xs text-slate-400">{item.brand}</p>}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{item.hsnSacCode ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono">{item.qty}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{item.uom}</td>
                <td className="px-4 py-2.5 font-mono">₹{Number(item.unitPrice ?? 0).toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 text-slate-500">{item.discountPct}%</td>
                <td className="px-4 py-2.5 font-mono">₹{Number(item.taxableAmount ?? 0).toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 text-xs">{item.gstRate}%</td>
                <td className="px-4 py-2.5 font-bold font-mono">₹{Number(item.lineTotal ?? 0).toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {(p.items ?? []).length === 0 && <tr><td colSpan={10} className="text-center py-8 text-slate-400">No items</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="bg-white border border-slate-200 rounded-xl p-5 w-80 space-y-2 text-sm">
          {[
            { label: "Subtotal", value: fmt(p.subtotal) },
            { label: "GST", value: fmt(p.totalGst) },
            { label: "Freight", value: fmt(p.freightCharges) },
            { label: "Other", value: fmt(p.otherCharges) },
          ].map(r => <div key={r.label} className="flex justify-between text-slate-600"><span>{r.label}</span><span className="font-mono">{r.value}</span></div>)}
          <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-base"><span>Total</span><span className="font-mono">{fmt(p.totalAmount)}</span></div>
        </div>
      </div>
    </motion.div>
  );
}
