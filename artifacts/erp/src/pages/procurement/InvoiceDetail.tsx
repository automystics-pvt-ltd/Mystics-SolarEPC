import { useState, useEffect } from "react";
import {
  useGetProcInvoice, getGetProcInvoiceQueryKey, getGetProcInvoicesQueryKey,
  useSubmitProcInvoice, useApproveProcInvoice, useRejectProcInvoice,
  useMarkProcInvoicePaid, useApproveProcInvoiceMismatch,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Send, AlertTriangle, CreditCard, Printer, Clock, PauseCircle, FolderOpen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { PageHeader, SectionCard, StatusBadge, DetailGrid, DetailRow } from "@/components/shared";
import { addRecentEntry } from "@/lib/recentHistory";
import { PrintPreviewModal } from "@/components/print/PrintPreviewModal";
import { InvoicePrint } from "@/components/print/documents/InvoicePrint";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";

const fmt = (n: number | null | undefined) =>
  n != null ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";

export default function InvoiceDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invId = Number(id);
  const { user: authUser } = useAuth();
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();
  const { canApprove: isApprover, canEdit } = usePermissions("procurement");

  const { data: invoice, isPending, isError } = useGetProcInvoice(invId, { query: { enabled: !!invId, queryKey: getGetProcInvoiceQueryKey(invId) } });

  useEffect(() => {
    if (invoice?.invoiceNumber && authUser?.id) addRecentEntry(authUser.id, `/procurement/invoices/${invId}`, invoice.invoiceNumber, "Procurement Invoices");
  }, [invoice?.invoiceNumber, invId, authUser?.id]);

  const submitMut = useSubmitProcInvoice();
  const approveMut = useApproveProcInvoice();
  const rejectMut = useRejectProcInvoice();
  const paidMut = useMarkProcInvoicePaid();
  const mismatchMut = useApproveProcInvoiceMismatch();

  const [showPrint, setShowPrint] = useState(false);
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

  if (isPending) return (
    <div className="flex h-60 items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading invoice…</div></div>
  );
  if (isError || !invoice) return (
    <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
      Failed to load invoice. Please go back and try again.
    </div>
  );

  const inv = invoice as any;
  const canSubmit = canEdit && inv.status === "Draft" && (inv.matchStatus !== "MismatchPending" || inv.mismatchApprovedAt);
  const canApproveMismatch = isApprover && inv.matchStatus === "MismatchPending" && !inv.mismatchApprovedAt;
  const canApprove = isApprover && inv.status === "PendingApproval";
  const canReject = isApprover && inv.status === "PendingApproval";
  const canMarkPaid = isApprover && inv.status === "Approved";
  const hasMobileActions = canSubmit || canApprove || canReject || canMarkPaid;

  const desktopActions = (
    <div className="hidden lg:flex gap-2 flex-wrap print:hidden">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPrint(true)}>
        <Printer className="w-3.5 h-3.5" /> Preview &amp; Print
      </Button>
      {canApproveMismatch && (
        <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setActionDialog("approve-mismatch")}>
          <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Approve Mismatch
        </Button>
      )}
      {canSubmit && <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => setActionDialog("submit")}><Send className="w-3.5 h-3.5" /> Submit</Button>}
      {canApprove && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={() => setActionDialog("approve")}><CheckCircle2 className="w-3.5 h-3.5" /> Approve</Button>}
      {canReject && <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setActionDialog("reject")}><XCircle className="w-3.5 h-3.5 mr-1" /> Reject</Button>}
      {canMarkPaid && <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1.5" onClick={() => setActionDialog("mark-paid")}><CreditCard className="w-3.5 h-3.5" /> Mark Paid</Button>}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={cn("space-y-6", hasMobileActions ? "pb-28 lg:pb-10" : "pb-10")}
    >
      <PageHeader
        title={inv.invoiceNumber}
        subtitle={inv.vendorName}
        backHref="/procurement/invoices"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 lg:hidden print:hidden" onClick={() => setShowPrint(true)}>
              <Printer className="w-3.5 h-3.5" />
            </Button>
            {desktopActions}
          </div>
        }
      />

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 rounded-xl border border-border bg-card shadow-sm">
        <StatusBadge status={inv.status} />
        {inv.matchStatus === "MismatchPending" && (
          <StatusBadge status="MismatchFlagged" />
        )}
        {inv.matchStatus === "Matched" && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> 3-Way Matched</span>
        )}
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[12px] text-muted-foreground">Invoice <span className="font-mono font-semibold text-foreground">{inv.invoiceNumber}</span></span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[12px] text-muted-foreground">PO <button className="font-mono font-semibold text-primary hover:underline" onClick={() => setLocation(`/procurement/pos/${inv.poId}`)}>#{inv.poId}</button></span>
        {inv.quotationId && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-[12px] text-muted-foreground">Quotation <button className="font-mono font-semibold text-primary hover:underline" onClick={() => setLocation(`/procurement/quotations/${inv.quotationId}`)}>{inv.quotationRef ?? `#${inv.quotationId}`}</button></span>
          </>
        )}
        {inv.grnId && <>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[12px] text-muted-foreground">GRN <button className="font-mono font-semibold text-primary hover:underline" onClick={() => setLocation(`/procurement/grns/${inv.grnId}`)}>#{inv.grnId}</button></span>
        </>}
        {inv.projectId && <>
          <span className="text-muted-foreground/40">·</span>
          <button className="flex items-center gap-1 text-[12px] text-emerald-700 font-semibold hover:underline" onClick={() => setLocation(`/projects/${inv.projectId}`)}>
            <FolderOpen className="w-3 h-3" />PRJ-{String(inv.projectId).padStart(4, "0")}
          </button>
        </>}
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[12px] text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString("en-IN")}</span>
      </div>

      {/* Mismatch details */}
      {inv.matchStatus === "MismatchPending" && inv.mismatchDetails && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg p-3">
          <p className="text-sm font-bold text-red-800 dark:text-red-400 mb-1">Mismatch Details</p>
          <p className="text-sm text-red-700 dark:text-red-300">{inv.mismatchDetails}</p>
        </div>
      )}

      {/* Mismatch approve banner — visible on mobile too */}
      {canApproveMismatch && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">3-way mismatch requires sign-off before this invoice can proceed.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => setActionDialog("approve-mismatch")}
          >
            Approve Mismatch
          </Button>
        </div>
      )}

      {/* Financial summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Subtotal", value: fmt(inv.subtotal) },
          { label: "GST", value: fmt(inv.totalGst) },
          { label: "Freight + Other", value: fmt((inv.freightCharges ?? 0) + (inv.otherCharges ?? 0)) },
          { label: "TDS Deduction", value: inv.tdsAmount ? `-${fmt(inv.tdsAmount)}` : "—" },
          { label: "Net Payable", value: fmt(inv.netPayable), bold: true },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={cn("font-mono font-bold", s.bold ? "text-xl text-foreground" : "text-base text-foreground/80")}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Invoice Details */}
      <SectionCard title="Invoice Details">
        <DetailGrid cols={3}>
          <DetailRow label="Vendor" value={inv.vendorName} />
          <DetailRow label="PO Reference" value={`#${inv.poId}`} mono />
          <DetailRow label="GRN Reference" value={inv.grnId ? `#${inv.grnId}` : undefined} mono />
          {inv.projectId && <DetailRow label="Project" value={`PRJ-${String(inv.projectId).padStart(4, "0")}`} mono />}
          <DetailRow label="Vendor Invoice No." value={inv.vendorInvoiceNumber} mono />
          <DetailRow label="Vendor Invoice Date" value={inv.vendorInvoiceDate} />
          <DetailRow label="Payment Terms" value={inv.paymentTerms} />
          <DetailRow label="Due Date" value={inv.dueDate} />
          <DetailRow label="Total Amount" value={fmt(inv.subtotal)} />
          {inv.paidAt && <DetailRow label="Paid On" value={new Date(inv.paidAt).toLocaleDateString("en-IN")} />}
        </DetailGrid>
      </SectionCard>

      {/* 3-Way Match — Line Items */}
      <SectionCard title="Line Items — 3-Way Match" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {["Material", "UOM", "PO Ordered", "GRN Accepted", "Invoiced", "Unit Price", "GST%", "Line Total", "Match"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(inv.items ?? []).map((item: any) => (
                <tr key={item.id} className={cn("hover:bg-muted/20", !item.isMatched && "bg-red-50 dark:bg-red-950/20")}>
                  <td className="px-4 py-3 font-medium text-foreground max-w-40 truncate">{item.materialName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.uom}</td>
                  <td className="px-4 py-3 font-mono">{item.orderedQty}</td>
                  <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-400">{item.receivedQty || "—"}</td>
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
      </SectionCard>

      {/* Audit Trail */}
      {(inv.auditLogs ?? []).length > 0 && (
        <SectionCard title="Audit Trail">
          <div className="space-y-3">
            {inv.auditLogs.map((log: any) => (
              <div key={log.id} className="flex gap-3">
                <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{log.action} <span className="text-muted-foreground font-normal">by {log.performedByName}</span></p>
                  {log.remarks && <p className="text-sm text-muted-foreground mt-0.5">{log.remarks}</p>}
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Mobile sticky action bar (thumb zone) ───────────────────────────── */}
      {hasMobileActions && (
        <div
          className="lg:hidden fixed bottom-16 left-0 right-0 z-30 print:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
        >
          <div className="mx-3 mb-2 bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
            {/* Main actions */}
            <div className="flex divide-x divide-border">
              {canSubmit && (
                <button
                  type="button"
                  onClick={() => setActionDialog("submit")}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                >
                  <Send className="w-6 h-6" />
                  <span className="text-[11px] font-bold">Submit</span>
                </button>
              )}
              {canApprove && (
                <button
                  type="button"
                  onClick={() => setActionDialog("approve")}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
                >
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="text-[11px] font-bold">Approve</span>
                </button>
              )}
              {canReject && (
                <button
                  type="button"
                  onClick={() => setActionDialog("reject")}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                  <span className="text-[11px] font-bold">Reject</span>
                </button>
              )}
              {canMarkPaid && (
                <button
                  type="button"
                  onClick={() => setActionDialog("mark-paid")}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 text-green-600 hover:bg-green-50 active:bg-green-100 transition-colors"
                >
                  <CreditCard className="w-6 h-6" />
                  <span className="text-[11px] font-bold">Mark Paid</span>
                </button>
              )}
            </div>
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
                <div><Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Payment Reference</Label>
                  <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="UTR / Cheque no." className="h-9" /></div>
                <div><Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Payment Mode</Label>
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
      <PrintPreviewModal
        open={showPrint}
        onClose={() => setShowPrint(false)}
        title={inv.invoiceNumber}
        subtitle={`${inv.vendorName ?? ""} · Vendor Invoice`}
      >
        <InvoicePrint invoice={inv} />
      </PrintPreviewModal>
    </motion.div>
  );
}
