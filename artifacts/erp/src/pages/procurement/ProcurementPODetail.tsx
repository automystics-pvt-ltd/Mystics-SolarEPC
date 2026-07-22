import { useState } from "react";
import {
  useGetProcurementPO, useUpdateProcurementPO, useRecordProcurementPODispatch,
  getGetProcurementPOQueryKey, getGetProcurementPOsQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, ShoppingCart, ExternalLink, Package, FileText,
  AlertTriangle, Truck, Clock, CheckCircle2, Circle,
} from "lucide-react";
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

// Timeline steps definition
const TIMELINE_STEPS = [
  { key: "created", label: "PO Created", icon: ShoppingCart },
  { key: "issued", label: "Issued to Vendor", icon: ExternalLink, status: "Issued" },
  { key: "acknowledged", label: "Acknowledged", icon: CheckCircle2, status: "Acknowledged" },
  { key: "dispatched", label: "Dispatched", icon: Truck },
  { key: "received", label: "Goods Received", icon: Package, status: "PartiallyReceived" },
  { key: "invoiced", label: "Invoice", icon: FileText },
  { key: "closed", label: "Closed", icon: CheckCircle2, status: "Closed" },
];

const STATUS_ORDER = ["Draft", "Issued", "Acknowledged", "PartiallyReceived", "FullyReceived", "Closed"];

function getStepState(key: string, p: any): "done" | "active" | "pending" {
  const statusIdx = STATUS_ORDER.indexOf(p.status);
  if (p.status === "Cancelled") {
    return key === "created" ? "done" : "pending";
  }
  if (key === "created") return "done";
  if (key === "issued") return statusIdx >= STATUS_ORDER.indexOf("Issued") ? "done" : statusIdx === STATUS_ORDER.indexOf("Draft") ? "active" : "pending";
  if (key === "acknowledged") return statusIdx >= STATUS_ORDER.indexOf("Acknowledged") ? "done" : statusIdx === STATUS_ORDER.indexOf("Issued") ? "active" : "pending";
  if (key === "dispatched") return p.dispatchedAt ? "done" : statusIdx >= STATUS_ORDER.indexOf("Acknowledged") ? "active" : "pending";
  if (key === "received") return statusIdx >= STATUS_ORDER.indexOf("PartiallyReceived") ? "done" : p.dispatchedAt ? "active" : "pending";
  if (key === "invoiced") return (p.invoices ?? []).some((i: any) => ["Approved", "Paid"].includes(i.status)) ? "done" : statusIdx >= STATUS_ORDER.indexOf("PartiallyReceived") ? "active" : "pending";
  if (key === "closed") return statusIdx >= STATUS_ORDER.indexOf("Closed") ? "done" : "pending";
  return "pending";
}

export default function ProcurementPODetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const poId = Number(id);
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();

  const [dispatchRef, setDispatchRef] = useState("");
  const [trackingNum, setTrackingNum] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [showDispatchForm, setShowDispatchForm] = useState(false);

  const { data: po, isLoading } = useGetProcurementPO(poId, { query: { enabled: !!poId, queryKey: getGetProcurementPOQueryKey(poId) } });
  const updateMut = useUpdateProcurementPO();
  const dispatchMut = useRecordProcurementPODispatch();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetProcurementPOQueryKey(poId) });
    qc.invalidateQueries({ queryKey: getGetProcurementPOsQueryKey() });
  };

  if (isLoading || !po) return (
    <div className="flex h-60 items-center justify-center"><div className="animate-pulse text-slate-400">Loading PO…</div></div>
  );

  const p = po as any;
  const cfg = STATUS_CONFIG[p.status ?? "Draft"];
  const nextStatuses = VALID_TRANSITIONS[p.status ?? "Draft"] ?? [];
  const fmt = (n: number | null | undefined) => n !== null && n !== undefined ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";
  const today = new Date().toISOString().split("T")[0];
  const deadline = p.deliveryDeadline ?? p.expectedDeliveryDate;
  const isOverdue = p.isOverdue || (deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(p.status));
  const daysOverdue = deadline ? Math.floor((new Date().getTime() - new Date(deadline).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const updateStatus = (status: string) => {
    updateMut.mutate({ id: poId, data: { status, userName: user.name, userId: user.id } as any }, {
      onSuccess: () => { invalidate(); toast({ title: `PO status updated to ${status}` }); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    });
  };

  const recordDispatch = () => {
    if (!dispatchRef && !trackingNum) { toast({ title: "Enter dispatch ref or tracking number", variant: "destructive" }); return; }
    dispatchMut.mutate({
      id: poId,
      data: { vendorDispatchRef: dispatchRef, trackingNumber: trackingNum, expectedDeliveryDate: expectedDelivery || undefined, userName: user.name, userId: user.id } as any,
    }, {
      onSuccess: () => { invalidate(); setShowDispatchForm(false); toast({ title: "Dispatch recorded" }); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">

      {/* Overdue banner */}
      {isOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-red-800">Delivery Overdue by {daysOverdue} day{daysOverdue !== 1 ? "s" : ""}</p>
            <p className="text-sm text-red-700">Deadline was {deadline}. Follow up with vendor immediately.</p>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setLocation("/procurement/pos")} className="h-9 w-9 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold font-mono text-slate-900">{p.poNumber}</h1>
                <Badge variant="outline" className={cn("text-sm", cfg.color)}>{p.status}</Badge>
                {isOverdue && <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">Overdue</Badge>}
              </div>
              <p className="text-sm text-slate-500 mt-1">{p.vendorName} · Created {new Date(p.createdAt).toLocaleDateString("en-IN")}{p.createdByName ? ` by ${p.createdByName}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {nextStatuses.length > 0 && (
              <Select onValueChange={updateStatus} disabled={updateMut.isPending}>
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue placeholder="Change status…" />
                </SelectTrigger>
                <SelectContent>
                  {nextStatuses.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Visual Timeline */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Timeline</p>
          <div className="flex items-start gap-0 overflow-x-auto pb-2">
            {TIMELINE_STEPS.map((step, idx) => {
              const state = getStepState(step.key, p);
              const Icon = step.icon;
              const isLast = idx === TIMELINE_STEPS.length - 1;
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                      state === "done" ? "bg-orange-500 border-orange-500 text-white" :
                      state === "active" ? "bg-white border-orange-400 text-orange-500" :
                      "bg-slate-100 border-slate-200 text-slate-400"
                    )}>
                      {state === "done" ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <p className={cn("text-[10px] font-medium text-center mt-1.5 max-w-[72px] leading-tight",
                      state === "done" ? "text-orange-600" : state === "active" ? "text-slate-700" : "text-slate-400"
                    )}>{step.label}</p>
                  </div>
                  {!isLast && (
                    <div className={cn("h-0.5 w-6 mb-5 mx-0 shrink-0",
                      getStepState(TIMELINE_STEPS[idx + 1].key, p) === "done" || state === "done" ? "bg-orange-300" : "bg-slate-200"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dispatch tracking */}
      {!["Cancelled", "Draft"].includes(p.status) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Dispatch Tracking</h2>
            {!p.dispatchedAt && (
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setShowDispatchForm(!showDispatchForm)}>
                <Truck className="w-3.5 h-3.5" /> {showDispatchForm ? "Cancel" : "Record Dispatch"}
              </Button>
            )}
          </div>

          {p.dispatchedAt ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-slate-500">Dispatched On</p><p className="font-medium">{new Date(p.dispatchedAt).toLocaleDateString("en-IN")}</p></div>
              <div><p className="text-xs text-slate-500">Dispatch Ref</p><p className="font-medium">{p.vendorDispatchRef ?? "—"}</p></div>
              <div><p className="text-xs text-slate-500">Tracking Number</p><p className="font-medium">{p.trackingNumber ?? "—"}</p></div>
              <div><p className="text-xs text-slate-500">Expected Delivery</p><p className="font-medium">{p.expectedDeliveryDate ?? "—"}</p></div>
            </div>
          ) : showDispatchForm ? (
            <div className="space-y-3 bg-slate-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Dispatch Ref</Label>
                  <Input value={dispatchRef} onChange={e => setDispatchRef(e.target.value)} placeholder="Vendor dispatch ref" className="h-9" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tracking Number</Label>
                  <Input value={trackingNum} onChange={e => setTrackingNum(e.target.value)} placeholder="AWB / LR number" className="h-9" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Expected Delivery</Label>
                  <Input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} className="h-9" />
                </div>
                <div className="flex items-end">
                  <Button className="bg-orange-500 hover:bg-orange-600 h-9 w-full" onClick={recordDispatch} disabled={dispatchMut.isPending}>
                    {dispatchMut.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No dispatch recorded yet.</p>
          )}
        </div>
      )}

      {/* PO Metadata */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-bold text-slate-900 mb-4">Purchase Order Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-slate-500">PO Date</p><p className="font-medium">{p.poDate ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Delivery Deadline</p><p className={cn("font-medium", isOverdue ? "text-red-600 font-bold" : "")}>{deadline ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Payment Terms</p><p className="font-medium">{p.paymentTerms ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Warranty</p><p className="font-medium">{p.warrantyMonths ? `${p.warrantyMonths} months` : "—"}</p></div>
          <div className="col-span-2"><p className="text-xs text-slate-500">Delivery Address</p><p className="font-medium">{p.deliveryAddress ?? "—"}</p></div>
          {p.vendorGstin && <div><p className="text-xs text-slate-500">Vendor GSTIN</p><p className="font-medium font-mono">{p.vendorGstin}</p></div>}
          {p.approvedByName && <div><p className="text-xs text-slate-500">Approved By</p><p className="font-medium">{p.approvedByName}</p></div>}
        </div>
        {p.specialTerms && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">Special Terms</p>
            <p className="text-sm text-slate-700 mt-1">{p.specialTerms}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["#", "Material", "UOM", "Qty", "Unit Price", "GST%", "Line Total", "Delivered Qty"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(p.items ?? []).map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400">{item.lineNo}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{item.materialName}</p>
                    {item.materialCode && <p className="text-xs text-slate-400">{item.materialCode}</p>}
                    {item.brand && <p className="text-xs text-slate-400">{item.brand}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.uom}</td>
                  <td className="px-4 py-3 font-mono">{item.qty}</td>
                  <td className="px-4 py-3 font-mono">{fmt(item.unitPrice)}</td>
                  <td className="px-4 py-3">{item.gstRate}%</td>
                  <td className="px-4 py-3 font-mono font-bold">{fmt(item.lineTotal)}</td>
                  <td className="px-4 py-3 font-mono">
                    {item.deliveredQty != null ? (
                      <span className={cn(
                        "font-bold",
                        Number(item.deliveredQty) >= Number(item.qty) ? "text-emerald-600" : "text-amber-600"
                      )}>{item.deliveredQty} / {item.qty}</span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-sm font-bold text-slate-600 text-right">Total</td>
                <td className="px-4 py-3 font-mono font-bold text-slate-900">{fmt(p.totalAmount)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Financial summary */}
        <div className="border-t border-slate-200 p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50">
          <div><p className="text-xs text-slate-500">Subtotal</p><p className="font-mono font-medium">{fmt(p.subtotal)}</p></div>
          <div><p className="text-xs text-slate-500">GST</p><p className="font-mono font-medium">{fmt(p.totalGst)}</p></div>
          <div><p className="text-xs text-slate-500">Freight + Other</p><p className="font-mono font-medium">{fmt((p.freightCharges ?? 0) + (p.otherCharges ?? 0))}</p></div>
          <div className="bg-slate-900 rounded-lg p-3 text-white text-right">
            <p className="text-xs text-slate-400">Grand Total</p>
            <p className="font-mono font-bold text-lg">{fmt(p.totalAmount)}</p>
          </div>
        </div>
      </div>

      {/* GRNs */}
      {(p.grns ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Goods Receipt Notes</h2>
            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setLocation(`/procurement/grns/new`)}>
              <Package className="w-3.5 h-3.5" /> New GRN
            </Button>
          </div>
          <div className="divide-y divide-slate-100">
            {p.grns.map((grn: any) => (
              <div key={grn.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer" onClick={() => setLocation(`/procurement/grns/${grn.id}`)}>
                <div>
                  <p className="font-mono font-bold text-slate-900">{grn.grnNumber}</p>
                  <p className="text-xs text-slate-500">{grn.deliveryDate ?? "No delivery date"}</p>
                </div>
                <Badge variant="outline" className={cn("text-xs", (({
                  Draft: "bg-slate-100 text-slate-600", Submitted: "bg-blue-50 text-blue-700",
                  Accepted: "bg-emerald-50 text-emerald-700", PartiallyAccepted: "bg-amber-50 text-amber-700",
                  Rejected: "bg-red-50 text-red-700",
                } as Record<string, string>)[grn.status] ?? ""))}>{grn.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      {(p.invoices ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Invoices</h2>
            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setLocation(`/procurement/invoices/new`)}>
              <FileText className="w-3.5 h-3.5" /> New Invoice
            </Button>
          </div>
          <div className="divide-y divide-slate-100">
            {p.invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer" onClick={() => setLocation(`/procurement/invoices/${inv.id}`)}>
                <div>
                  <p className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</p>
                  <p className="text-xs text-slate-500">₹{Number(inv.totalAmount ?? 0).toLocaleString("en-IN")}</p>
                </div>
                <Badge variant="outline" className={cn("text-xs", (({
                  Draft: "bg-slate-100 text-slate-600", PendingApproval: "bg-purple-50 text-purple-700",
                  Approved: "bg-emerald-50 text-emerald-700", OnHold: "bg-amber-50 text-amber-700",
                  Paid: "bg-green-50 text-green-700",
                } as Record<string, string>)[inv.status] ?? ""))}>{inv.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit log */}
      {(p.auditLogs ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-bold text-slate-900 mb-4">Audit Trail</h2>
          <div className="space-y-3">
            {p.auditLogs.map((log: any) => (
              <div key={log.id} className="flex gap-3">
                <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{log.action} <span className="text-slate-500 font-normal">by {log.performedByName}</span></p>
                  {log.remarks && <p className="text-sm text-slate-500 mt-0.5">{log.remarks}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
