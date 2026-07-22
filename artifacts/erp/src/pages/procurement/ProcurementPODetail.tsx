import { useState } from "react";
import {
  useGetProcurementPO, useUpdateProcurementPO, useRecordProcurementPODispatch,
  getGetProcurementPOQueryKey, getGetProcurementPOsQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, ShoppingCart, ExternalLink, Package, FileText,
  AlertTriangle, Truck, Clock, CheckCircle2, Printer, ChevronRight,
  ClipboardCheck, XCircle, Send, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  Draft:            { color: "bg-slate-100 text-slate-600 border-slate-200",   label: "Draft" },
  Issued:           { color: "bg-blue-50 text-blue-700 border-blue-200",        label: "Issued to Vendor" },
  Acknowledged:     { color: "bg-amber-50 text-amber-700 border-amber-200",     label: "Acknowledged" },
  PartiallyReceived:{ color: "bg-orange-50 text-orange-700 border-orange-200",  label: "Partially Received" },
  FullyReceived:    { color: "bg-emerald-50 text-emerald-700 border-emerald-200",label: "Fully Received" },
  Closed:           { color: "bg-slate-100 text-slate-500 border-slate-200",    label: "Closed" },
  Cancelled:        { color: "bg-red-50 text-red-700 border-red-200",           label: "Cancelled" },
};

const GRN_STATUS_COLOR: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600", Submitted: "bg-blue-50 text-blue-700",
  Accepted: "bg-emerald-50 text-emerald-700", PartiallyAccepted: "bg-amber-50 text-amber-700",
  Rejected: "bg-red-50 text-red-700",
};

const INV_STATUS_COLOR: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600", PendingApproval: "bg-purple-50 text-purple-700",
  Approved: "bg-emerald-50 text-emerald-700", OnHold: "bg-amber-50 text-amber-700",
  Paid: "bg-green-50 text-green-700", Rejected: "bg-red-50 text-red-700",
};

const STATUS_ORDER = ["Draft", "Issued", "Acknowledged", "PartiallyReceived", "FullyReceived", "Closed"];

const TIMELINE_STEPS = [
  { key: "created",      label: "Created",         icon: ShoppingCart },
  { key: "issued",       label: "Issued to Vendor", icon: Send,         status: "Issued" },
  { key: "acknowledged", label: "Acknowledged",     icon: CheckCircle2, status: "Acknowledged" },
  { key: "dispatched",   label: "Dispatched",       icon: Truck },
  { key: "received",     label: "Goods Received",   icon: Package,      status: "PartiallyReceived" },
  { key: "invoiced",     label: "Invoice",          icon: FileText },
  { key: "closed",       label: "Closed",           icon: ClipboardCheck, status: "Closed" },
];

function getStepState(key: string, p: any): "done" | "active" | "pending" {
  if (p.status === "Cancelled") return key === "created" ? "done" : "pending";
  const idx = STATUS_ORDER.indexOf(p.status);
  if (key === "created")      return "done";
  if (key === "issued")       return idx >= STATUS_ORDER.indexOf("Issued") ? "done" : idx === STATUS_ORDER.indexOf("Draft") ? "active" : "pending";
  if (key === "acknowledged") return idx >= STATUS_ORDER.indexOf("Acknowledged") ? "done" : idx === STATUS_ORDER.indexOf("Issued") ? "active" : "pending";
  if (key === "dispatched")   return p.dispatchedAt ? "done" : idx >= STATUS_ORDER.indexOf("Acknowledged") ? "active" : "pending";
  if (key === "received")     return idx >= STATUS_ORDER.indexOf("PartiallyReceived") ? "done" : p.dispatchedAt ? "active" : "pending";
  if (key === "invoiced")     return (p.invoices ?? []).some((i: any) => ["Approved","Paid"].includes(i.status)) ? "done" : idx >= STATUS_ORDER.indexOf("PartiallyReceived") ? "active" : "pending";
  if (key === "closed")       return idx >= STATUS_ORDER.indexOf("Closed") ? "done" : "pending";
  return "pending";
}

export default function ProcurementPODetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const poId = Number(id);
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();

  // Dispatch form state
  const [dispatchRef,       setDispatchRef]       = useState("");
  const [trackingNum,       setTrackingNum]        = useState("");
  const [expectedDelivery,  setExpectedDelivery]   = useState("");
  const [showDispatchForm,  setShowDispatchForm]   = useState(false);

  // Issue PO form state (Draft → Issued)
  const [issueDeadline, setIssueDeadline] = useState("");
  const [issueAddress,  setIssueAddress]  = useState("");
  const [issueTerms,    setIssueTerms]    = useState("");
  const [issueError,    setIssueError]    = useState("");

  // Dialog states
  const [showCancelWarning, setShowCancelWarning]   = useState(false);
  const [pendingStatus,     setPendingStatus]        = useState<string | null>(null);
  const [showCloseConfirm,  setShowCloseConfirm]     = useState(false);

  const { data: po, isLoading } = useGetProcurementPO(poId, { query: { enabled: !!poId, queryKey: getGetProcurementPOQueryKey(poId) } });
  const updateMut  = useUpdateProcurementPO();
  const dispatchMut = useRecordProcurementPODispatch();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetProcurementPOQueryKey(poId) });
    qc.invalidateQueries({ queryKey: getGetProcurementPOsQueryKey() });
  };

  if (isLoading || !po) return (
    <div className="flex h-60 items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading PO…</div>
    </div>
  );

  const p = po as any;
  const cfg = STATUS_CONFIG[p.status ?? "Draft"] ?? STATUS_CONFIG["Draft"];
  const fmt = (n: number | null | undefined) =>
    n !== null && n !== undefined ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";
  const deadline = p.deliveryDeadline ?? p.expectedDeliveryDate;
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = p.isOverdue || (deadline && deadline < today && !["Closed","Cancelled","FullyReceived"].includes(p.status));
  const daysOverdue = deadline ? Math.floor((Date.now() - new Date(deadline).getTime()) / 86400000) : 0;

  // Derived booleans
  const canCreateGRN     = ["Issued","Acknowledged","PartiallyReceived"].includes(p.status);
  const canCreateInvoice = ["PartiallyReceived","FullyReceived","Closed"].includes(p.status);
  const canCancel        = !["Closed","Cancelled"].includes(p.status);

  const updateStatus = (status: string, extraFields: Record<string, any> = {}) => {
    updateMut.mutate(
      { id: poId, data: { status, userName: user.name, userId: user.id, ...extraFields } as any },
      {
        onSuccess: () => { invalidate(); toast({ title: `PO updated to ${STATUS_CONFIG[status]?.label ?? status}` }); },
        onError: (e: any) => {
          const msg = (e as any)?.response?.data?.error ?? (e as any)?.message ?? "An error occurred";
          toast({ title: "Cannot update PO", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleCancel = () => {
    if ((p.grns ?? []).length > 0) { setPendingStatus("Cancelled"); setShowCancelWarning(true); }
    else updateStatus("Cancelled");
  };

  const handleIssuePO = () => {
    if (!issueDeadline) { setIssueError("Delivery deadline is required before issuing the PO."); return; }
    setIssueError("");
    updateStatus("Issued", {
      deliveryDeadline: issueDeadline,
      ...(issueAddress ? { deliveryAddress: issueAddress } : {}),
      ...(issueTerms   ? { specialTerms:   issueTerms }   : {}),
    });
  };

  const recordDispatch = () => {
    if (!dispatchRef && !trackingNum) { toast({ title: "Enter dispatch ref or tracking number", variant: "destructive" }); return; }
    dispatchMut.mutate(
      { id: poId, data: { vendorDispatchRef: dispatchRef, trackingNumber: trackingNum, expectedDeliveryDate: expectedDelivery || undefined, userName: user.name, userId: user.id } as any },
      {
        onSuccess: () => { invalidate(); setShowDispatchForm(false); toast({ title: "Dispatch details recorded" }); },
        onError: (e: any) => {
          const msg = (e as any)?.response?.data?.error ?? (e as any)?.message ?? "Failed";
          toast({ title: "Failed to record dispatch", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const grnUrl   = `/procurement/grns/new?poId=${p.id}`;
  const invUrl   = `/procurement/invoices/new?poId=${p.id}`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-12">

      {/* Overdue banner */}
      {isOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-red-800">Delivery Overdue by {daysOverdue} day{daysOverdue !== 1 ? "s" : ""}</p>
            <p className="text-sm text-red-700">Deadline was {deadline}. Follow up with the vendor immediately.</p>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setLocation("/procurement/pos")} className="h-9 w-9 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold font-mono text-slate-900">{p.poNumber}</h1>
                <Badge variant="outline" className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</Badge>
                {isOverdue && <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">Overdue</Badge>}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {p.vendorName} · PO date {p.poDate ?? "—"}
                {p.createdByName ? ` · Created by ${p.createdByName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            {canCancel && (
              <Button
                variant="outline" size="sm"
                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleCancel}
                disabled={updateMut.isPending}
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel PO
              </Button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Workflow Timeline</p>
          <div className="flex items-start overflow-x-auto pb-2">
            {TIMELINE_STEPS.map((step, idx) => {
              const state = getStepState(step.key, p);
              const Icon = step.icon;
              const isLast = idx === TIMELINE_STEPS.length - 1;
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                      state === "done"   ? "bg-orange-500 border-orange-500 text-white" :
                      state === "active" ? "bg-white border-orange-400 text-orange-500" :
                                          "bg-slate-100 border-slate-200 text-slate-400"
                    )}>
                      {state === "done" ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <p className={cn("text-[10px] font-medium text-center mt-1.5 max-w-[72px] leading-tight",
                      state === "done"   ? "text-orange-600" :
                      state === "active" ? "text-slate-700"  : "text-slate-400"
                    )}>{step.label}</p>
                  </div>
                  {!isLast && (
                    <div className={cn("h-0.5 w-6 mb-5 shrink-0",
                      state === "done" ? "bg-orange-300" : "bg-slate-200"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Contextual Action Panel ─────────────────────────────────────────── */}

      {/* DRAFT — Issue PO to Vendor */}
      {p.status === "Draft" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
              <Send className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-blue-900">Issue Purchase Order to Vendor</h2>
              <p className="text-sm text-blue-700 mt-0.5">
                Set the delivery deadline and formally issue this PO. The vendor will be expected to acknowledge receipt.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
            <div>
              <Label className="text-xs font-semibold text-blue-800 mb-1.5 block">
                Delivery Deadline <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={issueDeadline}
                min={today}
                onChange={e => { setIssueDeadline(e.target.value); setIssueError(""); }}
                className={cn("h-9 bg-white", issueError ? "border-red-400" : "")}
              />
              {issueError && <p className="text-xs text-red-600 mt-1">{issueError}</p>}
            </div>
            <div>
              <Label className="text-xs font-semibold text-blue-800 mb-1.5 block">Delivery Address</Label>
              <Input
                value={issueAddress}
                onChange={e => setIssueAddress(e.target.value)}
                placeholder="Site / warehouse address…"
                className="h-9 bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-blue-800 mb-1.5 block">Special Terms</Label>
              <Input
                value={issueTerms}
                onChange={e => setIssueTerms(e.target.value)}
                placeholder="e.g. Delivery in working hours only"
                className="h-9 bg-white"
              />
            </div>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            onClick={handleIssuePO}
            disabled={updateMut.isPending}
          >
            <Send className="w-4 h-4" />
            {updateMut.isPending ? "Issuing…" : "Issue PO to Vendor"}
          </Button>
        </div>
      )}

      {/* ISSUED — Awaiting Acknowledgement + Dispatch */}
      {p.status === "Issued" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-amber-900">Awaiting Vendor Acknowledgement</h2>
                <p className="text-sm text-amber-700 mt-0.5">
                  The PO has been issued. Once the vendor confirms receipt, mark it as acknowledged.
                </p>
              </div>
            </div>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              onClick={() => updateStatus("Acknowledged")}
              disabled={updateMut.isPending}
            >
              <CheckCircle2 className="w-4 h-4" />
              {updateMut.isPending ? "Saving…" : "Mark as Acknowledged"}
            </Button>
          </div>
          {/* Dispatch form for Issued state */}
          <div className="border-t border-amber-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-amber-800">Vendor Dispatch Details</p>
              {!p.dispatchedAt && (
                <Button size="sm" variant="outline" className="text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => setShowDispatchForm(!showDispatchForm)}>
                  <Truck className="w-3.5 h-3.5" /> {showDispatchForm ? "Cancel" : "Record Dispatch"}
                </Button>
              )}
            </div>
            {p.dispatchedAt ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><p className="text-xs text-amber-700">Dispatched On</p><p className="font-medium">{new Date(p.dispatchedAt).toLocaleDateString("en-IN")}</p></div>
                <div><p className="text-xs text-amber-700">Dispatch Ref</p><p className="font-medium">{p.vendorDispatchRef ?? "—"}</p></div>
                <div><p className="text-xs text-amber-700">Tracking No.</p><p className="font-medium">{p.trackingNumber ?? "—"}</p></div>
                <div><p className="text-xs text-amber-700">Expected Delivery</p><p className="font-medium">{p.expectedDeliveryDate ?? "—"}</p></div>
              </div>
            ) : showDispatchForm ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white rounded-lg p-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1 block">Dispatch Ref</Label>
                  <Input value={dispatchRef} onChange={e => setDispatchRef(e.target.value)} placeholder="Vendor ref" className="h-9" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1 block">Tracking Number</Label>
                  <Input value={trackingNum} onChange={e => setTrackingNum(e.target.value)} placeholder="AWB / LR" className="h-9" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1 block">Expected Delivery</Label>
                  <Input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} className="h-9" />
                </div>
                <div className="flex items-end">
                  <Button className="bg-orange-500 hover:bg-orange-600 h-9 w-full" onClick={recordDispatch} disabled={dispatchMut.isPending}>
                    {dispatchMut.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-amber-600">No dispatch recorded yet. Record when vendor ships.</p>
            )}
          </div>
        </div>
      )}

      {/* ACKNOWLEDGED — Ready to receive goods */}
      {p.status === "Acknowledged" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-emerald-900">Ready to Receive Goods</h2>
                <p className="text-sm text-emerald-700 mt-0.5">
                  Vendor has acknowledged. Create a GRN when goods arrive at your warehouse.
                </p>
              </div>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={() => setLocation(grnUrl)}
            >
              <Package className="w-4 h-4" /> Create GRN
            </Button>
          </div>
          {/* Dispatch for Acknowledged state */}
          {!p.dispatchedAt && (
            <div className="border-t border-emerald-200 pt-3 flex items-center justify-between">
              <p className="text-sm text-emerald-700">Dispatch not yet recorded.</p>
              <Button size="sm" variant="outline" className="text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                onClick={() => setShowDispatchForm(!showDispatchForm)}>
                <Truck className="w-3.5 h-3.5" /> {showDispatchForm ? "Cancel" : "Record Dispatch"}
              </Button>
            </div>
          )}
          {p.dispatchedAt && (
            <div className="border-t border-emerald-200 pt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-emerald-700">Dispatched On</p><p className="font-medium">{new Date(p.dispatchedAt).toLocaleDateString("en-IN")}</p></div>
              <div><p className="text-xs text-emerald-700">Dispatch Ref</p><p className="font-medium">{p.vendorDispatchRef ?? "—"}</p></div>
              <div><p className="text-xs text-emerald-700">Tracking No.</p><p className="font-medium">{p.trackingNumber ?? "—"}</p></div>
              <div><p className="text-xs text-emerald-700">Expected Delivery</p><p className="font-medium">{p.expectedDeliveryDate ?? "—"}</p></div>
            </div>
          )}
          {showDispatchForm && !p.dispatchedAt && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white rounded-lg p-3">
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">Dispatch Ref</Label>
                <Input value={dispatchRef} onChange={e => setDispatchRef(e.target.value)} placeholder="Vendor ref" className="h-9" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">Tracking Number</Label>
                <Input value={trackingNum} onChange={e => setTrackingNum(e.target.value)} placeholder="AWB / LR" className="h-9" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">Expected Delivery</Label>
                <Input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} className="h-9" />
              </div>
              <div className="flex items-end">
                <Button className="bg-orange-500 hover:bg-orange-600 h-9 w-full" onClick={recordDispatch} disabled={dispatchMut.isPending}>
                  {dispatchMut.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PARTIALLY RECEIVED — More GRNs + Invoice */}
      {p.status === "PartiallyReceived" && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-orange-900">Partial Delivery in Progress</h2>
              <p className="text-sm text-orange-700 mt-0.5">
                Some items have been received. Record additional GRNs as remaining goods arrive, then raise an invoice.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2" onClick={() => setLocation(grnUrl)}>
              <Package className="w-4 h-4" /> Create GRN
            </Button>
            <Button variant="outline" className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-100" onClick={() => setLocation(invUrl)}>
              <FileText className="w-4 h-4" /> Create Invoice
            </Button>
          </div>
        </div>
      )}

      {/* FULLY RECEIVED — Invoice + Close */}
      {p.status === "FullyReceived" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-emerald-900">All Goods Received</h2>
              <p className="text-sm text-emerald-700 mt-0.5">
                Raise an invoice for payment, then close the PO once it is settled.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => setLocation(invUrl)}>
              <FileText className="w-4 h-4" /> Create Invoice
            </Button>
            <Button
              variant="outline" className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              onClick={() => setShowCloseConfirm(true)}
              disabled={updateMut.isPending}
            >
              <ClipboardCheck className="w-4 h-4" /> Close PO
            </Button>
          </div>
        </div>
      )}

      {/* CLOSED — read-only summary */}
      {p.status === "Closed" && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-center gap-3">
          <ClipboardCheck className="w-5 h-5 text-slate-500 shrink-0" />
          <p className="text-sm text-slate-600">
            This PO is <strong>closed</strong>
            {p.closedAt ? ` on ${new Date(p.closedAt).toLocaleDateString("en-IN")}` : ""}.
            All records are read-only.
          </p>
        </div>
      )}

      {/* CANCELLED */}
      {p.status === "Cancelled" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">This PO has been <strong>cancelled</strong>. No further actions can be taken.</p>
        </div>
      )}

      {/* ── PO Details ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-bold text-slate-900 mb-4">Purchase Order Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-slate-500">PO Date</p><p className="font-medium">{p.poDate ?? "—"}</p></div>
          <div>
            <p className="text-xs text-slate-500">Delivery Deadline</p>
            <p className={cn("font-medium", isOverdue ? "text-red-600 font-bold" : "")}>{deadline ?? "—"}</p>
          </div>
          <div><p className="text-xs text-slate-500">Payment Terms</p><p className="font-medium">{p.paymentTerms ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Warranty</p><p className="font-medium">{p.warrantyMonths ? `${p.warrantyMonths} months` : "—"}</p></div>
          {p.deliveryAddress && (
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Delivery Address</p>
              <p className="font-medium">{p.deliveryAddress}</p>
            </div>
          )}
          {p.vendorGstin && <div><p className="text-xs text-slate-500">Vendor GSTIN</p><p className="font-medium font-mono">{p.vendorGstin}</p></div>}
          {p.approvedByName && <div><p className="text-xs text-slate-500">Approved By</p><p className="font-medium">{p.approvedByName}</p></div>}
          {p.acknowledgedAt && <div><p className="text-xs text-slate-500">Acknowledged At</p><p className="font-medium">{new Date(p.acknowledgedAt).toLocaleDateString("en-IN")}</p></div>}
        </div>
        {p.specialTerms && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">Special Terms</p>
            <p className="text-sm text-slate-700 mt-1">{p.specialTerms}</p>
          </div>
        )}
        {p.internalNotes && (
          <div className="mt-3">
            <p className="text-xs text-slate-500">Internal Notes</p>
            <p className="text-sm text-slate-700 mt-1">{p.internalNotes}</p>
          </div>
        )}
      </div>

      {/* ── Line Items ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["#","Material","UOM","Qty","Unit Price","GST%","Line Total","Delivered"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(p.items ?? []).map((item: any) => {
                const pct = item.qty > 0 ? (Number(item.deliveredQty ?? 0) / Number(item.qty)) * 100 : 0;
                return (
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
                    <td className="px-4 py-3">
                      {item.deliveredQty != null ? (
                        <div>
                          <span className={cn("font-mono font-bold text-sm",
                            pct >= 100 ? "text-emerald-600" : pct > 0 ? "text-amber-600" : "text-slate-400"
                          )}>
                            {item.deliveredQty} / {item.qty}
                          </span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-amber-400")}
                              style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm text-slate-500">
                  <span className="text-xs">Subtotal {fmt(p.subtotal)} · GST {fmt(p.totalGst)} · Freight+Other {fmt((p.freightCharges ?? 0) + (p.otherCharges ?? 0))}</span>
                </td>
                <td colSpan={3} className="px-4 py-3 text-right">
                  <span className="text-xs font-bold text-slate-600 uppercase">Grand Total</span>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-slate-900 text-base">{fmt(p.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Goods Receipt Notes ─────────────────────────────────────────────── */}
      {!["Draft","Cancelled"].includes(p.status) && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Goods Receipt Notes</h2>
              <p className="text-xs text-slate-500 mt-0.5">{(p.grns ?? []).length} GRN{(p.grns ?? []).length !== 1 ? "s" : ""} against this PO</p>
            </div>
            {canCreateGRN && (
              <Button size="sm" className="text-xs gap-1.5 bg-orange-500 hover:bg-orange-600" onClick={() => setLocation(grnUrl)}>
                <Package className="w-3.5 h-3.5" /> New GRN
              </Button>
            )}
          </div>
          {(p.grns ?? []).length === 0 ? (
            <div className="flex flex-col items-center py-8 text-slate-400">
              <Package className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm font-medium">No GRNs recorded yet</p>
              {canCreateGRN && (
                <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs" onClick={() => setLocation(grnUrl)}>
                  <Package className="w-3.5 h-3.5" /> Create First GRN
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {p.grns.map((grn: any) => (
                <div key={grn.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer group"
                  onClick={() => setLocation(`/procurement/grns/${grn.id}`)}>
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="font-mono font-bold text-slate-900 text-sm">{grn.grnNumber}</p>
                      <p className="text-xs text-slate-500">{grn.deliveryDate ?? "No delivery date"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", GRN_STATUS_COLOR[grn.status] ?? "")}>{grn.status}</Badge>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Invoices ────────────────────────────────────────────────────────── */}
      {canCreateInvoice && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Invoices</h2>
              <p className="text-xs text-slate-500 mt-0.5">{(p.invoices ?? []).length} invoice{(p.invoices ?? []).length !== 1 ? "s" : ""} linked</p>
            </div>
            <Button size="sm" className="text-xs gap-1.5 bg-orange-500 hover:bg-orange-600" onClick={() => setLocation(invUrl)}>
              <FileText className="w-3.5 h-3.5" /> New Invoice
            </Button>
          </div>
          {(p.invoices ?? []).length === 0 ? (
            <div className="flex flex-col items-center py-8 text-slate-400">
              <FileText className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm font-medium">No invoices created yet</p>
              <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs" onClick={() => setLocation(invUrl)}>
                <FileText className="w-3.5 h-3.5" /> Create Invoice
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {p.invoices.map((inv: any) => (
                <div key={inv.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer group"
                  onClick={() => setLocation(`/procurement/invoices/${inv.id}`)}>
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="font-mono font-bold text-slate-900 text-sm">{inv.invoiceNumber}</p>
                      <p className="text-xs text-slate-500">₹{Number(inv.totalAmount ?? 0).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", INV_STATUS_COLOR[inv.status] ?? "")}>{inv.status}</Badge>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Audit Trail ─────────────────────────────────────────────────────── */}
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
                  <p className="text-sm font-medium text-slate-900">
                    {STATUS_CONFIG[log.action]?.label ?? log.action}
                    <span className="text-slate-500 font-normal"> by {log.performedByName}</span>
                  </p>
                  {log.remarks && <p className="text-sm text-slate-500 mt-0.5">{log.remarks}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Cancel warning */}
      <AlertDialog open={showCancelWarning} onOpenChange={setShowCancelWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">⚠️ Active Deliveries Detected</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>This PO has <strong>{(p.grns ?? []).length} GRN(s)</strong> with active delivery records. Cancelling it may cause reconciliation issues.</p>
                {(p.grns ?? []).length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-2">
                    <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Linked GRNs</p>
                    {(p.grns as any[]).map((g: any) => (
                      <div key={g.id} className="flex items-center justify-between text-sm">
                        <span className="font-mono font-semibold text-slate-800">{g.grnNumber}</span>
                        <span className="text-xs text-slate-500">{g.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p>Are you sure you want to cancel this PO?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep PO Active</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { setShowCancelWarning(false); if (pendingStatus) updateStatus(pendingStatus); }}
            >
              Cancel PO Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close PO confirmation */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Purchase Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing <strong>{p.poNumber}</strong> will mark it as complete. This is a final action — the PO will become read-only. Ensure all invoices are settled before closing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not Yet</AlertDialogCancel>
            <AlertDialogAction
              className="bg-slate-800 hover:bg-slate-900 text-white"
              onClick={() => { setShowCloseConfirm(false); updateStatus("Closed"); }}
            >
              Close PO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </motion.div>
  );
}
