import { useState, useEffect } from "react";
import {
  useGetProcInvoice, getGetProcInvoiceQueryKey, getGetProcInvoicesQueryKey,
  useSubmitProcInvoice, useApproveProcInvoice, useRejectProcInvoice,
  useMarkProcInvoicePaid, useApproveProcInvoiceMismatch,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2, XCircle, Send, AlertTriangle, CreditCard, Printer, Clock,
  Lock, MessageSquare, FileText, Activity, LayoutGrid, PauseCircle,
  Play, Flag, RefreshCw, Banknote, Plus, Trash2, Building2, ShieldAlert,
  Info,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { PageHeader, SectionCard, StatusBadge, DetailGrid, DetailRow } from "@/components/shared";
import { addRecentEntry } from "@/lib/recentHistory";
import { useAuth } from "@/lib/auth";
import { apiPost, apiDelete } from "@/lib/fetch";

const fmt = (n: number | null | undefined) =>
  n != null ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";

const LIFECYCLE_STEPS = ["Draft", "PendingApproval", "Approved", "Paid"];

function LifecycleBar({ status }: { status: string }) {
  const TERMINALS: Record<string, { label: string; color: string; icon: any }> = {
    Cancelled: { label: "Cancelled", color: "text-gray-500", icon: XCircle },
    Disputed: { label: "Disputed", color: "text-red-600", icon: ShieldAlert },
    Revised: { label: "Revised", color: "text-purple-600", icon: RefreshCw },
  };
  const special: Record<string, { label: string; step: number }> = {
    OnHold: { label: "On Hold", step: 1 },
    PartiallyPaid: { label: "Partially Paid", step: 3 },
  };
  const STEPS_DISPLAY = ["Draft", "Pending Approval", "Approved", "Paid"];

  if (TERMINALS[status]) {
    const t = TERMINALS[status];
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/30">
        <t.icon className={cn("w-4 h-4 shrink-0", t.color)} />
        <span className={cn("text-sm font-bold", t.color)}>Invoice {t.label}</span>
      </div>
    );
  }

  let currentStep = LIFECYCLE_STEPS.indexOf(status);
  if (status === "PartiallyPaid") currentStep = 2; // between Approved and Paid
  if (status === "OnHold") currentStep = 1;

  return (
    <div className="flex items-center gap-0 w-full">
      {STEPS_DISPLAY.map((step, idx) => {
        const isComplete = idx < currentStep;
        const isCurrent = idx === currentStep;
        const isOnHold = status === "OnHold" && idx === 1;
        const isPartial = status === "PartiallyPaid" && idx === 3;
        return (
          <div key={step} className="flex items-center flex-1 min-w-0">
            <div className={cn(
              "flex flex-col items-center shrink-0",
            )}>
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all",
                isComplete ? "bg-emerald-500 border-emerald-500 text-white" :
                isOnHold ? "bg-amber-500 border-amber-500 text-white" :
                isPartial ? "bg-blue-400 border-blue-400 text-white" :
                isCurrent ? "bg-primary border-primary text-primary-foreground" :
                "bg-muted border-border text-muted-foreground"
              )}>
                {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 isOnHold ? <PauseCircle className="w-3.5 h-3.5" /> :
                 isPartial ? <Banknote className="w-3.5 h-3.5" /> :
                 <span className="text-[10px] font-bold">{idx + 1}</span>}
              </div>
              <span className={cn(
                "text-[10px] mt-1 font-medium whitespace-nowrap",
                isComplete ? "text-emerald-600 dark:text-emerald-400" :
                isOnHold ? "text-amber-600" :
                isCurrent ? "text-primary" :
                "text-muted-foreground"
              )}>
                {isOnHold ? "On Hold" : isPartial ? "Part. Paid" : step}
              </span>
            </div>
            {idx < STEPS_DISPLAY.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-1 rounded transition-all",
                idx < currentStep ? "bg-emerald-500" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgingBadge({ agingDays, status }: { agingDays: number | null; status: string }) {
  if (agingDays === null || ["Paid", "Cancelled"].includes(status)) return null;
  if (agingDays > 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-2 py-0.5">
      <Clock className="w-3 h-3" /> {agingDays}d overdue
    </span>
  );
  const daysLeft = Math.abs(agingDays);
  if (daysLeft === 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5">
      <Clock className="w-3 h-3" /> Due today
    </span>
  );
  if (daysLeft <= 7) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
      Due in {daysLeft}d
    </span>
  );
  return null;
}

type TabId = "overview" | "match" | "payments" | "comments" | "activity";

export default function InvoiceDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invId = Number(id);
  const { user: authUser } = useAuth();
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();
  const isApprover = ["admin", "approver"].includes(user.role);

  const { data: invoice, isLoading } = useGetProcInvoice(invId, { query: { enabled: !!invId, queryKey: getGetProcInvoiceQueryKey(invId) } });

  useEffect(() => {
    if (invoice?.invoiceNumber && authUser?.id) addRecentEntry(authUser.id, `/procurement/invoices/${invId}`, (invoice as any).invoiceNumber, "Procurement Invoices");
  }, [(invoice as any)?.invoiceNumber, invId, authUser?.id]);

  const submitMut = useSubmitProcInvoice();
  const approveMut = useApproveProcInvoice();
  const rejectMut = useRejectProcInvoice();
  const paidMut = useMarkProcInvoicePaid();
  const mismatchMut = useApproveProcInvoiceMismatch();

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [utrNumber, setUtrNumber] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [localComments, setLocalComments] = useState<any[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetProcInvoiceQueryKey(invId) });
    qc.invalidateQueries({ queryKey: getGetProcInvoicesQueryKey() });
    qc.invalidateQueries({ queryKey: ["invoice-stats"] });
  };

  const resetDialog = () => { setActionDialog(null); setRemarks(""); setPaymentRef(""); setPaymentMode(""); setPaymentAmount(""); setUtrNumber(""); };

  const runExistingAction = (action: string) => {
    if (["approve", "reject", "approve-mismatch"].includes(action) && !remarks.trim()) {
      toast({ title: "Remarks required", variant: "destructive" }); return;
    }
    const payload = { id: invId, data: { userName: user.name, userId: user.id, remarks, paymentReference: paymentRef, paymentMode } as any };
    const handlers = {
      onSuccess: () => { invalidate(); resetDialog(); toast({ title: `Invoice ${action} successful` }); },
      onError: (e: any) => toast({ title: "Failed", description: e?.response?.data?.error ?? e?.message, variant: "destructive" }),
    };
    if (action === "submit") submitMut.mutate(payload, handlers);
    else if (action === "approve") approveMut.mutate(payload, handlers);
    else if (action === "reject") rejectMut.mutate(payload, handlers);
    else if (action === "mark-paid") paidMut.mutate(payload, handlers);
    else if (action === "approve-mismatch") mismatchMut.mutate(payload, handlers);
  };

  const runNewAction = async (endpoint: string, body: Record<string, any>) => {
    setIsWorking(true);
    try {
      await apiPost(`/proc-invoices/${invId}/${endpoint}`, { ...body, userName: user.name, userId: user.id });
      invalidate(); resetDialog();
      toast({ title: "Action completed successfully" });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally { setIsWorking(false); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const comment = await apiPost<any>(`/proc-invoices/${invId}/comments`, {
        userId: user.id, userName: user.name, userRole: user.role, body: newComment.trim(),
      });
      setLocalComments(prev => [...prev, comment]);
      setNewComment("");
      invalidate();
    } catch (e: any) {
      toast({ title: "Failed to add comment", description: e?.message, variant: "destructive" });
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await apiDelete(`/proc-invoices/${invId}/comments/${commentId}`);
      setLocalComments(prev => prev.filter(c => c.id !== commentId));
      invalidate();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  if (isLoading || !invoice) return (
    <div className="flex h-60 items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading invoice…</div>
    </div>
  );

  const inv = invoice as any;
  const allComments = [...(inv.comments ?? []), ...localComments].reduce<any[]>((acc, c) => acc.find((x: any) => x.id === c.id) ? acc : [...acc, c], []);
  const payments = inv.payments ?? [];

  const canSubmit = (inv.status === "Draft" || inv.status === "OnHold") && (inv.matchStatus !== "MismatchPending" || inv.mismatchApprovedAt);
  const canApproveMismatch = isApprover && inv.matchStatus === "MismatchPending" && !inv.mismatchApprovedAt;
  const canApprove = isApprover && inv.status === "PendingApproval";
  const canReject = isApprover && inv.status === "PendingApproval";
  const canPutOnHold = isApprover && ["Approved", "PartiallyPaid"].includes(inv.status);
  const canReleaseHold = isApprover && inv.status === "OnHold";
  const canDispute = isApprover && ["Approved", "PartiallyPaid", "PendingApproval"].includes(inv.status);
  const canResolveDispute = isApprover && inv.status === "Disputed";
  const canCancel = ["Draft", "PendingApproval", "OnHold", "Disputed"].includes(inv.status);
  const canRecordPayment = ["Approved", "PartiallyPaid"].includes(inv.status);
  const canMarkPaid = ["Approved", "PartiallyPaid"].includes(inv.status);
  const canCreateCreditNote = isApprover && ["Approved", "Paid", "PartiallyPaid"].includes(inv.status);

  const hasMobileActions = canSubmit || canApprove || canReject || canMarkPaid || canRecordPayment || canApproveMismatch || canReleaseHold || canResolveDispute;

  const paidPct = inv.netPayable > 0 ? Math.min(100, Math.round((inv.paidAmount ?? 0) / inv.netPayable * 100)) : 0;

  const TABS: { id: TabId; label: string; icon: any; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "match", label: "3-Way Match", icon: CheckCircle2 },
    { id: "payments", label: "Payments", icon: Banknote, badge: payments.length },
    { id: "comments", label: "Comments", icon: MessageSquare, badge: allComments.length },
    { id: "activity", label: "Activity", icon: Activity },
  ];

  const desktopActions = (
    <div className="hidden lg:flex gap-2 flex-wrap print:hidden">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}><Printer className="w-3.5 h-3.5" /> Print</Button>
      {canCreateCreditNote && <Button size="sm" variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => setActionDialog("credit-note")}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Credit Note</Button>}
      {canApproveMismatch && <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setActionDialog("approve-mismatch")}><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Approve Mismatch</Button>}
      {canResolveDispute && <Button size="sm" className="bg-purple-600 hover:bg-purple-700 gap-1.5" onClick={() => setActionDialog("resolve-dispute")}><Flag className="w-3.5 h-3.5" /> Resolve Dispute</Button>}
      {canReleaseHold && <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => setActionDialog("release-hold")}><Play className="w-3.5 h-3.5" /> Release Hold</Button>}
      {canSubmit && <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => setActionDialog("submit")}><Send className="w-3.5 h-3.5" /> Submit</Button>}
      {canApprove && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={() => setActionDialog("approve")}><CheckCircle2 className="w-3.5 h-3.5" /> Approve</Button>}
      {canReject && <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setActionDialog("reject")}><XCircle className="w-3.5 h-3.5 mr-1" /> Reject</Button>}
      {canDispute && <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setActionDialog("dispute")}><Flag className="w-3.5 h-3.5 mr-1" /> Dispute</Button>}
      {canPutOnHold && <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setActionDialog("put-on-hold")}><PauseCircle className="w-3.5 h-3.5 mr-1" /> Hold</Button>}
      {canRecordPayment && <Button size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setActionDialog("record-payment")}><Banknote className="w-3.5 h-3.5 mr-1" /> Record Payment</Button>}
      {canMarkPaid && <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1.5" onClick={() => setActionDialog("mark-paid")}><CreditCard className="w-3.5 h-3.5" /> Mark Fully Paid</Button>}
      {canCancel && <Button size="sm" variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-50" onClick={() => setActionDialog("cancel")}><XCircle className="w-3.5 h-3.5 mr-1" /> Cancel</Button>}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={cn("space-y-5", hasMobileActions ? "pb-28 lg:pb-10" : "pb-10")}>

      <PageHeader
        title={inv.invoiceNumber}
        subtitle={inv.vendorName}
        backHref="/procurement/invoices"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 lg:hidden print:hidden" onClick={() => window.print()}><Printer className="w-3.5 h-3.5" /></Button>
            {desktopActions}
          </div>
        }
      />

      {/* Status + lifecycle bar */}
      <div className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm space-y-4">
        {/* Status strip */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusBadge status={inv.status} />
          {inv.invoiceType !== "Standard" && (
            <span className={cn(
              "text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border",
              inv.invoiceType === "CreditNote" ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-orange-100 text-orange-700 border-orange-200"
            )}>{inv.invoiceType === "CreditNote" ? "Credit Note" : "Debit Note"}</span>
          )}
          {inv.isLocked && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              <Lock className="w-3 h-3" /> Locked
            </span>
          )}
          {inv.matchStatus === "Matched" && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> 3-Way Matched</span>
          )}
          {inv.matchStatus === "MismatchPending" && (
            <span className="flex items-center gap-1 text-[11px] text-red-600 font-bold"><AlertTriangle className="w-3.5 h-3.5" /> Mismatch Pending</span>
          )}
          {inv.isDuplicateFlagged && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" /> Duplicate Flagged
            </span>
          )}
          <AgingBadge agingDays={inv.agingDays} status={inv.status} />
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[12px] text-muted-foreground">PO <span className="font-mono font-semibold text-foreground">#{inv.poId}</span></span>
          {inv.grnId && <>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-[12px] text-muted-foreground">GRN <span className="font-mono font-semibold text-foreground">#{inv.grnId}</span></span>
          </>}
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[12px] text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString("en-IN")}</span>
        </div>
        {/* Lifecycle bar */}
        <LifecycleBar status={inv.status} />
        {/* Payment progress */}
        {["PartiallyPaid", "Approved"].includes(inv.status) && inv.paidAmount > 0 && (
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Payment progress</span>
              <span>{fmt(inv.paidAmount)} of {fmt(inv.netPayable)}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Alert banners */}
      {inv.matchStatus === "MismatchPending" && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">3-way mismatch requires sign-off before this invoice can proceed.</p>
            {inv.mismatchDetails && <p className="text-xs text-amber-700 mt-0.5">{inv.mismatchDetails}</p>}
          </div>
          {canApproveMismatch && (
            <Button size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => setActionDialog("approve-mismatch")}>Approve Mismatch</Button>
          )}
        </div>
      )}
      {inv.status === "Disputed" && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
            <p className="font-bold text-red-800 dark:text-red-400">Invoice is under Dispute</p>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300">Reason: {inv.disputeReason}</p>
          <p className="text-xs text-red-600 dark:text-red-400">Disputed by {inv.disputedByName} on {new Date(inv.disputedAt).toLocaleDateString("en-IN")}</p>
        </div>
      )}
      {inv.status === "OnHold" && inv.heldReason && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="font-bold text-amber-800">Invoice is On Hold</p>
          </div>
          <p className="text-sm text-amber-700">Reason: {inv.heldReason}</p>
          {inv.heldByName && <p className="text-xs text-amber-600">Held by {inv.heldByName} on {new Date(inv.heldAt).toLocaleDateString("en-IN")}</p>}
        </div>
      )}
      {inv.status === "Cancelled" && (
        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-gray-500 shrink-0" />
            <p className="font-bold text-gray-700 dark:text-gray-300">Invoice Cancelled</p>
          </div>
          {inv.cancellationReason && <p className="text-sm text-gray-600">Reason: {inv.cancellationReason}</p>}
          {inv.cancelledByName && <p className="text-xs text-gray-500">Cancelled by {inv.cancelledByName} on {new Date(inv.cancelledAt).toLocaleDateString("en-IN")}</p>}
        </div>
      )}
      {inv.isDuplicateFlagged && inv.duplicateOfId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Possible duplicate detected</p>
            <p className="text-xs text-amber-700 mt-0.5">This invoice shares the same vendor invoice number as invoice #{inv.duplicateOfId}. Please verify before proceeding.</p>
          </div>
        </div>
      )}

      {/* Financial summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: "Subtotal", value: fmt(inv.subtotal) },
          { label: "GST", value: fmt(inv.totalGst) },
          { label: "Freight + Other", value: fmt((inv.freightCharges ?? 0) + (inv.otherCharges ?? 0)) },
          { label: "Discount", value: inv.discountAmount ? `-${fmt(inv.discountAmount)}` : "—" },
          { label: "TDS", value: inv.tdsAmount ? `-${fmt(inv.tdsAmount)}` : "—" },
          { label: "Net Payable", value: fmt(inv.netPayable), bold: true, highlight: true },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl border border-border p-3 text-center", s.highlight ? "bg-foreground text-background" : "bg-card")}>
            <p className={cn("font-mono font-bold text-sm", s.bold ? "text-base" : "", s.highlight ? "text-background" : "text-foreground/90")}>{s.value}</p>
            <p className={cn("text-[10px] mt-0.5", s.highlight ? "text-background/60" : "text-muted-foreground")}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0",
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-primary/10 text-primary rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

          {/* ── Overview ───────────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <SectionCard title="Invoice Details">
                <DetailGrid cols={3}>
                  <DetailRow label="Invoice Type" value={inv.invoiceType ?? "Standard"} />
                  <DetailRow label="Vendor" value={inv.vendorName} />
                  <DetailRow label="Vendor Invoice No." value={inv.vendorInvoiceNumber} mono />
                  <DetailRow label="Vendor Invoice Date" value={inv.vendorInvoiceDate} />
                  <DetailRow label="PO Reference" value={`#${inv.poId}`} mono />
                  <DetailRow label="GRN Reference" value={inv.grnId ? `#${inv.grnId}` : undefined} mono />
                  {inv.originalInvoiceId && <DetailRow label="Original Invoice" value={`#${inv.originalInvoiceId}`} mono />}
                  {inv.linkedCreditNoteId && <DetailRow label="Credit Note" value={`#${inv.linkedCreditNoteId}`} mono />}
                  {inv.revisionNumber > 0 && <DetailRow label="Revision #" value={String(inv.revisionNumber)} />}
                </DetailGrid>
              </SectionCard>

              <SectionCard title="Payment Information">
                <DetailGrid cols={3}>
                  <DetailRow label="Payment Terms" value={inv.paymentTerms} />
                  {inv.paymentTermsDays && <DetailRow label="Terms (days)" value={String(inv.paymentTermsDays)} />}
                  <DetailRow label="Due Date" value={inv.dueDate} />
                  {inv.agingDays != null && (
                    <DetailRow
                      label="Aging"
                      value={inv.agingDays > 0 ? `${inv.agingDays} days overdue` : inv.agingDays === 0 ? "Due today" : `Due in ${Math.abs(inv.agingDays)} days`}
                    />
                  )}
                  <DetailRow label="Paid Amount" value={fmt(inv.paidAmount)} />
                  <DetailRow label="Balance Due" value={fmt(Math.max(0, (inv.netPayable ?? 0) - (inv.paidAmount ?? 0)))} />
                  {inv.paidAt && <DetailRow label="Fully Paid On" value={new Date(inv.paidAt).toLocaleDateString("en-IN")} />}
                  {inv.paymentReference && <DetailRow label="Payment Reference" value={inv.paymentReference} mono />}
                  {inv.paymentMode && <DetailRow label="Payment Mode" value={inv.paymentMode} />}
                </DetailGrid>
              </SectionCard>

              {(inv.bankName || inv.bankAccount) && (
                <SectionCard title="Bank Details">
                  <DetailGrid cols={3}>
                    <DetailRow label="Bank Name" value={inv.bankName} />
                    <DetailRow label="Account Number" value={inv.bankAccount} mono />
                    <DetailRow label="IFSC Code" value={inv.bankIfsc} mono />
                    <DetailRow label="Branch" value={inv.bankBranch} />
                  </DetailGrid>
                </SectionCard>
              )}

              <SectionCard title="Approval Chain">
                <DetailGrid cols={3}>
                  <DetailRow label="Created By" value={inv.createdByName} />
                  <DetailRow label="Created At" value={new Date(inv.createdAt).toLocaleString("en-IN")} />
                  {inv.submittedByName && <DetailRow label="Submitted By" value={inv.submittedByName} />}
                  {inv.submittedAt && <DetailRow label="Submitted At" value={new Date(inv.submittedAt).toLocaleString("en-IN")} />}
                  {inv.approvedByName && <DetailRow label="Approved By" value={inv.approvedByName} />}
                  {inv.approvedAt && <DetailRow label="Approved At" value={new Date(inv.approvedAt).toLocaleString("en-IN")} />}
                  {inv.approvalRemarks && <DetailRow label="Approval Remarks" value={inv.approvalRemarks} fullWidth />}
                  {inv.rejectedByName && <DetailRow label="Rejected By" value={inv.rejectedByName} />}
                </DetailGrid>
              </SectionCard>

              {inv.internalNotes && (
                <SectionCard title="Internal Notes">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{inv.internalNotes}</p>
                </SectionCard>
              )}
            </div>
          )}

          {/* ── 3-Way Match ──────────────────────────────────────────────────── */}
          {activeTab === "match" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3">
                  {inv.matchStatus === "Matched" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  {inv.matchStatus === "MismatchPending" && <AlertTriangle className="w-5 h-5 text-red-500" />}
                  {inv.matchStatus === "MismatchApproved" && <CheckCircle2 className="w-5 h-5 text-amber-500" />}
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {inv.matchStatus === "Matched" ? "All lines matched — PO → GRN → Invoice" :
                       inv.matchStatus === "MismatchPending" ? "Mismatch detected — sign-off required" :
                       "Mismatch approved by " + (inv.mismatchApprovedByName ?? "—")}
                    </p>
                    {inv.mismatchDetails && <p className="text-xs text-muted-foreground mt-0.5">{inv.mismatchDetails}</p>}
                  </div>
                </div>
                {canApproveMismatch && (
                  <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0" onClick={() => setActionDialog("approve-mismatch")}>
                    Approve Mismatch
                  </Button>
                )}
              </div>

              <SectionCard title="Line Items — 3-Way Match" noPadding>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead className="bg-muted/40 border-b border-border">
                      <tr>
                        {["#", "Material", "UOM", "PO Ordered", "GRN Accepted", "Invoiced", "Unit Price", "Disc%", "GST%", "Line Total", "Match"].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(inv.items ?? []).map((item: any) => (
                        <tr key={item.id} className={cn("hover:bg-muted/20", !item.isMatched && "bg-red-50 dark:bg-red-950/10")}>
                          <td className="px-4 py-3 text-muted-foreground">{item.lineNo}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground max-w-40 truncate">{item.materialName}</p>
                            {item.materialCode && <p className="text-[11px] text-muted-foreground font-mono">{item.materialCode}</p>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{item.uom}</td>
                          <td className="px-4 py-3 font-mono">{item.orderedQty}</td>
                          <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-400">{item.receivedQty || "—"}</td>
                          <td className="px-4 py-3 font-mono font-bold">{item.invoicedQty}</td>
                          <td className="px-4 py-3 font-mono">{fmt(item.unitPrice)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.discountPct > 0 ? `${item.discountPct}%` : "—"}</td>
                          <td className="px-4 py-3">{item.gstRate}%</td>
                          <td className="px-4 py-3 font-mono font-bold">{fmt(item.lineTotal)}</td>
                          <td className="px-4 py-3 text-center">
                            {item.isMatched
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                              : <span title={item.mismatchNote ?? ""}><AlertTriangle className="w-4 h-4 text-red-500 mx-auto" /></span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                {[
                  { label: "Total Lines", value: String(inv.items?.length ?? 0) },
                  { label: "Matched", value: String((inv.items ?? []).filter((i: any) => i.isMatched).length), color: "text-emerald-600" },
                  { label: "Mismatched", value: String((inv.items ?? []).filter((i: any) => !i.isMatched).length), color: "text-red-600" },
                  { label: "Total GST", value: fmt(inv.totalGst) },
                ].map(s => (
                  <div key={s.label} className="bg-card border border-border rounded-lg p-3">
                    <p className={cn("font-bold text-lg", s.color ?? "text-foreground")}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Payments ─────────────────────────────────────────────────────── */}
          {activeTab === "payments" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Net Payable", value: fmt(inv.netPayable), color: "text-foreground" },
                  { label: "Paid", value: fmt(inv.paidAmount), color: "text-emerald-600" },
                  { label: "Balance", value: fmt(Math.max(0, (inv.netPayable ?? 0) - (inv.paidAmount ?? 0))), color: inv.netPayable > inv.paidAmount ? "text-orange-600" : "text-emerald-600" },
                ].map(s => (
                  <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                    <p className={cn("text-xl font-bold font-mono", s.color)}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {canRecordPayment && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setActionDialog("record-payment")}>
                    <Plus className="w-3.5 h-3.5" /> Record Partial Payment
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => setActionDialog("mark-paid")}>
                    <CreditCard className="w-3.5 h-3.5" /> Mark Fully Paid
                  </Button>
                </div>
              )}

              {payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Banknote className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No payments recorded yet</p>
                </div>
              ) : (
                <SectionCard title="Payment History" noPadding>
                  <div className="divide-y divide-border">
                    {payments.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950/30 rounded-full flex items-center justify-center shrink-0">
                          <Banknote className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground">{fmt(p.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.paymentMode && <span>{p.paymentMode} · </span>}
                            {p.paymentReference && <span className="font-mono">{p.paymentReference} · </span>}
                            {p.utrNumber && <span className="font-mono">UTR: {p.utrNumber}</span>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{p.paidByName}</p>
                          <p className="text-xs text-muted-foreground">{p.paymentDate || new Date(p.createdAt).toLocaleDateString("en-IN")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {/* ── Comments ─────────────────────────────────────────────────────── */}
          {activeTab === "comments" && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment…" className="min-h-16" rows={2} />
                </div>
                <Button className="shrink-0 self-end gap-1.5" onClick={handleAddComment} disabled={!newComment.trim()}>
                  <Send className="w-3.5 h-3.5" /> Post
                </Button>
              </div>

              {allComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <MessageSquare className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No comments yet — start the conversation</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allComments.map((c: any) => (
                    <div key={c.id} className="flex gap-3 group">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-primary">
                        {(c.userName ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 bg-muted/30 rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">{c.userName}
                            {c.userRole && <span className="text-muted-foreground font-normal ml-1">({c.userRole})</span>}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">{new Date(c.createdAt).toLocaleString("en-IN")}</span>
                            {(c.userId === user.id || isApprover) && (
                              <button onClick={() => handleDeleteComment(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Activity ─────────────────────────────────────────────────────── */}
          {activeTab === "activity" && (
            <div className="space-y-1">
              {(inv.auditLogs ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Activity className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No activity recorded</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {(inv.auditLogs ?? []).map((log: any, idx: number) => {
                    const actionColors: Record<string, string> = {
                      Created: "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
                      Submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
                      Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30",
                      Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30",
                      Cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800",
                      Disputed: "bg-red-100 text-red-700 dark:bg-red-900/30",
                      MismatchApproved: "bg-amber-100 text-amber-700 dark:bg-amber-900/30",
                    };
                    const colorKey = Object.keys(actionColors).find(k => log.action.startsWith(k));
                    return (
                      <div key={log.id} className="flex gap-3 py-3 border-b border-border last:border-0">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold", colorKey ? actionColors[colorKey] : "bg-muted text-muted-foreground")}>
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">{log.action}</p>
                            <p className="text-[11px] text-muted-foreground/60 shrink-0">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">by {log.performedByName}</p>
                          {log.remarks && <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-2">{log.remarks}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Mobile sticky action bar ────────────────────────────────────────── */}
      {hasMobileActions && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 print:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}>
          <div className="mx-3 mb-2 bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
            <div className="flex divide-x divide-border overflow-x-auto">
              {canApproveMismatch && (
                <button type="button" onClick={() => setActionDialog("approve-mismatch")} className="flex-1 flex flex-col items-center gap-1.5 py-3.5 text-amber-600 hover:bg-amber-50 min-w-[72px]">
                  <AlertTriangle className="w-5 h-5" /><span className="text-[10px] font-bold">Mismatch</span>
                </button>
              )}
              {canSubmit && (
                <button type="button" onClick={() => setActionDialog("submit")} className="flex-1 flex flex-col items-center gap-1.5 py-3.5 text-blue-600 hover:bg-blue-50 min-w-[72px]">
                  <Send className="w-5 h-5" /><span className="text-[10px] font-bold">Submit</span>
                </button>
              )}
              {canReleaseHold && (
                <button type="button" onClick={() => setActionDialog("release-hold")} className="flex-1 flex flex-col items-center gap-1.5 py-3.5 text-amber-600 hover:bg-amber-50 min-w-[72px]">
                  <Play className="w-5 h-5" /><span className="text-[10px] font-bold">Release</span>
                </button>
              )}
              {canResolveDispute && (
                <button type="button" onClick={() => setActionDialog("resolve-dispute")} className="flex-1 flex flex-col items-center gap-1.5 py-3.5 text-purple-600 hover:bg-purple-50 min-w-[72px]">
                  <Flag className="w-5 h-5" /><span className="text-[10px] font-bold">Resolve</span>
                </button>
              )}
              {canApprove && (
                <button type="button" onClick={() => setActionDialog("approve")} className="flex-1 flex flex-col items-center gap-1.5 py-3.5 text-emerald-600 hover:bg-emerald-50 min-w-[72px]">
                  <CheckCircle2 className="w-5 h-5" /><span className="text-[10px] font-bold">Approve</span>
                </button>
              )}
              {canReject && (
                <button type="button" onClick={() => setActionDialog("reject")} className="flex-1 flex flex-col items-center gap-1.5 py-3.5 text-red-600 hover:bg-red-50 min-w-[72px]">
                  <XCircle className="w-5 h-5" /><span className="text-[10px] font-bold">Reject</span>
                </button>
              )}
              {canRecordPayment && (
                <button type="button" onClick={() => setActionDialog("record-payment")} className="flex-1 flex flex-col items-center gap-1.5 py-3.5 text-blue-600 hover:bg-blue-50 min-w-[72px]">
                  <Banknote className="w-5 h-5" /><span className="text-[10px] font-bold">Pay</span>
                </button>
              )}
              {canMarkPaid && (
                <button type="button" onClick={() => setActionDialog("mark-paid")} className="flex-1 flex flex-col items-center gap-1.5 py-3.5 text-green-600 hover:bg-green-50 min-w-[72px]">
                  <CreditCard className="w-5 h-5" /><span className="text-[10px] font-bold">Mark Paid</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Action Dialogs ──────────────────────────────────────────────────── */}
      <Dialog open={!!actionDialog && !["cancel"].includes(actionDialog ?? "")} onOpenChange={o => { if (!o) resetDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionDialog === "mark-paid" ? "Mark Invoice Fully Paid" :
               actionDialog === "approve-mismatch" ? "Approve 3-Way Match Mismatch" :
               actionDialog === "record-payment" ? "Record Payment" :
               actionDialog === "put-on-hold" ? "Put Invoice on Hold" :
               actionDialog === "release-hold" ? "Release Hold" :
               actionDialog === "dispute" ? "Raise Dispute" :
               actionDialog === "resolve-dispute" ? "Resolve Dispute" :
               actionDialog === "credit-note" ? "Create Credit Note" :
               actionDialog ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {actionDialog === "record-payment" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Amount (₹) *</Label>
                    <Input type="number" min="0" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder={String(Math.max(0, (inv.netPayable ?? 0) - (inv.paidAmount ?? 0)))} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Payment Date</Label>
                    <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-9" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Payment Mode</Label>
                    <Input value={paymentMode} onChange={e => setPaymentMode(e.target.value)} placeholder="NEFT / IMPS / Cheque…" className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Payment Reference</Label>
                    <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="UTR / Cheque no." className="h-9" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">UTR Number</Label>
                  <Input value={utrNumber} onChange={e => setUtrNumber(e.target.value)} placeholder="UTR number (for bank transfer)" className="h-9" />
                </div>
              </>
            )}
            {actionDialog === "mark-paid" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Payment Reference</Label>
                    <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="UTR / Cheque no." className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Payment Mode</Label>
                    <Input value={paymentMode} onChange={e => setPaymentMode(e.target.value)} placeholder="NEFT / IMPS / Cheque…" className="h-9" />
                  </div>
                </div>
              </>
            )}
            {actionDialog === "resolve-dispute" && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Resolve as</Label>
                <select className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="Approved">Approved — proceed with invoice</option>
                  <option value="Cancelled">Cancelled — cancel the invoice</option>
                </select>
              </div>
            )}
            {actionDialog === "credit-note" && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Credit Note Amount (₹) — leave blank for full invoice amount</Label>
                <Input type="number" min="0" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder={String(inv.netPayable)} className="h-9" />
              </div>
            )}
            <Textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder={
                actionDialog === "approve" ? "Approval remarks (required)…" :
                actionDialog === "reject" ? "Rejection reason (required)…" :
                actionDialog === "approve-mismatch" ? "Sign-off remarks (required)…" :
                actionDialog === "put-on-hold" ? "Reason for hold (required)…" :
                actionDialog === "dispute" ? "Dispute reason (required)…" :
                actionDialog === "resolve-dispute" ? "Resolution details (required)…" :
                actionDialog === "credit-note" ? "Reason for credit note (required)…" :
                "Remarks…"
              }
              className="min-h-20"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetDialog}>Cancel</Button>
              <Button
                disabled={isWorking}
                className={cn(
                  actionDialog === "approve" || actionDialog === "mark-paid" || actionDialog === "record-payment" ? "bg-emerald-600 hover:bg-emerald-700" :
                  actionDialog === "reject" || actionDialog === "dispute" ? "bg-red-600 hover:bg-red-700" :
                  actionDialog === "approve-mismatch" ? "bg-amber-500 hover:bg-amber-600" :
                  actionDialog === "resolve-dispute" ? "bg-purple-600 hover:bg-purple-700" :
                  actionDialog === "credit-note" ? "bg-purple-600 hover:bg-purple-700" :
                  "bg-blue-600 hover:bg-blue-700"
                )}
                onClick={() => {
                  if (!actionDialog) return;
                  if (["submit", "approve", "reject", "mark-paid", "approve-mismatch"].includes(actionDialog)) {
                    runExistingAction(actionDialog);
                  } else if (actionDialog === "put-on-hold") {
                    if (!remarks.trim()) { toast({ title: "Reason required", variant: "destructive" }); return; }
                    runNewAction("put-on-hold", { reason: remarks });
                  } else if (actionDialog === "release-hold") {
                    runNewAction("release-hold", { remarks });
                  } else if (actionDialog === "dispute") {
                    if (!remarks.trim()) { toast({ title: "Dispute reason required", variant: "destructive" }); return; }
                    runNewAction("dispute", { reason: remarks });
                  } else if (actionDialog === "resolve-dispute") {
                    if (!remarks.trim()) { toast({ title: "Resolution required", variant: "destructive" }); return; }
                    runNewAction("resolve-dispute", { resolution: remarks, resolveAs: paymentMode || "Approved" });
                  } else if (actionDialog === "record-payment") {
                    if (!paymentAmount || Number(paymentAmount) <= 0) { toast({ title: "Amount required", variant: "destructive" }); return; }
                    runNewAction("record-payment", { amount: Number(paymentAmount), paymentReference: paymentRef, paymentMode, paymentDate, utrNumber, notes: remarks });
                  } else if (actionDialog === "credit-note") {
                    if (!remarks.trim()) { toast({ title: "Reason required", variant: "destructive" }); return; }
                    runNewAction("create-credit-note", { reason: remarks, amount: paymentAmount ? Number(paymentAmount) : undefined });
                  }
                }}
              >
                {isWorking ? "Working…" : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel — AlertDialog for safety */}
      <AlertDialog open={actionDialog === "cancel"} onOpenChange={o => { if (!o) resetDialog(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700 dark:text-red-400">Cancel Invoice {inv.invoiceNumber}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The invoice will be permanently cancelled.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Cancellation reason (required)…" className="min-h-16" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetDialog}>Keep Invoice</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (!remarks.trim()) { toast({ title: "Cancellation reason required", variant: "destructive" }); return; }
                runNewAction("cancel", { reason: remarks });
              }}
            >Cancel Invoice</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel trigger on desktop — separate from the dialog open */}
      {canCancel && (
        <div className="hidden lg:flex justify-end pt-0">
          {/* Cancel is already in the header desktopActions — the button above triggers actionDialog="cancel" */}
        </div>
      )}
    </motion.div>
  );
}
