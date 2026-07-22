import { useState } from "react";
import {
  useGetProcInvoice, getGetProcInvoiceQueryKey, getGetProcInvoicesQueryKey,
  useSubmitProcInvoice, useApproveProcInvoice, useRejectProcInvoice,
  useMarkProcInvoicePaid, useApproveProcInvoiceMismatch,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, FileText, CheckCircle2, XCircle, Send, Clock, AlertTriangle, CreditCard, Printer } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Draft: { label: "Draft", color: "bg-slate-100 text-slate-600 border-slate-200" },
  PendingApproval: { label: "Pending Approval", color: "bg-purple-50 text-purple-700 border-purple-200" },
  Approved: { label: "Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  OnHold: { label: "On Hold", color: "bg-amber-50 text-amber-700 border-amber-200" },
  Paid: { label: "Paid", color: "bg-green-50 text-green-700 border-green-200" },
  Cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200" },
};

const fmt = (n: number | null | undefined) =>
  n != null ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";

export default function InvoiceDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invId = Number(id);
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();
  const isApprover = ["admin", "approver"].includes(user.role);

  const { data: invoice, isLoading } = useGetProcInvoice(invId, { query: { enabled: !!invId, queryKey: getGetProcInvoiceQueryKey(invId) } });
  const submitMut = useSubmitProcInvoice();
  const approveMut = useApproveProcInvoice();
  const rejectMut = useRejectProcInvoice();
  const paidMut = useMarkProcInvoicePaid();
  const mismatchMut = useApproveProcInvoiceMismatch();

  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentMode, setPaymentMode] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetProcInvoiceQueryKey(invId) });
    qc.invalidateQueries({ queryKey: getGetProcInvoicesQueryKey() });
  };

  const runAction = (action: string) => {
    if (["approve", "reject", "approve-mismatch"].includes(action) && !remarks.trim()) {
      toast({ title: "Remarks required", variant: "destructive" }); return;
    }
    const payload = { id: invId, data: { userName: user.name, userId: user.id, remarks, paymentReference: paymentRef, paymentMode } as any };
    const handlers = {
      onSuccess: () => { invalidate(); setActionDialog(null); setRemarks(""); setPaymentRef(""); setPaymentMode(""); toast({ title: `Invoice ${action} successful` }); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    };
    if (action === "submit") submitMut.mutate(payload, handlers);
    else if (action === "approve") approveMut.mutate(payload, handlers);
    else if (action === "reject") rejectMut.mutate(payload, handlers);
    else if (action === "mark-paid") paidMut.mutate(payload, handlers);
    else if (action === "approve-mismatch") mismatchMut.mutate(payload, handlers);
  };

  if (isLoading || !invoice) return (
    <div className="flex h-60 items-center justify-center"><div className="animate-pulse text-slate-400">Loading invoice…</div></div>
  );

  const inv = invoice as any;
  const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.Draft;
  const canSubmit = inv.status === "Draft" && (inv.matchStatus !== "MismatchPending" || inv.mismatchApprovedAt);
  const canApproveMismatch = isApprover && inv.matchStatus === "MismatchPending" && !inv.mismatchApprovedAt;
  const canApprove = isApprover && inv.status === "PendingApproval";
  const canReject = isApprover && inv.status === "PendingApproval";
  const canMarkPaid = inv.status === "Approved";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setLocation("/procurement/invoices")} className="h-9 w-9 shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold font-mono text-slate-900">{inv.invoiceNumber}</h1>
                <Badge variant="outline" className={cn("text-sm", cfg.color)}>{cfg.label}</Badge>
                {inv.matchStatus === "MismatchPending" && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1"><AlertTriangle className="w-3 h-3" /> Mismatch Pending</Badge>}
                {inv.matchStatus === "MismatchApproved" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Mismatch Approved</Badge>}
                {inv.matchStatus === "Matched" && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="w-3 h-3" /> 3-Way Matched</Badge>}
              </div>
              <p className="text-sm text-slate-500 mt-1">{inv.vendorName} · PO #{inv.poId}{inv.grnId ? ` · GRN #${inv.grnId}` : ""} · Created {new Date(inv.createdAt).toLocaleDateString("en-IN")} by {inv.createdByName}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5 print:hidden" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            {canApproveMismatch && (
              <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50 print:hidden" onClick={() => setActionDialog("approve-mismatch")}>
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Approve Mismatch
              </Button>
            )}
            {canSubmit && <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 print:hidden" onClick={() => setActionDialog("submit")}><Send className="w-3.5 h-3.5" /> Submit</Button>}
            {canApprove && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 print:hidden" onClick={() => setActionDialog("approve")}><CheckCircle2 className="w-3.5 h-3.5" /> Approve</Button>}
            {canReject && <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 print:hidden" onClick={() => setActionDialog("reject")}><XCircle className="w-3.5 h-3.5 mr-1" /> Reject</Button>}
            {canMarkPaid && <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1.5 print:hidden" onClick={() => setActionDialog("mark-paid")}><CreditCard className="w-3.5 h-3.5" /> Mark Paid</Button>}
          </div>
        </div>

        {/* Mismatch details */}
        {inv.matchStatus === "MismatchPending" && inv.mismatchDetails && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-bold text-red-800 mb-1">Mismatch Details</p>
            <p className="text-sm text-red-700">{inv.mismatchDetails}</p>
          </div>
        )}

        {/* Meta grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-100 text-sm">
          <div><p className="text-xs text-slate-500">Vendor Invoice No.</p><p className="font-medium">{inv.vendorInvoiceNumber ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Vendor Invoice Date</p><p className="font-medium">{inv.vendorInvoiceDate ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Payment Terms</p><p className="font-medium">{inv.paymentTerms ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Due Date</p><p className="font-medium">{inv.dueDate ?? "—"}</p></div>
          {inv.paidAt && <div><p className="text-xs text-slate-500">Paid On</p><p className="font-medium text-green-700">{new Date(inv.paidAt).toLocaleDateString("en-IN")}</p></div>}
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Subtotal", value: fmt(inv.subtotal) },
          { label: "GST", value: fmt(inv.totalGst) },
          { label: "Freight + Other", value: fmt((inv.freightCharges ?? 0) + (inv.otherCharges ?? 0)) },
          { label: "TDS Deduction", value: inv.tdsAmount ? `-${fmt(inv.tdsAmount)}` : "—" },
          { label: "Net Payable", value: fmt(inv.netPayable), bold: true },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={cn("font-mono font-bold", s.bold ? "text-xl text-slate-900" : "text-base text-slate-700")}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Line items */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">Line Items — 3-Way Match</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Material", "UOM", "PO Ordered", "GRN Accepted", "Invoiced", "Unit Price", "GST%", "Line Total", "Match"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(inv.items ?? []).map((item: any) => (
                <tr key={item.id} className={cn("hover:bg-slate-50", !item.isMatched && "bg-red-50")}>
                  <td className="px-4 py-3 font-medium text-slate-900 max-w-40 truncate">{item.materialName}</td>
                  <td className="px-4 py-3 text-slate-600">{item.uom}</td>
                  <td className="px-4 py-3 font-mono">{item.orderedQty}</td>
                  <td className="px-4 py-3 font-mono text-blue-700">{item.receivedQty || "—"}</td>
                  <td className="px-4 py-3 font-mono font-bold">{item.invoicedQty}</td>
                  <td className="px-4 py-3 font-mono">{fmt(item.unitPrice)}</td>
                  <td className="px-4 py-3">{item.gstRate}%</td>
                  <td className="px-4 py-3 font-mono font-bold">{fmt(item.lineTotal)}</td>
                  <td className="px-4 py-3 text-center">
                    {item.isMatched ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit log */}
      {(inv.auditLogs ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-bold text-slate-900 mb-4">Audit Trail</h2>
          <div className="space-y-3">
            {inv.auditLogs.map((log: any) => (
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

      {/* Action dialog */}
      <Dialog open={!!actionDialog} onOpenChange={o => { if (!o) { setActionDialog(null); setRemarks(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionDialog === "mark-paid" ? "Record Payment" : actionDialog === "approve-mismatch" ? "Approve Mismatch" : actionDialog}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {actionDialog === "mark-paid" && (
              <>
                <div><Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Payment Reference</Label>
                  <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="UTR / Cheque no." className="h-9" /></div>
                <div><Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Payment Mode</Label>
                  <Input value={paymentMode} onChange={e => setPaymentMode(e.target.value)} placeholder="NEFT / IMPS / Cheque…" className="h-9" /></div>
              </>
            )}
            <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder={`Remarks${["approve","reject","approve-mismatch"].includes(actionDialog ?? "") ? " (required)" : ""}…`} className="min-h-20" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setActionDialog(null); setRemarks(""); }}>Cancel</Button>
              <Button className={cn(
                actionDialog === "approve" || actionDialog === "mark-paid" ? "bg-emerald-600 hover:bg-emerald-700" :
                actionDialog === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"
              )} onClick={() => runAction(actionDialog ?? "")}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
