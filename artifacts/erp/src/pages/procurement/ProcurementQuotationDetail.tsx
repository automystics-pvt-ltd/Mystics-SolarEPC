import { useState } from "react";
import {
  useGetProcurementQuotation, getGetProcurementQuotationQueryKey, getGetProcurementQuotationsQueryKey,
  useSubmitProcurementQuotation,
  useStartProcurementQuotationReview, useApproveProcurementQuotation,
  useRejectProcurementQuotation, useRequestProcurementQuotationRevision,
  useAddProcurementQuotationComment, useDeleteProcurementQuotation,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, XCircle, RotateCcw, Send, Eye, MessageSquare, BarChart2,
  Clock, FileText, AlertCircle, Star, ShoppingCart, History, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  Draft: { color: "bg-slate-100 text-slate-600 border-slate-200", label: "Draft" },
  Submitted: { color: "bg-blue-50 text-blue-700 border-blue-200", label: "Submitted" },
  UnderReview: { color: "bg-amber-50 text-amber-700 border-amber-200", label: "Under Review" },
  RevisionRequested: { color: "bg-orange-50 text-orange-700 border-orange-200", label: "Revision Requested" },
  Approved: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Approved" },
  Rejected: { color: "bg-red-50 text-red-700 border-red-200", label: "Rejected" },
};

const ACTION_ICONS: Record<string, any> = {
  Created: FileText, Submitted: Send, ReviewStarted: Eye, Approved: CheckCircle2,
  Rejected: XCircle, RevisionRequested: RotateCcw, Updated: Clock,
  CommentAdded: MessageSquare, Deleted: XCircle, POGenerated: ShoppingCart,
};

export default function ProcurementQuotationDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const qId = Number(id);
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");

  const { data: quotation, isLoading } = useGetProcurementQuotation(qId, { query: { enabled: !!qId, queryKey: getGetProcurementQuotationQueryKey(qId) } });

  const submitMut = useSubmitProcurementQuotation();
  const reviewMut = useStartProcurementQuotationReview();
  const approveMut = useApproveProcurementQuotation();
  const rejectMut = useRejectProcurementQuotation();
  const revisionMut = useRequestProcurementQuotationRevision();
  const commentMut = useAddProcurementQuotationComment();
  const deleteMut = useDeleteProcurementQuotation();

  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();
  const isApprover = ["admin", "approver"].includes(user.role);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetProcurementQuotationQueryKey(qId) });
    qc.invalidateQueries({ queryKey: getGetProcurementQuotationsQueryKey() });
  };

  const runAction = (action: string) => {
    if (["approve", "reject", "request-revision"].includes(action) && !remarks.trim()) {
      toast({ title: "Remarks required", description: "Please provide remarks to continue.", variant: "destructive" }); return;
    }
    const payload = { data: { userName: user.name, userId: user.id, userRole: user.role, remarks } };
    const handlers = {
      onSuccess: () => { invalidate(); setActionDialog(null); setRemarks(""); toast({ title: "Action completed" }); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message ?? "Unknown error", variant: "destructive" }),
    };
    if (action === "submit") submitMut.mutate({ id: qId, data: payload.data }, handlers);
    else if (action === "start-review") reviewMut.mutate({ id: qId, data: payload.data }, handlers);
    else if (action === "approve") approveMut.mutate({ id: qId, data: payload.data }, { ...handlers, onSuccess: () => { invalidate(); setActionDialog(null); setRemarks(""); toast({ title: "Quotation approved! PO auto-generated." }); } });
    else if (action === "reject") rejectMut.mutate({ id: qId, data: payload.data }, handlers);
    else if (action === "request-revision") revisionMut.mutate({ id: qId, data: payload.data }, handlers);
    else if (action === "comment") commentMut.mutate({ id: qId, data: payload.data }, handlers);
  };

  if (isLoading || !quotation) return (
    <div className="flex h-60 items-center justify-center"><div className="animate-pulse text-slate-400">Loading quotation…</div></div>
  );

  const q = quotation as any;
  const cfg = STATUS_CONFIG[q.status ?? "Draft"];
  const canEdit = ["Draft", "RevisionRequested"].includes(q.status ?? "");
  const canSubmit = q.status === "Draft";
  const canReview = isApprover && q.status === "Submitted";
  const canApprove = isApprover && q.status === "UnderReview";
  const canReject = isApprover && ["UnderReview", "Submitted"].includes(q.status ?? "");
  const canRequestRevision = isApprover && ["UnderReview", "Submitted"].includes(q.status ?? "");

  const fmt = (n: number | null | undefined) => n !== null && n !== undefined ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setLocation("/procurement/quotations")} className="h-9 w-9 shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-mono text-slate-900">{q.referenceId}</h1>
                <span className="text-slate-400">v{q.version}</span>
                <Badge variant="outline" className={cn("text-sm", cfg.color)}>{cfg.label}</Badge>
                {q.isL1 && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><Star className="w-3 h-3 mr-0.5" /> L1</Badge>}
                {q.poGenerated && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><ShoppingCart className="w-3 h-3 mr-0.5" /> PO Generated</Badge>}
              </div>
              <p className="text-sm text-slate-500 mt-1">{q.vendorSnapshotName ?? "No vendor"} · Created {new Date(q.createdAt).toLocaleDateString("en-IN")} by {q.createdByName}</p>
            </div>
          </div>
          {/* Action bar */}
          <div className="flex gap-2">
            {canEdit && <Button variant="outline" size="sm" onClick={() => setLocation(`/procurement/quotations/${qId}/edit`)}>Edit</Button>}
            {canSubmit && <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => { setActionDialog("submit"); }}><Send className="w-3.5 h-3.5" /> Submit</Button>}
            {canReview && <Button size="sm" variant="outline" onClick={() => { setActionDialog("start-review"); }}><Eye className="w-3.5 h-3.5 mr-1" /> Start Review</Button>}
            {canRequestRevision && <Button size="sm" variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => setActionDialog("request-revision")}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Request Revision</Button>}
            {canReject && <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setActionDialog("reject")}><XCircle className="w-3.5 h-3.5 mr-1" /> Reject</Button>}
            {canApprove && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={() => setActionDialog("approve")}><CheckCircle2 className="w-3.5 h-3.5" /> Approve & PO</Button>}
            {q.mrId && <Button size="sm" variant="outline" onClick={() => setLocation(`/procurement/material-requests/${q.mrId}/compare`)} title="Compare all vendor quotes for this MR"><BarChart2 className="w-3.5 h-3.5" /></Button>}
            <Button size="sm" variant="outline" onClick={() => setActionDialog("comment")}><MessageSquare className="w-3.5 h-3.5" /></Button>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-100">
          {[
            { label: "Quotation Date", value: q.quotationDate ?? "—" },
            { label: "Valid Till", value: q.validityDate ?? "—" },
            { label: "Payment Terms", value: q.paymentTerms ?? "—" },
            { label: "Delivery Lead", value: q.deliveryLeadDays ? `${q.deliveryLeadDays} days` : "—" },
            { label: "Warranty", value: q.warrantyMonths ? `${q.warrantyMonths} months` : "—" },
          ].map(f => (
            <div key={f.label}>
              <p className="text-xs text-slate-400">{f.label}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="items">
            <TabsList>
              <TabsTrigger value="items">Line Items ({q.items?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="notes">Notes & Remarks</TabsTrigger>
            </TabsList>

            {/* Line items */}
            <TabsContent value="items" className="mt-3">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>{["#", "Item / Description", "HSN", "Qty", "UoM", "Rate", "Disc%", "Taxable", "GST", "Total"].map(h => <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(q.items ?? []).map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{item.lineNo}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-900">{item.materialName}</p>
                          {item.brand && <p className="text-xs text-slate-400">{item.brand}</p>}
                          {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{item.hsnSacCode ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono">{item.qty}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{item.uom}</td>
                        <td className="px-3 py-2.5 font-mono">₹{Number(item.unitPrice ?? 0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2.5 text-slate-500">{Number(item.discountPct ?? 0)}%</td>
                        <td className="px-3 py-2.5 font-mono">₹{Number(item.taxableAmount ?? 0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2.5 text-xs">
                          <p className="font-medium">{Number(item.gstRate ?? 0)}%</p>
                          <p className="text-slate-400">₹{Number(item.totalGst ?? 0).toLocaleString("en-IN")}</p>
                        </td>
                        <td className="px-3 py-2.5 font-bold font-mono">₹{Number(item.lineTotal ?? 0).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                    {(q.items ?? []).length === 0 && <tr><td colSpan={10} className="text-center py-8 text-slate-400">No line items</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 ml-auto max-w-xs">
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Subtotal", value: fmt(q.subtotal) },
                    { label: "Discount", value: `- ${fmt(q.totalDiscount)}` },
                    { label: "GST", value: fmt(q.totalGst) },
                    { label: "Freight", value: fmt(q.freightCharges) },
                    { label: "Other Charges", value: fmt(q.otherCharges) },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-slate-600"><span>{r.label}</span><span className="font-mono">{r.value}</span></div>
                  ))}
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900 text-base">
                    <span>Total Amount</span><span className="font-mono">{fmt(q.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Notes */}
            <TabsContent value="notes" className="mt-3 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                {q.vendorRemarks && <div><p className="text-xs text-slate-400 font-semibold uppercase">Vendor Remarks</p><p className="text-sm text-slate-700 mt-1">{q.vendorRemarks}</p></div>}
                {q.internalNotes && <div><p className="text-xs text-slate-400 font-semibold uppercase">Internal Notes</p><p className="text-sm text-slate-700 mt-1">{q.internalNotes}</p></div>}
                {q.approvalRemarks && <div><p className="text-xs text-slate-400 font-semibold uppercase">Approval Remarks</p><p className="text-sm text-slate-700 mt-1">{q.approvalRemarks}</p></div>}
                {!q.vendorRemarks && !q.internalNotes && !q.approvalRemarks && <p className="text-sm text-slate-400">No remarks recorded</p>}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar: Timeline + Audit */}
        <div className="space-y-4">
          {/* Version history */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3"><History className="w-4 h-4" /> Version History</h3>
            <div className="space-y-2">
              {(q.versions ?? []).map((v: any) => (
                <div key={v.id} className="flex items-center gap-2 text-xs">
                  <span className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-mono font-bold">v{v.version}</span>
                  <div>
                    <p className="font-medium text-slate-700">{v.changeSummary ?? "Updated"}</p>
                    <p className="text-slate-400">{v.changedByName} · {new Date(v.createdAt ?? "").toLocaleDateString("en-IN")}</p>
                  </div>
                </div>
              ))}
              {(q.versions ?? []).length === 0 && <p className="text-xs text-slate-400">No version history</p>}
            </div>
          </div>

          {/* Audit log */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3"><Clock className="w-4 h-4" /> Audit Trail</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {(q.auditLogs ?? []).map((log: any) => {
                const Icon = ACTION_ICONS[log.action] ?? FileText;
                return (
                  <div key={log.id} className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700">{log.action}</p>
                      {log.remarks && <p className="text-xs text-slate-500 mt-0.5 truncate">{log.remarks}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{log.performedByName} · {new Date(log.createdAt).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                );
              })}
              {(q.auditLogs ?? []).length === 0 && <p className="text-xs text-slate-400">No audit logs</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setRemarks(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "submit" && "Submit for Review"}
              {actionDialog === "start-review" && "Start Review"}
              {actionDialog === "approve" && "Approve Quotation & Generate PO"}
              {actionDialog === "reject" && "Reject Quotation"}
              {actionDialog === "request-revision" && "Request Revision"}
              {actionDialog === "comment" && "Add Comment"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {["approve", "reject", "request-revision"].includes(actionDialog ?? "") && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">Remarks are mandatory for this action.</div>
            )}
            {actionDialog === "approve" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
                A Purchase Order will be automatically generated from this quotation upon approval.
              </div>
            )}
            <div>
              <Label>{["approve", "reject", "request-revision"].includes(actionDialog ?? "") ? "Remarks *" : "Remarks (optional)"}</Label>
              <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Enter your remarks…" className="mt-1" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setActionDialog(null); setRemarks(""); }}>Cancel</Button>
              <Button
                onClick={() => runAction(actionDialog!)}
                disabled={submitMut.isPending || reviewMut.isPending || approveMut.isPending || rejectMut.isPending || revisionMut.isPending || commentMut.isPending}
                className={cn(
                  actionDialog === "approve" && "bg-emerald-600 hover:bg-emerald-700",
                  actionDialog === "reject" && "bg-red-600 hover:bg-red-700",
                )}
              >
                {actionDialog === "approve" ? "Approve & Generate PO" : actionDialog === "reject" ? "Reject" : actionDialog === "request-revision" ? "Send Revision Request" : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
