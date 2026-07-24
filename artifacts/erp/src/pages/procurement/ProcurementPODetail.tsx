import { useState, useEffect } from "react";
import {
  useGetProcurementPO, useRecordProcurementPODispatch,
  getGetProcurementPOQueryKey, getGetProcurementPOsQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ShoppingCart, ExternalLink, Package, FileText,
  AlertTriangle, Truck, Clock, CheckCircle2, Printer, ChevronRight,
  ClipboardCheck, XCircle, Send, Eye, Lock, Unlock, PauseCircle,
  PlayCircle, RotateCcw, MessageSquare, History, CreditCard,
  ThumbsUp, ThumbsDown, AlertCircle, User, Paperclip, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { StatusBadge, DetailRow, DetailGrid, SectionCard, PageHeader } from "@/components/shared";
import { addRecentEntry } from "@/lib/recentHistory";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import { apiPost, apiPatch } from "@/lib/fetch";

function formatDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(d));
  } catch { return d; }
}

function formatDateTime(d?: string | null) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
  } catch { return d; }
}

function relativeTime(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const LIFECYCLE_STEPS = [
  { key: "Draft",             label: "Draft",            icon: ShoppingCart },
  { key: "Submitted",         label: "Submitted",        icon: Send },
  { key: "Approved",          label: "Approved",         icon: ThumbsUp },
  { key: "Issued",            label: "Issued",           icon: Send },
  { key: "Acknowledged",      label: "Acknowledged",     icon: CheckCircle2 },
  { key: "PartiallyReceived", label: "Partially Received", icon: Package },
  { key: "FullyReceived",     label: "Fully Received",   icon: Package },
  { key: "InvoiceMatched",    label: "Invoice Matched",  icon: FileText },
  { key: "PaymentPending",    label: "Payment Pending",  icon: CreditCard },
  { key: "Paid",              label: "Paid",             icon: CreditCard },
  { key: "Closed",            label: "Closed",           icon: ClipboardCheck },
];

const LIFECYCLE_ORDER = LIFECYCLE_STEPS.map(s => s.key);
const SIDE_STATES = ["Rejected", "OnHold", "Cancelled", "Revised"];

function getLifecycleState(stepKey: string, status: string): "done" | "active" | "pending" {
  if (SIDE_STATES.includes(status)) {
    if (stepKey === "Draft") return "done";
    return "pending";
  }
  const current = LIFECYCLE_ORDER.indexOf(status);
  const step = LIFECYCLE_ORDER.indexOf(stepKey);
  if (current < 0) return "pending";
  if (step < current) return "done";
  if (step === current) return "active";
  return "pending";
}

const SLA_CONFIG: Record<string, { color: string; label: string }> = {
  OnTrack: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "SLA: On Track" },
  DueSoon: { color: "bg-amber-50 text-amber-700 border-amber-200",       label: "SLA: Due Soon" },
  Breached:{ color: "bg-red-50 text-red-700 border-red-200",             label: "SLA: Breached"  },
};

const PAYMENT_CONFIG: Record<string, { color: string; label: string }> = {
  Outstanding:   { color: "bg-red-50 text-red-700 border-red-200",         label: "Payment Outstanding" },
  PartiallyPaid: { color: "bg-amber-50 text-amber-700 border-amber-200",   label: "Partially Paid" },
  FullyPaid:     { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Fully Paid" },
};

export default function ProcurementPODetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const poId = Number(id);
  const { user: authUser } = useAuth();
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();

  // Form states
  const [dispatchRef, setDispatchRef]             = useState("");
  const [trackingNum, setTrackingNum]             = useState("");
  const [expectedDelivery, setExpectedDelivery]   = useState("");
  const [showDispatchForm, setShowDispatchForm]   = useState(false);
  const [issueDeadline, setIssueDeadline]         = useState("");
  const [issueAddress, setIssueAddress]           = useState("");
  const [issueTerms, setIssueTerms]               = useState("");
  const [issueError, setIssueError]               = useState("");

  // Dialog states
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm]   = useState(false);
  const [actionDialog, setActionDialog]           = useState<string | null>(null);
  const [actionRemarks, setActionRemarks]         = useState("");
  const [commentBody, setCommentBody]             = useState("");

  const { data: po, isLoading } = useGetProcurementPO(poId, {
    query: { enabled: !!poId, queryKey: getGetProcurementPOQueryKey(poId), refetchInterval: 30_000 },
  });

  useEffect(() => {
    if (po?.poNumber && authUser?.id) addRecentEntry(authUser.id, `/procurement/pos/${poId}`, po.poNumber, "Purchase Orders");
  }, [po?.poNumber, poId, authUser?.id]);

  const dispatchMut = useRecordProcurementPODispatch();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetProcurementPOQueryKey(poId) });
    qc.invalidateQueries({ queryKey: getGetProcurementPOsQueryKey() });
  };

  /* ── Action mutations — all hooks must be declared before any conditional return ── */
  const makeMut = (path: string, successMsg: string) =>
    useMutation({
      mutationFn: (body: any) => apiPost<any>(`/procurement-pos/${poId}/${path}`, body),
      onSuccess: () => { invalidate(); setActionDialog(null); setActionRemarks(""); toast({ title: successMsg }); },
      onError: (e: any) => {
        const msg = e?.data?.error ?? e?.message ?? "An error occurred";
        toast({ title: "Action failed", description: msg, variant: "destructive" });
      },
    });

  const submitMut  = makeMut("submit",      "PO submitted for approval");
  const reviseMut  = makeMut("revise",      "PO opened for revision");
  const cancelMut  = makeMut("cancel",      "PO cancelled");
  const holdMut    = makeMut("hold",        "PO placed on hold");
  const unholdMut  = makeMut("unhold",      "PO resumed from hold");
  const issueMut   = makeMut("issue",       "PO issued to vendor ✓");
  const ackMut     = makeMut("acknowledge", "PO marked as acknowledged ✓");
  const closeMut   = makeMut("close",       "PO closed ✓");

  // Approve/Reject MUST go through the Approval Workbench which enforces
  // step-level canAct gating. The approval request ID is passed at call time.
  const approveMut = useMutation({
    mutationFn: ({ approvalRequestId, comment }: { approvalRequestId: number; comment?: string }) =>
      apiPatch<any>(`/approvals/${approvalRequestId}/approve`, { comment }),
    onSuccess: () => { invalidate(); setActionDialog(null); setActionRemarks(""); toast({ title: "PO approved ✓" }); },
    onError: (e: any) => {
      const msg = e?.data?.error ?? e?.message ?? "An error occurred";
      toast({ title: "Approval failed", description: msg, variant: "destructive" });
    },
  });
  const rejectMut = useMutation({
    mutationFn: ({ approvalRequestId, comment }: { approvalRequestId: number; comment: string }) =>
      apiPatch<any>(`/approvals/${approvalRequestId}/reject`, { comment }),
    onSuccess: () => { invalidate(); setActionDialog(null); setActionRemarks(""); toast({ title: "PO rejected" }); },
    onError: (e: any) => {
      const msg = e?.data?.error ?? e?.message ?? "An error occurred";
      toast({ title: "Rejection failed", description: msg, variant: "destructive" });
    },
  });

  const commentMut = useMutation({
    mutationFn: (body: string) => apiPost<any>(`/procurement-pos/${poId}/comments`, { body }),
    onSuccess: () => { invalidate(); setCommentBody(""); toast({ title: "Comment added" }); },
    onError: (e: any) => toast({ title: "Failed", description: e?.data?.error ?? e?.message, variant: "destructive" }),
  });

  // usePermissions MUST be called here, before any early return, to satisfy React's Rules of Hooks
  const { canApprove: rbacCanApprove, canEdit: rbacCanEdit } = usePermissions("procurement");

  if (isLoading || !po) return (
    <div className="flex h-60 items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading PO…</div>
    </div>
  );

  const p = po as any;
  const fmt = (n: number | null | undefined) =>
    n !== null && n !== undefined ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";
  const deadline = p.deliveryDeadline ?? p.expectedDeliveryDate;
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = p.isOverdue || (deadline && deadline < today && !["Closed", "Cancelled", "FullyReceived"].includes(p.status));
  const daysOverdue = deadline ? Math.floor((Date.now() - new Date(deadline).getTime()) / 86400000) : 0;

  const isLocked       = p.isLocked === true;
  const isApprover     = rbacCanApprove;
  const isManager      = rbacCanEdit;
  const canSubmit      = rbacCanEdit && ["Draft", "Revised"].includes(p.status) && !isLocked;
  const canApprove     = isApprover && ["Submitted", "PendingApproval"].includes(p.status);
  const canIssue       = rbacCanEdit && p.status === "Approved" && isLocked;
  const canCancel      = rbacCanEdit && !["Closed", "Cancelled"].includes(p.status);
  const canHold        = isManager && !["Closed", "Cancelled", "OnHold"].includes(p.status);
  const canUnhold      = rbacCanEdit && p.status === "OnHold";
  const canRevise      = rbacCanEdit && p.status === "Rejected";
  const canCreateGRN   = rbacCanEdit && ["Issued", "Acknowledged", "PartiallyReceived"].includes(p.status);
  const canCreateInvoice = rbacCanEdit && ["PartiallyReceived", "FullyReceived", "Closed"].includes(p.status);

  const grnUrl = `/procurement/grns/new?poId=${p.id}`;
  const invUrl = `/procurement/invoices/new?poId=${p.id}`;

  const handleActionConfirm = () => {
    if (!actionDialog) return;
    const approvalReqId: number | undefined = p.approvalRequest?.id;

    if (actionDialog === "submit") {
      submitMut.mutate({});
    } else if (actionDialog === "approve") {
      // Route through Approval Workbench which enforces step-level canAct gating
      if (!approvalReqId) { toast({ title: "No approval request found", variant: "destructive" }); return; }
      approveMut.mutate({ approvalRequestId: approvalReqId, comment: actionRemarks || undefined });
    } else if (actionDialog === "reject") {
      if (!actionRemarks.trim()) { toast({ title: "Rejection reason is required", variant: "destructive" }); return; }
      if (!approvalReqId) { toast({ title: "No approval request found", variant: "destructive" }); return; }
      rejectMut.mutate({ approvalRequestId: approvalReqId, comment: actionRemarks });
    } else if (actionDialog === "revise") {
      reviseMut.mutate({ remarks: actionRemarks || undefined });
    } else if (actionDialog === "cancel") {
      cancelMut.mutate({ reason: actionRemarks || undefined });
    } else if (actionDialog === "hold") {
      holdMut.mutate({ reason: actionRemarks });
    } else if (actionDialog === "unhold") {
      unholdMut.mutate({});
    }
  };

  const requiresReason = ["reject", "hold", "cancel"].includes(actionDialog ?? "");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="space-y-5 pb-12">

      {/* ── Quotation source chip ──────────────────────────────────────────────── */}
      {p.quotationId && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs print:hidden">
          <ExternalLink className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span className="text-blue-700">Auto-generated from</span>
          <button className="font-semibold text-blue-800 underline underline-offset-2 hover:text-blue-900"
            onClick={() => setLocation(`/procurement/quotations/${p.quotationId}`)}>
            Vendor Quotation #{p.quotationId}
          </button>
        </div>
      )}

      {p.projectId && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs print:hidden">
          <FolderOpen className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span className="text-emerald-700">Linked to Project</span>
          <button
            className="font-mono font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
            onClick={() => setLocation(`/projects/${p.projectId}`)}>
            PRJ-{String(p.projectId).padStart(4, "0")}
          </button>
          <ChevronRight className="h-3 w-3 text-emerald-500/60" />
          <button
            onClick={() => setLocation(`/projects/${p.projectId}`)}
            className="text-emerald-700 hover:text-emerald-900 font-medium">
            Open Project →
          </button>
        </div>
      )}

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title={p.poNumber}
        subtitle={`${p.vendorName ?? ""}${p.createdByName ? ` · Created by ${p.createdByName}` : ""}${p.revisionNumber > 1 ? ` · Rev ${p.revisionNumber}` : ""}`}
        actions={
          <div className="flex items-center gap-2 print:hidden flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setLocation("/procurement/pos")} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            {canHold && (
              <Button variant="outline" size="sm" className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={() => { setActionDialog("hold"); setActionRemarks(""); }}>
                <PauseCircle className="w-3.5 h-3.5" /> Hold
              </Button>
            )}
            {canUnhold && (
              <Button variant="outline" size="sm" className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                onClick={() => unholdMut.mutate({ previousStatus: "Approved" })}>
                <PlayCircle className="w-3.5 h-3.5" /> Resume
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" size="sm" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { if ((p.grns ?? []).length > 0) setShowCancelWarning(true); else { setActionDialog("cancel"); setActionRemarks(""); } }}>
                <XCircle className="w-3.5 h-3.5" /> Cancel PO
              </Button>
            )}
          </div>
        }
      />

      {/* ── Status + Metadata Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center flex-wrap gap-2 px-5 py-3 rounded-xl border bg-card">
        <StatusBadge status={p.status ?? "Draft"} size="md" />
        {isLocked && (
          <span className="inline-flex items-center gap-1 rounded-md border text-[11px] px-2 py-1 font-semibold bg-slate-50 text-slate-600 border-slate-200">
            <Lock className="w-3 h-3" /> Locked
          </span>
        )}
        {p.slaStatus && (
          <span className={cn("inline-flex items-center rounded-md border text-[11px] px-2 py-1 font-semibold", SLA_CONFIG[p.slaStatus]?.color)}>
            <Clock className="w-3 h-3 mr-1" />{SLA_CONFIG[p.slaStatus]?.label ?? p.slaStatus}
          </span>
        )}
        {p.paymentStatus && (
          <span className={cn("inline-flex items-center rounded-md border text-[11px] px-2 py-1 font-semibold", PAYMENT_CONFIG[p.paymentStatus]?.color)}>
            <CreditCard className="w-3 h-3 mr-1" />{PAYMENT_CONFIG[p.paymentStatus]?.label ?? p.paymentStatus}
          </span>
        )}
        {isOverdue && <span className="inline-flex items-center rounded-md border text-[11px] px-2 py-1 font-bold uppercase tracking-wide bg-red-50 text-red-700 border-red-200">⚠ Overdue</span>}
        <div className="h-4 w-px bg-border/60" />
        <span className="text-[12px] text-muted-foreground">PO Date:</span>
        <span className="text-[12px] text-foreground">{formatDate(p.poDate)}</span>
        <div className="h-4 w-px bg-border/60" />
        <span className="text-[12px] text-muted-foreground">Vendor:</span>
        <span className="text-[12px] font-semibold text-foreground">{p.vendorName ?? "—"}</span>
        {isOverdue && (
          <>
            <div className="h-4 w-px bg-border/60" />
            <span className="text-[12px] font-semibold text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Overdue by {daysOverdue}d
            </span>
          </>
        )}
      </div>

      {/* ── Rejection Banner ───────────────────────────────────────────────────── */}
      {p.status === "Rejected" && p.rejectionReason && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-800 text-sm">PO Rejected by {p.rejectedByName ?? "Approver"}</p>
            <p className="text-sm text-red-700 mt-1">"{p.rejectionReason}"</p>
            {canRevise && (
              <Button size="sm" className="mt-3 gap-2 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => { setActionDialog("revise"); setActionRemarks(""); }}>
                <RotateCcw className="w-3.5 h-3.5" /> Revise & Resubmit
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── On Hold Banner ─────────────────────────────────────────────────────── */}
      {p.status === "OnHold" && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <PauseCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 text-sm">PO On Hold</p>
            {p.onHoldReason && <p className="text-sm text-amber-700 mt-1">"{p.onHoldReason}"</p>}
            {canUnhold && (
              <Button size="sm" variant="outline" className="mt-3 gap-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => unholdMut.mutate({ previousStatus: "Approved" })}>
                <PlayCircle className="w-3.5 h-3.5" /> Resume PO
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Full Lifecycle Status Bar ──────────────────────────────────────────── */}
      <SectionCard title="PO Lifecycle">
        <div className="overflow-x-auto pb-2">
          <div className="flex items-start min-w-max gap-0">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const state = getLifecycleState(step.key, p.status);
              const Icon = step.icon;
              const isLast = idx === LIFECYCLE_STEPS.length - 1;
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[72px]">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all",
                      state === "done"   ? "bg-orange-500 border-orange-500 text-white" :
                      state === "active" ? "bg-white border-orange-400 text-orange-500 ring-2 ring-orange-100" :
                                          "bg-muted border-border text-muted-foreground"
                    )}>
                      {state === "done" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3 h-3" />}
                    </div>
                    <p className={cn("text-[9px] font-medium text-center mt-1 leading-tight max-w-[64px]",
                      state === "done"   ? "text-orange-600" :
                      state === "active" ? "text-foreground font-bold" : "text-muted-foreground"
                    )}>{step.label}</p>
                  </div>
                  {!isLast && (
                    <div className={cn("h-0.5 w-5 mb-5 shrink-0 transition-colors",
                      state === "done" ? "bg-orange-300" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
            {/* Side states */}
            {SIDE_STATES.includes(p.status) && (
              <div className="ml-4 pl-4 border-l border-border flex flex-col items-center min-w-[72px]">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center border-2",
                  p.status === "Cancelled" ? "bg-red-500 border-red-500 text-white" :
                  p.status === "Rejected"  ? "bg-red-400 border-red-400 text-white" :
                  p.status === "OnHold"    ? "bg-amber-400 border-amber-400 text-white" :
                                             "bg-slate-400 border-slate-400 text-white"
                )}>
                  {p.status === "Cancelled" ? <XCircle className="w-3.5 h-3.5" /> :
                   p.status === "Rejected"  ? <ThumbsDown className="w-3 h-3" /> :
                   p.status === "OnHold"    ? <PauseCircle className="w-3 h-3" /> :
                                              <RotateCcw className="w-3 h-3" />}
                </div>
                <p className="text-[9px] font-bold text-center mt-1">{p.status}</p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Contextual Action Panel ─────────────────────────────────────────── */}

      {/* DRAFT / REVISED — Submit for Approval */}
      {canSubmit && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                <Send className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-blue-900">Submit for Approval</h2>
                <p className="text-sm text-blue-700 mt-0.5">
                  Once submitted, an approval request will be created and sent to your procurement approvers.
                  {p.revisionNumber > 1 && <span className="ml-1 font-semibold">(Revision {p.revisionNumber})</span>}
                </p>
              </div>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              onClick={() => { setActionDialog("submit"); setActionRemarks(""); }}
              disabled={submitMut.isPending}>
              <Send className="w-4 h-4" />
              {submitMut.isPending ? "Submitting…" : "Submit for Approval"}
            </Button>
          </div>
        </div>
      )}

      {/* SUBMITTED/PENDING APPROVAL — Approval Chain */}
      {["Submitted", "PendingApproval"].includes(p.status) && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-purple-900">Awaiting Approval</h2>
              <p className="text-sm text-purple-700 mt-0.5">
                Submitted {formatDateTime(p.submittedAt)} by {p.submittedByName ?? "—"}.
                {p.slaDeadline && <span className="ml-1">Approval due by {formatDateTime(p.slaDeadline)}.</span>}
              </p>
            </div>
          </div>
          {/* Approval Steps */}
          {p.approvalRequest?.steps?.length > 0 && (
            <div className="border-t border-purple-200 pt-4">
              <p className="text-xs font-bold text-purple-800 uppercase tracking-wide mb-3">Approval Chain</p>
              <div className="space-y-2">
                {p.approvalRequest.steps.map((step: any) => (
                  <div key={step.id} className="flex items-center gap-3 bg-white rounded-lg p-2.5 border border-purple-100">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                      step.status === "approved" ? "bg-emerald-100 text-emerald-600" :
                      step.status === "rejected" ? "bg-red-100 text-red-600" :
                                                   "bg-purple-100 text-purple-500"
                    )}>
                      {step.status === "approved" ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                       step.status === "rejected" ? <XCircle className="w-3.5 h-3.5" /> :
                                                    <Clock className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{step.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {step.approverRole ? `Role: ${step.approverRole}` : ""}{step.actedByName ? ` · ${step.actedByName}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px]",
                      step.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      step.status === "rejected" ? "bg-red-50 text-red-700 border-red-200" :
                                                   "bg-purple-50 text-purple-700 border-purple-200"
                    )}>{step.status}</Badge>
                    {step.actedAt && <p className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(step.actedAt)}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Approver Actions */}
          {canApprove && (
            <div className="border-t border-purple-200 pt-4 flex gap-3">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                onClick={() => { setActionDialog("approve"); setActionRemarks(""); }}>
                <ThumbsUp className="w-4 h-4" /> Approve PO
              </Button>
              <Button variant="outline" className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => { setActionDialog("reject"); setActionRemarks(""); }}>
                <ThumbsDown className="w-4 h-4" /> Reject
              </Button>
            </div>
          )}
        </div>
      )}

      {/* APPROVED — Issue to Vendor */}
      {canIssue && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
              <Send className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-emerald-900 flex items-center gap-2">
                PO Approved — Ready to Issue
                <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              </h2>
              <p className="text-sm text-emerald-700 mt-0.5">Approved by {p.approvedByName}. Set the delivery deadline and issue to the vendor.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <Label className="text-xs font-semibold text-emerald-800 mb-1.5 block">Delivery Deadline <span className="text-red-500">*</span></Label>
              <Input type="date" value={issueDeadline} min={today}
                onChange={e => { setIssueDeadline(e.target.value); setIssueError(""); }}
                className={cn("h-9 bg-white", issueError && "border-red-400")} />
              {issueError && <p className="text-xs text-red-600 mt-1">{issueError}</p>}
            </div>
            <div>
              <Label className="text-xs font-semibold text-emerald-800 mb-1.5 block">Delivery Address</Label>
              <Input value={issueAddress} onChange={e => setIssueAddress(e.target.value)} placeholder="Site / warehouse…" className="h-9 bg-white" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-emerald-800 mb-1.5 block">Special Terms</Label>
              <Input value={issueTerms} onChange={e => setIssueTerms(e.target.value)} placeholder="e.g. Deliver in working hours" className="h-9 bg-white" />
            </div>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            onClick={() => {
              if (!issueDeadline) { setIssueError("Delivery deadline is required"); return; }
              issueMut.mutate({ deliveryDeadline: issueDeadline, deliveryAddress: issueAddress || undefined, specialTerms: issueTerms || undefined });
            }}
            disabled={issueMut.isPending}>
            <Send className="w-4 h-4" /> {issueMut.isPending ? "Issuing…" : "Issue PO to Vendor"}
          </Button>
        </div>
      )}

      {/* ISSUED — Awaiting Acknowledgement */}
      {p.status === "Issued" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-amber-900">Awaiting Vendor Acknowledgement</h2>
                <p className="text-sm text-amber-700 mt-0.5">The PO has been issued. Once the vendor confirms receipt, mark it acknowledged.</p>
              </div>
            </div>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              onClick={() => ackMut.mutate({})}
              disabled={ackMut.isPending}>
              <CheckCircle2 className="w-4 h-4" /> Mark Acknowledged
            </Button>
          </div>
          <DispatchSection p={p} showDispatchForm={showDispatchForm} setShowDispatchForm={setShowDispatchForm}
            dispatchRef={dispatchRef} setDispatchRef={setDispatchRef}
            trackingNum={trackingNum} setTrackingNum={setTrackingNum}
            expectedDelivery={expectedDelivery} setExpectedDelivery={setExpectedDelivery}
            dispatchMut={dispatchMut} poId={poId} user={user} invalidate={invalidate} toast={toast}
            colorClass="amber" />
        </div>
      )}

      {/* ACKNOWLEDGED */}
      {p.status === "Acknowledged" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-emerald-900">Ready to Receive Goods</h2>
                <p className="text-sm text-emerald-700 mt-0.5">Vendor acknowledged. Create a GRN when goods arrive.</p>
              </div>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => setLocation(grnUrl)}>
              <Package className="w-4 h-4" /> Create GRN
            </Button>
          </div>
        </div>
      )}

      {/* PARTIALLY RECEIVED */}
      {p.status === "PartiallyReceived" && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-orange-900">Partial Delivery in Progress</h2>
              <p className="text-sm text-orange-700 mt-0.5">Record additional GRNs as goods arrive, then raise an invoice.</p>
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

      {/* FULLY RECEIVED */}
      {p.status === "FullyReceived" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-emerald-900">All Goods Received</h2>
              <p className="text-sm text-emerald-700 mt-0.5">Raise an invoice for payment, then close the PO once settled.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => setLocation(invUrl)}>
              <FileText className="w-4 h-4" /> Create Invoice
            </Button>
            <Button variant="outline" className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              onClick={() => setShowCloseConfirm(true)} disabled={closeMut.isPending}>
              <ClipboardCheck className="w-4 h-4" /> Close PO
            </Button>
          </div>
        </div>
      )}

      {/* CLOSED */}
      {p.status === "Closed" && (
        <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center gap-3">
          <ClipboardCheck className="w-5 h-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            This PO is <strong className="text-foreground">closed</strong>
            {p.closedAt ? ` on ${new Date(p.closedAt).toLocaleDateString("en-IN")}` : ""}. All records are read-only.
          </p>
        </div>
      )}

      {/* CANCELLED */}
      {p.status === "Cancelled" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">This PO has been <strong>cancelled</strong>. No further actions can be taken.</p>
        </div>
      )}

      {/* ── Detail Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 rounded-xl bg-muted">
          <TabsTrigger value="details" className="text-xs">Order Details</TabsTrigger>
          <TabsTrigger value="items" className="text-xs">Line Items ({(p.items ?? []).length})</TabsTrigger>
          <TabsTrigger value="grns" className="text-xs">GRNs ({(p.grns ?? []).length})</TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs">Invoices ({(p.invoices ?? []).length})</TabsTrigger>
          <TabsTrigger value="comments" className="text-xs">
            Comments {(p.comments ?? []).length > 0 ? `(${p.comments.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="versions" className="text-xs">
            Versions {(p.versions ?? []).length > 0 ? `(${p.versions.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
        </TabsList>

        {/* ── DETAILS ──────────────────────────────────────────────────────────── */}
        <TabsContent value="details" className="space-y-4">
          <SectionCard title="Order Details">
            <DetailGrid cols={4}>
              <DetailRow label="Vendor" value={p.vendorName} />
              <DetailRow label="Status" value={<StatusBadge status={p.status ?? "Draft"} />} />
              <DetailRow label="PO Date" value={formatDate(p.poDate)} />
              <DetailRow label="Delivery Deadline" value={deadline ? (
                <span className={cn(isOverdue && "text-red-600 font-bold")}>{formatDate(deadline)}</span>
              ) : undefined} />
              <DetailRow label="Total Amount" value={fmt(p.totalAmount)} mono />
              <DetailRow label="Payment Terms" value={p.paymentTerms} />
              <DetailRow label="Warranty" value={p.warrantyMonths ? `${p.warrantyMonths} months` : undefined} />
              {p.vendorGstin && <DetailRow label="Vendor GSTIN" value={p.vendorGstin} mono />}
              {p.approvedByName && <DetailRow label="Approved By" value={`${p.approvedByName}${p.approvedAt ? ` · ${formatDate(p.approvedAt)}` : ""}`} />}
              {p.acknowledgedAt && <DetailRow label="Acknowledged" value={formatDate(p.acknowledgedAt)} />}
              {p.revisionNumber > 1 && <DetailRow label="Revision" value={`Rev ${p.revisionNumber}`} />}
              {p.createdByName && <DetailRow label="Created By" value={p.createdByName} />}
              {p.deliveryAddress && <DetailRow label="Delivery Address" value={p.deliveryAddress} colSpan={2} />}
            </DetailGrid>
            {(p.specialTerms || p.internalNotes) && (
              <div className="mt-5 pt-5 border-t border-border/60 space-y-3">
                {p.specialTerms && <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Special Terms</p><p className="text-sm">{p.specialTerms}</p></div>}
                {p.internalNotes && <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Internal Notes</p><p className="text-sm">{p.internalNotes}</p></div>}
              </div>
            )}
          </SectionCard>

          {/* Financials */}
          <SectionCard title="Financial Summary">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Subtotal",         value: fmt(p.subtotal) },
                { label: "GST",              value: fmt(p.totalGst) },
                { label: "Freight + Other",  value: fmt((p.freightCharges ?? 0) + (p.otherCharges ?? 0)) },
                { label: "Grand Total",      value: fmt(p.totalAmount), highlight: true },
              ].map(s => (
                <div key={s.label} className={cn("rounded-lg p-3 border", s.highlight ? "bg-orange-50 border-orange-200" : "bg-muted/30 border-border")}>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <p className={cn("font-mono font-bold mt-1", s.highlight ? "text-orange-700 text-lg" : "text-foreground")}>{s.value}</p>
                </div>
              ))}
            </div>
            {p.paymentStatus && (
              <div className={cn("mt-3 flex items-center gap-2 p-3 rounded-lg border", PAYMENT_CONFIG[p.paymentStatus]?.color)}>
                <CreditCard className="w-4 h-4" />
                <span className="text-sm font-semibold">{PAYMENT_CONFIG[p.paymentStatus]?.label ?? p.paymentStatus}</span>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── LINE ITEMS ────────────────────────────────────────────────────────── */}
        <TabsContent value="items">
          <SectionCard title="Line Items" noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    {["#", "Material", "UOM", "Qty", "Unit Price", "GST%", "Line Total", "Delivered"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(p.items ?? []).map((item: any) => {
                    const pct = item.qty > 0 ? (Number(item.deliveredQty ?? 0) / Number(item.qty)) * 100 : 0;
                    return (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground text-[12px]">{item.lineNo}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{item.materialName}</p>
                          {item.materialCode && <p className="text-[11px] text-muted-foreground">{item.materialCode}</p>}
                          {item.brand && <p className="text-[11px] text-muted-foreground">{item.brand}</p>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.uom}</td>
                        <td className="px-4 py-3 font-mono">{item.qty}</td>
                        <td className="px-4 py-3 font-mono">{fmt(item.unitPrice)}</td>
                        <td className="px-4 py-3">{item.gstRate}%</td>
                        <td className="px-4 py-3 font-mono font-bold">{fmt(item.lineTotal)}</td>
                        <td className="px-4 py-3">
                          {item.deliveredQty != null ? (
                            <div>
                              <span className={cn("font-mono font-bold text-sm",
                                pct >= 100 ? "text-emerald-600" : pct > 0 ? "text-amber-600" : "text-muted-foreground"
                              )}>{item.deliveredQty} / {item.qty}</span>
                              <div className="w-16 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                <div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-amber-400")}
                                  style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── GRNS ─────────────────────────────────────────────────────────────── */}
        <TabsContent value="grns">
          <SectionCard title="Goods Receipt Notes" subtitle={`${(p.grns ?? []).length} GRN(s)`} noPadding
            actions={canCreateGRN ? (
              <Button size="sm" className="text-xs gap-1.5 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setLocation(grnUrl)}>
                <Package className="w-3.5 h-3.5" /> New GRN
              </Button>
            ) : undefined}>
            {(p.grns ?? []).length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Package className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">No GRNs recorded yet</p>
                {canCreateGRN && (
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs" onClick={() => setLocation(grnUrl)}>
                    <Package className="w-3.5 h-3.5" /> Create First GRN
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {p.grns.map((grn: any) => (
                  <div key={grn.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 cursor-pointer group"
                    onClick={() => setLocation(`/procurement/grns/${grn.id}`)}>
                    <div className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-mono font-bold text-foreground text-sm">{grn.grnNumber}</p>
                        <p className="text-xs text-muted-foreground">{grn.deliveryDate ?? "No delivery date"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={grn.status} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-orange-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── INVOICES ──────────────────────────────────────────────────────────── */}
        <TabsContent value="invoices">
          <SectionCard title="Invoices" subtitle={`${(p.invoices ?? []).length} invoice(s)`} noPadding
            actions={canCreateInvoice ? (
              <Button size="sm" className="text-xs gap-1.5 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setLocation(invUrl)}>
                <FileText className="w-3.5 h-3.5" /> New Invoice
              </Button>
            ) : undefined}>
            {(p.invoices ?? []).length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">No invoices created yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {p.invoices.map((inv: any) => (
                  <div key={inv.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 cursor-pointer group"
                    onClick={() => setLocation(`/procurement/invoices/${inv.id}`)}>
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-mono font-bold text-foreground text-sm">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">₹{Number(inv.totalAmount ?? 0).toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={inv.status} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-orange-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── COMMENTS ──────────────────────────────────────────────────────────── */}
        <TabsContent value="comments">
          <SectionCard title="Comments" subtitle="Team discussion and notes">
            <div className="space-y-4">
              {(p.comments ?? []).length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm font-medium">No comments yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {p.comments.map((c: any) => (
                    <div key={c.id} className={cn("flex gap-3", c.parentId && "ml-8 border-l-2 border-border pl-3")}>
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-[11px] font-bold text-muted-foreground uppercase">
                        {(c.userName ?? "?")[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-foreground">{c.userName ?? "Unknown"}</span>
                          <span className="text-[11px] text-muted-foreground">{relativeTime(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-foreground bg-muted/30 rounded-lg px-3 py-2">{c.body}</p>
                        {c.attachmentUrl && (
                          <a href={c.attachmentUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline">
                            <Paperclip className="w-3 h-3" /> {c.attachmentName ?? "Attachment"}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Add Comment */}
              <div className="border-t border-border/60 pt-4 flex gap-3">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-[11px] font-bold text-muted-foreground uppercase">
                  {(user.name ?? "?")[0]}
                </div>
                <div className="flex-1 space-y-2">
                  <Textarea value={commentBody} onChange={e => setCommentBody(e.target.value)}
                    placeholder="Add a comment, note, or question…" rows={2} className="text-sm resize-none" />
                  <Button size="sm" className="gap-2" onClick={() => commentMut.mutate(commentBody)}
                    disabled={!commentBody.trim() || commentMut.isPending}>
                    <MessageSquare className="w-3.5 h-3.5" />
                    {commentMut.isPending ? "Posting…" : "Post Comment"}
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── VERSIONS ──────────────────────────────────────────────────────────── */}
        <TabsContent value="versions">
          <VersionHistoryTab versions={p.versions ?? []} />
        </TabsContent>

        {/* ── ACTIVITY ──────────────────────────────────────────────────────────── */}
        <TabsContent value="activity">
          <SectionCard title="Activity Log">
            {(p.auditLogs ?? []).length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {p.auditLogs.map((log: any, idx: number) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      {idx < p.auditLogs.length - 1 && <div className="w-px flex-1 bg-border/60 mt-1" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">
                        {log.action}
                        <span className="text-muted-foreground font-normal"> · {log.performedByName}</span>
                      </p>
                      {log.remarks && <p className="text-[12px] text-muted-foreground mt-0.5">{log.remarks}</p>}
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}

      {/* Generic Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={open => { if (!open) { setActionDialog(null); setActionRemarks(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{
              actionDialog === "submit"  ? "Submit PO for Approval" :
              actionDialog === "approve" ? "Approve Purchase Order" :
              actionDialog === "reject"  ? "Reject Purchase Order" :
              actionDialog === "revise"  ? "Revise & Resubmit PO" :
              actionDialog === "cancel"  ? "Cancel Purchase Order" :
              actionDialog === "hold"    ? "Place PO On Hold" :
              "Confirm Action"
            }</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {actionDialog === "approve" && (
              <p className="text-sm text-muted-foreground">You are approving <strong>{p.poNumber}</strong>. The PO will be locked and the requester notified.</p>
            )}
            {actionDialog === "submit" && (
              <p className="text-sm text-muted-foreground">Submit <strong>{p.poNumber}</strong> for approval. Your procurement approvers will be notified.</p>
            )}
            {actionDialog === "revise" && (
              <p className="text-sm text-muted-foreground">Unlocking <strong>{p.poNumber}</strong> for editing. A new revision will be created.</p>
            )}
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">
                {requiresReason ? "Reason *" : "Remarks (optional)"}
              </Label>
              <Textarea
                value={actionRemarks}
                onChange={e => setActionRemarks(e.target.value)}
                placeholder={
                  actionDialog === "reject"  ? "Explain why this PO is rejected…" :
                  actionDialog === "hold"    ? "Reason for placing on hold…" :
                  actionDialog === "cancel"  ? "Reason for cancellation…" :
                  "Optional remarks…"
                }
                rows={3} className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setActionRemarks(""); }}>Cancel</Button>
            <Button
              className={cn(
                actionDialog === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
                actionDialog === "reject" || actionDialog === "cancel" ? "bg-red-600 hover:bg-red-700 text-white" :
                "bg-primary hover:bg-primary/90 text-primary-foreground"
              )}
              onClick={handleActionConfirm}
              disabled={requiresReason && !actionRemarks.trim() || submitMut.isPending || approveMut.isPending || rejectMut.isPending || cancelMut.isPending || holdMut.isPending || reviseMut.isPending}
            >
              {actionDialog === "submit"  ? "Submit" :
               actionDialog === "approve" ? "Approve PO" :
               actionDialog === "reject"  ? "Reject" :
               actionDialog === "revise"  ? "Start Revision" :
               actionDialog === "cancel"  ? "Cancel PO" :
               actionDialog === "hold"    ? "Place On Hold" :
               "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel warning (GRNs exist) */}
      <AlertDialog open={showCancelWarning} onOpenChange={setShowCancelWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">⚠️ Active Deliveries Detected</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>This PO has <strong>{(p.grns ?? []).length} GRN(s)</strong>. Cancelling it may cause reconciliation issues.</p>
                <div className="bg-muted border border-border rounded-lg p-3">
                  <p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">Linked GRNs</p>
                  {(p.grns as any[]).map((g: any) => (
                    <div key={g.id} className="flex items-center justify-between text-sm">
                      <span className="font-mono font-semibold">{g.grnNumber}</span>
                      <span className="text-xs">{g.status}</span>
                    </div>
                  ))}
                </div>
                <p>Are you sure you want to cancel?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep PO Active</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { setShowCancelWarning(false); setActionDialog("cancel"); setActionRemarks(""); }}>
              Proceed to Cancel
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
              Closing <strong>{p.poNumber}</strong> will mark it as complete. All records become read-only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not Yet</AlertDialogCancel>
            <AlertDialogAction className="bg-slate-800 hover:bg-slate-900 text-white"
              onClick={() => {
                setShowCloseConfirm(false);
                closeMut.mutate({});
              }}>
              Close PO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </motion.div>
  );
}

/* ── Dispatch Section (reusable for Issued/Acknowledged) ─────────────────── */
function DispatchSection({ p, showDispatchForm, setShowDispatchForm, dispatchRef, setDispatchRef, trackingNum, setTrackingNum, expectedDelivery, setExpectedDelivery, dispatchMut, poId, user, invalidate, toast, colorClass }: any) {
  return (
    <div className={`border-t border-${colorClass}-200 pt-4`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-sm font-semibold text-${colorClass}-800`}>Vendor Dispatch Details</p>
        {!p.dispatchedAt && (
          <Button size="sm" variant="outline" className={`text-xs gap-1.5 border-${colorClass}-300 text-${colorClass}-700`}
            onClick={() => setShowDispatchForm(!showDispatchForm)}>
            <Truck className="w-3.5 h-3.5" /> {showDispatchForm ? "Cancel" : "Record Dispatch"}
          </Button>
        )}
      </div>
      {p.dispatchedAt ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className={`text-xs text-${colorClass}-700`}>Dispatched On</p><p className="font-medium">{new Date(p.dispatchedAt).toLocaleDateString("en-IN")}</p></div>
          <div><p className={`text-xs text-${colorClass}-700`}>Dispatch Ref</p><p className="font-medium">{p.vendorDispatchRef ?? "—"}</p></div>
          <div><p className={`text-xs text-${colorClass}-700`}>Tracking No.</p><p className="font-medium">{p.trackingNumber ?? "—"}</p></div>
          <div><p className={`text-xs text-${colorClass}-700`}>Expected Delivery</p><p className="font-medium">{p.expectedDeliveryDate ?? "—"}</p></div>
        </div>
      ) : showDispatchForm ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white rounded-lg p-3">
          <div><Label className="text-xs font-semibold text-slate-600 mb-1 block">Dispatch Ref</Label><Input value={dispatchRef} onChange={e => setDispatchRef(e.target.value)} placeholder="Vendor ref" className="h-9" /></div>
          <div><Label className="text-xs font-semibold text-slate-600 mb-1 block">Tracking Number</Label><Input value={trackingNum} onChange={e => setTrackingNum(e.target.value)} placeholder="AWB / LR" className="h-9" /></div>
          <div><Label className="text-xs font-semibold text-slate-600 mb-1 block">Expected Delivery</Label><Input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} className="h-9" /></div>
          <div className="flex items-end">
            <Button className="bg-orange-500 hover:bg-orange-600 h-9 w-full"
              onClick={() => {
                if (!dispatchRef && !trackingNum) { toast({ title: "Enter dispatch ref or tracking number", variant: "destructive" }); return; }
                dispatchMut.mutate(
                  { id: poId, data: { vendorDispatchRef: dispatchRef, trackingNumber: trackingNum, expectedDeliveryDate: expectedDelivery || undefined, userName: user.name, userId: user.id } as any },
                  { onSuccess: () => { invalidate(); setShowDispatchForm(false); toast({ title: "Dispatch recorded" }); }, onError: (e: any) => toast({ title: "Failed", description: e?.data?.error ?? e?.message, variant: "destructive" }) }
                );
              }}
              disabled={dispatchMut.isPending}>
              {dispatchMut.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <p className={`text-sm text-${colorClass}-600`}>No dispatch recorded yet.</p>
      )}
    </div>
  );
}

/* ── Version History Tab ────────────────────────────────────────────────────── */
function VersionHistoryTab({ versions }: { versions: any[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (versions.length === 0) return (
    <SectionCard title="Version History">
      <div className="flex flex-col items-center py-8 text-muted-foreground">
        <History className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm font-medium">No versions saved yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Versions are saved when you submit for approval or revise a rejected PO</p>
      </div>
    </SectionCard>
  );

  return (
    <SectionCard title="Version History" subtitle={`${versions.length} revision(s)`}>
      <div className="space-y-3">
        {versions.map(v => (
          <div key={v.id} className="border border-border rounded-lg overflow-hidden">
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
              onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-[11px] font-bold text-orange-700">
                  R{v.revisionNumber}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{v.changeSummary ?? `Revision ${v.revisionNumber}`}</p>
                  <p className="text-[11px] text-muted-foreground">{v.changedByName ?? "System"} · {new Date(v.changedAt).toLocaleString("en-IN")}</p>
                </div>
              </div>
              <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded === v.id && "rotate-90")} />
            </button>
            <AnimatePresence>
              {expanded === v.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/20">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-3">Snapshot at this revision</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      {v.snapshot?.header && Object.entries(v.snapshot.header).filter(([k]) => ["status", "totalAmount", "vendorName", "revisionNumber", "poDate"].includes(k)).map(([k, val]) => (
                        <div key={k} className="bg-white rounded p-2 border border-border">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k}</p>
                          <p className="font-semibold text-foreground">{String(val ?? "—")}</p>
                        </div>
                      ))}
                    </div>
                    {v.snapshot?.items?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">{v.snapshot.items.length} line item(s)</p>
                        <div className="space-y-1">
                          {v.snapshot.items.slice(0, 5).map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-white rounded p-1.5 border border-border">
                              <span>{item.materialName}</span>
                              <span className="font-mono text-muted-foreground">{item.qty} × ₹{Number(item.unitPrice ?? 0).toLocaleString("en-IN")}</span>
                            </div>
                          ))}
                          {v.snapshot.items.length > 5 && <p className="text-xs text-muted-foreground pl-1">+{v.snapshot.items.length - 5} more items</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
